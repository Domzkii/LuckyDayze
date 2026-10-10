-- Week 1 numbers from Big Huss (Oct 8).
--   1/8 $30, 1/4 $40, 1/2 $70, 1 oz $120 for every strain.
--   1 oz (8 eighths, 28g) of each strain on hand. Pending confirmation from Big Huss.
--   Re-up goal $350.

update public.products
   set weight_prices = '{"3.5": 30, "7": 40, "14": 70, "28": 120}'::jsonb,
       price = 30,
       stock_grams = 28,
       in_stock = true
 where category = 'Flower' and not archived;

update public.weeks
   set new_grams_added = (select coalesce(sum(stock_grams), 0) from public.products where category = 'Flower' and not archived)
 where status = 'active';

update public.reup_fund set goal = 350 where status = 'active';
