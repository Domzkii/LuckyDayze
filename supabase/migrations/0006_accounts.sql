-- Optional customer accounts and special prices.
--   Accounts: email + password, no confirmation emails. Guest checkout stays.
--     Building residents sign up with their apartment number.
--     Friends outside the building sign up through an invite link and give a street address.
--   Special prices: named price lists ("Lamar") staff can create, edit and assign to accounts.
--     A list sets flower prices by size; sizes it leaves out stay at the regular price.
-- Customers never touch these tables directly: the API routes do, with the service key.
-- Run once in Supabase → SQL Editor.

create table public.price_lists (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  -- Flower prices by size, e.g. {"14": 65, "28": 120}.
  prices jsonb not null default '{}'::jsonb
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  email text not null,
  name text not null,
  phone text not null unique,
  kind text not null check (kind in ('building', 'friend')),
  apt text,
  street_address text,
  price_list_id uuid references public.price_lists (id) on delete set null
);

-- One link per friend. Used once; can carry a price list that applies on sign-up.
create table public.invites (
  code text primary key,
  created_at timestamptz not null default now(),
  note text,
  price_list_id uuid references public.price_lists (id) on delete set null,
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz
);

alter table public.price_lists enable row level security;
alter table public.profiles enable row level security;
alter table public.invites enable row level security;

create policy "staff all price_lists" on public.price_lists for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all profiles" on public.profiles for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all invites" on public.invites for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Lamar's deal, ready to assign.
insert into public.price_lists (name, prices) values ('Lamar', '{"14": 65, "28": 120}');
