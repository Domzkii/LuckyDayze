-- Building-only delivery and spend perks.
--   $10 delivery minimum, no fee.
--   Spend $60: 2 free pre-rolls now, or 10% off the next order.
--   Spend $150: a free 1/8 (customer picks the strain).

alter table public.store_settings alter column delivery_minimum set default 10;
update public.store_settings set delivery_minimum = 10 where id = 1;

-- 10% off waiting for this customer's next order, earned when a $60+ order is delivered.
alter table public.loyalty add column next_order_credit_pct int not null default 0;

-- 'prerolls' | 'credit' | 'eighth' — which spend perk this order earned.
alter table public.orders add column perk text check (perk in ('prerolls', 'credit', 'eighth'));
-- Credit from a previous order that this order used up (given back if cancelled).
alter table public.orders add column credit_pct_used int not null default 0;

-- Delivered $60+ orders that chose "10% off next time" bank the credit.
create or replace function public.grant_order_credit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'delivered' and old.status <> 'delivered' and new.perk = 'credit' then
    update public.loyalty set next_order_credit_pct = 10 where customer_phone = new.customer_phone;
  end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' and new.credit_pct_used > 0 then
    update public.loyalty
       set next_order_credit_pct = greatest(next_order_credit_pct, new.credit_pct_used)
     where customer_phone = new.customer_phone;
  end if;
  return new;
end;
$$;

create trigger orders_credit_perk
after update of status on public.orders
for each row execute function public.grant_order_credit();
