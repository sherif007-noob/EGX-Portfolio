# Performance Analytics

## Goals

The analytics layer is designed to calculate portfolio performance from real ledger events and historical market prices without manufacturing missing values.

The key dependency chain is:

```text
transaction ledger
+ historical market prices
        ↓
historical daily valuation
        ↓
MWRR / performance chart
drawdown
other historical analytics
```

## Historical prices

Historical prices are stored in `price_history`.

The scheduled historical sync runs Sunday through Thursday, matching EGX trading days.

Ticker symbols are normalized when necessary so variants such as an `EGX:` prefix or `.CA` suffix map to the stored EGX ticker.

## Historical portfolio valuation

The application reconstructs daily portfolio state by replaying transactions and valuing open holdings with the historical close for each trading day.

A valuation generally consists of:

```text
equity = cash + market value of open holdings
```

The system should not use current prices as a substitute for unavailable historical prices.

## Money-weighted return

The Reports performance chart uses a money-weighted return approach based on dated external cash flows and portfolio value.

Conceptually this is an XIRR-style calculation:

```text
NPV(cash flows, rate) = 0
```

The chart can calculate a money-weighted return at each historical valuation date.

### External investor flows

Examples of external flows:

- deposits;
- withdrawals.

Internal portfolio activity is not an external investor flow:

- stock purchases;
- stock sales;
- dividends;
- fees;
- cash adjustments used to correct internal bookkeeping.

Legacy portfolios that began with a capital balance but do not contain explicit deposit rows may use a synthetic analytical opening deposit. This is for performance math only and must not be persisted as a new financial transaction.

## Drawdown

Drawdown measures the decline from a prior portfolio equity peak.

For valuation `V_t` and running peak `P_t`:

```text
drawdown_t = (V_t - P_t) / P_t
```

The application intentionally reports drawdown as unavailable when it cannot produce a trustworthy historical equity series.

Examples that should produce `N/A` rather than a fabricated number:

- too few valid valuation days;
- gaps that make the requested period incomplete;
- missing historical prices for required holdings.

## Realized and unrealized P&L

Realized P&L comes from closed trade cycles derived from ledger BUY/SELL activity.

Unrealized P&L is based on currently open positions and current market price.

Fees are included in accounting and must not be double-counted when bridging between ledger cash, realized P&L, and equity.

## Closed cycles

Partial sells and multi-lot positions can produce closed-cycle records while shares remain open.

The reconciliation engine retains the transaction IDs contributing to a cycle so performance figures are traceable back to the ledger.

## Young-portfolio behavior

Annualized money-weighted returns can appear extremely large for a very young portfolio because a short holding period is being annualized.

This is a property of the chosen metric, not necessarily a calculation error.

Do not silently cap or replace the metric because it looks visually surprising. If the presentation needs to change, change the semantics explicitly and add tests.

## Validation principles

Analytics changes should include tests for:

- deposits and withdrawals;
- legacy opening capital;
- no double-counting of opening capital;
- partial sells;
- fees;
- dividends;
- ticker normalization;
- missing history;
- MWRR availability;
- drawdown availability.

Relevant test files include:

- `src/services/performanceEngine.test.ts`
- `src/services/portfolioPerformance.test.ts`
- `src/services/portfolioAccounting.test.ts`
- `src/services/portfolioReconciliation.test.ts`


## Unified analytics engine

`src/services/unifiedAnalyticsEngine.ts` is the canonical analytical layer for the next-generation portfolio charts.

It derives all primary series from the same ledger and valuation timeline:

- portfolio NAV/equity;
- cumulative net deposits;
- TWR;
- MWR;
- performance drawdown;
- equity drawdown.

The goal is to prevent separate dashboard/report components from implementing different financial definitions for the same period.

## Timeframe semantics

Shared timeframe boundaries live in `src/services/analyticsTimeframes.ts`.

| Timeframe | Definition | Resolution |
| --- | --- | --- |
| Today | Current EGX session after open, otherwise latest completed session | 15-minute |
| 1W | Elapsed 7-day lookback ending at the latest session | Daily |
| 1M | Rolling one calendar month ending at the latest session | Daily |
| 90D | Rolling 90 calendar days ending at the latest session | Daily |
| YTD | January 1 through the latest session | Daily |
| All | First portfolio transaction through the latest session | Daily |

For daily ranges, if a boundary lands on a weekend, holiday, or otherwise lacks a valuation, the engine uses the last complete valuation at or before the requested start as the analytical baseline. It never invents a synthetic price for the missing date.

`Today` is marked as requiring intraday data. Pass 2 intentionally does not substitute a daily point for the missing 15-minute series; session reconstruction belongs to the intraday analytics pass.

## Selected-period MWR

The main MWR value for a selected chart period is a **non-annualized period return**.

This keeps the meaning consistent across:

- Today;
- 1W;
- 1M;
- 90D;
- YTD;
- All.

The calculation starts with the portfolio value at the selected-period baseline, includes only external investor flows after that baseline, and closes with the ending portfolio value.

Deposits are investor cash outflows; withdrawals are investor cash inflows. Trades, dividends, brokerage fees, and internal bookkeeping adjustments are not external investor flows.

The existing annualized XIRR-style return is retained separately as `annualizedMwrrPercent` for long-term/reference use. It is not the headline return for short periods.

## Time-weighted return

TWR measures portfolio performance independently of external deposits and withdrawals.

For each daily sub-period:

```text
subperiod return =
  (ending equity - net external portfolio flow)
  / starting equity
  - 1
```

The sub-period returns are geometrically linked:

```text
TWR = product(1 + subperiod return) - 1
```

A deposit therefore changes portfolio size but does not count as investment performance.

The daily version is an end-of-day approximation. The intraday pass will use execution timestamps and 15-minute valuations to improve same-session precision.

## Net deposits

`netDeposits` is cumulative investor capital:

```text
deposits - withdrawals
```

It is cumulative from portfolio inception rather than reset to zero for each selected chart range. This allows a "Portfolio vs Net Deposits" chart to show total contributed capital against portfolio value consistently.

## Drawdown definitions

The unified engine exposes two related quantities:

- **performance drawdown %**: decline in the external-flow-neutral TWR performance index from its prior peak;
- **equity drawdown EGP**: raw decline in portfolio equity from its prior nominal equity peak.

Performance drawdown is preferred for comparing investment performance because deposits cannot erase a loss simply by increasing account size. The legacy report KPI now uses this same TWR-based percentage. When an EGP drawdown figure is shown beside it, that EGP value is explicitly the nominal equity peak-to-trough gap rather than a second percentage-equivalent calculation.

## Data quality

No analytics mode is allowed to fabricate a missing valuation.

Daily points are usable only when all held securities required for that valuation have trustworthy historical prices.

The result exposes:

- valuation day count;
- complete day count;
- incomplete day count;
- missing tickers;
- whether the selected range has enough complete points;
- whether the timeframe requires intraday reconstruction.


### Automatic repair for newly introduced tickers

A newly added portfolio ticker can exist in the transaction ledger before that symbol has any rows in `price_history`. In that state, every valuation from the first held day onward is incomplete because the engine cannot value the new holding. Those dates are intentionally excluded rather than valuing the security at zero, carrying the trade price forward, or substituting the current quote.

This previously appeared in the UI as the performance graph suddenly stopping before the newest trades.

The application now treats `dataQuality.missingTickers` as an ingestion signal:

1. load the canonical historical-price store;
2. build analytics without fabricating missing values;
3. detect held tickers that make valuation dates incomplete;
4. request an authenticated server-side historical backfill from that ticker's first transaction date;
5. upsert only missing TradingView daily bars into `price_history`;
6. reload the canonical store once and rebuild analytics.

The request includes the in-memory first-transaction date as a hint so a just-added trade can be repaired even if asynchronous portfolio persistence is still completing. When the ticker already exists in the persisted ledger, the persisted first-transaction date is authoritative; the client hint is only a fallback for the brief persistence race.

The repair path is generic. It must never contain ticker-specific exceptions or manually seed a ticker merely to make the chart look complete. If TradingView cannot supply a trustworthy close, the affected valuation remains incomplete.

Regression coverage lives in `src/services/unifiedAnalyticsEngine.test.ts` and verifies that a newly introduced ticker first appears in `missingTickers`, then restores the previously excluded valuation dates after history becomes available.



## Timeframe UI and intraday reconstruction

The Reports performance card now uses one shared timeframe selector:

```text
Today · 1W · 1M · 90D · YTD · All
```

The daily timeframes use `buildUnifiedAnalyticsResult()` and therefore share the same NAV, external-flow, TWR, MWR, and drawdown semantics defined by the unified analytics engine.

### Today

`Today` is reconstructed by `src/services/intradayAnalyticsEngine.ts`.

The engine:

- selects the current EGX session after market open, otherwise the latest completed session; if a nominal weekday has no intraday bars, it falls back to the latest actual stored EGX session (holiday-safe);
- starts from pre-session cash and holdings rebuilt from the transaction ledger;
- values opening holdings from the prior trusted daily close;
- applies same-session trades at their exact `executedAt` timestamps;
- applies 15-minute TradingView bars without look-ahead;
- uses the current partial bar only up to the current time during an active session;
- includes intraday round trips even when the security is no longer held at session end;
- includes brokerage fees through the ledger cash impact;
- computes intraday NAV, TWR, MWR, net deposits, and drawdown from the same timeline.

A same-session transaction without an execution timestamp makes the 1D reconstruction incomplete. The app does not guess its position inside the session.

The Today chart uses a straight `linear` line rather than a smoothed curve so the UI does not imply market observations that did not occur.

The stored 15-minute bars reconstruct the session path. During the active session, if every currently held ticker has a valid live quote, the engine appends one final as-of valuation using the same live position prices that drive the portfolio hero/current NAV. This makes the chart endpoint converge on the current portfolio value without rewriting the earlier 15-minute path. If even one held ticker lacks a trustworthy live quote, no mixed live/stale endpoint is appended.

### Seven-day window semantics

`1W` uses an elapsed seven-day lookback: the boundary is exactly seven calendar days before the ending session. For example, an ending session of Sep 23 resolves to Sep 16. This matches the usual period-return convention of comparing the current value with the value one week earlier; the two boundary dates are endpoints, not seven inclusive date labels. The valuation selector uses the most recent complete valuation at or before that boundary when required.

### Current-session versus completed-session behavior

During an active session, the newest available partial 15-minute bar is valued only through the current time.

The session boundary is shared with the live-market scheduler: the regular EGX session starts at 10:00 Cairo Sunday–Thursday. The earlier 09:30 window is treated as pre-market, not portfolio-session performance. After the session closes—or on a non-trading day—the selector resolves to the latest completed EGX session. If a weekday is an exchange holiday, the UI resolves to the latest actual session present in intraday market data instead of displaying a fabricated empty day.

### MWR presentation

The headline remains the non-annualized selected-period MWR.

For `All`, annualized XIRR is shown only as a secondary reference value.

### Data availability

If no 15-minute rows exist for the selected session, Today remains explicitly unavailable instead of falling back to a daily price.

The ingestion workflow is also triggered when its own workflow/script changes are merged to `main`, which allows an empty production intraday store to seed immediately after deployment while preserving the normal 15-minute scheduled ingestion.


## Analytics chart modes

The primary analytics card supports four modes that all reuse the same selected timeframe and the same unified/intraday valuation result.

### Portfolio vs Return

Primary series:

```text
portfolio equity / NAV
```

The headline is ending portfolio value. The companion values are selected-period portfolio P&L in EGP and the flow-aware selected-period MWR percentage.

The percentage is intentionally not calculated as simple `P&L / starting equity` because deposits and withdrawals inside the selected period would distort that result.

### Portfolio vs Net Deposits

Two EGP series share one scale:

```text
Portfolio
Net Deposits
```

`Net Deposits` is cumulative contributed investor capital from inception:

```text
deposits - withdrawals
```

This mode makes the gap between contributed capital and current portfolio value visually explicit.

### Performance (TWR)

The chart displays the unified engine's time-weighted return series.

External deposits and withdrawals are neutralized so this view answers:

```text
How did the investment strategy itself perform?
```

### Performance (MWR)

The chart displays selected-period money-weighted return.

This view answers:

```text
What return did the investor's actual money experience,
given the timing of deposits and withdrawals?
```

For `All`, annualized XIRR remains a secondary reference only.

### Mode and timeframe independence

Changing chart mode does not reset the selected timeframe. Changing timeframe does not change the selected mode.

All four modes support:

```text
Today · 1W · 1M · 90D · YTD · All
```

`Today` uses the 15-minute transaction-aware series. Longer periods use complete daily valuation points.

### Visual behavior

- Today remains a straight linear chart for all modes.
- Portfolio vs Net Deposits uses two distinct same-scale lines.
- Longer single-series views may use the restrained area treatment from the shared chart visual system.
- Tooltips, axes, crosshairs, empty states, EGP formatting, and percentage formatting use the shared Phase 3 analytics theme.


## Secondary analytics

Phase 6 adds secondary analytical views that reuse the same selected timeframe and valuation result as the primary analytics card.

### Performance drawdown

The drawdown chart uses the unified engine's external-flow-neutral performance drawdown series.

This means deposits and withdrawals cannot make a drawdown disappear merely by changing account size.

The percentage series is:

```text
current TWR performance index
relative to
the prior peak TWR performance index
```

The card also reports nominal equity peak-to-trough loss in EGP as a secondary reference.

### Cumulative fees

The fee chart measures fees paid inside the visible timeframe.

Included:

- BUY brokerage fees;
- SELL brokerage fees;
- explicit `CASH` rows with `cashFlowType = FEE`.

Excluded:

- deposits;
- withdrawals;
- dividends;
- ordinary cash adjustments.

The series is cumulative within the selected visible range and is not used as a second deduction from P&L; trading P&L already includes fees where appropriate.

### Realized vs Unrealized P&L

The P&L composition chart is reconstructed read-only from the transaction ledger.

Realized P&L uses the same proportional cost and buy-fee allocation semantics as portfolio reconciliation:

```text
net sell proceeds
- allocated gross cost
- allocated buy fees
```

Unrealized P&L is calculated for remaining open shares using the trusted market price for each valuation point:

```text
open market value
- remaining gross cost
- remaining buy fees
```

For daily timeframes the chart uses historical daily closes. For Today it uses 15-minute prices, prior-session closes for the opening baseline, and exact execution timestamps for same-session trades.

The secondary analytics service never mutates portfolio rows, positions, closed trades, or transactions.



<!-- deployment-trigger: premium-cloudflare-2026-09-23-2331 -->

### Rolling-period boundary valuation

Daily rolling periods distinguish the **first plotted date** from the **beginning-of-period valuation**. If a 1W chart ends on Sep 23, its plotted window begins Sep 16, but the return baseline is the last complete close strictly before that boundary (Sep 15). This is the portfolio value at the beginning of Sep 16; using Sep 16's closing valuation would discard the first day's performance. External capital flows after the baseline are neutralized by the return calculations.
