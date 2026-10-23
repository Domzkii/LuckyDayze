-- Hand sales: Hussein's dad sells in person and never uses the app, so a partner logs his sales
-- from Finance → This week. They are ordinary sales rows (same week, same profit split, same stock)
-- with no order behind them and a seller tag, so his numbers can be shown on their own.

alter table public.sales alter column order_id drop not null;
alter table public.sales add column seller text;

create index sales_seller_created on public.sales (seller, created_at) where seller is not null;

-- p_items: [{ "product_id": uuid, "grams": 3.5, "price": 20 }, ...], one entry per strain.
create or replace function public.log_hand_sale(p_items jsonb, p_seller text default 'hussein_dad')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  settings public.store_settings;
  week_id uuid;
  item jsonb;
  prod public.products;
  grams numeric;
  price numeric;
begin
  if not public.is_staff() then
    raise exception 'Only staff can log sales';
  end if;

  select id into week_id from public.weeks where status = 'active' limit 1;
  if week_id is null then
    raise exception 'Start a week before logging sales';
  end if;
  select * into settings from public.store_settings where id = 1;

  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    grams := coalesce((item ->> 'grams')::numeric, 0);
    price := coalesce((item ->> 'price')::numeric, 0);
    if grams <= 0 then
      continue;
    end if;

    select * into prod from public.products where id = (item ->> 'product_id')::uuid for update;
    if not found then
      raise exception 'Strain not found';
    end if;

    update public.products
       set stock_grams = greatest(0, stock_grams - grams),
           in_stock = case when category = 'Flower' then greatest(0, stock_grams - grams) > 0 else in_stock end
     where id = prod.id;

    insert into public.sales (order_id, week_id, product_id, product_name, category, grams_sold, revenue,
                              inventory_cost, delivery_cost, net_profit, delivery_shares, kind, seller)
    values (
      null, week_id, prod.id, prod.name, prod.category, grams, price,
      round(settings.cost_per_gram * grams, 2), 0,
      round(price - settings.cost_per_gram * grams, 2), '{}'::jsonb, 'sale', p_seller
    );
  end loop;
end;
$$;

-- Undo a hand sale logged by mistake: puts the weight back in stock. Only while its week is open.
create or replace function public.remove_hand_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.sales;
begin
  if not public.is_staff() then
    raise exception 'Only staff can remove sales';
  end if;

  select * into s from public.sales where id = p_sale_id and seller is not null for update;
  if not found then
    raise exception 'Hand sale not found';
  end if;
  if not exists (select 1 from public.weeks where id = s.week_id and status = 'active') then
    raise exception 'That week is closed, so its sales can no longer change';
  end if;

  if s.product_id is not null then
    update public.products
       set stock_grams = stock_grams + s.grams_sold,
           in_stock = case when category = 'Flower' then true else in_stock end
     where id = s.product_id;
  end if;

  delete from public.sales where id = s.id;
end;
$$;

grant execute on function public.log_hand_sale(jsonb, text) to authenticated;
grant execute on function public.remove_hand_sale(uuid) to authenticated;
