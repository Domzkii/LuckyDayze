-- 1 oz (8 eighths, 28g) of each strain until Big Huss confirms the real amount.
update public.products set stock_grams = 28, in_stock = true where category = 'Flower' and not archived;
update public.weeks
   set new_grams_added = (select coalesce(sum(stock_grams), 0) from public.products where category = 'Flower' and not archived)
 where status = 'active';
