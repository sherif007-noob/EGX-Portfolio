# 1-Minute Intraday Migration Plan — Canonical 15-Phase Roadmap

This is the canonical implementation roadmap for the EGX 1-minute intraday migration on `feature/premium-ui-redesign`.

## Target architecture

```text
TradingView 1m
  -> GitHub Actions / Node
      -> raw 1m (30 calendar days)
      -> deterministic local 1m -> 5m
      -> derived 5m (90 calendar days)
  -> Supabase
      -> Today reader: sufficient 1m -> sufficient 5m -> legacy 15m
      -> daily history remains permanent

TradingView Scanner HTTP
  -> authoritative latest/live endpoint
```

Cloudflare Workers must not open TradingView WebSockets.

---

## Phase 1 — Lock down the data contract

**Status: implemented and regression validated**

Canonical policy: `src/services/intradayPolicy.ts`.

Current authoritative settings:

- raw interval = 1 minute;
- derived interval = 5 minutes;
- legacy fallback = 15 minutes;
- raw retention = 30 calendar days;
- derived retention = 90 calendar days;
- timezone = `Africa/Cairo`;
- regular session = 10:00-14:30 Cairo;
- scheduled ingestion grace = through 14:40 Cairo;
- trading weekdays = Sunday-Thursday;
- ingestion cadence target = about 5 minutes;
- initial/backfill batch size = 5,000 observations;
- maximum additional backfill batches = 10;
- incremental request = 1,200 observations;
- incremental overlap = 2 days;
- read order = 1m -> 5m -> 15m.

Cairo time is computed through `Intl.DateTimeFormat(..., { timeZone: 'Africa/Cairo' })`, so summer/winter offsets remain date-aware. `intradayPriceStore.ts` also consumes the policy timezone rather than hardcoding it independently.

Resolver logs preserve the complete attempt path, e.g. NAPR ticker failure followed by successful ISIN resolution.

Acceptance: met for the current intraday code paths.

---

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

Result: timeframe `"1"` works in Node, but a fixed count is not a calendar-range guarantee.

ACTF was not manually seeded before this validation.

---

## Phase 3 — Restrict the Today universe

**Status: implemented and regression validated**

Browser helper:

```text
resolveIntradaySessionTickers(transactions, sessionDate)
```

Today includes:

- securities held entering the session;
- current holdings;
- securities bought/sold during the session;
- same-day round trips.

It excludes CASH and unrelated closed historical positions.

The automatic Node sync independently discovers current positions plus current Cairo-session trades. Explicit targeted ticker input overrides discovery for diagnostics/smoke repairs.

---

## Phase 4 — Build proper chunked 1m backfill

**Status: implemented and live validated**

`src/services/intradayBackfillPlan.ts` distinguishes:

- `full-derived-backfill`;
- `raw-backfill`;
- `incremental`.

The implementation does **not** rely on one enormous 15k+ request and does not assume one count equals a date range.

Current TradingView retrieval uses:

1. an initial bounded request;
2. bounded `request_more_data` batches;
3. stop when the required timestamp boundary is reached;
4. or when TradingView reports source exhaustion;
5. or fail explicitly if the configured safety limit is reached first.

Current limits are 5,000 initial bars, 5,000 per additional batch, maximum 10 additional batches.

The planner uses the required 30d/90d time boundaries; the fetcher walks backward until it reaches them where TradingView history permits.

---

## Phase 5 — Store 1m as the raw truth

**Status: implemented and live validated**

Raw rows use:

- `interval_minutes = 1`;
- `source = tradingview`;
- real TradingView timestamps/OHLCV;
- UTC storage;
- insert-only semantics for already-persisted completed historical timestamps.

The production schema accepts `interval_minutes IN (1,5,15)`.

---

## Phase 6 — Derive 5m ourselves

**Status: implemented and live validated**

`aggregateIntradayBars()` derives:

- open = first observed 1m open;
- high = maximum observed high;
- low = minimum observed low;
- close = final observed close;
- volume = sum of observed volume.

No missing minute is synthesized.

Derived rows use:

```text
source = derived-1m
```

A live validation defect was found and fixed: TradingView can later revise a historical volume value, while raw history is intentionally immutable. Deriving from the later network fetch made 5m disagree with stored raw 1m.

The sync now reloads persisted raw rows and gives them precedence before deriving 5m.

Latest direct validation across ACTF, NAPR and ORAS:

- overlapping raw->derived buckets checked: **2,985**;
- OHLCV mismatches: **0**.

---

## Phase 7 — Two retention jobs

**Status: implemented and live validated**

After sync:

- raw 1m older than 30 calendar days is pruned;
- derived 5m older than 90 calendar days is pruned;
- daily remains permanent;
- legacy 15m remains untouched during rollout.

Planning and pruning use the same day-aligned cutoff.

A previous exact-instant cutoff defect could leave the first retained derived bucket only partially reconstructible; that has been corrected.

---

## Phase 8 — Make chart resolution adaptive

**Status: implemented and regression validated**

Today loads candidate intervals and selects intentionally:

```text
sufficient 1m -> sufficient 5m -> legacy 15m
```

The live Scanner snapshot remains the authoritative endpoint only when the complete held-ticker live snapshot is trustworthy.

No synthetic chart observations are generated.

---

## Phase 9 — Define sufficient coverage

**Status: implemented and regression validated**

`selectBestIntradayResolution()` compares more than ticker breadth.

For each relevant ticker it compares the observed session envelope across candidate resolutions. This prevents a tiny late/early 1m sample from displacing a healthier 5m session.

It deliberately does not demand a candle every minute, so legitimate EGX illiquidity remains valid.

Regression coverage includes:

- partial 1m ticker breadth;
- tiny 1m sample containing all tickers;
- sparse/illiquid 1m with a comparable real session envelope;
- Cairo session-date handling;
- latest real session selection when the requested date contains no bars;
- post-midnight and closed-session fallback.

---

## Phase 10 — Validate portfolio mathematics at 1m

**Status: implemented and regression validated**

The intraday test suite includes a transaction at a 10:07-equivalent session time and compares 1m, 5m and 15m results.

Higher resolution may change path shape/timing. It must not arbitrarily change:

- opening equity;
- transaction cash accounting;
- deposits/withdrawals;
- final authoritative NAV;
- final P&L;
- TWR/MWR semantics;
- previous-close baseline.

The regression also verifies that the 1m path applies the transaction earlier than the old 15m path.

---

## Phase 11 — ACTF / NAPR migration test

**Status: ingestion/storage/resolution acceptance validated; live UI observation rolls into Phase 12**

The final smoke set now includes ACTF, NAPR and established ticker ORAS.

Successful smoke output on 2026-09-24:

### ACTF

- resolver: ticker `ACTF`;
- raw 1m rows currently stored: **4,731**;
- latest raw bar: 2026-09-24 11:28Z;
- derived 5m rows: **1,247**;
- TradingView 1m source exhausts before the full 90d target;
- older direct-TradingView 5m bootstrap remains only before reconstructible 1m coverage.

### NAPR

- resolver path: `NAPR` ticker -> invalid symbol -> ISIN `EGS370O1C013` -> success;
- raw 1m rows currently stored: **2,349**;
- latest raw bar: 2026-09-24 11:29Z;
- derived 5m rows: **1,895**;
- no legacy direct-5m rows remain.

### ORAS established-ticker check

- resolver: ticker `ORAS`;
- inserted during validation: **5,489** new raw 1m rows;
- raw 1m rows currently stored: **5,489**;
- derived 5m rows: **1,260**;
- older legacy 5m bootstrap remains only outside reconstructible 1m history.

### Cross-ticker database acceptance

- duplicate timestamps: **0**;
- overlapping persisted raw->derived buckets: **2,985**;
- OHLCV mismatches: **0**;
- smoke typecheck: passed;
- focused intraday regression suite: passed;
- write-capable smoke: passed with **0 failures**.

The chart code is wired to load these rows through the adaptive resolution selector. Actual multi-session/live-app observation remains part of rollout Phase 12.

---

## Phase 12 — Migration without breaking Today

**Status: staged; multi-session observation remains**

Current rollout order:

```text
legacy 15m
  -> raw 1m
  -> derived 5m
  -> coverage/mathematics validation
  -> prefer sufficient 1m
  -> retain 15m rollback fallback
  -> observe across multiple sessions
  -> retire 15m dependency
```

Do not delete the legacy 15m dataset yet.

One-session migration and regression acceptance are green. The remaining requirement is observation over multiple real trading sessions before legacy retirement.

---

## Phase 13 — Workflow scheduling

**Status: implemented on Premium, intentionally not activated on main**

Primary workflow:

```text
.github/workflows/intraday-1m-sync.yml
```

Staged schedule:

```text
*/5 7-12 * * 0-4
```

GitHub cron is UTC. The Node script applies the authoritative Cairo-local Sunday-Thursday 10:00-14:40 ingestion gate, covering DST without a fixed UTC offset.

The old direct-TradingView 5m workflow is now manual-only and shares the same concurrency group, preventing competing scheduled producers.

Important: GitHub scheduled workflows execute from the default branch. The Premium schedule does not become production scheduling until this work is intentionally promoted. This plan does not authorize merging `main`.

---

## Phase 14 — Observability

**Status: implemented for current migration; future alerting may be added separately**

Per-ticker logs include:

- ticker;
- resolved symbol;
- final resolver method;
- complete resolver attempt path;
- migration mode;
- additional batches;
- source-exhaustion state;
- fetched 1m bars;
- inserted 1m bars;
- newly appended 1m bars;
- repaired historical 1m gaps;
- persisted raw rows used for derivation;
- upserted 5m rows;
- legacy/bootstrap state;
- earliest/latest fetched timestamps;
- previous raw/derived coverage.

The final summary includes ticker counts, fetch/write/derivation totals, source exhaustion, bootstrap limits, retention pruning and failures.

`repaired1mGaps` is deliberately source-backed: it counts a TradingView observation missing at or before the previously persisted latest raw timestamp. It does **not** label no-trade minutes as gaps.

The latest full smoke reported zero repaired gaps and zero failures.

---

## Phase 15 — Documentation and tests before calling it finished

**Status: implemented and branch-wide CI validated; final multi-session rollout observation remains tied to Phase 12**

Updated documentation:

- `docs/INTRADAY_1M_MIGRATION_PLAN.md`;
- `docs/INTRADAY_MARKET_DATA.md`;
- `docs/ANALYTICS_MARKET_DATA_EVOLUTION.md`;
- `docs/OPERATIONS.md`;
- `docs/TESTING.md`.

Regression coverage includes:

- 1m -> 5m aggregation;
- sparse-minute data;
- persisted-raw precedence;
- market-session boundaries;
- Cairo DST/time handling;
- same-day trade execution timing;
- 1m/5m/15m fallback selection;
- incomplete 1m coverage;
- ACTF/NAPR resolver behavior through live smoke logs;
- canonical/legacy resolver tests;
- post-midnight fallback;
- weekend/closed-session fallback;
- portfolio accounting invariants across intervals.

The focused smoke typechecks before tests and writes.

The repository-wide Quality gate was then run against the exact Premium code snapshot through a CI-only branch. It passed:

- TypeScript typecheck;
- **26/26 test files**;
- **158/158 tests**;
- production Vite build;
- bundled server build.

That broad gate exposed one pre-existing analytics edge case before passing: same-boundary MWR with legacy `openingCapital` returned 0% on the inception date. The existing regression correctly expected the real simple holding-period return. `calculatePeriodMWR()` was fixed so same-boundary/no-flow inception valuation returns `ending / starting - 1` rather than zero.

The CI-only validation commit differs from the Premium snapshot only by the Quality workflow trigger used to execute the gate.

---

## Non-negotiable invariants

- No fabricated market points.
- No TradingView WebSocket ingestion in Cloudflare Workers.
- No browser-triggered history repair.
- No ticker-specific hacks where centralized ticker/canonical/ISIN resolution can solve identity.
- No manual ACTF intraday seed before migration verification.
- No regression to Today live endpoint semantics.
- No regression to the verified 1W baseline semantics.
- Completed persisted raw 1m history remains immutable during ordinary sync.
- Reconstructible derived 5m must match persisted raw 1m.
- Legacy 15m remains until multi-session rollout observation succeeds.
- Premium work stays on `feature/premium-ui-redesign` unless explicitly requested otherwise.
