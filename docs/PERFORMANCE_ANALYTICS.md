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
