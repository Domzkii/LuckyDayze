-- Hussein's asks, 2026-11-05.
-- 1. A switch that closes the whole store. is_open only ever covered delivery, so it keeps that job.
alter table public.store_settings
  add column if not exists store_closed boolean not null default false;

-- 2. Two more strain types for products.
alter table public.products drop constraint if exists products_strain_type_check;
alter table public.products
  add constraint products_strain_type_check
  check (strain_type in ('Sativa', 'Indica', 'Hybrid', 'Sativa leaning hybrid', 'Indica leaning hybrid'));
