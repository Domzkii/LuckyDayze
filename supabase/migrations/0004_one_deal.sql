-- One deal per order, $7-off credit, real flower cost.
--   Spend $60 now earns 2 free pre-rolls or $7 off the next order (was 10% off).
--   Flower costs $350 per QP = $3.125/g.

update public.store_settings set cost_per_gram = 3.125 where id = 1;
alter table public.store_settings alter column cost_per_gram set default 3.125;

-- Credit is now a dollar amount. Anyone holding the old 10% gets $7.
alter table public.loyalty add column next_order_credit numeric(10, 2) not null default 0;
update public.loyalty set next_order_credit = 7 where next_order_credit_pct > 0;

alter table public.orders add column credit_used numeric(10, 2) not null default 0;
update public.orders set credit_used = 7 where credit_pct_used > 0;

create or replace function public.grant_order_credit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'delivered' and old.status <> 'delivered' and new.perk = 'credit' then
    update public.loyalty set next_order_credit = 7 where customer_phone = new.customer_phone;
  end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' and new.credit_used > 0 then
    update public.loyalty
       set next_order_credit = greatest(next_order_credit, new.credit_used)
     where customer_phone = new.customer_phone;
  end if;
  return new;
end;
$$;

alter table public.loyalty drop column next_order_credit_pct;
alter table public.orders drop column credit_pct_used;
