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

## Capital baseline authority

Legacy portfolios may predate explicit deposit/withdrawal ledger rows. In that case, analytics must not blindly trust a cached `capitalDeposits` scalar as the opening-capital baseline.

The canonical legacy baseline is derived from the authoritative current cash balance and the transaction ledger:

```text
opening capital
  = current cash
  - cumulative signed ledger cash impact
```

When explicit deposit/withdrawal rows exist, net contributed capital is derived directly from those external flows instead.

This rule is shared across Today and the daily 1W/1M/90D/YTD/All analytics. It prevents a stale opening-capital cache from shifting the entire NAV curve by a constant amount while leaving period P&L apparently correct.

## Money-weighted return

The Reports performance chart uses a money-weighted return approach based on dated external cash flows and portfolio value.

Conceptually this is an XIRR-style calculation:

```text
NPV(cash flows, rate) = 0
```

The chart can calculate a money-weighted return at each historical valuation date.

### External investor flows and return-neutral bookkeeping flows

True investor capital flows are:

- `DEPOSIT`;
- `WITHDRAWAL`.

They are the only cash events counted in contributed capital and the chart's `netDeposits` series.

Internal portfolio performance remains performance rather than investor flow:

- stock purchases/sales;
- `DIVIDEND`;
- `OTHER_INCOME`;
- `FEE`;
- `OTHER_EXPENSE`.

`RECONCILIATION_ADJUSTMENT` is a third class. It changes recorded cash to repair bookkeeping, so return math must neutralize its mechanical equity jump. TWR/MWRR therefore include its signed effect as a return-neutral portfolio flow, while `netDeposits` and contributed capital exclude it.

This distinction prevents both failure modes:

```text
bookkeeping repair ≠ investment performance
bookkeeping repair ≠ investor contribution
```

Legacy `CASH_ADJUSTMENT` is normalized to `RECONCILIATION_ADJUSTMENT`.

Legacy portfolios that began with a capital balance but do not contain explicit deposit/withdrawal rows may use a synthetic analytical opening deposit. A reconciliation row does not suppress that synthetic opening-capital fallback. The synthetic flow is for performance math only and must not be persisted as a new financial transaction.

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
| Today | Current requested EGX session under Cairo session rules | Coverage-aware observed intraday: Auto 1m → 5m → legacy 15m; manual 1m/5m/15m; client-derived 1h |
| 1W | Elapsed 7-day lookback ending at the latest session | Daily |
| 1M | Rolling one calendar month ending at the latest session | Daily |
| 90D | Rolling 90 calendar days ending at the latest session | Daily |
| YTD | January 1 through the latest session | Daily |
| All | First portfolio transaction through the latest session | Daily |

For daily ranges, if a boundary lands on a weekend, holiday, or otherwise lacks a valuation, the engine uses the last complete valuation at or before the requested start as the analytical baseline. It never invents a synthetic price for the missing date.

`Today` requires observed intraday data. The requested Cairo session is shared by every intraday resolution. Missing current-session data does not authorize switching to an older date or synthesizing a daily substitute.

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

The daily version is an end-of-day approximation. Today uses execution timestamps and the selected observed intraday timeline for same-session precision.

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



## Timeframe UI and intraday reconstruction

The Reports performance card now uses one shared timeframe selector:

```text
Today · 1W · 1M · 90D · YTD · All
```

The daily timeframes use `buildUnifiedAnalyticsResult()` and therefore share the same NAV, external-flow, TWR, MWR, and drawdown semantics defined by the unified analytics engine.

### Today

`Today` is reconstructed by `src/services/intradayAnalyticsEngine.ts`.

The engine:

- resolves one requested EGX session using Cairo session rules;
- requires every selected resolution to match that same session;
- starts from pre-session cash and holdings rebuilt from the transaction ledger;
- values opening holdings from the prior trusted daily close;
- applies same-session trades at their exact `executedAt` timestamps;
- applies observed intraday market bars without look-ahead;
- uses the current partial observation only up to the current time during an active session;
- includes intraday round trips even when the security is no longer held at session end;
- includes brokerage fees through the ledger cash impact;
- computes intraday NAV, TWR, MWR, net deposits, and drawdown from the same timeline.

A same-session transaction without an execution timestamp makes the 1D reconstruction incomplete. The app does not guess its position inside the session.

The Today chart uses a straight `linear` line rather than a smoothed curve so the UI does not imply market observations that did not occur.

The selected observed intraday series reconstructs the session path. Auto prefers sufficient raw 1m, then sufficient derived 5m, then legacy 15m. Manual 1m/5m/15m uses the requested persisted tier; 1h is derived client-side from the healthiest observed source. During the active session, if every currently held ticker has a valid same-session live quote, the engine may append one final as-of valuation using the same live position prices that drive current NAV. If even one held ticker lacks a trustworthy live quote, no mixed live/stale endpoint is appended.

### Seven-day window semantics

`1W` uses an elapsed seven-day lookback: the boundary is exactly seven calendar days before the ending session. For example, an ending session of Sep 23 resolves to Sep 16. This matches the usual period-return convention of comparing the current value with the value one week earlier; the two boundary dates are endpoints, not seven inclusive date labels. The valuation selector uses the most recent complete valuation at or before that boundary when required.

### Current-session versus completed-session behavior

During an active session, observations after the current Cairo time are excluded.

The regular EGX session starts at 10:00 Cairo Sunday–Thursday. The earlier 09:30 window is pre-market, not portfolio-session performance. Before open and on normal closed days, Cairo session logic resolves the appropriate prior session. Once a current session is requested, missing ingestion is treated as missing data rather than evidence that the app should silently display a different stored date.

### MWR presentation

The headline remains the non-annualized selected-period MWR.

For `All`, annualized XIRR is shown only as a secondary reference value.

### Data availability

If the requested session lacks a usable observed intraday series, Today remains explicitly unavailable instead of falling back to a daily price or a different date.

Scheduled raw-1m ingestion runs from `main`; derived 5m is rebuilt from persisted raw truth. Legacy 15m remains a fallback/repair tier only while rollout evidence is incomplete.


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

`Today` uses the transaction-aware observed intraday series selected under the 1m/5m/15m policy. Longer periods use complete daily valuation points.

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

For daily timeframes the chart uses historical daily closes. For Today it uses the selected observed intraday prices, prior-session closes for the opening baseline, and exact execution timestamps for same-session trades.

The secondary analytics service never mutates portfolio rows, positions, closed trades, or transactions.



### Rolling-period boundary valuation

Daily rolling periods distinguish the **first plotted date** from the **beginning-of-period valuation**. If a 1W chart ends on Sep 23, its plotted window begins Sep 16, but the return baseline is the last complete close strictly before that boundary (Sep 15). This is the portfolio value at the beginning of Sep 16; using Sep 16's closing valuation would discard the first day's performance. External capital flows after the baseline are neutralized by the return calculations.


## Market-data consistency audit (September 28, 2026)

Today uses one Cairo session for Auto/1m/5m/15m/1h. Missing current-session candles do not authorize switching dates. Secondary unrealized P&L uses the primary engine's market value minus ledger remaining cost and buy fees, so candle timing and the complete live endpoint match the main chart. Drawdown continues to use the unified performance curve. Daily 1W/1M/90D/YTD/ALL reads are paginated in `(trading_date, ticker)` order. Intraday reads use `(bar_timestamp, ticker)` order. Visible history and realized-trajectory windows refresh independently of whether a quote price changed. Daily axis labels are Cairo-based across device timezones.

The visual curves and analytical semantics remain protected by the current chart/visual contracts. See [the audit](MARKET_DATA_AUDIT_2026_09_28.md) for the September incident evidence and [INTRADAY_MARKET_DATA.md](INTRADAY_MARKET_DATA.md) for current production policy.

## Reports workspace integration

Stage 5 reorganized Reports without rewriting these calculations.

The same trusted analytics surfaces now live inside the dedicated **Analytics** workspace, while Overview consumes diagnostic summaries and promotes into the full workspace when deeper inspection is requested. Report mode persistence is presentation state only and does not alter analytics math.

## Corporate-action analytics

Supported bonus-share corporate actions are quantity/cost-basis adjustments, not external cash flows.

Historical/Today analytics must not create artificial profit/loss solely because share count increased and the market price mechanically adjusted. The corporate-action ledger remains the source of the quantity event; missing market observations are still never synthesized.

See [CORPORATE_ACTIONS_LEDGER.md](CORPORATE_ACTIONS_LEDGER.md).
