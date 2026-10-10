-- All strains: 1/8 $30, 1/4 $40, 1/2 $70, 1 oz $120.
update public.products
   set weight_prices = '{"3.5": 30, "7": 40, "14": 70, "28": 120}'::jsonb,
       price = 30
 where category = 'Flower';
