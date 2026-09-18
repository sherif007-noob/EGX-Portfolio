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
| 1W | Rolling 7 calendar days ending at the latest session | Daily |
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

Performance drawdown is preferred for comparing investment performance because deposits cannot erase a loss simply by increasing account size.

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

