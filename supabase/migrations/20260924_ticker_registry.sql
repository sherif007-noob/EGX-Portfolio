-- Authoritative EGX security identity registry.
-- Quote/technical snapshots remain in public.tickers; this registry is service-managed identity data.

create table if not exists public.ticker_registry (
  ticker text primary key,
  name_en text not null default '',
  name_ar text not null default '',
  isin text not null default '',
  sector text not null default 'Other',
  market_sector text,
  industry text,
  logo_url text,
  currency text not null default 'EGP',
  status text not null default 'unresolved'
    check (status in ('active','inactive','retired','unresolved')),
  scanner_symbol text,
  history_symbol text,
  history_resolution_method text,
  resolution_attempts jsonb not null default '[]'::jsonb,
  verification_error text,
  metadata_source text not null default 'legacy-tickers',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz,
  missing_since timestamptz,
  history_verified_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists ticker_registry_isin_idx
  on public.ticker_registry (isin)
  where isin <> '';

create index if not exists ticker_registry_status_idx
  on public.ticker_registry (status);

create index if not exists ticker_registry_history_verified_idx
  on public.ticker_registry (history_verified_at nulls first);

create table if not exists public.ticker_aliases (
  alias text primary key,
  canonical_ticker text not null references public.ticker_registry(ticker)
    on update cascade on delete cascade,
  alias_type text not null
    check (alias_type in ('legacy','renamed','scanner','isin')),
  source text not null default 'reconciliation',
  first_seen_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  check (alias <> canonical_ticker)
);

create index if not exists ticker_aliases_canonical_idx
  on public.ticker_aliases (canonical_ticker);

alter table public.ticker_registry enable row level security;
alter table public.ticker_aliases enable row level security;

drop policy if exists "authenticated ticker registry read" on public.ticker_registry;
create policy "authenticated ticker registry read"
  on public.ticker_registry
  for select
  to authenticated
  using (true);

drop policy if exists "authenticated ticker aliases read" on public.ticker_aliases;
create policy "authenticated ticker aliases read"
  on public.ticker_aliases
  for select
  to authenticated
  using (true);

revoke all on table public.ticker_registry from anon;
revoke all on table public.ticker_aliases from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.ticker_registry from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.ticker_aliases from authenticated;
grant select on table public.ticker_registry to authenticated;
grant select on table public.ticker_aliases to authenticated;

insert into public.ticker_registry (
  ticker,
  name_en,
  name_ar,
  isin,
  sector,
  logo_url,
  status,
  scanner_symbol,
  metadata_source,
  first_seen_at,
  last_seen_at,
  updated_at
)
select
  upper(regexp_replace(regexp_replace(t.ticker, '^EGX:', ''), '\.CA$', '')),
  coalesce(t.name_en, ''),
  coalesce(t.name_ar, ''),
  coalesce(t.isin, ''),
  coalesce(nullif(t.sector, ''), 'Other'),
  t.logo_url,
  'unresolved',
  upper(regexp_replace(regexp_replace(t.ticker, '^EGX:', ''), '\.CA$', '')),
  'legacy-tickers',
  coalesce(t.last_updated, t.updated_at, now()),
  t.last_updated,
  coalesce(t.updated_at, now())
from public.tickers t
where coalesce(t.ticker, '') <> ''
on conflict (ticker) do nothing;
