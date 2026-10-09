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
| Today | Current EGX session after open, otherwise latest completed session | adaptive intraday: Auto / 1m / 5m / 15m, with optional 1h display aggregation |
| 1W | Elapsed 7-day lookback ending at the latest session | Daily |
| 1M | Rolling one calendar month ending at the latest session | Daily |
| 90D | Rolling 90 calendar days ending at the latest session | Daily |
| YTD | January 1 through the latest session | Daily |
| All | First portfolio transaction through the latest session | Daily |

For daily ranges, if a boundary lands on a weekend, holiday, or otherwise lacks a valuation, the engine uses the last complete valuation at or before the requested start as the analytical baseline. It never invents a synthetic price for the missing date.

`Today` requires intraday data. The reader uses the requested persisted resolution when explicitly selected (1m/5m/15m), while Auto chooses the finest trustworthy current-session candidate with comparable ticker/session coverage. The 1h option is derived in memory from the selected trustworthy intraday source. Missing current-session intraday data remains unavailable; the engine never substitutes an older session or a daily point.

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

The daily version is an end-of-day approximation. The Today path already uses execution timestamps plus trustworthy intraday valuations for same-session precision.

### Does TWR agree with the deposit-neutral Return chart?

They agree that an external deposit is **not profit**, but they do **not** generally have the same number or normalized curve after a mid-period deposit. Return is EGP earned/lost on the actual capital invested; TWR compounds subperiod percentages independently of the amount contributed.

For example, 1,000 EGP grows to 1,100 (+10%), then a 1,000 EGP deposit raises NAV to 2,100 with no investment gain. A subsequent +10% takes NAV to 2,310. Deposit-neutral Return is **310 EGP** (100 + 210); TWR is **21%** (1.10 × 1.10 − 1). Dividing 310 by the original 1,000 gives 31%, which is not TWR. With no intervening external flows and the same valuation baseline, EGP profit divided by starting capital can match TWR instead.

MWR is a separate cash-flow-timed percentage and can differ from TWR; boundary cash flows can also make them coincide. Date-only cash records limit timing precision. The latest-session hero/tooltip percentage is a third, explicitly broker-style convention, not a TWR alias. Missing percentage inputs are flagged through `dayChangeReliable`, even though its legacy numeric companion retains a compatibility fallback.

The audit changes labels, typing, presentation and tests only. Passing synthetic tests does not establish exact Telda parity or validate all historical corporate-action price adjustments.

## Net deposits

`netDeposits` is cumulative investor capital:

```text
deposits - withdrawals
```

It is cumulative from portfolio inception rather than reset to zero for each selected chart range. This allows a "Portfolio vs Net Deposits" chart to show total contributed capital against portfolio value consistently.

## Drawdown definitions

The unified engine exposes two related quantities:

- **performance drawdown %**: decline in the external-flow-neutral TWR performance index from its prior peak;
- **profit drawdown EGP**: decline in cumulative external-flow-neutral EGP profit from its prior peak (legacy field name `maxEquityDrawdownEgp`).

Performance drawdown is preferred for comparing investment performance because deposits cannot erase a loss simply by increasing account size. The legacy report KPI now uses this same TWR-based percentage. The EGP figure beside it is deposit-neutral profit drawdown, not a nominal NAV gap and not a conversion of the TWR percentage. A profit peak of +200 EGP followed by +80 EGP therefore has a 120 EGP drawdown.

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

The UI exposes:

`Auto · 1m · 5m · 15m · 1h`

`Auto` evaluates persisted 1m/5m/15m candidates and prefers the finest candidate that covers the same current-session ticker envelope. An explicit 1m/5m/15m selection requests only that persisted resolution. The 1h view is a client-side aggregation of the selected trustworthy source rather than a separate persisted interval.

`Today` is reconstructed by `src/services/intradayAnalyticsEngine.ts`.

The engine:

- selects the current EGX session after market open, otherwise the latest completed session; if a nominal weekday has no intraday bars, it falls back to the latest actual stored EGX session (holiday-safe);
- starts from pre-session cash and holdings rebuilt from the transaction ledger;
- values opening holdings from the prior trusted daily close;
- applies same-session trades at their exact `executedAt` timestamps;
- applies the selected trustworthy 1m/5m/15m timeline without look-ahead; the optional 1h view is aggregated from that selected source;
- uses the current partial bar only up to the current time during an active session;
- includes intraday round trips even when the security is no longer held at session end;
- includes brokerage fees through the ledger cash impact;
- computes intraday NAV, TWR, MWR, net deposits, and drawdown from the same timeline.

A same-session transaction without an execution timestamp makes the 1D reconstruction incomplete. The app does not guess its position inside the session.

The Today chart uses a straight `linear` line rather than a smoothed curve so the UI does not imply market observations that did not occur.

The selected persisted intraday timeline reconstructs the session path. During the active session, if every currently held ticker has a valid live quote, the engine appends one final as-of valuation using the same live position prices that drive the portfolio hero/current NAV. This makes the chart endpoint converge on the current portfolio value without rewriting earlier observations. If even one held ticker lacks a trustworthy live quote, no mixed live/stale endpoint is appended.

### Seven-day window semantics

`1W` uses an elapsed seven-day lookback: the boundary is exactly seven calendar days before the ending session. For example, an ending session of Sep 23 resolves to Sep 16. This matches the usual period-return convention of comparing the current value with the value one week earlier; the two boundary dates are endpoints, not seven inclusive date labels. The valuation selector uses the most recent complete valuation at or before that boundary when required.

### Current-session versus completed-session behavior

Today is keyed to the **EGX session boundary**, not to Cairo calendar midnight.

- Friday/Saturday resolve to the previous EGX trading weekday.
- On Sunday–Thursday from **00:00 through 09:59 Cairo**, Today continues to show the previous trading weekday/session.
- At **10:00 Cairo**, the requested Today session switches to the current Cairo date.
- Once that requested session is chosen, missing intraday data does not authorize silently switching to an older session date.
- The database query window is the complete Cairo calendar day converted to UTC using `Africa/Cairo` timezone rules, so midnight and DST do not clip or shift the requested session.
- During an active session, the newest available partial bar at the selected resolution is valued only through the current time.

This intentionally fixes the post-midnight empty-chart failure while preserving the no-fabricated-session rule. Exchange holidays after the 10:00 boundary still remain unavailable unless real bars exist for the requested date; the current resolver is weekday/session-time aware, not an exchange-holiday calendar.

Date-only CASH events have different timing semantics from exchange executions. A same-session CASH row without `executedAt` is treated as a session-boundary external flow rather than an untimed trade. It must not make every intraday point incomplete. Same-session BUY/SELL trades still require `executedAt` because their ordering against market bars affects shares, cash and NAV.

New cash rows default to the Cairo calendar date. UTC `toISOString().slice(0, 10)` must not be used for EGX/accounting date defaults because the Cairo date can already have rolled over while UTC is still on the prior day.


### MWR presentation

The headline remains the non-annualized selected-period MWR.

For `All`, annualized XIRR is shown only as a secondary reference value.

### Data availability

If no acceptable current-session 1m/5m/15m candidate exists, Today remains explicitly unavailable instead of falling back to a daily price or an older intraday session.

The ingestion workflow is also triggered when its own workflow/script changes are merged to `main`, which allows an empty production intraday store to seed immediately after deployment while preserving the normal 15-minute scheduled ingestion.


## Analytics chart modes

The primary analytics card supports five modes that all reuse the same selected timeframe and the same unified/intraday valuation result.

### Return (EGP)

The primary series is selected-period investment profit after neutralizing deposits, withdrawals and return-neutral accounting corrections. It consumes the engine's `returnEgp`; the medium UI retains a cash-flow-neutral fallback for compatible older points. It is not portfolio NAV.

The medium UI optionally overlays NAV on a separately labelled right-hand EGP axis. Deposits can move that NAV line without becoming profit. The Return tooltip's interval percentage follows the existing hero convention: interval gain / (ending NAV − interval gain). This percentage is not TWR; missing reference capital must be presented as unavailable.

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

All five modes support:

```text
Today · 1W · 1M · 90D · YTD · All
```

`Today` uses the selected trustworthy Auto/1m/5m/15m intraday series, with optional 1h display aggregation. Longer periods use complete daily valuation points.

### Visual behavior

- Today remains a straight linear chart for all modes.
- Portfolio vs Net Deposits uses two distinct same-scale lines.
- Longer single-series views may use the restrained area treatment from the shared chart visual system.
- Tooltips, axes, crosshairs, empty states, EGP formatting, and percentage formatting use the shared Phase 3 analytics theme.


### Portfolio vs Benchmarks

The primary analytics card also supports a flow-neutral benchmark comparison mode:

```text
Portfolio (TWR)
EGX30
EGX70 EWI
EGX100 EWI
```

All four series are expressed as percentage return and normalized from the selected-period beginning-of-period baseline. The portfolio leg uses TWR so deposits and withdrawals cannot create artificial outperformance or underperformance.

Benchmark observations use the latest trustworthy index observation at or before each portfolio valuation timestamp; future index observations are never carried backward. Daily comparison uses persisted TradingView daily history. Today uses the same selected trustworthy intraday resolution as the portfolio chart, including the optional 1h display aggregation.

The UI exposes relative return as:

```text
portfolio TWR - benchmark normalized return
```

A positive relative value means portfolio outperformance over the selected period; a negative value means underperformance. Missing benchmark data remains missing and does not invalidate the portfolio analytics series.


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

For daily timeframes the chart uses historical daily closes. For Today it uses the selected trustworthy intraday resolution, prior-session closes for the opening baseline, and exact execution timestamps for same-session trades.

The secondary analytics service never mutates portfolio rows, positions, closed trades, or transactions.



<!-- deployment-trigger: premium-cloudflare-2026-09-23-2331 -->

### Rolling-period boundary valuation

Daily rolling periods distinguish the **first plotted date** from the **beginning-of-period valuation**. If a 1W chart ends on Sep 23, its plotted window begins Sep 16, but the return baseline is the last complete close strictly before that boundary (Sep 15). This is the portfolio value at the beginning of Sep 16; using Sep 16's closing valuation would discard the first day's performance. External capital flows after the baseline are neutralized by the return calculations.


## Market-data consistency audit (September 28, 2026)

Today uses one Cairo session for Auto/1m/5m/15m/1h. Missing current-session candles do not authorize switching dates. Secondary unrealized P&L uses the primary engine's market value minus ledger remaining cost and buy fees, so candle timing and the complete live endpoint match the main chart. Drawdown continues to use the unified performance curve. Daily 1W/1M/90D/YTD/ALL reads are paginated in `(trading_date, ticker)` order. Intraday reads use `(bar_timestamp, ticker)` order. Visible history and realized-trajectory windows refresh independently of whether a quote price changed. Daily axis labels are Cairo-based across device timezones.

The visual curves, materials, navigation, and accepted Phase 8/9 hierarchy are unchanged. See [the audit](MARKET_DATA_AUDIT_2026_09_28.md) for evidence and deployment limits.
