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

## Oct 8 observed holiday / false daily P&L fix (medium-ui)
The previous session resolver skipped weekends but did not know the observed 2026-10-08 EGX closure. On the Thursday holiday, the app requested nonexistent Oct 8 intraday candles and a summary could display the previous session's quote `change` or `changePercent` as if the portfolio gained that amount **today**.

`egxTradingCalendar` now explicitly records the verified closure; Today/Last session resolves to **Oct 7** through Sunday Oct 11 before 10:00 Cairo, while the closed-day UI replaces “Today +P&L” with **EGX holiday / Market closed — Last session, 7 Oct**. Scheduled price sync and intraday ingestion also honor the closure; manual scans/backfill are separate actions.

The numeric `dayChange` fields remain ledger/quote-derived and unchanged for active trading days. On closed days they are not used as a claim of *calendar-day* trading return. The observed +0.24% was not an exchange move on Oct 8. Verifying its exact instrument contributions requires stored portfolio quote snapshots. Calendar/quote coverage remain subject to the source tests and rendered acceptance.

## Cash versus trading and Telda NAV review (medium-ui; pending validation)
- Production uses a legacy unified transaction ledger. `CASH` entries are persisted as BUY/SELL at a synthetic EGP 1 unit price; their `shares` count is **an amount, not stock shares**. Do not alter the schema or rewrite these events without a migration preserving audits, RLS, backward compatibility and reconciliation.
- `src/services/ledgerRecordTypes.ts` distinguishes cash from security executions in read-only selectors. **The Activity timeline includes ALL persisted events:** buys, sells, cash transfers, dividends, fees, bonus/free shares, corporate actions, opening positions and IPO subscription lifecycle events. Each uses category-specific details; CASH pseudo-shares and unit prices never appear as equity execution fields. The specialist advanced `TradingJournal` remains security-focused, and Activity cash/IPO actions link to the dedicated Cash/IPO workflows.
- `src/ui/cashFlowNeutralReturn.ts` computes cumulative EGP P&L as each verified NAV difference **minus the interval's external flow**, so deposits/withdrawals and return-neutral reconciliation adjustments do not create investment gains. The chart labels the result accurately and warns about missing historical-price days. The TWR/MWR engines still use the canonical `buildExternalCashFlows` path.
- `NavReconciliation` in Home is an optional read-only breakdown of holdings market value + available cash + pending IPO assets and a user-entered broker NAV/cash comparison. It lists quote timestamps, flags refreshes performed on closed-market dates, and does **not** save broker numbers or mutate ledger balances.
- **Verified ingestion issue:** market-price scans on a closed exchange day may store refreshed retrieval timestamps while replaying the last session's price change. The medium-ui market-data hook now rejects both automatic and manual quote writes on non-trading EGX dates; real return and NAV must not be inferred from the mere refresh time.
- **Fee-source risk:** learned brokerage-fee estimates may overstate same-day/grouped execution invoices; the Add Trade form explicitly warns that actual Telda invoice fees must be reconciled. Verified invoice/ledger fee differences must be corrected via audited transaction edits, not silent cash adjustments. Do **not** publish private portfolio-specific NAV, trade ticket numbers, screenshots or broker invoices into the repository.
- Source-level tests cover pseudo-trade filtering, deposit/withdrawal/reconciliation-neutral performance curves, read-only NAV decomposition and holiday refresh flags. Full typecheck, Vitest and broker parity remain **unverified** here.

## All-events Activity and partial IPO broker holds (medium-ui, 2026-10-09)
- **Revised acceptance direction:** Activity is one chronology for security trades AND all cash/corporate/IPO events; Cash and IPO subviews remain dedicated mutation destinations. Wrapped pills include All, Buys, Sells, Cash, Dividends, Corporate, IPOs, Open, Wins, Losses.
- `activityRecordModel.ts` maps cash (EGP amount/type/date), security executions (shares/price/fees/P&L), free shares (received/source/ratio/reference), IPO subscriptions (order commitment, shares, actual broker hold, status, settlement), and opening-position records (actual shares, not cash-event pseudo-shares).
- The old statement about *excluding cash from Activity* was superseded. Advanced trade-only ledger remains intentionally filtered, but the default Activity feed must include cash.
- Pending IPO metadata now separates `requestedAmount` (full commitment) from optional `reservedAmount` (actual broker-held money). Absent `reservedAmount`, the old full-reserve behavior remains unchanged. Submission holds only reserved funds and counts them as a pending portfolio asset; cash + pending asset leaves NAV unchanged, including on the session return baseline.
- Settlement releases an unused hold or explicitly checks additional available cash when cost exceeds hold. Cancellation releases only the original hold; no shares become owned until allocation.
- Native Cash displays IPO held balance, and Reports Allocation counts it as an asset distinct from available cash. Full user-portfolio values and broker invoices stay out of repository docs; only example lifecycle figures are used in the specialized IPO guide.
- Production financial rows were **not** altered. A read-only audit found exact agreement *conditional on* correct IPO hold and audited fee correction; recording HALN and correcting grouped invoices require a reviewable financial mutation with audit reasons.
- Tests are committed for activity-type content, cash pseudo-share exclusions, 25%-hold lifecycle, allocation/refund/top-up, full-reserve backwards compatibility, and NAV neutrality. Build and device checks not yet executed.

### Last-session daily return integrity (medium-ui)
`calculatePortfolioMetrics` now attempts to reconstruct session-opening share quantities and cash after replaying the day's BUY/SELL executions. If an EGX ticker-registry quote is unavailable, it can derive the previous close from the currently held position's valid last-price/change pair. This preserves same-day round-trips and avoids crediting today's newly purchased shares with the previous session's price rise. If an opening position still has no usable previous quote, `dayChangeReliable=false`; Home, simple Reports, compact strip, and advanced Reports do **not** claim a verified daily gain. This is separate from the official market-closed holiday presentation.

Tests include a synthetic same-day buy/sell/rebuy where `shares × quote change` overstates P&L, and a missing-previous-close case that must fail closed. None of this proves parity with a broker's own return convention; only same-timestamp receipts and closing valuations can do that.

## IPO share-first entry (medium-ui, 2026-10-09)
- Removed the manually entered “Requested Amount (EGP)” from the IPO form. Primary fields are **Number of shares** (positive integer) and **Offer price / share (EGP)**.
- The form derives **Total order value** and then **Cash held by broker** from the adjustable hold percentage. The compact summary displays requested shares, full order, broker hold, and buying power after hold, with NAV unchanged by reservation.
- Canonical persistence receives the exact entered shares and checks monetary consistency. Older amount-based integrations retain compatibility. Tests cover integer validation, monetary rounding, 25%-hold calculation, and rejection of inconsistent amounts.
- Changes are source-level on the experimental `medium-ui` branch. Full build, Vitest execution and device acceptance have not yet been run.

## IPO pending date correction (earlier implementation, superseded)
The earlier IPO modal included **Edit subscription** on a selected pending order. The user can change an accidentally entered date, optionally set the exact broker time in Cairo, provide an audit reason and save it. The original IPO record and reserved cash remain intact; no duplicate hold or phantom return. If backdating onto a cash-deposit day, the actual order placement time becomes required to preserve financial chronology. Editing after allocation/cancellation is blocked. Source tests exist; no production data was edited, and live validation is pending.

## IPO flow cleanup / date-entry fix (medium-ui, 2026-10-09)

- **Bug fixed:** editing a subscription for 07/10/2026 failed with 'Enter the correct subscription date' because the UI regex contained accidentally double-escaped `\\d`. The correction form now correctly validates digits, and date/time handling uses strict DD/MM/YYYY → ISO conversion.
- **Superseded:** The intermediate pending-orders overview was removed from the active app. Add → IPO subscription opens only the new-subscription form; existing orders are managed directly from their Activity entries.
- **Reliability:** pending orders refreshing from Supabase don't reset forms mid-edit; entered corrections remain until Save, Discard, or Close. Strict DateInput on IPO screens prevents invalid/unfinished user input from accidentally keeping stale state or silently becoming today's date.
- Ledger semantics unchanged: correct the original transaction ID with audited persistence; the broker hold, requested shares and NAV remain unchanged until an actual lifecycle event. Production financial records were not touched; source tests committed but not run.

## Single-step Activity actions — current medium-ui design (2026-10-09)

An expanded record in the **Activity** timeline now exposes its actions in place:
- **Security execution:** Edit, Delete, Buy more; Sell if shares of that ticker remain in an open position. Edit/Delete target the specific original execution; Buy more/Sell open the existing trading action modal with the relevant ticker.
- **Pending IPO subscription:** Allocation, Edit, Delete. Allocation opens a focused allocation form; Edit opens a focused editor for requested shares, offer price, cash-hold percentage, broker date/time/reference/notes; Delete shows a destructive ledger-only confirmation. Already allocated/cancelled IPOs are protected from direct deletion at the canonical mutation boundary.
- **Cash record** (including deposits, withdrawals, dividends and fees): Edit and Delete, with cash amount/event-type semantics. They use audited financial mutations, not fake share trades.
- Corporate-action and opening-position lifecycle records remain visible with typed details; protected opening positions do not expose Delete.

The old **Manage IPO → Pending orders → Choose action** navigation was removed from the live app. Add → IPO subscription now mounts `SimpleIpoCreateModal` as a **single new-order form only**. Activity record actions mount `ActivityActionDialog` directly; no cross-tab navigation is needed to edit a pending order. The one-step dialogs use the same compact simple-UI styling and wrap on small phones.

Persisted financial actions still require an audit reason and pass through the canonical ledger reconciliation executor. IPO Edit changes one existing transaction rather than reserving cash again. Pending IPO Delete deletes an **erroneous app ledger entry**, releasing its held amount in the app; it must not be mistaken for an actual Telda cancellation. New/edited IPO amounts are derived from shares × offer price and held percentage.

Source-level tests cover direct forms, IPO/cash ledger reconciliation, lifecycle-delete protection, and the single-purpose Create IPO form. No app build, browser acceptance, CI execution or production financial mutation has been performed as part of this pass.
