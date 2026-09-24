# EGX Ticker Registry

## Purpose

The ticker directory is no longer treated as a static application dictionary.

The authoritative identity layer is now service-managed in Supabase:

- `public.ticker_registry` — canonical security identity and resolver state;
- `public.ticker_aliases` — historical/renamed symbols and ISIN aliases;
- `public.tickers` — quote/technical snapshot table retained for market prices and indicators.

This split prevents browser price persistence from corrupting security identity.

## Identity precedence

For current security identity, precedence is:

```text
live Supabase registry
  -> TradingView Scanner discovery / current symbol
  -> persisted registry metadata
  -> static baseline fallback
```

For EGX sector taxonomy, a known curated EGX classification outranks TradingView's generic global industry taxonomy. TradingView classification is a fallback only when the security has no known EGX-sector mapping.

A symbol currently present in the live scanner universe is canonical for that reconciliation pass. A stale hardcoded alias must never override an active live symbol.

The static dictionary remains useful for:

- Arabic-name fallback;
- offline bootstrapping;
- historical legacy imports;
- sector/ISIN fallback when live metadata is absent.

It is no longer the authoritative current EGX directory.

## Reconciliation job

Command:

```bash
npm run sync:ticker-registry
```

Workflow:

```text
.github/workflows/ticker-registry.yml
```

The worker:

1. downloads the TradingView Egypt Scanner universe;
2. normalizes active EGP securities;
3. refreshes name, ISIN, sector, industry, logo and scanner symbol;
4. detects disappear/appear rename pairs when a unique ISIN moves to a new ticker;
5. stores historical ticker aliases;
6. stores unique ISIN aliases;
7. prevents an active scanner symbol from being treated as a legacy alias;
8. marks missing securities inactive only after a grace period;
9. keeps explicit retired/renamed identities for historical lookup;
10. verifies a rotating set of history symbols through the TradingView chart resolver;
11. records the successful history symbol, method, attempts and verification timestamp.

Default verification policy:

- up to 100 active securities per run;
- reverify after 30 days;
- mark a scanner-missing security inactive after 14 days unless it is a known retirement/rename.

Environment overrides:

```env
EGX_TICKER_VERIFY_LIMIT=100
EGX_TICKER_VERIFY_AFTER_DAYS=30
EGX_TICKER_INACTIVE_AFTER_DAYS=14
```

## History resolution

The registry records:

- `scanner_symbol`;
- `history_symbol`;
- `history_resolution_method`;
- `resolution_attempts`;
- `history_verified_at`;
- `verification_error`.

The shared resolver still supports:

```text
persisted history symbol
  -> current ticker
  -> legacy fallback
  -> ISIN
```

But a registry-confirmed current symbol outranks static rename assumptions.

The 1-minute ingestion pipeline reads registry aliases and resolver metadata before falling back to the legacy quote table.

## Browser behavior

Authenticated browser clients can read the registry and aliases but cannot write them.

The application merges:

```text
ticker_registry identity
  + tickers quote/technical snapshot
  + static fallback only where necessary
```

The directory UI:

- hides inactive/retired securities from the normal active list;
- searches current ticker, old ticker aliases, ISIN, English name and Arabic name;
- exposes a Registry badge for service-managed identities.

Open clients use registry `updated_at` as part of the remote freshness signal, so a rename can refresh without requiring an accounting mutation.

## Portfolio behavior

Portfolio transactions and positions are rehydrated through the loaded registry alias set.

This means a future rename does not require a code deployment merely to translate an old portfolio ticker into the current canonical ticker.

## Safety rules

- Browser quote sync may update prices/technical values but registry identity wins over browser metadata.
- Known EGX/curated sector classifications outrank TradingView's generic sector taxonomy; TradingView fills sector only when the EGX mapping is unknown.
- Do not automatically merge two simultaneously active scanner symbols merely because they share a similar name.
- ISIN-driven rename detection is only automatic when the scanner ISIN is unique in the active scanner universe.
- Active scanner symbols are never deleted as aliases by static assumptions.
- Historical aliases remain queryable even after the old symbol disappears.
- The service role owns registry writes; authenticated browser users are read-only.
- Existing quote and portfolio tables are not destructively migrated.

## Rollout

The registry schema is additive. The legacy static dictionary remains as a fallback during rollout.

The scheduled workflow is staged on `feature/premium-ui-redesign`. GitHub scheduled workflows execute from the default branch, so the daily schedule becomes production-active only when this implementation is intentionally promoted.
