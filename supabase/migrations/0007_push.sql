-- Phone push alerts for staff. One row per device that tapped "Turn on alerts" in the back office.
-- The server (service role) reads these to send a push on every new order; dead devices are removed when a push bounces.

create table public.push_subscriptions (
  endpoint text primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  user_agent text
);

alter table public.push_subscriptions enable row level security;
create policy "staff all push_subscriptions" on public.push_subscriptions for all to authenticated using (public.is_staff()) with check (public.is_staff());
