-- Apple Pay (Apple Cash sent from Messages) as a fourth way to pay.
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders
  add constraint orders_payment_method_check check (payment_method in ('cashapp', 'zelle', 'applepay', 'cash'));

alter table public.scheduled_orders drop constraint if exists scheduled_orders_payment_method_check;
alter table public.scheduled_orders
  add constraint scheduled_orders_payment_method_check check (payment_method in ('cashapp', 'zelle', 'applepay', 'cash'));
