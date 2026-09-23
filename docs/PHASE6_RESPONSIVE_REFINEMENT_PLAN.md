# Phase 6 — Mobile / Responsive Refinement Plan

**Status: IMPLEMENTATION IN PROGRESS — Pass 1 implemented and CI-clean; awaiting mobile visual validation before Pass 2.**

This is the detailed execution plan for Phase 6 of the premium UI redesign.

Phase 6 begins from the accepted Phase 5 state and is intentionally planned before implementation. The audit covered:

- `src/App.tsx`;
- all **33 non-test TSX files** under `src/components`;
- the current responsive/media-query layer in `src/index.css`;
- persistent shell, fixed notifications, modal/overlay families, filters/selectors, tables, report surfaces, and chart shells.

The goal is **not** to redesign navigation, charts, or information hierarchy. Phase 6 owns responsive fit, touch ergonomics, stacking, density, viewport safety, and reachability. Phase 6.5, 7, 8, and 9 retain their later ownership.

---

## 1. Audit summary

### 1.1 Existing strengths

The app is not starting from zero:

- `PositionsTable` already renders separate desktop-table and mobile-card layouts.
- Main content uses responsive page gutters (`px-4 sm:px-6 lg:px-8`).
- Many headers/forms already stack at `sm`, `md`, or `lg`.
- Cash/report tables already use horizontal overflow containers.
- Several complex modals already use `overflow-y-auto`, `max-h-[90vh]`, or internal scrolling.
- Chart timeframe controls already scroll horizontally.
- Most report KPI grids already collapse from 4/6 columns down to 2 or 1.
- Phase 5 already provides lower-cost mobile material behavior.

Phase 6 should preserve these working patterns and standardize the weak ones.

### 1.2 Cross-cutting risks found

#### A. Touch targets are undersized across the shared control language

Many header actions, nav tabs, filter pills, compact selectors, icon controls, and quick-adjust buttons use `py-1` / `py-1.5` or very small icon padding.

Representative examples:
- Header actions/nav;
- Portfolio Summary sync/reconcile;
- Closed-cycle filters;
- Journal filters/pagination;
- chart timeframe segments;
- Quick Cash adjustment buttons;
- DateInput calendar trigger;
- modal close buttons.

`NumberStepperInput` is the strongest example: a 32px-wide control is split vertically into two buttons, producing very small individual touch targets.

**Phase 6 rule:** on coarse/touch pointers, interactive controls must receive a shared minimum target size without inflating desktop density.

#### B. Modal viewport behavior is inconsistent

Robust examples:
- Price Alerts: `max-h-[90vh]` + internal scrolling.
- Trade Screenshot: `max-h-[90vh]` + flex/internal scroll.
- Google Sheets: outer scrolling + inner max-height.
- Add Trade / Sell / Journal edit: scrolling backdrop.

Weak examples:
- Portfolio Backup is long and uses a centered fixed backdrop with no outer scrolling and no max-height contract.
- Edit Position, Quick Cash, Confirm Delete, and some embedded Cash modals rely on content fitting the viewport.
- Several modal paddings remain desktop-sized on narrow/short screens.

**Phase 6 rule:** every modal family gets a consistent `dvh`-aware viewport contract, safe outer padding, and predictable body/footer scrolling. Short content should still feel centered; long content must never clip.

#### C. Fixed notifications/status surfaces are not viewport-clamped

- App undo toast is fixed `bottom-6 right-6`.
- App notification toast is fixed `top-20 right-4`.
- Offline/Firestore status is fixed `bottom-4 left-4`.

None currently has a shared mobile width clamp/safe-area contract.

**Phase 6 rule:** fixed UI must use viewport-safe max widths and safe-area-aware insets.

#### D. Filter/search toolbars contain fixed minimum widths

Known hotspots:
- Closed Cycles search `min-w-[240px]`, sort `min-w-[205px]`.
- Positions sort `min-w-[170px]`.
- Ticker Directory selector `min-w-[170px]`.
- Trading Journal search `min-w-[240px]`, sort `170px`, page size `112px`.
- Monthly report selector `185px`.
- Trading Performance selector `165px`.

Most live inside wrapping/stacking containers, but fixed minimums still create risk at 320px and in nested padded cards.

**Phase 6 rule:** mobile uses `w-full/min-w-0` or bounded responsive widths; desktop minimums can remain where useful.

#### E. Report/chart shells fit, but controls/tooltips need a mobile contract

- Performance chart uses a horizontally scrolling timeframe row, but segments are compact touch targets.
- Primary chart tooltip uses `min-w-[260px]`.
- Allocation tooltip uses `min-w-[235px]`.
- Allocation chart uses fixed 285px height.
- Risk & Cost cards use fixed chart heights around 208–256px.
- Report export/print controls hide text correctly, but selector/action groups need narrow-screen review.

**Phase 6 rule:** preserve chart data/series/interpolation. Only responsive shell height, tooltip width, selector stacking, control reachability, and overflow are in scope. Phase 7 still owns chart visual design.

#### F. Mobile CSS currently optimizes effects, not layout ergonomics

`src/index.css` currently contains **six** `@media (max-width: 767px)` blocks, but they mainly tune:
- blur/material cost;
- hover/radial behavior;
- animation duration;
- report-glass intensity.

There is no canonical coarse-pointer touch-target layer, fixed-overlay width contract, or modal viewport primitive.

---

## 2. Responsive architecture

### 2.1 Viewport matrix

Every Phase 6 pass must consider at least:

- **320px narrow phone** — catches min-width/label overflow.
- **360px phone** — common Android baseline.
- **390px phone** — modern iPhone-class baseline.
- **430px large phone**.
- **768px tablet / breakpoint boundary**.
- **phone landscape / short viewport** — catches modal vertical clipping.

The goal is not pixel-perfect per device. These are stress cases for the responsive contract.

### 2.2 Shared responsive primitives before one-off fixes

Prefer shared CSS/media rules for recurring behavior:

1. **Touch-target contract**
   - coarse-pointer/mobile minimum control height;
   - icon-action minimum square target;
   - compact filter/segment target normalization;
   - preserve current desktop density.

2. **Modal viewport contract**
   - safe side/top/bottom padding;
   - `100dvh` / `calc(100dvh - ...)` maximums;
   - long body scroll;
   - no inaccessible footer/action row;
   - safe-area inset support where useful.

3. **Fixed-overlay contract**
   - `max-width: calc(100vw - gutters)`;
   - safe right/left/bottom/top positioning;
   - text can wrap rather than force overflow.

4. **Mobile control-width contract**
   - `min-width: 0` inside flex/grid;
   - selectors can become full-width where needed;
   - horizontal scrollers remain intentional only where the interaction benefits from them.

5. **Responsive chart/report shell rules**
   - tooltip width clamp;
   - chart height floors/ceilings;
   - selectors/actions wrap predictably;
   - no Phase 7 chart-style changes.

Do not solve repeated issues by adding unrelated per-component arbitrary widths if one shared rule can safely own the behavior.

---

## 3. Scope boundaries

### Phase 6 owns

- breakpoints;
- stacking/wrapping;
- mobile spacing/padding;
- viewport fit;
- touch target sizing;
- horizontal overflow containment;
- modal body/footer reachability;
- dropdown viewport containment;
- mobile table/card density;
- report/chart container sizing and selector fit;
- fixed toast/status positioning.

### Phase 6 does NOT own

- navigation information architecture or active-state redesign — **Phase 6.5**;
- chart colors, axes, plot styling, interpolation, series design — **Phase 7**;
- final visual hierarchy/typographic reprioritization — **Phase 8**;
- final header redesign/composition — **Phase 9**;
- business logic, accounting, persistence, transaction semantics, data engines.

Header/nav may receive touch/overflow fixes in Phase 6, but not structural redesign.

---

## 4. Component coverage matrix

Every render file has an explicit Phase 6 disposition.

### App shell / persistent surfaces

| File | Phase 6 disposition |
| --- | --- |
| `src/App.tsx` | **Direct.** Clamp undo/toast overlays to viewport; validate page gutters and top-level action rows at 320–430px. No tab lifecycle changes. |
| `Header.tsx` | **Direct.** Touch targets, wrap pressure, icon-only action usability, horizontal nav scroll containment. Structural nav/header redesign deferred to 6.5/9. |
| `PortfolioSummary.tsx` | **Direct.** Validate live-feed status wrapping, sync/reconcile action targets, 2-column KPI density at 320px. |
| `OfflineIndicator.tsx` | **Direct.** Viewport-safe fixed width/insets, text wrap, retry-action reachability. |

### Main data views

| File | Phase 6 disposition |
| --- | --- |
| `PositionsTable.tsx` | **Direct.** Preserve existing desktop/mobile split; fix toolbar selector widths/touch targets and mobile-card density/action reachability. |
| `ClosedCyclesView.tsx` | **Direct.** Remove mobile min-width pressure from search/sort; normalize filter strip behavior; verify card detail grids/actions. |
| `TradingJournal.tsx` | **Direct.** Toolbar/filter density, selector widths, pagination controls, fixed delete toast, card/action wrapping, edit modal viewport. |
| `CashBalanceView.tsx` | **Direct.** Table overflow affordance, action rows, edit/add modal viewport, two-column form compression, touch targets. |
| `TickerDirectoryView.tsx` | **Direct.** Search/select width contract and card metric density; preserve 1→2→3 column progression. |

### Reports and charts

| File | Phase 6 disposition |
| --- | --- |
| `PerformanceReports.tsx` | **Direct shell-only.** Allocation chart height/selector fit/tooltips and report-control wrapping. Chart design remains Phase 7. |
| `RealizedTrajectoryChart.tsx` | **Direct shell-only.** Selector/control target size, KPI grid density, mobile chart height. No series changes. |
| `charts/PerformanceTimeframeChart.tsx` | **Direct shell-only.** Timeframe scroller target size, mode dropdown containment, tooltip width, mobile chart height. Weekly/interpolation logic is frozen. |
| `charts/SecondaryAnalyticsCharts.tsx` | **Direct shell-only.** Card header stacking/value wrapping and mobile chart heights; no Recharts changes. |
| `charts/AnalyticsChartTheme.tsx` | **Direct shared tooltip/loading shell.** Clamp tooltip width for 320px; keep chart-theme redesign in Phase 7. |
| `reports/MonthlyPerformanceReport.tsx` | **Direct.** Selector/search/action rows, hero header wrapping, table horizontal access. |
| `reports/TradingPerformanceReport.tsx` | **Direct.** Selector/export controls, KPI density, report-table horizontal access. |

### Modal / overlay family

| File | Phase 6 disposition |
| --- | --- |
| `AddTradeModal.tsx` | **Direct.** Standard modal viewport contract; collapse narrow 2/3-column groups where needed; dropdown containment. |
| `EditPositionModal.tsx` | **Direct.** Add viewport-safe scrolling; prevent title/ticker/status overflow; mobile action row. |
| `SellPositionModal.tsx` | **Direct.** Standard viewport contract and narrow-grid review. |
| `QuickCashModal.tsx` | **Direct.** Standard viewport contract; 4 quick-adjust buttons must remain comfortably tappable. |
| `ConfirmDeleteModal.tsx` | **Inherited + direct contract.** Small content is already compact, but modal must inherit universal short-viewport safety and touch sizing. |
| `PriceAlertsModal.tsx` | **Mostly inherited.** Already max-height/scroll safe; audit header/filter rows and card action wrapping. |
| `GoogleSheetsModal.tsx` | **Direct.** Existing scroll model is good; reduce narrow-screen padding and validate footer/action/selector width. |
| `PythonSchemaSyncModal.tsx` | **Direct.** Viewport contract, code block horizontal scroll, action/footer reachability. |
| `PortfolioBackupModal.tsx` | **High-priority direct fix.** Long modal currently lacks outer scroll/max-height; internal option rows also need mobile stacking. |
| `TradeScreenshotModal.tsx` | **Direct.** Existing max-height model retained; header chips, 2/4-column edit grid, footer actions require narrow-screen layout. |
| `PWAInstallButton.tsx` | **Mostly inherited.** Modal already scroll-safe; install/header targets and text fit need audit. |

### Shared controls / rare states

| File | Phase 6 disposition |
| --- | --- |
| `AnalyticsSelect.tsx` | **Direct shared primitive.** Dropdown width/edge containment and touch row sizing; avoid viewport escape near screen edges. |
| `DateInput.tsx` | **Direct.** Calendar trigger is currently too small for touch; preserve native picker behavior. |
| `NumberStepperInput.tsx` | **High-priority direct.** Current 32px-wide two-button stepper produces tiny tap targets; create coarse-pointer behavior without bloating desktop. |
| `ErrorBoundary.tsx` | **Mostly inherited.** Verify action stacking and page gutters. |
| `SupabaseAuthGate.tsx` | **Mostly inherited.** Validate keyboard/narrow viewport and field/button touch sizing. |
| `StockLogo.tsx` | **Intentional exclusion.** Existing size API is responsive-safe; no Phase 6 surface layout ownership. |
| `PremiumMotion.tsx` | **Frozen.** No Phase 6 lifecycle/easing changes. Existing media-query hooks may be consumed but motion architecture stays Phase 4-owned. |

---

## 5. Planned implementation passes

### Pass 0 — Responsive primitives and safety baseline

**Status: COMPLETE.**

Goal:
- solve repeated responsive problems once before screen-level rollout.

Implemented:
- **db4bcc3** — add Phase 6 shared responsive safety primitives in `src/index.css`.
- Add canonical responsive tokens:
  - `--premium-touch-target: 2.75rem` (44px);
  - `--premium-mobile-gutter: 0.75rem`;
  - `--premium-modal-gutter: 0.75rem`;
  - fixed-overlay max width token.
- On phone widths or coarse pointers, shared actions/nav/filter pills/segments/choices/accordion/select triggers now receive a 44px minimum target and `touch-action: manipulation`.
- Shared icon actions receive a 44x44 minimum target.
- Direct shared input/select/textarea fields receive a 44px minimum height.
- Menu rows receive the same coarse-pointer minimum target.
- `NumberStepperInput` is intentionally excluded from generic `.premium-control` sizing because its split vertical control requires a dedicated Pass 5 solution.
- Add opt-in `.premium-modal-viewport` and `.premium-modal-scroll-body` helpers using `dvh`, overscroll containment, and stable scroll gutters.
- Add `.premium-fixed-overlay`, `.premium-mobile-min-w-0`, and `.premium-mobile-full` helpers for later component rollout.
- Mobile modal backdrops now use safe-area-aware padding.
- Mobile dropdowns receive viewport max-width/max-height containment and overscroll containment.

No component-specific layout was changed in Pass 0.

Quality Checks **#600** passed typecheck, tests, and production build. User validation accepted the shared mobile/coarse-pointer baseline. Pass 0 is complete.

Validation:
- desktop visual density materially unchanged;
- no new clipping or layout shift;
- Phase 4/5 motion/effects unchanged.

### Pass 1 — Persistent shell and main app chrome

**Status: IMPLEMENTED — CI clean; awaiting mobile visual validation before Pass 2.**

Scope:
- `App.tsx`;
- `Header.tsx`;
- `PortfolioSummary.tsx`;
- `OfflineIndicator.tsx`.

Implemented:
- **ae08150** — extend the responsive baseline with mobile fixed-overlay safe-area/stacking helpers and ensure icon-only shared actions have a 44px minimum width on touch.
- **24ac8d2 / bf3cdd1** — clamp App undo/notification toasts to mobile safe gutters, allow text wrapping, keep action buttons reachable, and stack Undo above persistent bottom status surfaces.
- **dbe2a30** — convert the phone Header utility cluster into one horizontally scrollable action rail instead of a tall wrapping control block; keep the existing navigation rail horizontally scrollable and leave navigation architecture unchanged.
- **3a625d8** — tighten phone Portfolio Summary padding/gaps, keep the 2-column KPI layout, hide low-priority KPI annotations below `sm`, allow long P&L/footer content to wrap, and align live-feed actions cleanly.
- **132295e** — clamp Offline/Firestore status surfaces to mobile safe gutters, allow status text to wrap, and keep the Sync action independently tappable.
- **3fd4190 / bc9e7f7** — prevent fixed-toast/header/status collisions and keep fixed-overlay width clamping mobile-only so desktop sizing remains unchanged.
- User screenshot validation found the initial mobile Header rail still visually noisy/off-center and highlighted redundant migration-era controls.
- **05f2316 / 2f1ed56 / 8019ca1** — remove the obsolete manual database Force Sync header action and the standalone Google/Firebase Sign In/avatar/Sign Out controls. Supabase already gates the app and owns portfolio persistence; optional Google authentication remains inside the Google Sheets modal. The remaining six Header actions are Alerts, Live Prices, Google Sheets, Backup/Reconcile, Scan, and Add Trade. Mobile count/status decorations are taken out of normal icon flow so the icons remain centered.
- **5c44fdb** — remove the dead Firestore-quota status branch. The migration shim already reports no quota state and no-op retry behavior; `OfflineIndicator` now represents only the real browser offline state.
- **1928172** — user-requested early Pass 2 correction: move mobile position sector metadata into the identity row and keep DCA, Sell, Edit, and Delete in one compact four-control row so Delete cannot create a standalone second row/card-height penalty.

Quality Checks **#620** passed typecheck, tests, and production build on the revised Header/Positions state.

Validation target:
- 320 / 360 / 390 / 430 widths;
- portrait + short landscape;
- Header utility rail remains reachable without excessive vertical growth;
- persistent nav remains horizontally accessible;
- fixed toast/status layers do not collide;
- summary cards remain legible without page-level horizontal overflow.

### Pass 2 — Core data tabs

Scope:
- Positions;
- Closed Cycles;
- Journal;
- Cash;
- Directory.

Work:
- selector/search min-width cleanup;
- filters/pagination wrapping;
- mobile card spacing/action rows;
- intentional horizontal table overflow only where a table remains;
- keep Positions desktop/mobile dual-render architecture.

Checkpoint:
- no horizontal page overflow;
- every primary action reachable without precision tapping.

### Pass 3 — Modal and overlay family

Goal:
- one consistent viewport behavior across all modal families.

Priority:
1. Portfolio Backup;
2. Edit Position / Quick Cash / Confirm Delete;
3. Add/Sell/Journal edit;
4. Google Sheets / Schema Sync / Price Alerts / Trade Screenshot / PWA.

Work:
- `dvh`-aware max heights;
- safe outer padding;
- body scroll vs fixed footer behavior;
- narrow-grid stacking;
- dropdown containment inside modals;
- touch target normalization.

Checkpoint:
- all modal content/actions reachable on 320px portrait and short phone landscape;
- no footer hidden below viewport;
- no backdrop content clipping.

### Pass 4 — Reports and chart shells

Scope:
- Performance Reports;
- main analytics shell;
- Risk & Cost shells;
- trajectory chart;
- Monthly/Trading reports;
- shared chart tooltip shell.

Work:
- mobile chart heights;
- tooltip width clamp;
- timeframe/selector touch targets;
- allocation selector/action wrapping;
- report export/search/select fit;
- horizontal table access.

Hard boundary:
- no chart series/interpolation/axis visual redesign.

### Pass 5 — Shared controls and rare states

Scope:
- AnalyticsSelect;
- DateInput;
- NumberStepperInput;
- auth/error/PWA/status edge cases.

Work:
- solve coarse-pointer stepper behavior;
- date-picker target size;
- dropdown edge clamping;
- keyboard + mobile viewport review for auth;
- rare status/empty/error surface fit.

### Pass 6 — Full 34-file responsive validation

Re-run the complete matrix.

Required checks:
- 320 / 360 / 390 / 430px portrait;
- 768px boundary;
- short phone landscape;
- no page-level horizontal overflow;
- no clipped modal/dropdown/fixed overlay;
- touch targets usable;
- primary actions reachable;
- tables intentionally scroll rather than clip;
- chart tooltips stay inside usable viewport;
- desktop remains unchanged unless explicitly intended;
- reduced-motion remains functional;
- typecheck/tests/build pass.

Only then mark Phase 6 complete.

---

## 6. Acceptance criteria

### Layout
- No page-level horizontal overflow at supported phone widths.
- No fixed `min-width` forces a toolbar/card outside its container.
- Grids collapse before content becomes illegible.
- Long labels wrap or intentionally truncate without hiding required meaning.

### Touch
- Primary and common controls have comfortable coarse-pointer targets.
- Icon-only controls are not precision-tap targets.
- Number stepper/date picker remain usable one-handed.
- Horizontal scrollers do not require tiny tap targets.

### Modals and overlays
- Every modal is usable on short viewport heights.
- All close/confirm/cancel actions remain reachable.
- No modal footer can be trapped below the viewport.
- Dropdowns do not escape screen edges.
- Fixed toast/offline/status surfaces stay inside mobile gutters/safe areas.

### Tables and reports
- Wide tables scroll within their shell rather than the whole page.
- Mobile users can recognize that overflow content exists.
- Report selectors/actions stay reachable.
- Chart tooltip/content shells do not exceed viewport width.

### Regression
- No Phase 6 change to accounting/business logic.
- No Phase 6 change to chart interpolation.
- No Phase 6 change to Phase 4 lifecycle motion architecture.
- No Phase 6.5 navigation redesign accidentally pulled forward.
- Desktop production behavior remains consistent.
- Quality Checks pass.

---

## 7. Change-control rule

During Phase 6, this file is the detailed active execution plan.

Update it in the same work pass whenever:
- a responsive primitive changes;
- a component requires a different disposition;
- a mobile workaround is accepted/rejected;
- a later-phase boundary changes;
- a pass completes or a validation gate changes.

After Phase 6 completes, mark this file historical. The active cross-phase roadmap remains `PREMIUM_UI_REDESIGN_PLAN.md`.
