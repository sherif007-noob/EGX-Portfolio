# 1-Minute Intraday Migration Plan

## Objective

Upgrade the EGX intraday data layer from the current legacy 15-minute / transitional 5-minute setup to a tiered architecture built around real TradingView 1-minute data:

- **1-minute raw history:** recent high-resolution source of truth.
- **5-minute derived history:** medium-term intraday archive generated locally from 1-minute bars.
- **Daily history:** permanent long-term analytics source.
- **15-minute history:** temporary fallback only during migration.

The goal is to improve Today-chart fidelity and transaction-time accuracy without fabricating market observations, overloading the browser, or reintroducing TradingView WebSocket work into Cloudflare Workers.

## Target architecture

```text
TradingView 1m
    |
    v
GitHub Actions / Node
    |
    +--> raw 1m rows (30d)
    |
    +--> deterministic 1m -> 5m aggregation
             |
             v
        derived 5m rows (90d)

Supabase
    |
    +--> browser reads 1m -> 5m -> legacy 15m fallback
    |
    +--> daily history remains permanent

TradingView Scanner HTTP
    |
    +--> latest/live endpoint only
```

Cloudflare remains the application/API runtime and does not open TradingView WebSockets.

## Data policy

The canonical policy lives in `src/services/intradayPolicy.ts`.

Initial target values:

| Setting | Value |
| --- | --- |
| Raw interval | 1 minute |
| Derived interval | 5 minutes |
| Legacy fallback | 15 minutes |
| Raw retention | 30 calendar days |
| Derived retention | 90 calendar days |
| Ingestion cadence target | ~5 minutes during EGX session |
| Display/analytics timezone | Africa/Cairo |

The database primary key already supports multiple resolutions:

```text
(ticker, interval_minutes, bar_timestamp)
```

No separate table is required for 1m versus 5m history.

## Implementation phases

### Phase A — Centralize interval policy

Status: **started**

Create one authoritative interval/retention policy and remove scattered assumptions from chart/ingestion code.

Acceptance criteria:

- 1m, 5m, 15m fallback order is declared once.
- 30d/90d retention is declared once.
- services import policy rather than inventing their own interval constants.

### Phase B — Prove TradingView 1m behavior

Status: **next**

Before changing production ingestion, run a non-mutating Node diagnostic against representative names:

- ACTF
- NAPR
- a liquid ticker
- an illiquid ticker
- one legacy/canonical alias case such as QNBA/QNBE/QNBF

Measure:

- ticker resolution path;
- whether timeframe `"1"` returns usable data;
- maximum practical bar count;
- earliest/latest timestamps;
- sparse-minute behavior;
- whether count-only retrieval is sufficient or ranged/chunked retrieval is required.

ACTF must not be manually seeded before this test.

### Phase C — Restrict the Today ticker universe

Status: **started**

Today analytics should query only:

1. securities held entering the requested session;
2. securities bought or sold during that session.

Historical tickers unrelated to the session must not be fetched just because they appear somewhere in the ledger.

Canonical helper:

```text
resolveIntradaySessionTickers(transactions, sessionDate)
```

Acceptance criteria:

- closed historical positions are excluded;
- same-day round trips are included;
- ticker variants normalize consistently;
- CASH is excluded.

### Phase D — Chunked/gap-aware 1m ingestion

Status: **planned**

Do not implement 1m by changing a single `5` constant to `1`.

For each ticker:

1. determine required 1m start date, capped at the 30-day retention boundary;
2. read existing 1m coverage;
3. identify missing ranges;
4. split missing history into safe TradingView retrieval chunks;
5. resolve ticker/canonical/ISIN through the centralized resolver;
6. fetch 1m bars in Node;
7. validate timestamps and OHLC;
8. insert only missing timestamps;
9. continue until coverage is complete.

The engine must distinguish:

- initial backfill;
- gap repair;
- normal incremental sync.

### Phase E — Persist raw 1m bars

Status: **planned**

Raw rows use:

- `interval_minutes = 1`
- `source = tradingview`
- TradingView timestamps
- OHLCV as supplied
- UTC storage
- Cairo session interpretation

Completed historical bars should be treated as immutable. Only a deliberately handled currently-forming bar may be refreshed later if required.

### Phase F — Derive 5m locally

Status: **started**

5m bars are aggregated from real 1m observations rather than fetched independently forever.

For each five-minute bucket:

- open = first observed 1m open;
- high = maximum observed 1m high;
- low = minimum observed 1m low;
- close = last observed 1m close;
- volume = sum of observed 1m volumes.

No missing minute is synthesized.

Derived rows use:

```text
source = derived-1m
```

Acceptance criteria:

- deterministic aggregation;
- sparse/illiquid buckets remain valid without invented minutes;
- repeated aggregation produces the same 5m result.

### Phase G — Retention jobs

Status: **planned**

After ingestion/aggregation:

- prune raw 1m rows older than 30 calendar days;
- prune derived 5m rows older than 90 calendar days;
- leave daily history permanent;
- retain legacy 15m data during migration for rollback/fallback.

### Phase H — Adaptive chart reads

Status: **started**

Today analytics uses the following real-data fallback order:

```text
1m -> 5m -> legacy 15m
```

The live TradingView scanner quote remains the authoritative latest endpoint when a complete live snapshot exists.

The chart must never synthesize points just to appear smoother.

A later coverage-quality check will prevent a tiny/incomplete 1m sample from winning over a healthier 5m session.

### Phase I — Define sufficient coverage

Status: **planned**

The reader must distinguish:

- sparse trading because an EGX security did not trade every minute;
- ingestion gaps caused by failed collection.

Potential coverage checks:

- usable previous close exists;
- first expected session area has data where appropriate;
- latest expected session area is covered;
- unexplained large ingestion gaps are detected;
- currently held tickers have a usable valuation path.

The final rule must accommodate legitimate illiquidity.

### Phase J — Validate portfolio mathematics

Status: **planned**

Moving from 15m -> 5m -> 1m may change path shape and timing, but must not arbitrarily change:

- opening equity;
- cash accounting;
- external deposits/withdrawals;
- final authoritative NAV;
- final P&L;
- final TWR/MWR semantics;
- previous-close baseline.

Add regression cases with executions between coarse bar boundaries, for example a trade at 10:07 Cairo.

### Phase K — ACTF / NAPR live migration test

Status: **planned**

Use ACTF and NAPR as genuine missing/new-ticker cases.

Verify directly in Supabase:

- resolver method used;
- 1m rows inserted;
- earliest/latest timestamps;
- no duplicate timestamps;
- derived 5m rows produced;
- derived OHLCV matches source 1m bars;
- chart consumes the new rows.

Do not manually seed ACTF before this test.

### Phase L — Workflow cadence and observability

Status: **planned**

The source resolution will be 1m, but GitHub Actions does not need to run every minute.

Target cadence:

- approximately every 5 minutes during the EGX session;
- one run may fetch several newly completed 1m candles.

Each run should report:

- portfolio tickers discovered;
- session-relevant tickers;
- resolver method per repaired ticker;
- new 1m bars;
- derived 5m buckets;
- gaps detected;
- rows pruned;
- failures.

### Phase M — Legacy retirement

Status: **planned**

Migration order:

```text
legacy 15m
  -> add raw 1m
  -> derive 5m
  -> validate
  -> prefer 1m
  -> observe across several sessions
  -> retire 15m dependency
```

Do not delete the existing 15m dataset until the new pipeline has been observed working reliably.

## Changes already implemented

The first implementation pass has begun on `feature/premium-ui-redesign`:

- `src/services/intradayPolicy.ts`
  - canonical 1m / 5m / 15m policy;
  - 30d raw and 90d derived retention.
- `src/services/intradayTickerUniverse.ts`
  - resolves session-relevant tickers only.
- `src/services/intradayAggregation.ts`
  - deterministic local 1m -> 5m aggregation.
- `PerformanceTimeframeChart.tsx`
  - uses session-relevant tickers;
  - read order is now 1m -> 5m -> 15m.
- `scripts/syncIntradayPrices.ts`
  - transitional 5m sync now imports the centralized policy instead of hardcoding its interval/retention.
- regression tests added for policy, ticker-universe selection and aggregation.

## Non-negotiable invariants

- No fabricated market points.
- No TradingView WebSocket ingestion in Cloudflare Workers.
- No browser-triggered history repair.
- No ticker-specific hacks where ticker/canonical/ISIN resolution can solve identity generically.
- No manual ACTF intraday seed before migration verification.
- No regression to Today live endpoint semantics.
- No regression to verified 1W baseline semantics.
- Premium work stays on `feature/premium-ui-redesign` unless explicitly requested otherwise.
