# Intraday Market Data

## Purpose

The intraday market-data layer stores 5-minute EGX bars for portfolio-relevant securities. It is the data foundation for future 1D portfolio analytics, including transaction-aware NAV, MWR, TWR, and Telda-style session charts.

This layer does not change portfolio accounting and does not render charts by itself.

## Source and interval

- Source: TradingView through `@ch99q/twc`
- Exchange: EGX
- Target interval: 5 minutes
- Legacy fallback interval: 15 minutes while 5-minute coverage is being established
- Storage timezone: UTC (`timestamptz`)
- Display/analytics timezone: `Africa/Cairo`
- Retention: 90 rolling calendar days by default

TradingView supplies the actual bar timestamps. GitHub Actions scheduling controls ingestion frequency only; it does not manufacture bar boundaries.

## Database table

Intraday bars are stored separately from permanent daily history:

```text
public.intraday_price_history
```

Primary key:

```text
(ticker, interval_minutes, bar_timestamp)
```

Columns:

| Column | Purpose |
| --- | --- |
| `ticker` | Normalized EGX ticker |
| `interval_minutes` | Bar interval; target is 5, with legacy 15-minute rows retained as read fallback |
| `bar_timestamp` | UTC bar timestamp |
| `open` | Bar open |
| `high` | Bar high |
| `low` | Bar low |
| `close` | Bar close |
| `volume` | Bar volume when available |
| `source` | Market-data source |
| `retrieved_at` | Last ingestion timestamp |

Daily bars remain in `price_history` and are retained permanently.

## Access control

The table is exposed to the application as read-only market data:

- `authenticated`: SELECT only
- `anon`: no access
- trusted server/automation role: SELECT/INSERT/UPDATE/DELETE
- RLS: enabled
- authenticated SELECT policy: allows signed-in users to read market bars

Browser code must never receive the Supabase server secret.

## Sync universe

The ingestion script synchronizes:

1. tickers appearing in portfolio transactions within the retention window;
2. all currently open-position tickers.

This ensures a ticker that was traded intraday and fully closed can still be reconstructed for a historical session.

For diagnostics or targeted backfills, `EGX_INTRADAY_TICKERS` can override the discovered universe with a comma-separated ticker list.

## Initial backfill and incremental sync

The first successful sync detects that no bars are stored and requests enough recent 5-minute observations to cover approximately the configured retention period.

Subsequent syncs inspect the newest stored timestamp per ticker and request only a bounded overlapping window. Only timestamps missing from Supabase are inserted. Existing observations are left untouched.

The sync intentionally overlaps recent bars. Correctness is preferred over trying to infer whether TradingView's newest bar is final.

## Retention

At the end of each successful run, the server-side sync removes rows older than the configured retention period.

Default:

```text
90 days
```

Override:

```env
EGX_INTRADAY_RETENTION_DAYS=90
```

The accepted range is capped by the script to prevent accidental unbounded retention.

## Commands

Run manually:

```bash
npm run sync:intraday
```

Required environment:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

Recommended:

```env
EGX_PORTFOLIO_ID=...
EGX_INTRADAY_RETENTION_DAYS=90
```

Optional targeted run:

```env
EGX_INTRADAY_TICKERS=ORAS,TALM,MASR
```

Optional fixed TradingView request size for diagnostics:

```env
EGX_INTRADAY_BAR_COUNT=200
```

## GitHub Actions

`.github/workflows/intraday-prices.yml` runs every 15 minutes during a broad Sunday-through-Thursday UTC window.

The broad window intentionally covers Cairo daylight-saving changes. If a scheduled run occurs outside an active market period, TradingView simply returns the most recent bars and the missing-row insert remains idempotent.

Workflow concurrency allows only one active intraday ingestion run at a time.

## Browser reads

Browser startup must not trigger TradingView ingestion. The browser reads persisted Supabase rows only; TradingView ingestion/backfill belongs to the Node workflow. A legacy Cloudflare intraday-repair route exists only as a successful no-op for stale cached clients during rollout.


`src/services/intradayPriceStore.ts` provides normalized, timestamp-sorted intraday series.

The underlying Supabase reader paginates in batches of 1,000 rows so future analytics are not silently truncated by a Data API row limit.

## Data-integrity rules

- Never synthesize missing prices.
- Reject malformed or non-positive OHLC data.
- Keep timestamps as UTC in storage.
- Convert to Cairo only when determining/displaying the trading session.
- Do not mix intraday rows into the daily `price_history` table.
- Prefer persisted 5-minute rows in Today analytics; if none exist for the requested/latest session, fall back to persisted 15-minute rows rather than returning an empty chart or synthesizing data.
- Do not use intraday bars to mutate accounting records.
- A missing ticker/session must remain explicitly missing until a trusted source supplies it.

## Next phase

Pass 2 consumes this foundation to create a unified analytics engine for:

- portfolio NAV;
- net deposits;
- MWR;
- TWR;
- drawdown;
- consistent timeframe boundaries.

No chart presentation assumptions belong in the market-data layer.
