-- The team is now two partners. Profit left after the re-up fund splits Hussein 75%, Dominic 20%,
-- investment fund 5%. Saved here so both partners see the same split; editable in Finance → This week.
-- Deliveries stay in the building, so there is no delivery role and no delivery cost.

alter table public.store_settings
  add column payout_splits jsonb not null default '{"hussein": 75, "dominic": 20, "investment": 5}'::jsonb;

update public.reup_fund set goal = 410 where status = 'active' and goal = 800;
