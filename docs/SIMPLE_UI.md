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

## Still using the legacy UI in medium-ui
Stocks/ticker directory and most transaction, trade and settings modals remain on their original visual system. Specialist Activity ledger corrections and the complete detailed Reports workspace remain accessible as advanced views, while the main Home, Holdings, Activity and Reports tabs render their own new components.

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

## Native Activity redesign (medium-ui, 2026-10-08)

The earlier Activity pass was only cosmetic. It still rendered the original premium journal, cash and closed-cycle screens by default, which was inconsistent with the Home and Holdings redesign. This pass **replaces the default Activity page composition**:

- `SimpleTransactionsView`: compact record list, three key summary values, wrapped filter/sort pills, expandable execution details and progressive loading. Shows BUY, SELL, corporate actions, IPO subscriptions and legacy opening records without dropping them. Uses canonical closed-cycle data for aggregate realized P&L and avoids assigning a whole multi-execution cycle's gain to every SELL.
- `SimpleCashView`: available cash, deposits and withdrawals; compact deposit/withdraw form using the existing `onAddCashTransaction` callback; transaction history projected by `buildCashHistory` and inline edit/delete dialogs using the existing ledger callbacks. No independent cash-balance mutation.
- `SimpleClosedView`: compact cycle results, signed performance, wrapped filters/sorts and expandable average prices/holding details. Source-ledger correction retains authoritative transaction IDs with the same bounded legacy fallback as the old view.
- New reusable design primitives: `SimpleActivityShared.tsx`, with independent `ui-activity-native` styles in `ui.css`.
- Redundant `CompactPortfolioStrip` is not shown on Activity pages. The shared Activity navigation continues to provide Transactions/Cash/Closed destinations.
- Specialist tools remain available via explicit advanced/detail entry points: full journal editor and reconciliation controls render the original components only when deliberately opened. They are **not** the default Activity layout.
- Added `SimpleActivityNative.test.tsx` source-level regression cases for the new routes, wrapped pills, and cycle execution links.

**Scope/limits:** Data model, persistence and calculation engines are unchanged. Cash edits still route through the canonical ledger. Not yet confirmed through a real browser, broker reconciliation, TypeScript build, or executed Vitest suite in this environment. The advanced transaction editor and reconciliation tools still use the legacy visual language and are a separate migration target.

## Native Reports implementation (medium-ui, 2026-10-08)
- `src/ui/SimpleReportsView.tsx` replaces the old default Reports presentation with Overview, Charts, Trading, Allocation and Monthly modes. Selection uses the same wrapping pills as Holdings and Activity.
- `src/ui/simpleReportsModel.ts` derives current market-value allocation and safe monthly summaries. It does **not** reconstruct historical month-end unrealized prices using current quotes. Prior months show confirmed realized exits; current month also shows a clearly labeled holdings **snapshot**, which is not a monthly time-weighted return.
- Overview uses `calculateEquityBridge` and `isEquityBridgeBalanced`, not hand-built cash/pnl arithmetic, retaining IPO and non-trading cash semantics. Unbalanced deltas remain visible, not auto-corrected.
- Charts reuses the Home chart and shared market-data pipeline; Trading reuses authoritative `PerformanceStats`; Allocation shows relative bars and cash toggle.
- Detailed workspace button keeps the full original `PerformanceReports` (trajectory, performance benchmarks, in-depth monthly reports, advanced charts). The old workspace is deliberately not the default.
- Added `SimpleReportsView.test.tsx` to guard allocation, monthly integrity and native presentation. Tests are committed but not executed in this environment. Browser rendering and financial reconciliation still need acceptance verification.
- The previous `Simple UI` historical sections in this doc describe the original baseline; later sections record the subsequent migration.

### Medium UI integrity follow-up
- Simplified views (Home, Holdings, Activity, Reports) no longer receive the redundant portfolio strip; advanced and remaining legacy destinations retain the compact context header.
- Native Transactions now follows canonical `sortPerformanceTransactions` ordering for chronological views rather than relying on untrusted date-only parsing.
- Closed-trade correction resolves missing BUY and SELL source links independently, retaining the original explicit IDs; regression case covers one-sided legacy links.
- Shared pills now have structural inline wrapping/shape as a resilience fallback for stale PWA CSS. Dedicated CSS still controls focus/hover states and layout polish.
- Next migration target is remaining legacy modal/dialog controls plus the ticker directory. Any claimed runtime acceptance requires a passing build/tests and actual mobile screenshots.

## Stage 7.2 — Personal risk dashboard (medium-ui source implementation, 2026-10-08)
- `SimpleReportsView` adds **My Risk** as a first-class Reports mode and Overview shortcut. The mode uses a medium-ui scoped persistence key, avoiding new values in the legacy detailed-workspace mode enum.
- `src/ui/personalRiskModel.ts` is a read-only pure projection of reconciled `Position` and `ClosedTrade` values; `src/ui/PersonalRiskView.tsx` is the native simple risk layout. No ledger mutations, fake fills, or additional persistence.
- Concentration: largest holding, top three and sector weights use **priced holdings market value**; cash allocation divides available cash by reconciled NAV (including reserved IPO assets). IPO reserves are shown separately, not treated as liquid cash.
- Stop coverage: only a finite positive stop **strictly below the current quote** and with a valid basis counts as covered. Missing, invalid, breached/at-price and unpriced positions remain uncovered and separately disclosed. Unpriced holdings do not become zero-valued risk.
- `Loss versus purchase cost at stops` = sum(max(0, gross entry cost + buy fees - shares × stop)) for covered positions; `Downside from quote to stop` = sum(shares × (current quote - stop)) for those positions. These are **different** figures. Future sell fees, gaps and slippage are excluded; they are conditional hypothetical losses for stop-covered holdings **only**, never guaranteed maximum portfolio loss.
- Unrealized loss pressure is the magnitude of negative **current holding P&L**, not a historical NAV drawdown. Realized drawdown is peak-to-trough in cumulative **closed-trade P&L**, grouped by exit day. Neither may be labeled historical total-portfolio NAV drawdown.
- The **Manage stops** action opens Holdings and reuses the existing position editor. The dashboard does not write stop or target changes.
- `personalRiskModel.test.ts` and additional `SimpleReportsView.test.tsx` cases cover exposure arithmetic, stop coverage exclusions, cash/IPO separation, zero-data handling, drawdown chronology/legacy date parsing, wrapping native presentation, and missing-stop warnings.
- Validation status: source changes and focused tests are committed, but TypeScript, Vitest, rendered-device checks and broker snapshot acceptance are **not yet executed** in this environment (GitHub host resolution unavailable). Do not merge/deploy as validated until those gates pass.
- Next: Stage 7.3 position thesis and trade-plan review; never invent thesis correctness or discipline scores without recorded inputs.

- Trust-gating follow-up: My Risk states that quotes are the latest stored values and may be stale; when the canonical equity bridge is unbalanced it displays a visible ledger-reconciliation warning rather than implying validated risk figures.
