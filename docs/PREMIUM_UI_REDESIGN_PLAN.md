# Premium UI Redesign Plan

## Purpose

This document is the source of truth for the EGX Portfolio premium UI redesign on **feature/premium-ui-redesign**.

The redesign is a **strict presentation-layer overhaul**. It may change styling, hierarchy, spacing, responsive composition, overlays, component chrome, accessibility presentation, and motion. It must not intentionally change portfolio accounting, analytics math, transaction semantics, persistence, schemas, market-data behavior, or business rules.

Baseline: **ce142a0**  
Tracking PR: **#27 — Premium UI redesign foundation**

## Non-negotiable scope boundary

### Allowed

- CSS/Tailwind styling, tokens, gradients, borders, shadows, blur, glass, opacity, and semantic colors.
- Responsive layout and spacing changes that preserve the same information and actions.
- Visual wrappers, portals, z-index and overflow fixes required to render existing UI correctly.
- Shared visual primitives for buttons, selectors, cards, fields, modals, dropdowns, tables, tooltips, badges, and charts.
- Motion that does not alter application state or timing-sensitive business behavior.
- Accessibility presentation such as focus visibility, aria-pressed, contrast, reduced-motion handling, and touch-target sizing.
- Regression restoration when the redesign itself hides or breaks an existing interaction.

### Not allowed

- Accounting, P&L, cash reconciliation, valuation, or performance-formula changes.
- Transaction creation/edit/delete semantic changes or data normalization changes.
- Persistence, Supabase/Firestore/Sheets, schema, migration, or API-contract changes.
- Market-data fetching/scheduling/history/provider changes.
- New product behavior disguised as a visual change.
- Changing financial meaning or filter/report semantics for aesthetics.

If a functional bug is discovered during redesign work, isolate it unless a change is strictly necessary to restore behavior the redesign accidentally broke.

## Visual direction

- Dark navy/slate financial interface with real frosted-glass depth.
- Existing cyan, blue, emerald, rose, amber, and purple accents remain semantic.
- Green/red financial meaning remains clear.
- **Realized P&L Gain / Loss Trajectory** and **Portfolio Allocation** establish the default selector language.
- Other buttons may take inspiration from that language, but primary Add Trade / Open Position actions remain intentionally distinct.
- Hero, primary, secondary, inset, and table surfaces must have visibly different hierarchy.
- Dropdowns and overlays must float above surrounding content.
- Motion should be intentional and perceptible, not decorative noise.
- Mobile and desktop should feel like one design system.

## Roadmap

| Phase | Name | Status |
| --- | --- | --- |
| 1 | Visual foundations & page shell | Complete |
| 2 | Core premium surfaces & shared primitives | Complete |
| 3 | Component migration | Complete; validation ongoing |
| 3.2 | Completeness & consistency sweep | Complete; validation ongoing |
| 3.3 | Semantic polish & report consistency | Complete; validation ongoing |
| 4 | Motion & micro-interactions | **Complete — validated; minor desktop smoothness debt deferred to Phase 11** |
| 5 | Advanced effects | **Complete** |
| 6 | Mobile / responsive refinement | **Complete — code audit, Quality Checks #745, and real-device smoke accepted** |
| 6.5 | Navigation refinement | **Complete — grouped responsive navigation + Quality Checks #748 clean; desktop visual regression deferred to Phase 11** |
| 7 | Charts | **Complete — device accepted; Quality Checks #767 clean (31/31 files, 190/190 tests, build 6.01s)** |
| 8 | Visual hierarchy | **In progress — 8.0–8.2 complete; 8.3 systemic visual-language correction implemented, device validation pending** |
| 9 | Header | Not started |
| 10 | Full consistency sweep | Not started |
| 11 | Performance, accessibility & regression QA | Not started |

Phases 4, 5, 6, 6.5, and 7 are complete. **4 planned stages remain**: 8, 9, 10, and 11. Phase 6.5 closed after phone validation, navigation hardening, and Quality Checks #748; its remaining transition-timing polish and final physical desktop/browser smoke are tracked as later QA/motion debt.

## Phase 1 — Visual foundations & page shell

**Goal:** establish the shared premium language without changing behavior.

Scope:
- Premium design tokens and global variables.
- Page-level canvas and depth treatment.
- Base glass/elevation hierarchy.
- Shared border, shadow, blur, accent, and motion foundations.
- Reduced-motion foundations.

Acceptance:
- One consistent global visual base.
- Reusable premium surfaces replace ad-hoc opaque blocks.
- No application-behavior regression.

## Phase 2 — Core premium surfaces & shared primitives

**Goal:** apply the system to the main shared surfaces and establish reusable primitives.

Scope:
- Header/navigation glass treatment.
- Portfolio summary / hero surfaces.
- Shared dropdown/floating surfaces.
- Panel, card, modal, field, table-shell, inset, and action primitives.
- Primary analytics and positions surfaces.

Acceptance:
- Header, hero cards, major panels, dropdowns, and primary data surfaces belong to one system.
- Shared primitives are reused instead of duplicated styling.
- Existing behavior/data are unchanged.

## Phase 3 — Component migration

**Goal:** migrate the rest of the application.

Scope includes:
- Positions, closed cycles, Transactions/Journal, Cash Ledger.
- Add Trade, Sell, Edit Position, Quick Cash, delete and edit modal families.
- Reports, Trading Performance Indicators, Monthly Performance, Realized P&L.
- Ticker Directory, Price Alerts, Backup, Google Sheets, Schema Sync, OCR/screenshot import, PWA/error states.
- Shared date and numeric controls.

Acceptance:
- No major feature area remains in the old opaque visual language.
- Existing actions remain discoverable/readable.
- Modals/dropdowns render in the correct visual layer.

## Phase 3.2 — Completeness & consistency sweep

**Goal:** catch migrated components that still look legacy or inconsistent.

Scope:
- Full button/selector/card/input/table/modal sweep.
- Default selector language based on Portfolio Allocation / Realized P&L.
- Cash Deposit/Withdraw and history filters.
- Transaction ALL/OPEN/WIN/LOSS/BUY/SELL filters.
- Performance timeframe and Monthly month selectors.
- Add Trade / Edit Transaction parity.
- Edit/Delete actions and viewport-safe modal portals.
- Dropdown layering and report-card consistency.

Acceptance:
- Selected state remains visible while hovered.
- Selector glow matches selected semantic color.
- Add/Edit modal families visibly share one system.
- Dropdowns overlay content correctly.
- Inputs do not appear borderless or buried under blur.

## Phase 3.3 — Semantic polish & report consistency

**Goal:** make semantic state, hierarchy, and accent usage consistent.

Scope:
- Green/red/amber/blue/purple semantic treatments.
- Hero KPI consistency across reports/overview.
- Realized/unrealized, win/loss, buy/sell, breakeven states.
- Button hover glow matched to button semantics rather than icon color.
- Dropdown hover matched to dropdown accent family.
- Date/time visual parity.
- Final glass-strength tuning.

Acceptance:
- Neutral controls stay neutral.
- Semantic controls glow only in their own family.
- Financial-state color remains meaningful rather than decorative.
- Reports use the same hierarchy as the dashboard.

## Phase 4 — Motion & micro-interactions

**Status: COMPLETE.**

The accepted Phase 4 direction is a shared five-family motion language implemented with **Motion for React** for lifecycle presence. Browser View Transition snapshots and timer-driven React tree swaps are retired. CSS owns tactile micro-interactions only; Recharts owns financial-series interpolation. The former detailed v3 implementation plan is preserved in **PHASE4_MOTION_REIMPLEMENTATION_PLAN.md** as a historical Phase 4 reference; it is no longer an active roadmap.

### Family 1 — Navigation / page context

Applies to:
- Main tab/page transitions.
- Active navigation changes.
- Context changes between major screens.

Intent:
- Make navigation feel continuous rather than like DOM replacement.
- Use restrained depth/fade/translation.
- Never make navigation feel blocked by animation.

Target timing:
- Main-tab exit: approximately **260–300 ms**.
- Main-tab entrance: approximately **420–460 ms** with controlled overlap.
- Context changes use real-DOM overlap rather than a strict wait-boundary cut.
- Nav-selection feedback: approximately **300–360 ms**.
- Major tab changes must animate both outgoing and incoming context through real DOM presence, not browser screenshots.

### Family 2 — Interactive controls

Applies to:
- Buttons.
- Icon actions.
- Selectors/segmented controls.
- Dropdown triggers.
- Accordion triggers.
- Form-field focus/response.

Intent:
- Immediate but readable tactile response.
- Semantic controls retain their own accent family.
- Avoid exaggerated bouncing.

Target timing:
- Hover/focus/control transition: approximately **240–280 ms**.
- Selector state settle: approximately **300–360 ms**.
- Press response: approximately **120–170 ms**.

### Family 3 — Overlays

Applies to:
- Dropdowns.
- Menus.
- Modals.
- Backdrops.
- Popovers and floating surfaces.

Intent:
- Dropdowns should feel attached to their trigger.
- Modal backdrop and panel should read as one coordinated transition.
- Overlay motion must preserve viewport focus and layering.

Target timing:
- Dropdown entrance: approximately **340–380 ms**; exit: **220–260 ms**.
- Modal entrance: approximately **400–440 ms**; exit: **280–320 ms**.
- Modal exit is part of the overlay family and must keep the real DOM mounted until exit completes.

### Family 4 — Content / state changes

Applies to:
- Accordion/expanded content.
- Deposit/Withdraw form switching.
- BUY/SELL conditional sections.
- Allocation mode changes.
- Trading Performance filter-result changes.
- Monthly report month/status changes.
- Feedback/success/error banners.

Intent:
- Explain what changed without fading the entire screen.
- Dynamic content should enter as one coherent surface.

Target timing:
- Result/content exit: approximately **200–240 ms**.
- Result/content entrance: approximately **340–380 ms** with controlled overlap.
- Result container size/position changes should animate as part of the same state transition.
- Tooltips stay quicker, approximately **180–220 ms**.
- Filtered/replaced content should transition old -> new through keyed presence; selector animation alone is not sufficient.

### Family 5 — Charts / financial data visualization

Applies to:
- Analytics timeframe changes.
- Analytics mode changes.
- Primary and secondary chart-series transitions.
- Tooltip/crosshair/active-point presentation.

Intent:
- Recharts/data-series interpolation owns the chart transition.
- Do not force-remount the plot solely to create motion.
- Today/intraday and daily timeframes must use the same visual transition language.
- Animation must never fabricate financial observations or imply data that does not exist.

Target timing:
- Main and secondary chart data transition: approximately **500–520 ms** for ordinary ranges.
- 1W crossings preserve the complete outgoing/incoming profile inside the existing Recharts interpolation path so short weekly datasets do not collapse the visible curve at animation start.
- Main-tab entry defers mounting animated chart canvases until the incoming tab transition completes, preventing page motion and chart animation from competing for the desktop render/compositor budget.
- Tooltip motion remains short enough to track the pointer.

### Phase 4 user-validation requirements

The accepted implementation must specifically satisfy:

- Motion is clearly noticeable without relying on full-page fades; the previous stability pass was judged too subtle and is superseded by the v3 Motion-for-React implementation.
- Motion coverage is systematic through the five families rather than added component-by-component without a shared language.
- The primary analytics chart transition **to and from Today** must match the quality/continuity of transitions between daily timeframes.
- The secondary Risk & Cost charts must animate Today/intraday data with the same transition language as other timeframes.
- Advanced decorative effects such as strong shimmer sweeps, parallax, animated ambient blobs, or elaborate glow pulses remain Phase 5 work.

Guardrails:
- Motion cannot delay or change data/transaction operations.
- Animation cannot imply a financial value changed when it did not.
- prefers-reduced-motion must be honored.
- Motion must suit dense financial screens.
- Do not permanently promote whole long pages to compositor layers with persistent `will-change` / `translateZ(0)`.
- Browser View Transition snapshots are prohibited for app tab/filter/report lifecycle motion.
- Timer-driven React-node caching/swap orchestration is prohibited.
- Avoid animated blur/filter on large app surfaces, especially on mobile.
- Every interaction has exactly one lifecycle-motion owner.
- Phase 4 is presentation-only; no business/accounting/data behavior may be changed for animation.

Acceptance:
- Every major interaction belongs to one of the five families.
- Timing is consistent within each family.
- Tab/context changes include outgoing + incoming motion.
- Overlay family includes modal exit motion.
- Filter families animate both control state and the affected result surface.
- App-content transitions must render **one React tree at a time**; browser full-page View Transition snapshots are not permitted for tab/filter/report content because real phone/desktop recordings showed ghost duplicates, blank midpoint frames, geometry drift, and scroll/viewport instability.
- Rapid repeated changes must collapse to the latest requested state without flashing an older intermediate tree.
- Transition midpoint opacity must stay high enough that content reads as a continuous change, not disappear/reappear.
- No leftover provisional motion visibly conflicts with the canonical family timing.
- Today and non-Today chart transitions feel like one system.
- Reduced-motion removes nonessential animation.
- Quality Checks pass and no visual-motion change introduces a functional regression.

### Phase 4 completion note

Phase 4 is accepted as complete after desktop and phone validation. The remaining desktop stutter is minor and no longer blocks the redesign. Further motion/performance tuning is explicitly deferred to **Phase 11 — Performance, accessibility & regression QA**, where it can be profiled against the final visual system after Phases 5–10.

The final desktop performance refinements include:
- avoiding simultaneous desktop + mobile position-tree rendering;
- memoizing heavy persistent/report/chart surfaces and derived position/report work;
- keeping historical analytics warm across tab changes;
- deferring expensive Recharts canvas mounting until the incoming Overview/Reports tab transition has actually completed rather than using a guessed timeout.

## Phase 5 — Advanced effects

**Status: COMPLETE — validated.**

Goal: restrained finishing effects after base visuals/motion are stable.

The detailed Phase 5 plan is preserved in **docs/PHASE5_ADVANCED_EFFECTS_PLAN.md** as a historical architecture/validation record.

Phase 5 is deliberately system-first. The audit covers `src/App.tsx`, all 33 non-test TSX component files under `src/components`, and the accumulated premium-effect rules in `src/index.css`. Implementation must use the documented full-component coverage matrix rather than stopping after the main screens look correct.

Scope:
- Consolidate existing advanced-effect ownership before adding new effects.
- Refined static edge light, depth, and glass-refraction cues through shared primitives.
- Controlled continuous CTA aurora/iridescent border flow on the explicitly audited high-value action set.
- Subtle semantic halo refinement tied to actual financial/system state.
- Existing page ambience may be tuned, but no additional continuous full-page effect layer is planned.

Performance guardrails:
- No broad new infinite-animation system; only the explicitly approved CTA aurora-border loop on the audited high-value action set is allowed.
- No new animated blur/backdrop-filter.
- No persistent `will-change` / compositor-promotion hacks.
- No per-row decorative animation on dense tables.
- No Phase 5-caused regression in the accepted Phase 4 production-motion baseline.
- Mobile/touch and reduced-motion paths degrade to static effects.

Later-phase boundaries:
- chart internals remain Phase 7;
- responsive layout remains Phase 6;
- navigation remains Phase 6.5;
- visual hierarchy remains Phase 8;
- bespoke header refinement remains Phase 9.

Acceptance:
- Effects support hierarchy, not compete with data.
- Readability is never reduced.
- One coherent edge/refraction/sheen/semantic-halo system is used across the full component matrix.
- Every component receives an explicit direct/inherited/excluded/deferred disposition.
- Performance remains at least as good as the accepted Phase 4 baseline.

## Phase 6 — Mobile / responsive refinement

**Status: IN PROGRESS — Pass 3 corrections plus ticker-directory and historical-coverage side quests are CI-clean; ACTF remains the deliberate end-to-end repair fixture before Pass 4.**

The detailed audited execution plan lives in **docs/PHASE6_RESPONSIVE_REFINEMENT_PLAN.md**.

Audit coverage:
- `src/App.tsx`;
- all 33 non-test component TSX files;
- responsive/media-query rules in `src/index.css`;
- touch controls, fixed notifications, modal families, filters/selectors, tables, report shells, and chart shells.

Key audit findings:
- touch targets are commonly undersized on coarse pointers;
- modal viewport/scroll behavior is inconsistent, with Portfolio Backup the highest-risk long modal;
- fixed toast/offline/status surfaces need viewport-safe width/insets;
- several toolbars/selectors retain fixed minimum widths that can create 320px pressure;
- chart/report shells mostly respond well, but tooltip widths, selector targets, and mobile heights need a common contract;
- existing mobile CSS mostly tunes material/motion cost and does not yet provide shared touch/modal/fixed-overlay layout primitives.

Scope:
- Breakpoints, wrapping, stacking, spacing.
- Touch-target sizing.
- Modal/dropdown viewport fit.
- Fixed toast/status viewport fit.
- Table overflow/card density.
- Report selectors/charts on mobile.
- Shared responsive primitives before one-off component fixes.

Acceptance:
- No page-level horizontal overflow at supported phone widths.
- No clipped controls or inaccessible overlays.
- Primary actions remain reachable.
- Touch targets are usable without precision tapping.
- Modal content and actions remain reachable on short mobile viewports.
- Wide tables scroll inside their shell rather than the page.
- Mobile hierarchy remains consistent with desktop.
- No Phase 6 change to business logic, chart interpolation, Phase 4 lifecycle motion, or Phase 6.5 navigation architecture.

## Phase 6.5 — Navigation refinement

Scope:
- Active/inactive hierarchy.
- Desktop/mobile navigation consistency.
- Grouping, icons, collapse behavior.
- Header/navigation/content handoff.

Acceptance:
- Current location is visually obvious.
- Navigation does not dominate portfolio content.
- Supported sizes have no collisions.

## Phase 7 — Charts

**Status: planning complete; implementation not started.**

Goal: bring every chart into the final premium system without changing underlying observations/calculations.

Detailed execution plan: **docs/PHASE7_CHARTS_PLAN.md**.

Scope:
- Chart frames, plot surfaces, grids, axes, legends, tooltips, crosshairs, active points, selectors, loading/empty states.
- Consistent EGP/% presentation.
- Semantic financial colors.
- Responsive sizing/tooltips.

Acceptance:
- No white/default chart-library UI remains.
- Charts look native to EGX Portfolio.
- Visual smoothing/transitions never alter actual data points.

See **docs/ANALYTICS_VISUAL_SYSTEM.md**.

## Phase 8 — Visual hierarchy

Scope:
- Hero vs primary vs secondary vs inset surfaces.
- Typography scale/emphasis.
- Spacing rhythm.
- Dense reports/tables vs summaries.
- Action priority/destructive-action de-emphasis.

Acceptance:
- The eye lands on the correct portfolio information first.
- Secondary controls do not compete with core metrics.
- Similar information uses similar hierarchy everywhere.

## Phase 9 — Header

Scope:
- Final header glass/readability.
- Utility grouping.
- Navigation relationship.
- Alert/sync/backup/install presentation.
- Desktop/mobile spacing and overflow.

Acceptance:
- Header feels integrated with the final system.
- Utilities remain discoverable without visual noise.
- No header collision/wrapping issues.

## Phase 10 — Full consistency sweep

Scope:
- Every tab, modal, confirmation, dropdown, selector, button, input, card, table, badge, tooltip, toast, banner, and empty/error state.
- Semantic color, hierarchy, overlay, and z-index consistency.

Acceptance:
- No accidental legacy styling remains.
- Equivalent controls look equivalent.
- Exceptions are intentional and documented.

## Phase 11 — Performance, accessibility & regression QA

Scope:
- Typecheck/tests/build.
- Visual-regression review.
- Keyboard/focus behavior.
- Contrast and semantic readability.
- Reduced-motion behavior.
- Touch-target review.
- CSS/blur/shadow/animation performance.
- Browser/responsive smoke tests.
- Verification that visual work did not alter business logic/data behavior.

Acceptance:
- Quality Checks pass.
- No known redesign-caused functional regression.
- No major accessibility regression.
- Expensive effects are tuned/removed where necessary.
- The branch is reviewable as a presentation-layer change.

## Change control

Documentation updates are part of the implementation workflow, not a separate cleanup task. Update this plan and the implementation log in the same work pass whenever:
- a phase starts, completes, pauses, or changes scope;
- acceptance criteria or visual rules change;
- a workaround/rollback becomes the accepted direction;
- performance or regression debt is intentionally deferred;
- a new representative implementation milestone is committed.

Record actual implementation history in **PREMIUM_UI_REDESIGN_IMPLEMENTATION.md** without waiting for a separate documentation request.
