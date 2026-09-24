# 1-Minute Intraday Migration Plan — Canonical 15-Phase Roadmap

This document is the canonical implementation roadmap for the EGX 1-minute intraday migration on `feature/premium-ui-redesign`.

The target architecture is:

```text
TradingView 1m
  -> GitHub Actions / Node
      -> raw 1m (30 calendar days)
      -> deterministic local 1m -> 5m
      -> derived 5m (90 calendar days)
  -> Supabase
      -> Today reader: 1m -> 5m -> legacy 15m
      -> daily history remains permanent

TradingView Scanner HTTP
  -> authoritative latest/live endpoint
```

Cloudflare Workers must not open TradingView WebSockets.

## Phase 1 — Lock down the data contract

**Status: in progress, substantially implemented**

Canonical policy: `src/services/intradayPolicy.ts`.

Current policy:

- raw interval = 1 minute;
- derived interval = 5 minutes;
- legacy fallback = 15 minutes;
- raw retention = 30 calendar days;
- derived retention = 90 calendar days;
- timezone = `Africa/Cairo`;
- ingestion cadence target = about 5 minutes;
- explicit backfill chunk = 7 days;
- incremental overlap = 2 days;
- read fallback order = 1m -> 5m -> 15m.

TradingView resolution now records the complete attempt path rather than only the final result, so cases such as NAPR can be diagnosed as ticker failure followed by ISIN success.

Remaining: formalize exchange-session expectations without hardcoding a fixed UTC offset; Cairo DST must remain date-aware.

Acceptance: no chart/service independently invents the active intraday interval, retention, or backfill policy.

## Phase 2 — Prove TradingView 1-minute behavior first

**Status: validated**

Read-only Node diagnostic: `scripts/diagnoseIntradayOneMinute.ts`.

Validated on 2026-09-24:

| Ticker | Resolver | Bars | First | Last | Median observed gap |
| --- | --- | ---: | --- | --- | ---: |
| ACTF | ticker `ACTF` | 5,000 | 2026-08-20 07:29Z | 2026-09-23 11:29Z | 60s |
| NAPR | ISIN `EGS370O1C013` | 5,000 | 2026-06-09 09:07Z | 2026-09-23 11:29Z | 60s |
| ORAS | ticker `ORAS` | 5,000 | 2026-08-25 10:57Z | 2026-09-23 11:27Z | 60s |
| QNBA | canonical ticker `QNBE` | 5,000 | 2026-08-02 08:20Z | 2026-09-23 11:14Z | 60s |

Result: timeframe `"1"` works in Node, but fixed-count retrieval does not guarantee a calendar range. Production migration therefore uses explicit ranged requests.

ACTF was not manually seeded before this validation.

## Phase 3 — Restrict the Today universe

**Status: implemented, validation continuing**

Browser helper: `resolveIntradaySessionTickers(transactions, sessionDate)`.

Today analytics includes:

- securities held entering the session;
- securities bought during the session;
- securities sold during the session;
- same-day round trips;
- excludes CASH and unrelated closed historical positions.

The automatic Node sync now uses current positions plus transactions on the current Cairo session date instead of every ticker touched during the previous 90 days. Explicit targeted tickers still override discovery.

Acceptance: Today ingestion/analytics does not load historical 1m data for irrelevant old positions.

## Phase 4 — Build proper chunked 1m backfill

**Status: implemented, live revalidation in progress**

`src/services/intradayBackfillPlan.ts` now distinguishes:

- `full-derived-backfill`: explicit 90-day source retrieval;
- `raw-backfill`: 30-day raw-tier fill when derived history already exists;
- `incremental`: two-day overlap repair.

`scripts/syncIntradayOneMinute.ts` now uses explicit TradingView date ranges split into bounded 7-day chunks rather than relying on one huge bar count plus `request_more_data`.

The planner also detects the migration state where old TradingView 5m history predates the locally-derived 5m cache and forces a 90-day rebuild.

Acceptance: an empty/new ticker can reach required coverage through bounded date ranges rather than a single huge request.

## Phase 5 — Store 1m as the raw truth

**Status: implemented**

Raw rows:

- `interval_minutes = 1`;
- `source = tradingview`;
- TradingView timestamps;
- real OHLCV;
- UTC storage;
- Cairo interpretation;
- insert only missing timestamps.

Completed historical raw candles are not overwritten by ordinary sync.

Production schema accepts `interval_minutes IN (1,5,15)`.

## Phase 6 — Derive 5m ourselves

**Status: implemented, migration cleanup validation in progress**

`aggregateIntradayBars()` derives 5m locally:

- open = first observed 1m open;
- high = maximum observed 1m high;
- low = minimum observed 1m low;
- close = last observed 1m close;
- volume = sum of observed volumes;
- no missing minute is synthesized.

Derived rows use `source = derived-1m`.

2026-09-24 validation found ACTF still contained older direct-TradingView 5m rows outside the original 30-day 1m pull. The planner was corrected so that this migration state triggers a full 90-day 1m source rebuild and replaces the old 5m tier with deterministic `derived-1m` rows.

## Phase 7 — Two retention jobs

**Status: implemented, live revalidation in progress**

After sync:

- raw 1m older than 30 calendar days is pruned;
- derived 5m older than 90 calendar days is pruned;
- daily remains permanent;
- legacy 15m remains untouched during migration.

A validation defect was found where the sync pruned at an exact `now - 30d` instant while the planner used a day boundary, leaving the first retained 5m bucket only partially reconstructible from retained 1m. Pruning now uses the same day-aligned retention cutoff as planning.

## Phase 8 — Make chart resolution adaptive

**Status: implemented**

Today loads all configured candidates and intentionally chooses:

```text
1m -> 5m -> legacy 15m
```

The live scanner snapshot remains the authoritative latest endpoint when every currently-held ticker has a trustworthy live quote.

No synthetic chart points are generated.

## Phase 9 — Define sufficient coverage

**Status: implemented, CI validation in progress**

The reader now checks more than ticker breadth.

For each ticker it compares the observed session envelope across available resolutions. A tiny late/early 1m sample cannot displace a healthier 5m session merely because it contains one row for every ticker.

The rule deliberately compares observed envelopes rather than requiring a candle every minute, so legitimate illiquidity remains valid.

Regression coverage includes:

- partial 1m breadth versus healthy 5m;
- tiny 1m sample with all tickers;
- sparse/illiquid 1m whose observed session envelope still matches 5m;
- Cairo session-date handling.

## Phase 10 — Validate portfolio mathematics at 1m

**Status: regression implementation added, CI validation in progress**

The intraday test suite now includes an execution at 10:07-equivalent UTC timing and compares 1m, 5m and 15m results.

The intended invariant is:

- path timing may improve at finer resolution;
- opening equity must remain stable;
- cash accounting must remain stable;
- deposits/withdrawals must remain stable;
- final authoritative NAV must remain stable;
- final P&L must remain stable;
- TWR/MWR semantics must remain stable;
- previous-close baseline must remain stable.

The regression also proves the trade enters the 1m path earlier than the old 15m path.

## Phase 11 — ACTF / NAPR migration test

**Status: in progress**

First write-capable migration run successfully populated:

- ACTF raw 1m: 4,532 rows, 22 sessions;
- NAPR raw 1m: 2,284 rows, 22 sessions;
- ACTF derived/legacy 5m total: 3,189 rows;
- NAPR derived 5m: 1,886 rows.

Direct Supabase validation found:

- zero duplicate ACTF/NAPR 1m or 5m timestamps;
- raw source is `tradingview`;
- derived source is `derived-1m` where migrated;
- 1,751 overlapping raw->derived 5m buckets checked;
- one ACTF first-retention-boundary mismatch, traced to the retention-cutoff defect fixed in Phase 7;
- ACTF also retained older direct-TradingView 5m rows, traced to incomplete 90-day derived migration and fixed in Phases 4/6.

The smoke workflow now typechecks and runs the intraday regression suite before any ACTF/NAPR write. If validation fails, the database write is skipped.

Remaining Phase 11 acceptance:

- rerun the corrected ACTF/NAPR rebuild;
- verify resolver attempt path from logs;
- verify 90-day 5m source is fully `derived-1m`;
- verify zero duplicate timestamps;
- verify overlapping retained 1m -> 5m OHLCV exactly matches;
- verify chart consumes the new rows;
- spot-check established tickers as well as ACTF/NAPR.

## Phase 12 — Migration without breaking Today

**Status: staged, not complete**

Current rollout order remains:

```text
legacy 15m
  -> add raw 1m
  -> derive 5m
  -> validate
  -> prefer sufficient 1m
  -> retain 15m rollback fallback
  -> observe across multiple sessions
  -> retire 15m dependency
```

Do not delete legacy 15m yet.

## Phase 13 — Workflow scheduling

**Status: planned**

After Phases 9–12 pass:

- source resolution remains 1m;
- scheduled ingestion target becomes about every 5 minutes during the EGX session;
- live quote refresh remains a separate concept.

The migration workflow remains manual/smoke-gated until validation is complete.

## Phase 14 — Observability

**Status: partially implemented**

Per-ticker logs now include:

- ticker;
- resolved symbol;
- final resolution method;
- complete resolution attempt path;
- migration mode;
- ranged request count;
- fetched 1m count;
- inserted 1m count;
- upserted 5m count;
- earliest/latest fetched timestamps;
- previous raw and derived coverage.

Final summary currently includes:

- total range requests;
- fetched bars;
- inserted 1m rows;
- upserted 5m rows;
- pruned 1m/5m rows;
- failure count.

Remaining: robust gap diagnostics that do not mistake legitimate illiquidity for ingestion failure.

## Phase 15 — Documentation and tests before calling it finished

**Status: in progress**

Required documentation:

- `docs/INTRADAY_MARKET_DATA.md`;
- `docs/ANALYTICS_MARKET_DATA_EVOLUTION.md`;
- operational documentation;
- testing documentation.

Required regression areas:

- 1m -> 5m aggregation;
- sparse-minute data;
- market-session boundaries;
- Cairo DST/time handling;
- same-day trade execution timing;
- 1m/5m/15m fallback selection;
- incomplete 1m coverage;
- ACTF/NAPR resolver behavior;
- legacy ticker aliases;
- post-midnight endpoint behavior;
- weekends/holidays.

## Non-negotiable invariants

- No fabricated market points.
- No TradingView WebSocket ingestion in Cloudflare Workers.
- No browser-triggered history repair.
- No ticker-specific hacks where centralized ticker/canonical/ISIN resolution can solve identity.
- No manual ACTF intraday seed before migration verification.
- No regression to Today live endpoint semantics.
- No regression to the verified 1W baseline semantics.
- Premium work stays on `feature/premium-ui-redesign` unless explicitly requested otherwise.
