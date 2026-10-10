-- LuckyDayze schema.
-- Run once against a fresh Supabase project (SQL editor or `supabase db push`).
--
-- Access model
--   anon (customers)  read the public catalog only: products, store status, pickup
--                     locations, the active sale. Every customer write goes through
--                     the Next.js API routes, which use the service-role key and
--                     recompute prices server-side.
--   staff             any auth user listed in public.staff. Full read/write.
--                     Add yourself after creating your login:
--                       insert into public.staff (user_id) select id from auth.users where email = 'you@example.com';

-- ─── Staff ──────────────────────────────────────────────────────────────────

create table public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

-- ─── Catalog ────────────────────────────────────────────────────────────────

create table public.products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  category text not null check (category in ('Flower', 'Pre-Rolls')),
  -- Pre-rolls: unit price. Flower: fallback 1/8 price when weight_prices is empty.
  price numeric(10, 2) not null default 0,
  -- Flower only: { "3.5": 30, "7": 55, "14": 100, "28": 180 }
  weight_prices jsonb not null default '{}'::jsonb,
  thc text,
  strain_type text not null default 'Hybrid' check (strain_type in ('Sativa', 'Indica', 'Hybrid')),
  description text,
  stock_grams numeric(10, 2) not null default 0,
  in_stock boolean not null default true,
  is_popular boolean not null default false,
  archived boolean not null default false,
  image_urls text[] not null default '{}'
);

create table public.store_settings (
  id int primary key default 1 check (id = 1),
  is_open boolean not null default true,
  delivery_minimum numeric(10, 2) not null default 25,
  -- Wholesale cost used for profit math ($400 per QP by default).
  cost_per_gram numeric(10, 4) not null default 3.5714,
  updated_at timestamptz not null default now()
);
insert into public.store_settings (id) values (1);

create table public.pickup_locations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  borough text not null,
  address text not null,
  description text,
  is_active boolean not null default true
);

create table public.sales_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  discount_type text not null check (discount_type in ('percent', 'dollar')),
  discount_value numeric(10, 2) not null check (discount_value > 0),
  applies_to text not null default 'all' check (applies_to in ('all', 'flower', 'prerolls')),
  is_active boolean not null default false
);
-- At most one live sale at a time.
create unique index sales_events_one_active on public.sales_events (is_active) where is_active;

-- ─── Customers ──────────────────────────────────────────────────────────────

create table public.loyalty (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_phone text not null unique,
  customer_name text not null,
  email text,
  birthday text,
  points int not null default 0,
  purchase_count int not null default 0,
  total_spent numeric(10, 2) not null default 0,
  membership_tier text not null default 'guest' check (membership_tier in ('guest', 'member', 'house')),
  membership_requested text check (membership_requested in ('member', 'house')),
  house_paid_until date,
  referral_code text not null unique,
  referred_by text,
  referral_count int not null default 0,
  pending_referral_reward text
);

create table public.membership_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_phone text not null,
  customer_name text not null,
  customer_email text,
  customer_birthday text,
  requested_tier text not null check (requested_tier in ('member', 'house')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined'))
);

-- ─── Orders ─────────────────────────────────────────────────────────────────

-- items: [{ product_id, name, category, weight, grams, qty, unit_price, line_total, is_reward, reward_key }]
-- discounts: [{ label, amount }]
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  fulfillment text not null check (fulfillment in ('delivery', 'pickup', 'scheduled')),
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')),
  customer_name text not null,
  customer_phone text not null,
  customer_address text,
  pickup_location_id uuid references public.pickup_locations (id) on delete set null,
  pickup_location_address text,
  order_notes text,
  cash_tag text,
  items jsonb not null,
  subtotal numeric(10, 2) not null,
  discounts jsonb not null default '[]'::jsonb,
  total numeric(10, 2) not null,
  referral_code text,
  referral_reward text,
  reward_key text,
  reward_points int not null default 0,
  scheduled_order_id uuid,
  customer_arrived boolean not null default false,
  delivery_cost numeric(10, 2),
  delivered_at timestamptz
);
create index orders_phone_idx on public.orders (customer_phone, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);

create table public.scheduled_orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  customer_name text not null,
  customer_phone text not null,
  customer_address text not null,
  order_notes text,
  cash_tag text,
  items jsonb not null,
  subtotal numeric(10, 2) not null,
  discounts jsonb not null default '[]'::jsonb,
  total numeric(10, 2) not null,
  -- The next delivery. Recurring orders roll this forward each time one is queued.
  delivery_date date not null,
  delivery_time_window text,
  frequency text not null default 'once' check (frequency in ('once', 'weekly', 'biweekly', 'monthly')),
  recurring_count int not null default 0,
  referral_code text,
  referral_reward text
);

-- ─── Finance ────────────────────────────────────────────────────────────────

create table public.weeks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  week_number int not null,
  start_date date not null default current_date,
  end_date date,
  carried_over_grams numeric(10, 2) not null default 0,
  new_grams_added numeric(10, 2) not null default 0,
  total_revenue numeric(10, 2),
  total_profit numeric(10, 2),
  total_delivery_costs numeric(10, 2),
  total_grams_sold numeric(10, 2),
  status text not null default 'active' check (status in ('active', 'closed'))
);
create unique index weeks_one_active on public.weeks (status) where status = 'active';

-- One row per delivered line item.
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  order_id uuid not null references public.orders (id) on delete cascade,
  week_id uuid references public.weeks (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  category text not null,
  grams_sold numeric(10, 2) not null,
  revenue numeric(10, 2) not null,
  inventory_cost numeric(10, 2) not null,
  delivery_cost numeric(10, 2) not null,
  net_profit numeric(10, 2) not null,
  delivery_shares jsonb not null default '{}'::jsonb
);

create table public.week_payouts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  week_id uuid not null references public.weeks (id) on delete cascade,
  role text not null,
  gross_payout numeric(10, 2) not null,
  delivery_contribution numeric(10, 2) not null,
  net_payout numeric(10, 2) not null
);

create table public.reup_fund (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  week_id uuid references public.weeks (id) on delete set null,
  goal numeric(10, 2) not null default 800,
  current_balance numeric(10, 2) not null default 0,
  status text not null default 'active' check (status in ('active', 'completed'))
);

create table public.investment_fund (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  week_id uuid references public.weeks (id) on delete set null,
  contribution numeric(10, 2) not null,
  running_total numeric(10, 2) not null,
  week_revenue numeric(10, 2) not null
);

-- ─── Order lifecycle ────────────────────────────────────────────────────────

-- Marks an order delivered and books everything that follows from it, once.
-- Safe to call twice: a second call on a delivered order does nothing.
create or replace function public.complete_order(p_order_id uuid, p_delivery_cost numeric default 0)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  l public.loyalty;
  settings public.store_settings;
  week_id uuid;
  item jsonb;
  paid_items int;
  points_to_add int;
  grams numeric;
  qty int;
  revenue numeric;
  item_delivery numeric;
  target_product uuid;
  top_product uuid;
  splits constant jsonb := '{"ceo": 35, "cfo": 20, "acquisitions": 25, "delivery": 20}';
begin
  if not public.is_staff() then
    raise exception 'Only staff can complete orders';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;
  if o.status in ('delivered', 'cancelled') then
    return;
  end if;

  select * into settings from public.store_settings where id = 1;
  select id into week_id from public.weeks where status = 'active' limit 1;

  update public.orders
     set status = 'delivered', delivered_at = now(), delivery_cost = coalesce(p_delivery_cost, 0)
   where id = o.id;

  -- Loyalty
  select * into l from public.loyalty where customer_phone = o.customer_phone for update;
  if found then
    points_to_add := floor(o.total)::int *
      case when l.membership_tier = 'house' or (l.membership_tier = 'member' and o.total >= 50) then 2 else 1 end;

    update public.loyalty
       set purchase_count = purchase_count + 1,
           total_spent = total_spent + o.total,
           points = points + points_to_add
     where id = l.id;

    if l.purchase_count = 0 and l.referred_by is not null then
      update public.loyalty
         set points = points + 50, referral_count = referral_count + 1
       where referral_code = l.referred_by;
    end if;
  else
    insert into public.loyalty (customer_phone, customer_name, purchase_count, total_spent, points, referral_code)
    values (o.customer_phone, o.customer_name, 1, o.total, floor(o.total)::int, public.new_referral_code());
  end if;

  -- Inventory and per-item sales rows
  select count(*) into paid_items
    from jsonb_array_elements(o.items) e
   where not coalesce((e ->> 'is_reward')::boolean, false);
  item_delivery := case when paid_items > 0 then coalesce(p_delivery_cost, 0) / paid_items else 0 end;

  for item in select * from jsonb_array_elements(o.items) loop
    qty := coalesce((item ->> 'qty')::int, 1);
    grams := coalesce((item ->> 'grams')::numeric, case when item ->> 'category' = 'Pre-Rolls' then 1 else 3.5 end) * qty;
    revenue := case when coalesce((item ->> 'is_reward')::boolean, false) then 0 else coalesce((item ->> 'line_total')::numeric, 0) end;

    -- Pre-rolls are rolled from whichever strain has the most stock.
    if item ->> 'category' = 'Pre-Rolls' then
      select id into target_product from public.products
       where category = 'Flower' and not archived
       order by stock_grams desc limit 1;
    else
      target_product := nullif(item ->> 'product_id', '')::uuid;
    end if;

    if target_product is not null then
      update public.products
         set stock_grams = greatest(0, stock_grams - grams),
             in_stock = case when category = 'Flower' then greatest(0, stock_grams - grams) > 0 else in_stock end
       where id = target_product;
    end if;

    if not coalesce((item ->> 'is_reward')::boolean, false) then
      insert into public.sales (order_id, week_id, product_id, product_name, category, grams_sold, revenue,
                                inventory_cost, delivery_cost, net_profit, delivery_shares)
      values (
        o.id, week_id, nullif(item ->> 'product_id', '')::uuid, item ->> 'name', item ->> 'category', grams, revenue,
        round(settings.cost_per_gram * grams, 2), round(item_delivery, 2),
        round(revenue - settings.cost_per_gram * grams - item_delivery, 2),
        (select jsonb_object_agg(key, round(item_delivery * value::numeric / 100, 2)) from jsonb_each_text(splits))
      );
    end if;
  end loop;

  -- The best-selling strain carries the Popular badge.
  select s.product_id into top_product
    from public.sales s join public.products p on p.id = s.product_id
   where s.category = 'Flower' and not p.archived
   group by s.product_id
   order by sum(s.grams_sold) desc
   limit 1;
  if top_product is not null then
    update public.products set is_popular = (id = top_product) where category = 'Flower';
  end if;
end;
$$;

-- Cancels an order and gives back any points spent on a reward in it.
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
begin
  if not public.is_staff() then
    raise exception 'Only staff can cancel orders';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found or o.status in ('delivered', 'cancelled') then
    return;
  end if;

  update public.orders set status = 'cancelled' where id = o.id;
  if o.reward_points > 0 then
    update public.loyalty set points = points + o.reward_points where customer_phone = o.customer_phone;
  end if;
end;
$$;

-- Turns the next occurrence of a scheduled order into a live order.
-- One-time orders complete; recurring ones roll forward to their next date.
create or replace function public.queue_scheduled_order(p_scheduled_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.scheduled_orders;
  new_order_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Only staff can queue orders';
  end if;

  select * into s from public.scheduled_orders where id = p_scheduled_id for update;
  if not found or s.status <> 'pending' then
    raise exception 'Scheduled order is not pending';
  end if;

  insert into public.orders (fulfillment, status, customer_name, customer_phone, customer_address, order_notes,
                             cash_tag, items, subtotal, discounts, total, referral_code, referral_reward,
                             scheduled_order_id)
  values ('scheduled', 'confirmed', s.customer_name, s.customer_phone, s.customer_address, s.order_notes,
          s.cash_tag, s.items, s.subtotal, s.discounts, s.total,
          case when s.recurring_count = 0 then s.referral_code end,
          case when s.recurring_count = 0 then s.referral_reward end,
          s.id)
  returning id into new_order_id;

  if s.frequency = 'once' then
    update public.scheduled_orders set status = 'completed', recurring_count = recurring_count + 1 where id = s.id;
  else
    update public.scheduled_orders
       set recurring_count = recurring_count + 1,
           delivery_date = s.delivery_date + case s.frequency
             when 'weekly' then interval '7 days'
             when 'biweekly' then interval '14 days'
             else interval '1 month'
           end
     where id = s.id;

    -- Three recurring deliveries earns an invitation to Member.
    if s.recurring_count + 1 >= 3 then
      update public.loyalty
         set membership_requested = 'member'
       where customer_phone = s.customer_phone and membership_tier = 'guest' and membership_requested is null;
    end if;
  end if;

  return new_order_id;
end;
$$;

create or replace function public.new_referral_code()
returns text
language sql
volatile
as $$
  select upper(substr(translate(md5(random()::text || clock_timestamp()::text), '01', ''), 1, 6));
$$;

-- ─── Row-level security ─────────────────────────────────────────────────────

alter table public.staff enable row level security;
alter table public.products enable row level security;
alter table public.store_settings enable row level security;
alter table public.pickup_locations enable row level security;
alter table public.sales_events enable row level security;
alter table public.loyalty enable row level security;
alter table public.membership_requests enable row level security;
alter table public.orders enable row level security;
alter table public.scheduled_orders enable row level security;
alter table public.weeks enable row level security;
alter table public.sales enable row level security;
alter table public.week_payouts enable row level security;
alter table public.reup_fund enable row level security;
alter table public.investment_fund enable row level security;

-- Staff can see that they are staff.
create policy "staff read self" on public.staff for select to authenticated using (user_id = auth.uid());

-- Public catalog
create policy "public read products" on public.products for select to anon, authenticated using (not archived or public.is_staff());
create policy "public read store settings" on public.store_settings for select to anon, authenticated using (true);
create policy "public read pickup locations" on public.pickup_locations for select to anon, authenticated using (is_active or public.is_staff());
create policy "public read active sale" on public.sales_events for select to anon, authenticated using (is_active or public.is_staff());

-- Staff: everything
do $$
declare t text;
begin
  foreach t in array array[
    'products', 'store_settings', 'pickup_locations', 'sales_events', 'loyalty', 'membership_requests',
    'orders', 'scheduled_orders', 'weeks', 'sales', 'week_payouts', 'reup_fund', 'investment_fund'
  ] loop
    execute format('create policy "staff all %1$s" on public.%1$I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;

grant execute on function public.complete_order(uuid, numeric) to authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;
grant execute on function public.queue_scheduled_order(uuid) to authenticated;
revoke execute on function public.complete_order(uuid, numeric) from anon, public;
revoke execute on function public.cancel_order(uuid) from anon, public;
revoke execute on function public.queue_scheduled_order(uuid) from anon, public;

-- ─── Realtime (admin live order feed) ───────────────────────────────────────

alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.scheduled_orders;
alter publication supabase_realtime add table public.store_settings;

-- ─── Storage: product photos ────────────────────────────────────────────────

insert into storage.buckets (id, name, public) values ('products', 'products', true)
on conflict (id) do nothing;

create policy "public read product photos" on storage.objects
  for select to anon, authenticated using (bucket_id = 'products');
create policy "staff upload product photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'products' and public.is_staff());
create policy "staff update product photos" on storage.objects
  for update to authenticated using (bucket_id = 'products' and public.is_staff());
create policy "staff delete product photos" on storage.objects
  for delete to authenticated using (bucket_id = 'products' and public.is_staff());
