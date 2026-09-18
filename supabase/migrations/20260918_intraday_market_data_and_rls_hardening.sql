-- Intraday market-data foundation and RLS event-trigger hardening.
-- Idempotent so it is safe to apply to the existing production project.

create table if not exists public.intraday_price_history (
  ticker text not null,
  interval_minutes smallint not null default 15,
  bar_timestamp timestamptz not null,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  volume numeric,
  source text not null default 'tradingview',
  retrieved_at timestamptz not null default now(),
  constraint intraday_price_history_interval_check check (interval_minutes = 15),
  constraint intraday_price_history_close_check check (close > 0),
  constraint intraday_price_history_ohlc_check check (
    high >= greatest(open, close, low)
    and low <= least(open, close, high)
  ),
  primary key (ticker, interval_minutes, bar_timestamp)
);

create index if not exists intraday_price_history_timestamp_idx
  on public.intraday_price_history (bar_timestamp desc);

alter table public.intraday_price_history enable row level security;

revoke all on table public.intraday_price_history from public, anon, authenticated;
grant select on table public.intraday_price_history to authenticated;
grant select, insert, update, delete on table public.intraday_price_history to service_role;

drop policy if exists "authenticated intraday price read"
  on public.intraday_price_history;

create policy "authenticated intraday price read"
on public.intraday_price_history
for select
to authenticated
using (true);

-- rls_auto_enable() is an internal SECURITY DEFINER event-trigger function.
-- API roles do not need direct EXECUTE privileges for the event trigger to run.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;
