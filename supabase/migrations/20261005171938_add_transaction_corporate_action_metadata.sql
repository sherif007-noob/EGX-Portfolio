alter table public.transactions
  add column if not exists corporate_action_type text,
  add column if not exists corporate_action_ratio numeric,
  add column if not exists corporate_action_source_shares numeric,
  add column if not exists corporate_action_reference text;

alter table public.transactions
  drop constraint if exists transactions_corporate_action_ratio_nonnegative,
  add constraint transactions_corporate_action_ratio_nonnegative
    check (corporate_action_ratio is null or corporate_action_ratio >= 0);

alter table public.transactions
  drop constraint if exists transactions_corporate_action_source_shares_nonnegative,
  add constraint transactions_corporate_action_source_shares_nonnegative
    check (corporate_action_source_shares is null or corporate_action_source_shares >= 0);
