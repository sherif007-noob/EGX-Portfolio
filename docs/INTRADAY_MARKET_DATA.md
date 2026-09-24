# Intraday Market Data

## Purpose

The intraday market-data layer provides real EGX observations for Today analytics without fabricating market points.

The target and current Premium architecture is:

```text
TradingView 1m
  -> GitHub Actions / Node
      -> raw 1m history (30 calendar days)
      -> deterministic local 1m -> 5m aggregation
      -> derived 5m history (90 calendar days)
  -> Supabase
      -> Today reader: sufficient 1m -> sufficient 5m -> legacy 15m

TradingView Scanner HTTP
  -> authoritative latest/live endpoint when the complete held-ticker snapshot is available
```

Cloudflare Workers serve the application/API but do not open TradingView WebSockets. Browser startup never triggers TradingView history repair.

## Canonical policy

The authoritative constants live in:

```text
src/services/intradayPolicy.ts
```

Current policy:

| Setting | Value |
| --- | --- |
| Raw interval | 1 minute |
| Derived interval | 5 minutes |
| Legacy fallback | 15 minutes |
| Raw retention | 30 calendar days |
| Derived retention | 90 calendar days |
| Timezone | `Africa/Cairo` |
| Regular session | 10:00-14:30 Cairo |
| Scheduled ingestion grace | through 14:40 Cairo |
| Trading weekdays | Sunday-Thursday |
| Scheduled cadence target | about every 5 minutes |
| Read order | 1m -> 5m -> 15m |

Cairo session calculations use `Intl.DateTimeFormat` with `Africa/Cairo`; they do not assume a fixed UTC offset. This matters across Egypt daylight-saving changes.

## Database table

Intraday bars are stored in:

```text
public.intraday_price_history
```

Primary key:

```text
(ticker, interval_minutes, bar_timestamp)
```

The production interval constraint accepts:

```text
1, 5, 15
```

Columns include normalized ticker, interval, UTC timestamp, OHLCV, source and retrieval time.

Daily history remains in `price_history` and is retained permanently.

## Source semantics

### Raw 1-minute rows

Raw rows use:

- `interval_minutes = 1`;
- `source = tradingview`;
- TradingView timestamps and OHLCV;
- UTC storage;
- insert-only semantics for completed historical timestamps.

A later TradingView response must not silently rewrite an already-persisted historical 1-minute observation.

### Derived 5-minute rows

`aggregateIntradayBars()` builds 5-minute buckets from actual 1-minute observations:

- open = first observed 1m open;
- high = maximum observed high;
- low = minimum observed low;
- close = final observed close;
- volume = sum of observed volume.

Missing minutes are never synthesized. An illiquid security may legitimately have only one or two observations in a five-minute bucket.

Derived rows use:

```text
source = derived-1m
```

When the same raw timestamp appears in a later TradingView retrieval, the already-persisted raw 1-minute row wins during derivation. This keeps the 5-minute cache exactly reconstructible from the stored raw source of truth.

### Legacy 5-minute bootstrap

Some securities may have older direct-TradingView 5-minute rows that predate the deepest 1-minute history TradingView will return. Those rows are retained only outside reconstructible 1-minute coverage.

They are migration bootstrap/fallback data, not a reason to fabricate older 1-minute observations.

### Legacy 15-minute fallback

The old 15-minute dataset remains available during rollout. It is not deleted until the new pipeline has been observed reliably across multiple sessions.

## Ticker resolution

TradingView identity resolution is centralized in:

```text
src/services/tradingViewSymbolResolver.ts
```

Resolution attempts are logged, including failures. For example, current validation records NAPR as:

```text
ticker NAPR -> invalid symbol
ISIN EGS370O1C013 -> success
```

Do not add ticker-specific ingestion hacks when ticker/canonical/ISIN resolution can solve the identity generically.

## Today ticker universe

Today analytics and automatic 1-minute ingestion operate on session-relevant securities:

1. securities held entering the session;
2. securities currently held;
3. securities bought or sold during the session;
4. same-day round trips.

CASH and unrelated closed historical positions are excluded.

Browser selection uses:

```text
resolveIntradaySessionTickers(transactions, sessionDate)
```

The Node sync separately resolves the current position/session-trade universe from Supabase.

Explicit `EGX_INTRADAY_TICKERS` still overrides discovery for diagnostics and targeted repairs.

## Backfill and incremental sync

The 1-minute sync is:

```text
scripts/syncIntradayOneMinute.ts
```

It distinguishes:

- `full-derived-backfill`;
- `raw-backfill`;
- `incremental`.

TradingView history is retrieved in bounded batches: an initial request followed by bounded `request_more_data` batches until the required time boundary is reached, TradingView reports source exhaustion, or the configured safety limit is reached.

The current canonical limits are:

- initial backfill: 5,000 bars;
- additional batch: 5,000 bars;
- maximum additional batches: 10;
- incremental request: 1,200 bars;
- normal incremental overlap: 2 days.

This intentionally avoids assuming that a fixed bar count equals a fixed calendar range; liquidity determines how much calendar history a count represents.

## Retention

After ingestion:

- raw 1m rows older than the 30-day day-aligned cutoff are pruned;
- derived 5m rows older than the 90-day day-aligned cutoff are pruned;
- daily history remains permanent;
- legacy 15m remains during migration.

Planning and pruning use the same day-aligned cutoff so the first retained derived bucket is not made partially unreconstructible by retention itself.

## Adaptive browser reads

Today loads candidate resolutions from Supabase and uses:

```text
selectBestIntradayResolution(...)
```

Selection is not based merely on whether one 1-minute row exists.

For each session-relevant ticker, the selector compares the observed session envelope across available resolutions. A tiny late/early 1m sample cannot displace a healthier 5m dataset, while sparse legitimate trading remains acceptable because the selector does not require a candle every minute.

If the requested calendar date has no market bars, such as after midnight, a weekend or an exchange-closed date, the reader may use the latest real session not after that date. It never invents a session.

## Today chart resolution control

The Today analytics chart exposes:

```text
Auto | 1m | 5m | 15m | 1h
```

`Auto` remains the default and preserves the coverage-aware `1m -> 5m -> 15m` selector.

Manual `1m`, `5m`, and `15m` choices read the corresponding persisted interval for the selected session. The `1h` view is intentionally not another storage tier: it is derived client-side from the healthiest available persisted intraday source using the same observed-only OHLCV aggregation semantics. Missing observations are not synthesized.

Changing the Today display resolution changes chart sampling only. It does not change transaction timing, portfolio accounting, live-price authority, ingestion cadence, retention, or the underlying stored market data.

## Today endpoint and authoritative portfolio alignment

The Today chart uses persisted intraday observations to reconstruct the session path, but two display rules keep the chart consistent with the rest of the portfolio UI:

1. **Post-close timestamp pinning.** During the live EGX session, a complete live quote snapshot may be appended at its real as-of time. After the regular 14:30 Cairo close, the live endpoint is pinned immediately after the final observed market point instead of using the later phone/browser wall-clock time. This prevents a 23:xx refresh from making the Today axis appear to extend into the night.
2. **Authoritative absolute portfolio value.** The main application portfolio total is the authority for the current absolute equity level. If the ledger-reconstructed Today series differs by a constant cash/baseline offset, the Today display series is shifted by that constant amount so its final equity equals the authoritative portfolio total. The shift is applied uniformly to the session equity/cash path, so the curve shape, selected-period P&L, TWR/MWR semantics and nominal drawdown gaps are not changed.

This alignment is a display-level reconciliation of absolute portfolio level; it does not rewrite persisted market bars or transaction history.

## Live endpoint

The TradingView Scanner HTTP snapshot remains separate from persisted intraday ingestion.

A complete live snapshot may be appended as the authoritative active-session endpoint. A mixed snapshot where a currently held ticker lacks a trustworthy live quote must not be treated as a complete portfolio endpoint.

## Workflow scheduling

Primary workflow:

```text
.github/workflows/intraday-1m-sync.yml
```

On the Premium branch it is configured for:

```text
*/5 7-12 * * 0-4
```

GitHub cron is UTC. The Node script applies the authoritative Cairo-local session gate and post-close grace window, so the broad UTC window safely covers Cairo DST changes.

Important: GitHub scheduled workflows execute from the repository default branch. The Premium schedule is staged code and does not become the production scheduler until that branch is intentionally promoted.

Legacy direct-TradingView 5-minute workflow:

```text
.github/workflows/intraday-prices.yml
```

is manual-only. It remains a repair/rollback tool and is no longer a competing scheduled producer.

Both workflows share the same concurrency group to prevent simultaneous writes.

## Commands

Primary 1-minute sync:

```bash
npm run sync:intraday:1m
```

Read-only 1-minute diagnostic:

```bash
npm run diagnose:intraday:1m
```

Legacy manual 5-minute repair:

```bash
npm run sync:intraday
```

Required server-side environment:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

Optional:

```env
EGX_PORTFOLIO_ID=...
EGX_INTRADAY_TICKERS=ACTF,NAPR
EGX_INTRADAY_FULL_REPAIR=true
```

The Supabase secret must never be exposed to browser code.

## Observability

Per-ticker sync logs include:

- ticker and resolved symbol;
- complete resolver attempt path;
- migration mode;
- additional TradingView batches;
- source-exhaustion state;
- fetched 1m bars;
- inserted 1m bars;
- newly appended 1m bars;
- repaired historical 1m gaps;
- persisted raw bars used for derivation;
- upserted 5m buckets;
- legacy bootstrap rows;
- earliest/latest fetched timestamps;
- previous raw/derived coverage.

A `repaired1mGaps` count means an actual TradingView observation was missing at or before the previously-known latest raw timestamp. It does **not** count minutes in which an illiquid security simply did not trade.

The final summary reports session-relevant/resolved ticker counts, fetch/insert/derivation totals, source exhaustion, bootstrap limitations, retention pruning and failures.

## Validated migration cases

ACTF/NAPR migration validation on 2026-09-24 confirmed:

- zero duplicate raw/derived timestamps;
- ACTF ticker resolution succeeds directly;
- NAPR ticker resolution fails then succeeds through ISIN `EGS370O1C013`;
- persisted raw 1m and derived 5m overlap exactly after the persisted-source derivation fix;
- legacy ACTF 5m rows remain only before TradingView's available 1m history boundary.

The smoke workflow typechecks and runs the intraday regression suite before writing test migration data.

## Data-integrity rules

- Never synthesize missing market points.
- Never overwrite a completed historical 1m row during ordinary sync.
- Derive reconstructible 5m from persisted 1m truth.
- Reject malformed/non-positive OHLC.
- Store timestamps in UTC; interpret sessions using Cairo timezone rules.
- Do not mix intraday rows into permanent daily history.
- Do not mutate accounting records from market-data ingestion.
- Do not run TradingView WebSocket ingestion in Cloudflare Workers.
- Do not trigger history repair from the browser.
- Preserve 15m fallback until rollout observation is complete.

See `docs/INTRADAY_1M_MIGRATION_PLAN.md` for the canonical 15-phase rollout status.
