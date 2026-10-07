# Intraday Market Data

## Purpose

The intraday market-data layer provides real EGX observations for Today analytics without fabricating market points.

The current production/default-`main` architecture is:

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
| Scheduled ingestion grace | through 15:15 Cairo |
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

Today analytics and automatic 1-minute ingestion operate on:

1. securities held entering the session;
2. securities currently held;
3. securities bought or sold during the session;
4. same-day round trips;
5. the benchmark indices EGX30, EGX70 EWI and EGX100 EWI.

CASH and unrelated closed historical positions are excluded. Benchmark indices are market-data context, not portfolio holdings.

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

The requested session comes from the Cairo EGX clock: before opening and on weekends it selects the previous trading weekday. Every resolution must match that exact session. Missing ingestion is not evidence of a holiday: an empty current session remains unavailable rather than silently displaying an older day. Manual 1m never falls back to a different resolution. Auto isolates failed resolution reads and can use a healthy same-session fallback. History refreshes every five minutes while visible and on resume/reconnection, independently of price changes.

## Today chart resolution control

The Today analytics chart exposes:

```text
Auto | 1m | 5m | 15m | 1h
```

`Auto` remains the default and preserves the coverage-aware `1m -> 5m -> 15m` selector.

Manual `1m` and `5m` choices remain strict reads of their corresponding persisted interval for the selected session. Manual `15m` and `1h` are display resolutions: the browser selects the finest healthy same-session source in the `1m -> 5m -> legacy 15m` chain and deterministically aggregates it to the requested bucket size when needed. Neither `15m` nor `1h` requires a separately persisted coarse dataset to render. Missing observations are not synthesized, and a missing requested session never falls back to an older trading day.

Changing the Today display resolution changes chart sampling only. It does not change transaction timing, portfolio accounting, live-price authority, ingestion cadence, retention, or the underlying stored market data.

## Today session boundary and endpoint

The Today chart reconstructs the current EGX session from a session boundary rather than rebuilding current cash from inception.

1. **Authoritative session-opening cash.** When the current portfolio cash balance is available, Today derives the cash balance at the first market bar by reversing the signed cash impact of session executions that occur at or after that first bar. It then replays those executions forward against real intraday market observations. This makes Today independent of stale legacy `capitalDeposits` / inception-opening-capital state while preserving auditable transaction effects.
2. **Historical fallback.** If no current cash boundary is available, the engine may still reconstruct from the historical opening-capital model for offline/tests/legacy callers.
3. **Post-close timestamp pinning.** During the live EGX session, a complete live quote snapshot may be appended at its real as-of time. After the regular 14:30 Cairo close, the live endpoint is pinned immediately after the final observed market point instead of using the later phone/browser wall-clock time. This prevents a 23:xx refresh from making the Today axis appear to extend into the night.

The Today engine does not vertically shift a finished equity curve to force a target total. Cash, shares, prices and transaction impacts must reconcile at their source.

## Today session-date ownership

Today follows the EGX session boundary rather than Cairo midnight.

`getLatestEgxSessionDate()` resolves:

- Friday/Saturday → previous EGX trading weekday;
- Sunday–Thursday before 10:00 Cairo → previous EGX trading weekday;
- Sunday–Thursday from 10:00 Cairo onward → current Cairo date.

Therefore a chart opened at 00:01–09:59 Cairo continues to display the previous session instead of querying a new empty calendar day.

`cairoSessionUtcBounds()` converts that selected Cairo date into its full UTC query interval using `Intl.DateTimeFormat(..., { timeZone: 'Africa/Cairo' })`. This is DST-aware and prevents a Cairo session from being clipped by UTC midnight.

After the requested date is chosen, resolution selection is same-session only: missing 1m/5m/15m data may fall back across resolutions, but not across session dates.

Ledger timing is evaluated separately from market-bar session selection:

- same-session BUY/SELL rows require `executedAt` to reconstruct execution order;
- date-only CASH rows are boundary external flows and do not count as missing execution timestamps;
- cash-entry default dates are derived in `Africa/Cairo`, not UTC, so a deposit after Cairo midnight is not accidentally attached to the previous market session.

## Live endpoint

The TradingView Scanner HTTP snapshot remains separate from persisted intraday ingestion.

A complete live snapshot may be appended only to the same Cairo session date. Every held position must have the same valid scanner receipt timestamp; mixed snapshots and previous-day cached prices cannot anchor live NAV. A mixed snapshot where a currently held ticker lacks a trustworthy live quote must not be treated as a complete portfolio endpoint.

## Workflow scheduling

Primary workflow:

```text
.github/workflows/intraday-1m-sync.yml
```

On production/default `main` it is configured for:

```text
*/5 7-13 * * 0-4
```

GitHub cron is UTC. The Node script applies the authoritative Cairo-local session gate and post-close grace window, so the broad UTC window safely covers Cairo DST changes. Scheduled workflows execute from `main`, which is the production authority.

Legacy direct-TradingView 5-minute workflow:

```text
.github/workflows/intraday-prices.yml
```

is manual-only. It remains a repair/rollback tool and is no longer a competing scheduled producer.

The production 1m writer is the scheduled authority. The legacy direct-5m workflow is manual-only and must not compete as a scheduled producer.

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
- Keep the pre-10:00 Cairo Today session on the previous EGX trading weekday.
- Build Cairo-day database bounds with timezone/DST-aware conversion, not raw UTC midnight.
- Keep benchmark indices in the same daily/intraday ingestion paths used by benchmark analytics.

See `docs/INTRADAY_1M_MIGRATION_PLAN.md` for the canonical 15-phase rollout status.

## September 28 audit and repair

See [MARKET_DATA_AUDIT_2026_09_28.md](MARKET_DATA_AUDIT_2026_09_28.md) for the dated September 28 evidence and repair history. Scheduler promotion has since occurred; the remaining operational debt is Stage 3.5 live-session ingestion reliability/soak closure.

Manual ingestion now resolves the latest EGX session rather than using the calendar day after midnight. Set `EGX_INTRADAY_SKIP_RETENTION=true` for a repair that must not prune old rows. Normal scheduled retention remains 30/90 days.
