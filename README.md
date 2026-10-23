# LuckyDayze

Cannabis delivery and pickup for residents of one building, plus invited friends outside it. Next.js 16 on Vercel, Supabase for data, auth and photos, Resend for order emails, web push for staff phone alerts.

## Pages

| Route | Who | What |
| --- | --- | --- |
| `/` | Customers | Menu, product details, cart |
| `/checkout` | Customers | Delivery, pickup or scheduled; places the order first, payment second |
| `/order/[id]` | Customers | Payment (Cash App, Zelle, Apple Pay or cash), then live status (link is private to the customer) |
| `/track` | Customers | Orders from this device, or look up by phone |
| `/rewards` | Customers | Points, rewards, referral code |
| `/app` | Customers | How to add LuckyDayze to the home screen (iPhone, Android, desktop) |
| `/account` | Customers | Optional account: sign in, sign up (invite links for friends), their details and special prices |
| `/admin` | Staff | Orders, scheduled orders, customers, accounts and special prices, promos. Saved to the home screen it installs as its own app, **LD Office**, with push alerts |
| `/finance` | Staff | Weekly books, the partner split, re-up and investment funds, product catalog |

Customers never write to the database directly. Every customer action goes through `app/api/*`, which recomputes prices from the database (`lib/pricing.ts` is shared by the browser preview and the server). Staff sign in with Supabase Auth, and row-level security limits the data to people listed in `public.staff`.

## Set up a new Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run each file in `supabase/migrations/` in order (`0001` → `0012`). `0001_init.sql` creates the tables, security rules, the order functions, realtime, and the `products` photo bucket; the later files layer on pricing, the one-deal rule, the October tweaks, customer accounts, staff push alerts (`0007`), the two-partner split (`0008`) referrer points (`0009`), Apple Pay as a payment method (`0010`), hand-logged sales for Hussein’s dad (`0011`) and his secret 8ths page plus QR tagging (`0012`).
3. **Authentication → Providers → Email**: turn off "Allow new users to sign up". Customer accounts are created by `/api/account/signup` with the service key, already confirmed, so no emails are sent and this setting can stay off.
4. **Authentication → Users → Add user**: create a login for each staff member.
5. Make them staff (SQL Editor):
   ```sql
   insert into public.staff (user_id)
   select id from auth.users where email in ('you@example.com');
   ```
6. Copy `.env.example` to `.env.local` and fill it in from **Project Settings → API**. Add the same variables in Vercel → Project → Settings → Environment Variables.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run lint
```

`building-revamp` is the working branch. Pushing it to `main` (`git push origin building-revamp:main`) deploys to production at luckydayzenyc.com (www and lucky-dayze.vercel.app redirect there).

## How an order flows

1. Customer places the order at `/checkout`. Status: **pending payment**.
2. They pay from their order page: Cash App to $Luckydayz3, Zelle with the order code in the memo, or Apple Cash from Messages to the Zelle number with the code in the message. Cash orders wait for staff to approve them, then are collected at the door.
3. Staff move it along in `/admin`: payment received → preparing → out for delivery (or ready for pickup) → delivered. **Mark delivered** is one tap; deliveries stay in the building, so no delivery cost is recorded.
4. **Delivered** runs `complete_order()` once: loyalty points, referral bonus, inventory, sales rows for finance, and the Popular badge. Running it twice does nothing.
5. **Cancel** runs `cancel_order()`, which gives back any points spent on a reward.

Signed-in customers send their session token with the order. The server looks up their profile: friends outside the building deliver to their street address, and a special price list (Admin → Accounts) competes as the order's one deal.

**Welcome offer** (`WELCOME_OFFER` in `lib/pricing.ts`): $5 off a signed-in account's first order, on top of the one deal. It only applies on the account's own phone number, for delivery or pickup, when that number has no earlier order that wasn't cancelled. It switches itself off at `endsAt`. To run it again, move `endsAt` (and the `through` wording) and deploy.

Scheduled orders wait in **Scheduled** until staff queue them. Recurring ones roll forward to their next date.

## Order alerts

Every new order (`app/api/orders`) sends two alerts at once. Neither can fail the order.

- **Email** (`lib/server/notify.ts`) through Resend, from `ORDER_NOTIFY_FROM` (orders@luckydayzenyc.com, verified in Resend) to every address in `ORDER_NOTIFY_EMAIL` (comma-separated).
- **Push** (`lib/server/push.ts`) to every device in `push_subscriptions`. Staff turn it on per device with **Turn on alerts** in the admin header (☰ menu on phones), which registers `public/sw.js` and sends a test push to that device only. iPhones need the back office saved to the home screen first (`app/admin/layout.tsx` points it at `public/office-manifest.json`). Devices that bounce (404/410) are removed automatically. Needs `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`.

## Weekly books and payouts

1. **Start week** (Finance → This week): stock per strain in ounces, which replaces what's on hand, plus the re-up goal.
2. Each delivered order books its revenue and profit at `store_settings.cost_per_gram` (set in SQL; currently $2.9286/g from a $410 re-up for 5 oz).
3. **Close week**: profit fills the re-up fund first. What's left splits by `store_settings.payout_splits`, by default **Hussein 75%, Dominic 20%, investment fund 5%**. The split is edited with the sliders in This week and saved for both partners (**Save split**). Closing writes `week_payouts` (one row per partner) and the investment contribution, and can't be undone.

Weeks closed before the two-partner split still show their old roles (CEO, CFO, Acquisitions, Delivery runner) in History.

## Accounts and special prices

Accounts are optional; guests can still order. Staff manage everything in **Admin → Accounts**:

- **Price lists**: named sets of prices per size (e.g. `{"14":65,"28":120}`). Assign one to an account to give that person their own prices. Special prices count as the order's one deal, so they don't stack with the spend perk or promos.
- **Invite links**: `/account?invite=CODE`, optionally tied to a price list that is applied when the friend signs up. Each link works once.
- **Passwords**: staff can reset a customer's password from the account row.

At sign-up people choose "In the building" (apartment) or "Somewhere else" (street address). Anyone can pick "Somewhere else"; there is no approval step yet.

## Home-screen install

`lib/install.ts` detects the platform and whether the app is already installed, and wraps Android/desktop `beforeinstallprompt`. `components/install.tsx` holds the step-by-step guide used on `/app`, the after-order card, and the menu banner (phones only, shows after 3s, hides after 10s, at most twice per device via `localStorage.ld_install`). iPhone steps follow iOS 27 Safari (≡ → Share → View More → Add to Home Screen), with a note for older iPhones.
