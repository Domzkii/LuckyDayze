-- LuckyDayze menu: 5 strains (1/8 $30, 1/4 $40, 1/2 $70, 1 oz $120) and 2 pre-rolls ($10, any 2 for $15).
-- Safe to run more than once: products that already exist by name are skipped.
-- Stock starts at 0. Set real amounts in Finance → This week → Start week; flower appears on the menu once it has stock.

insert into public.products (name, category, price, weight_prices, thc, strain_type, description, stock_grams, in_stock)
select v.name, v.category, v.price, v.weight_prices::jsonb, v.thc, v.strain_type, v.description, 0, true
from (values
  ('Grape Gas',        'Flower',    30, '{"3.5": 30, "7": 40, "14": 70, "28": 120}', '23%', 'Hybrid', 'Sweet grape up front, loud fuel on the finish. Relaxed but not stuck.'),
  ('Super Skittlez',   'Flower',    30, '{"3.5": 30, "7": 40, "14": 70, "28": 120}', '25%', 'Hybrid', 'A bag of fruit candy, sweet and tropical. Mellow, happy, easy evening smoke.'),
  ('Cherry Pop',       'Flower',    30, '{"3.5": 30, "7": 40, "14": 70, "28": 120}', '22%', 'Hybrid', 'Bright cherry and sugar, like soda candy. Upbeat and smooth.'),
  ('Motorbreath',      'Flower',    30, '{"3.5": 30, "7": 40, "14": 70, "28": 120}', '29%', 'Indica', 'Diesel and earthy kush, heavy and gassy. A nightcap that hits hard.'),
  ('Bubblegum Gelato', 'Flower',    30, '{"3.5": 30, "7": 40, "14": 70, "28": 120}', '19%', 'Hybrid', 'Creamy bubblegum sweetness with a smooth Gelato body. Calm and balanced.'),
  ('Pre-Roll (No Grabba)',   'Pre-Rolls', 10, '{}', null, 'Hybrid', 'A full pre-roll of this week’s flower.'),
  ('Pre-Roll (With Grabba)', 'Pre-Rolls', 10, '{}', null, 'Hybrid', 'This week’s flower, rolled with grabba leaf.')
) as v(name, category, price, weight_prices, thc, strain_type, description)
where not exists (select 1 from public.products p where lower(p.name) = lower(v.name));
