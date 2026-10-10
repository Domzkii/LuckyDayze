# LuckyDayze

Cannabis delivery and pickup for Manhattan and Brooklyn. Next.js 16 on Vercel, Supabase for data, auth and photos, Resend for order emails.

## Pages

| Route | Who | What |
| --- | --- | --- |
| `/` | Customers | Menu, product details, cart |
| `/checkout` | Customers | Delivery, pickup or scheduled; places the order first, payment second |
| `/order/[id]` | Customers | Cash App payment, then live status (link is private to the customer) |
| `/track` | Customers | Orders from this device, or look up by phone |
| `/rewards` | Customers | Points, rewards, referral code, Member and House |
| `/admin` | Staff | Orders, scheduled orders, customers, membership, promos, pickup spots |
| `/finance` | Staff | Weekly books, payouts, re-up and investment funds, product catalog |

Customers never write to the database directly. Every customer action goes through `app/api/*`, which recomputes prices from the database (`lib/pricing.ts` is shared by the browser preview and the server). Staff sign in with Supabase Auth, and row-level security limits the data to people listed in `public.staff`.

## Set up a new Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste `supabase/migrations/0001_init.sql`, and run it. It creates the tables, security rules, the order functions, realtime, and the `products` photo bucket.
3. **Authentication → Providers → Email**: turn off "Allow new users to sign up" so only people you invite get accounts.
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

## How an order flows

1. Customer places the order at `/checkout`. Status: **pending payment**.
2. They pay the exact amount to $Luckydayz3 from their order page.
3. Staff move it along in `/admin`: payment received → preparing → out for delivery (or ready for pickup) → delivered.
4. **Delivered** runs `complete_order()` once: loyalty points, referral bonus, inventory, sales rows for finance, and the Popular badge. Running it twice does nothing.
5. **Cancel** runs `cancel_order()`, which gives back any points spent on a reward.

Scheduled orders wait in **Scheduled** until staff queue them. Recurring ones roll forward to their next date.
