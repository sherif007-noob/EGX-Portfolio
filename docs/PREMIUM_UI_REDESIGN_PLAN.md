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
| 4 | Motion & micro-interactions | **In progress — five-family system approved** |
| 5 | Advanced effects | Not started |
| 6 | Mobile / responsive refinement | Not started |
| 6.5 | Navigation refinement | Not started |
| 7 | Charts | Not started |
| 8 | Visual hierarchy | Not started |
| 9 | Header | Not started |
| 10 | Full consistency sweep | Not started |
| 11 | Performance, accessibility & regression QA | Not started |

After Phase 4 is completed, **8 planned stages remain**: 5, 6, 6.5, 7, 8, 9, 10, and 11.

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

**Status: IN PROGRESS.**

The accepted Phase 4 direction is a shared motion language organized into five families. The provisional motion code remains useful input, but it is being normalized rather than treated as final.

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
- Major page/context transition: approximately **420–460 ms**.
- Nav-selection feedback: approximately **300–320 ms**.

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
- Selector state settle: approximately **300–320 ms**.
- Press response may be faster than hover, but must not snap abruptly.

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
- Dropdown/popover: approximately **340–380 ms**.
- Modal/backdrop: approximately **380–440 ms**.

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
- Content/reveal transition: approximately **400–420 ms**.
- Tooltips stay quicker, approximately **200–220 ms**.

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
- Main and secondary chart data transition: approximately **500–520 ms**.
- Tooltip motion remains short enough to track the pointer.

### Phase 4 user-validation requirements

The accepted implementation must specifically satisfy:

- Motion is clearly noticeable but **slower than the provisional pass**, which was judged too fast.
- Motion coverage is systematic through the five families rather than added component-by-component without a shared language.
- The primary analytics chart transition **to and from Today** must match the quality/continuity of transitions between daily timeframes.
- The secondary Risk & Cost charts must animate Today/intraday data with the same transition language as other timeframes.
- Advanced decorative effects such as strong shimmer sweeps, parallax, animated ambient blobs, or elaborate glow pulses remain Phase 5 work.

Guardrails:
- Motion cannot delay or change data/transaction operations.
- Animation cannot imply a financial value changed when it did not.
- prefers-reduced-motion must be honored.
- Motion must suit dense financial screens.
- Phase 4 is presentation-only; no business/accounting/data behavior may be changed for animation.

Acceptance:
- Every major interaction belongs to one of the five families.
- Timing is consistent within each family.
- No leftover provisional motion visibly conflicts with the canonical family timing.
- Today and non-Today chart transitions feel like one system.
- Reduced-motion removes nonessential animation.
- Quality Checks pass and no visual-motion change introduces a functional regression.

## Phase 5 — Advanced effects

Goal: restrained finishing effects after base visuals/motion are stable.

Scope:
- Controlled shimmer/light sweep on suitable surfaces/actions.
- Refined edge light, depth, and glass-refraction cues.
- Subtle ambient semantic glow.

Acceptance:
- Effects support hierarchy, not compete with data.
- Readability is never reduced.
- Effects remain performant and degrade gracefully.

## Phase 6 — Mobile / responsive refinement

Scope:
- Breakpoints, wrapping, stacking, spacing.
- Touch-target sizing.
- Modal/dropdown viewport fit.
- Table overflow/card density.
- Report selectors/charts on mobile.

Acceptance:
- No clipped controls or inaccessible overlays.
- Primary actions remain reachable.
- Mobile hierarchy remains consistent with desktop.

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

Goal: bring every chart into the final premium system without changing underlying observations/calculations.

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

Update this plan whenever a phase is re-scoped, inserted, split, paused, or completed. Record actual implementation history in **PREMIUM_UI_REDESIGN_IMPLEMENTATION.md**.
