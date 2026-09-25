# Phase 8 Hierarchy Audit Map

## Purpose

This document maps the current premium UI onto the Phase 8 H0–H5 hierarchy model before screen-specific hierarchy changes begin.

It is an audit/map, not a statement that every component already implements the target hierarchy correctly.

## Hierarchy levels

| Level | Role | Typical treatment |
| --- | --- | --- |
| H0 | Page canvas / structural grouping | no card hover, no card-like elevation |
| H1 | Hero / decision surface | strongest type/depth; normally one per local context |
| H2 | Primary supporting surface | clear card/visualization, lower than H1 |
| H3 | Secondary information | quieter card/group, lower glow |
| H4 | Inset / detail / controls | nested plot, toolbar, metric block, filter area |
| H5 | Dense data | tables, lists, repeated rows, journals/directories |

## Overview — `PortfolioSummary.tsx`

### Target hierarchy

- **H0** — overall Overview content stack.
- **Utility/context strip** — EGX Live Market Feed; visually below portfolio KPIs even though it appears first structurally.
- **H1** — Total Portfolio Value + Today state.
- **H2** — Unrealized P&L.
- **H2** — Total Market Value / current exposure.
- **H3** — Realized Gain (Booked).
- **H3** — Cash Available.
- **H3** — Brokerage Fees.
- **H4** — inline badges, Cost/holdings metadata, Adjust action, gross P&L helper values.
- **H5** — Active Positions table/list below the KPI summary.

### Current debt

- six KPI cards still read too equally;
- semantic red/green can overpower structural importance;
- market-feed utility strip competes with portfolio summary;
- desktop grid distributes visual weight too evenly.

## Reports — `PerformanceReports.tsx`

### Target hierarchy

- **H0** — Reports page / major report-section grouping.
- **H1** — main unified analytics context when present as the principal visualization.
- **H2** — Performance Drawdown.
- **H2** — Cumulative Fees.
- **H2** — Realized vs Unrealized P&L.
- **H2** — Realized Gain / Loss Trajectory.
- **H2** — Portfolio Allocation.
- **H2/H3** — Portfolio Equity Bridge depending surrounding section.
- **H3** — summary metric groups supporting each visualization.
- **H4** — chart plot surfaces.
- **H4** — allocation center summary and ranked breakdown container.
- **H4** — trajectory metric summary blocks and selector rows.
- **H3/H5** — Trading Performance and Monthly Performance summary/result areas.
- **H5** — dense report tables and repeated month/trade rows.

### Current debt

- outer report shells often compete with inner visualization surfaces;
- several nested surfaces use similar border/glow strength;
- repeated metadata labels can carry too much visual weight.

## Open Positions — `PositionsTable.tsx`

### Target hierarchy

- **H0** — tab page.
- **H2/H3** — summary/count/value region.
- **H4** — search, sector filtering, and local action toolbar.
- **H5** — positions table / repeated mobile position cards.
- **Row semantic state** — edge/accent treatment only; never promote a row to H1/H2.

### Current debt

- repeated cards/rows can feel more elevated than their toolbar context;
- desktop summary and data regions need more deliberate separation.

## Closed Cycles — `ClosedCyclesView.tsx`

### Target hierarchy

- **H0** — page.
- **H2/H3** — closed-cycle summary metrics.
- **H4** — search/filter/sort toolbar.
- **H5** — cycle result list/table.
- **H4** — expanded cycle detail inside a selected result.

### Current debt

- summary KPI cards and repeated cycle rows use similar card language;
- expanded content should read as detail, not another peer card.

## Transactions — `TradingJournal.tsx`

### Target hierarchy

- **H0** — page.
- **H2/H3** — journal summary/status region.
- **H4** — canonical selector/filter/search toolbar.
- **H5** — transaction list/table.
- **H4** — inline edit state/details.
- **Action priority** — Add Trade primary; edit/delete secondary/destructive.

### Current debt

- transaction controls are visually successful but can still compete with dense result rows;
- edit/delete need clear local priority without becoming page-level focal points.

## Cash Ledger — `CashBalanceView.tsx`

### Target hierarchy

- **H0** — page.
- **H1/H2** — Available Cash / capital context.
- **H3** — supporting cash KPIs and reconciliation information.
- **H4** — Deposit/Withdraw controls and history filters.
- **H5** — cash transaction history.
- **H4** — transaction edit/detail surfaces.

### Current debt

- top banner and KPI cards can both read as primary;
- operational controls and ledger history need stronger summary → action → history separation.

## Stocks / Directory — `TickerDirectoryView.tsx`

### Target hierarchy

- **H0** — page.
- **H2/H3** — directory/context header.
- **H4** — search + sector filter + sync/export utilities.
- **H5** — ticker grid/results.
- **H4** — technical-level inset information within each ticker result.
- **Action priority** — Add to Portfolio / Log Trade is primary within a ticker card; sync/export remain utility.

### Current debt

- every ticker card currently has full card depth, which can become visually noisy in large grids;
- sync/export actions can compete with the data itself.

## Monthly Performance — `reports/MonthlyPerformanceReport.tsx`

### Target hierarchy

- **H0/H3** — month section grouping.
- **H3** — monthly summary.
- **H4** — status/month selectors and metric sub-blocks.
- **H5** — trade/holding rows.

### Current debt

- nested monthly cards can still create excessive containment;
- month shell should not imply semantic success/failure independent of mixed inner data.

## Trading Performance — `reports/TradingPerformanceReport.tsx`

### Target hierarchy

- **H0/H2** — report context.
- **H3** — KPI group.
- **H4** — period/filter selectors.
- **H5** — dense benchmark/detail rows where applicable.

### Current debt

- KPI cards currently use similar elevation across metrics with different importance;
- selector/result spacing can be normalized further.

## Header — `Header.tsx`

Phase 8 does **not** assign final utility/nav hierarchy architecture here.

Temporary mapping only:
- brand/navigation shell → structural H0/H2 context;
- Add Trade → primary action;
- sync/sheets/backup/alerts/receipt → utility actions.

Final grouping, placement, and visual priority are Phase 9.

## Modals and overlays

Modal hierarchy is local to each overlay:

- modal frame → local H1/H2 depending task criticality;
- modal title/primary decision → local H1;
- form sections → H4;
- destructive confirmation action → destructive priority, not global H1;
- secondary/cancel → secondary priority.

Phase 8 should not replace the accepted overlay architecture from Phase 4.

## Semantic rules applied to the map

- semantic financial color does not determine H-level;
- losing Unrealized P&L can be H2 without overpowering H1 Total Portfolio Value;
- repeated winning/losing rows remain H5;
- utility state such as sync/reconcile does not become H1 because it glows;
- green/red/amber are state colors; cyan/blue/purple remain preferred structural accents.

## Implementation order after 8.0

1. Overview.
2. Reports.
3. Dense workflows.
4. Typography/spacing normalization.
5. Action priority.
6. Responsive hierarchy.
7. Regression/closure.
