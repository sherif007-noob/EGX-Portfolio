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
