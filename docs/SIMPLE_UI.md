# Simple UI (branch `simple-ui`)

A visual overhaul that keeps every service, hook and data path unchanged and
replaces only the presentation layer, one screen at a time. `main` is untouched.

## Principles
- One job per screen. Full summary only on Home; other tabs get the compact strip.
- Five bottom tabs on phone (Home, Holdings, Activity, Reports, More); the same
  destinations as a top bar on desktop. One "+" menu for every create action.
- Color carries meaning (`src/ui/ui.css` tokens): teal = portfolio / realized,
  blue = MWR / unrealized, purple = EGX30, amber = fees / cash movements,
  coral = drawdown / losses / EGX100, gray = cash.
- Everything new is prefixed `ui-` and lives in `src/ui/`; legacy `premium-*`
  styles remain for screens not migrated yet.

## Done
- Tokens and base components: `src/ui/ui.css`
- Shell (`SimpleShell`): top bar, bottom nav, add sheet, more sheet. Same
  handler props as the legacy `Header`, plus `onQuickAddCash`.
- Activity switcher: Transactions | Cash | Closed over the existing views.
- Home (`HomeScreen`): hero value, analytics chart (Return default; Value, vs
  Deposits, TWR, MWR, Benchmarks with an index switcher), Realized and
  Unrealized P&L tiles, holdings preview, cash and costs.
- Analytics data: `useAnalyticsSeries` reuses the same engines as the legacy
  chart (daily unified engine, intraday session for Today, benchmark comparison).

## Not migrated yet (still legacy visuals inside the new shell)
Holdings table, Transactions, Cash, Closed trades, Reports (Metrics page and
chart sub-views), Stocks, modals (Add Trade sheet with sticky total footer).

## Removed
Tests that froze the old Overview composition (PortfolioSummary on Overview in
`App.tsx`, the overview positions preview, the overview analytics order).

## Medium UI branch refinements (2026-10-08)
- `medium-ui` is derived from `simple-ui` and leaves the source branch unchanged.
- Today has explicit 1m/5m/15m/1h controls, delegating coarse aggregation to `loadTodayIntraday` rather than assuming separate persisted candles.
- Chart uses timestamp-scaled x-axis instead of equally spaced category labels; chart height adapts to desktop/mobile.
- Advanced performance modes are progressively disclosed; color meaning for profit/loss remains driven by signed numeric tone, separate from metric category color.
- A modest elevation treatment is limited to the portfolio hero. Focus outlines and mobile touch targets are improved.
- Still to verify against actual broker snapshots: cash-flow-adjusted Return definition, Today session boundary, benchmark coverage, and end-to-end rendered mobile behavior. Do not claim those correctness checks from code changes alone.

### Follow-up implementation
- Home panels use consistent row rhythm and accessible context labels; advanced chart controls receive keyboard/touch states.
- Benchmark overlays now explicitly flag missing aligned index history instead of silently pretending every line is present.
- Today intraday result is keyed by session and selected granularity to prevent displaying the previous interval while loading the next.
- Validation still pending: real broker reconciliation, compiled TypeScript, browser layout snapshots, and automated CI.

## Holdings migration (medium-ui)
- Holdings route now uses `src/ui/SimpleHoldings.tsx`: searchable, sortable sector-filtered responsive list with expandable trade details.
- Buy more, Sell, Edit, Correct ledger, Add trade, and Price alerts continue to call existing App handlers; the ledger and broker-facing data are unchanged.
- The legacy `PositionsTable` remains in the repository for other consumers; this branch only swaps the full Holdings tab presentation.
- Interval selector uses exact 1m/5m source when selected, and shared aggregate fallback for 15m/1h.
- Manual acceptance needed on phone/desktop: interaction focus, opening trading modals, and live quote reconciliation.

## Holdings selector refinement
- Replaced native Sector and Sort dropdowns with single-selection pill groups. Active state uses `aria-pressed`; both preserve the original filtering/sorting logic.
- Sector and sort pills wrap into as many natural lines as needed at every viewport width; no horizontal scrolling or desktop-only column layout.

## Medium UI — Activity presentation pass (2026-10-08)
- Activity now has a compact shared heading and accessible Transactions / Cash / Closed navigation.
- Existing TradingJournal, CashBalanceView and ClosedCyclesView ledger calculations, audit/edit/delete modals and reconciliation callbacks are kept intact. No financial mutation code was changed.
- Transaction, cash-history, deposit/withdraw, and closed-trade filters use wrapped pill rows (no horizontally scrolling selector strip).
- Transaction and closed-trade sort controls also use wrapped pills. Journal page-size and cash payment-method choices remain dropdowns where a longer menu is more practical.
- Activity cards use quieter, opaque surfaces rather than premium glow effects. The cash history turns into labeled cards below 700px, retaining edit/delete buttons; desktop keeps the full table.
- Acceptance not yet proven: runtime typecheck/test execution, mobile screenshot review, mobile cash edit/delete and ledger focus workflows, and accounting reconciliation. Avoid interpreting a source commit as a passed check.
- Remaining work: fully migrate complex cash-transfer forms and editor modals, then Reports.
