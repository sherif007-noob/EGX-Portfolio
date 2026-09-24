-- Allow the intraday table to store the migration's raw 1-minute,
-- derived 5-minute, and legacy 15-minute resolutions.
-- Backward compatible with the existing primary key and RLS policies.

alter table public.intraday_price_history
  drop constraint if exists intraday_price_history_interval_check;

alter table public.intraday_price_history
  add constraint intraday_price_history_interval_check
  check (interval_minutes in (1, 5, 15));
