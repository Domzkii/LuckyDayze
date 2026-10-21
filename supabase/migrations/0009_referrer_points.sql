-- Sharing a referral code earns 25 points (was 50), added when the friend's first order is delivered.
-- Same complete_order as 0005 with only that number changed.

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
  d jsonb;
  paid_items int;
  points_to_add int;
  grams numeric;
  qty int;
  is_reward boolean;
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
    -- 1 point per $1 for everyone. (Member and House multipliers are on hold.)
    points_to_add := floor(o.total)::int;

    update public.loyalty
       set purchase_count = purchase_count + 1,
           total_spent = total_spent + o.total,
           points = points + points_to_add
     where id = l.id;

    if l.purchase_count = 0 and l.referred_by is not null then
      update public.loyalty
         set points = points + 25, referral_count = referral_count + 1
       where referral_code = l.referred_by;
    end if;
  else
    insert into public.loyalty (customer_phone, customer_name, purchase_count, total_spent, points, referral_code)
    values (o.customer_phone, o.customer_name, 1, o.total, floor(o.total)::int, public.new_referral_code());
  end if;

  -- Items: inventory, sold rows and reward rows
  select count(*) into paid_items
    from jsonb_array_elements(o.items) e
   where not coalesce((e ->> 'is_reward')::boolean, false);
  item_delivery := case when paid_items > 0 then coalesce(p_delivery_cost, 0) / paid_items else 0 end;

  for item in select * from jsonb_array_elements(o.items) loop
    qty := coalesce((item ->> 'qty')::int, 1);
    is_reward := coalesce((item ->> 'is_reward')::boolean, false);
    grams := coalesce((item ->> 'grams')::numeric, case when item ->> 'category' = 'Pre-Rolls' then 1 else 3.5 end) * qty;

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

    if is_reward then
      insert into public.sales (order_id, week_id, product_id, product_name, category, grams_sold, revenue,
                                inventory_cost, delivery_cost, net_profit, delivery_shares, kind, reward_type)
      values (
        o.id, week_id, nullif(item ->> 'product_id', '')::uuid, item ->> 'name', item ->> 'category', grams, 0,
        round(settings.cost_per_gram * grams, 2), 0, -round(settings.cost_per_gram * grams, 2), '{}'::jsonb,
        'reward', coalesce(item ->> 'reward_key', 'other')
      );
    else
      revenue := coalesce((item ->> 'line_total')::numeric, 0);
      insert into public.sales (order_id, week_id, product_id, product_name, category, grams_sold, revenue,
                                inventory_cost, delivery_cost, net_profit, delivery_shares, kind)
      values (
        o.id, week_id, nullif(item ->> 'product_id', '')::uuid, item ->> 'name', item ->> 'category', grams, revenue,
        round(settings.cost_per_gram * grams, 2), round(item_delivery, 2),
        round(revenue - settings.cost_per_gram * grams - item_delivery, 2),
        (select jsonb_object_agg(key, round(item_delivery * value::numeric / 100, 2)) from jsonb_each_text(splits)),
        'sale'
      );
    end if;
  end loop;

  -- Discounts: money given up on this order
  for d in select * from jsonb_array_elements(coalesce(o.discounts, '[]'::jsonb)) loop
    if coalesce((d ->> 'amount')::numeric, 0) > 0 then
      insert into public.sales (order_id, week_id, product_name, category, grams_sold, revenue,
                                inventory_cost, delivery_cost, net_profit, delivery_shares, kind, reward_type)
      values (
        o.id, week_id, d ->> 'label', 'Discount', 0, -(d ->> 'amount')::numeric,
        0, 0, -(d ->> 'amount')::numeric, '{}'::jsonb, 'discount', public.discount_kind(d)
      );
    end if;
  end loop;

  -- The best-selling strain carries the Popular badge.
  select s.product_id into top_product
    from public.sales s join public.products p on p.id = s.product_id
   where s.kind = 'sale' and s.category = 'Flower' and not p.archived
   group by s.product_id
   order by sum(s.grams_sold) desc
   limit 1;
  if top_product is not null then
    update public.products set is_popular = (id = top_product) where category = 'Flower';
  end if;
end;
$$;
