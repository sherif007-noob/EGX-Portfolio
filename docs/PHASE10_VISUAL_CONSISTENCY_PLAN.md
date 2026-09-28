# Phase 10 — Full-App Visual Consistency & System Closure

## Status

**PHASE 10.0 — BASELINE FREEZE + VISUAL INVENTORY COMPLETE AT SOURCE LEVEL. NO VISUAL CHANGES MADE.**

Phase 10 begins only after the accepted Phase 8 material/hierarchy system and the Phase 9 header architecture are treated as frozen dependencies.

The purpose of Phase 10 is **consistency, not redesign**.

> Reduce visual exceptions without creating new ones.

A component may be changed later in Phase 10 only when its intended role is known and an actual inconsistency, responsive defect, viewport-safety problem, or primitive-ownership problem has been identified.

---

## Governing rules

1. **Accepted components are frozen by default.**
   Existing accepted visual behavior is not reopened merely because another component looks different.

2. **No blanket global overrides.**
   Do not repair visual debt through broad selectors such as all cards, all buttons, all borders, or all nested panels. Changes must belong to a known primitive, role, or component family.

3. **Material, semantic state, and information hierarchy remain independent axes.**
   - material = glass/refraction/elevation;
   - semantic state = financial meaning;
   - hierarchy = information importance/density.

4. **Hierarchy never replaces material.**
   H0–H5 may organize information but may not flatten or redefine accepted glass/refraction/aura.

5. **Semantic aura is protected.**
   The additive semantic edge never replaces full-card semantic aura/bloom.

6. **Intentional difference is allowed.**
   A hero, dense table, modal, dropdown, filter pill, and repeated record should not become visually identical merely for the sake of consistency.

7. **Phase 9 header/navigation is frozen.**
   Phase 10 may report a regression but may not reorganize or redesign the header architecture.

8. **Chart behavior is frozen.**
   Phase 10 may audit chart containers/controls/typography, but not chart data, interpolation, smoothing, spacing, tooltip synchronization, timeframe logic, or animation algorithms.

9. **No business/data changes.**
   No accounting, Supabase, market data, ticker registry/resolver, persistence, reporting math, or transaction behavior.

10. **No opportunistic cleanup.**
    Every later code change must point to a Phase 10 audit finding.

11. **Reuse before duplication.**
    Equivalent roles should converge on an existing accepted primitive before a new visual recipe is added.

12. **Responsive parity is mandatory.**
    A desktop repair is incomplete if it regresses mobile/landscape/tablet, and vice versa.

13. **Audit before implementation.**
    A source difference is an audit candidate, not automatically a defect.

14. **Each pass gets regression coverage where practical.**

15. **Each pass updates this document with findings, implementation, intentional exceptions, and remaining work.**

16. **No giant Phase 10 implementation commit.**
    Passes are audited, implemented, tested, and accepted independently.

---

# Frozen dependencies

## Phase 8 visual language

Canonical source: `docs/PREMIUM_VISUAL_LANGUAGE_CONTRACT.md`.

Protected invariants:

- accepted glass/refraction material remains the source of truth;
- hierarchy is material-neutral;
- semantic state uses the accepted BUY / WIN / LOSS / BREAKEVEN language;
- semantic surfaces retain near aura + far bloom before hover;
- the additive semantic edge is additional decoration, not a glow replacement;
- Monthly Performance audit cards remain a material-quality reference;
- Data & Tools remains the canonical custom-dropdown surface;
- body-level overlay context + viewport-clamped dropdown geometry remain canonical;
- emergency late-cascade restoration overrides remain prohibited.

Canonical hierarchy source: `src/components/VisualHierarchy.tsx`.

Frozen hierarchy levels:

- H0 — structural/page context;
- H1 — hero / decision surface;
- H2 — primary supporting surface;
- H3 — secondary information surface;
- H4 — inset/detail surface;
- H5 — dense-data surface.

Frozen text roles:

- page title;
- section title;
- metric;
- metric label;
- metadata;
- helper.

Frozen action priorities:

- primary;
- secondary;
- utility;
- destructive.

## Phase 9 global command architecture

Canonical source: `docs/PHASE9_HEADER_NAVIGATION_PLAN.md` and `Phase99HeaderClosure.test.ts`.

Phase 10 does not change:

- three navigation groups;
- seven navigation destinations;
- global command ownership;
- Add Trade primary / Scan Receipt secondary;
- direct Alerts + Sync;
- Data & Tools ownership;
- Settings affordance;
- keyboard navigation;
- active `aria-current`;
- viewport-safe Data & Tools portal;
- mobile command architecture;
- desktop/2XL header geometry;
- header status semantics;
- reduced-motion behavior.

---

# Phase 10.0 — Baseline freeze + full inventory

## Rule

**10.0 makes no production visual changes.**

Its job is to identify ownership and risk before any consistency work begins.

### Source-level evidence rule

Raw Tailwind Slate utility classes inside a component are **not proof of inconsistency**. They may represent accepted typography, dense-data coloring, separators, or intentionally local treatment.

They become a Phase 10 finding only after comparison against:

- the component's role;
- its hierarchy assignment;
- its semantic state;
- the canonical primitive family;
- its responsive behavior;
- the accepted visual reference.

---

# Application composition map

## Shared application shell

| Surface | Source | Role | Baseline status | Phase 10 ownership |
| --- | --- | --- | --- | --- |
| Global header + navigation | `Header.tsx` | Global control plane | **FROZEN — Phase 9** | Report regressions only |
| Main page canvas | `App.tsx` / `premium-page` | H0 structural canvas | Accepted baseline | 10.9 responsive verification |
| Global portfolio summary | `PortfolioSummary.tsx` | Shared KPI/hero band shown above every tab | **Protected visual reference** | 10.4 + 10.6 verification only unless a defect is proven |
| Ledger reconciliation alert | `App.tsx` | Conditional operational alert | Audit target | 10.2 / 10.7 |
| Undo toast | `App.tsx` | Floating action feedback | Audit target | 10.3 / 10.9 |
| Price/action toast | `App.tsx` | Floating status feedback | Audit target | 10.3 / 10.9 |
| Tab transition stage | `PremiumMotion.tsx` / `App.tsx` | Existing motion infrastructure | Behavior frozen | Phase 11 performance/motion work only unless visual regression |

**Important:** `PortfolioSummary` is outside the tab content switch. It is therefore a **global shared surface**, not an Overview-only component.

---

# Seven-destination inventory

## 1. Overview

Primary sources:

- `App.tsx`;
- `PositionsTable.tsx`;
- `PerformanceTimeframeChart.tsx`;
- secondary analytics chart components used by the main analytics surface.

Current source roles:

- page content wrapper: structural flow;
- Active Stock Positions title/action: section/control layer;
- PositionsTable: H3/H4/H5 + dense workflow/table system;
- analytics chart: H1 panel with chart-control/select/dropdown primitives.

Protected behavior:

- chart calculations;
- timeframe behavior;
- smoothing/interpolation;
- tooltip synchronization;
- chart transitions;
- intraday logic.

Phase 10 audit focus:

- section title/action consistency;
- table toolbar/control language;
- chart selector/container consistency;
- spacing between dense holdings and analytics;
- responsive visual parity.

Status: **AUDIT REQUIRED — no source-level visual defect declared in 10.0.**

---

## 2. Open Positions

Primary source:

- `PositionsTable.tsx`.

Current primitive families:

- `premium-card`;
- `premium-panel`;
- `premium-subpanel`;
- `premium-table-shell`;
- `premium-dense-data`;
- `premium-dense-row`;
- `premium-dense-toolbar`;
- `premium-dense-workflow`;
- `premium-action*`;
- `premium-icon-action`;
- H3 / H4 / H5;
- semantic WIN / LOSS / BREAKEVEN glow;
- additive semantic edge.

Intentional uniqueness:

- true dense desktop rows may use row-edge semantics rather than standalone-card halo geometry;
- repeated/mobile records may use semantic-record/card treatment.

Phase 10 audit focus:

- toolbar/search/filter parity;
- action-button family;
- dense table typography;
- row vs mobile-card semantics;
- search + sector selector relationship;
- empty state;
- horizontal overflow and mobile fallback.

Status: **STRONG PRIMITIVE COVERAGE / AUDIT FOR CONSISTENCY.**

---

## 3. Closed Cycles

Primary source:

- `ClosedCyclesView.tsx`.

Current primitive families:

- H3 / H4 / H5;
- semantic WIN / LOSS / BREAKEVEN;
- additive semantic edge;
- dense row/summary/toolbar/workflow;
- selector shell;
- panel/subpanel/card;
- action/icon-action.

Intentional uniqueness:

- cycle records communicate realized outcome;
- repeated records should remain denser than KPI/report hero cards.

Phase 10 audit focus:

- outcome filters;
- summary cards;
- expanded execution-phase details;
- edit/delete/destructive action hierarchy;
- semantic edge/aura relationship;
- desktop/mobile density.

Status: **STRONG PRIMITIVE COVERAGE / AUDIT FOR CONSISTENCY.**

---

## 4. Transactions

Primary source:

- `TradingJournal.tsx`.

Current primitive families:

- H3 / H4 / H5;
- BUY / WIN / LOSS / BREAKEVEN semantic states;
- additive semantic edge;
- dense row/summary/toolbar/workflow;
- selector shell;
- panel/subpanel/card;
- floating surfaces;
- embedded modal primitives;
- action/icon-action.

Intentional uniqueness:

- BUY transactions legitimately use blue semantic state;
- transaction records carry execution context that must remain denser than general cards.

Phase 10 audit focus:

- ALL/BUY/SELL/WIN/LOSS filter language;
- transaction summary surfaces;
- row/card parity;
- edit/delete actions;
- notes and embedded edit workflow;
- local modal consistency;
- responsive filtering.

Status: **HIGH-COMPLEXITY AUDIT TARGET.**

---

## 5. Cash Ledger

Primary source:

- `CashBalanceView.tsx`.

Current primitive families:

- H2 / H3 / H5;
- dense data/summary/workflow;
- table shell;
- selector shell;
- panel/subpanel/card;
- modal primitives;
- primary/success/warning/danger actions;
- icon actions.

Intentional uniqueness:

- cash operations are accounting actions, not financial WIN/LOSS state;
- deposit/withdraw action semantics must not be confused with portfolio performance semantics.

Phase 10 audit focus:

- Deposit / Withdraw segmented control;
- cash summary hierarchy;
- ledger table;
- edit/delete operations;
- modal consistency;
- mathematical breakdown/inset surfaces;
- mobile workflow.

Status: **HIGH-COMPLEXITY AUDIT TARGET.**

---

## 6. Reports & Performance

Primary sources:

- `PerformanceReports.tsx`;
- `reports/MonthlyPerformanceReport.tsx`;
- `reports/TradingPerformanceReport.tsx`.

Current primitive families:

- H0 / H2 / H3 / H4 depending section;
- report hero cards;
- report tables;
- compact selectors / selector shells;
- WIN / LOSS / BREAKEVEN states;
- Monthly semantic edge;
- subpanels.

Protected material reference:

- Monthly Performance audit-card glass/aura remains canonical.

Intentional uniqueness:

- outer report sections may be structural and must not inherit a child's semantic color;
- mixed-metric monthly reports may contain winning and losing inner surfaces simultaneously.

Phase 10 audit focus:

- section-vs-card containment;
- report selector consistency;
- monthly outer-shell neutrality;
- holding/closed/all filter visual ownership;
- Trading Performance period selectors;
- report tables;
- nested material depth;
- mixed semantic states.

Status: **CANONICAL MATERIAL REFERENCE + HIGH-PRIORITY CONSISTENCY AUDIT.**

---

## 7. Stocks & Prices

Primary source:

- `TickerDirectoryView.tsx`.

Current primitive families:

- H3 / H4 / H5;
- dense row/summary/toolbar/workflow;
- panel/subpanel/card;
- primary/success actions.

Intentional uniqueness:

- directory/search data is informational and should remain neutral unless an action has an explicit functional accent.

Phase 10 audit focus:

- search/control bar;
- ticker cards/rows;
- action buttons;
- schema/live-price controls;
- empty/loading states;
- responsive density.

Status: **STRONG PRIMITIVE COVERAGE / AUDIT FOR CONSISTENCY.**

---

# Shared primitive-family inventory

## A. Hierarchy ownership

Canonical implementation:

- `VisualHierarchy.tsx`;
- `premium-hierarchy-h0` … `premium-hierarchy-h5`;
- typography-role classes;
- metric-scale classes;
- action-priority classes.

10.1 audit questions:

- are equivalent surface roles using equivalent hierarchy levels?
- are any hierarchy classes being used to compensate for material problems?
- are local classes bypassing a shared typography/action priority role?

Status: **FROZEN MODEL / OWNERSHIP AUDIT IN 10.1.**

---

## B. Cards / panels / structural surfaces

Observed families:

- `premium-card`;
- `premium-panel`;
- `premium-subpanel`;
- `premium-glass`;
- `premium-inset-glass`;
- report-glass families;
- `premium-table-shell`;
- `premium-report-hero-card`;
- dense workflow/summary/data families.

10.4 audit questions:

- correct hierarchy assignment?
- correct nested material relationship?
- accidental card-within-card visual competition?
- local material recipes duplicating shared primitives?

Status: **AUDIT IN 10.1 + 10.4.**

---

## C. Semantic surfaces

Observed states:

- BUY;
- WIN;
- LOSS;
- BREAKEVEN.

Observed implementation families:

- `premium-glow-*`;
- `premium-state-*`;
- `premium-semantic-edge`;
- report semantic edge;
- canonical semantic surface roles defined in the visual-language contract.

10.6 audit questions:

- correct state meaning?
- full aura preserved?
- additive edge preserved?
- no parent semantic leakage into mixed child metrics?
- correct dense-row exception?

Status: **PROTECTED / AUDIT IN 10.6.**

---

## D. Buttons and action hierarchy

Observed shared families:

- `premium-action`;
- `premium-action-primary`;
- `premium-action-success`;
- `premium-action-warning`;
- `premium-action-danger`;
- `premium-action-purple`;
- `premium-icon-action`;
- action-priority classes.

Known high-density usage:

- Positions;
- Cycles;
- Transactions;
- Cash Ledger;
- Reports;
- Directory;
- all modal workflows.

10.2 audit questions:

- equivalent role → equivalent height/radius/padding?
- primary/secondary/utility/destructive ownership?
- icon alignment?
- focus/disabled states?
- functional accent vs financial semantic color?

Status: **AUDIT IN 10.2.**

---

## E. Selectors / filters / segmented controls

Observed families:

- `premium-selector-shell`;
- `premium-compact-selector`;
- `premium-control`;
- `premium-select-trigger`;
- chart-control/select families;
- page-local filter groups.

Canonical shared selector implementation:

- `AnalyticsSelect.tsx` for custom selectable dropdown behavior/material.

10.2 audit questions:

- equivalent selectors use the same control vocabulary?
- legacy one-off segmented controls still present?
- size/radius/text/icon alignment parity?
- selected state vs financial semantic state correctly separated?

Status: **HIGH-PRIORITY AUDIT IN 10.2.**

---

## F. Dropdowns / menus / popovers

Canonical material reference:

- Data & Tools dropdown.

Canonical implementation requirements:

- `premium-floating + premium-dropdown`;
- `premium-menu-item`;
- body-level overlay;
- viewport-clamped geometry;
- upward opening when appropriate;
- internal max-height scrolling.

Known owners:

- `AnalyticsSelect.tsx`;
- Add Trade ticker/autocomplete flow;
- analytics mode/timeframe controls;
- Data & Tools (Phase 9 frozen);
- other custom application selectors.

10.3 audit rule:

**A dropdown matching the CSS but rendering inside the wrong backdrop/overflow context is still inconsistent.**

Status: **CANONICAL CONTRACT ALREADY EXISTS / FULL SWEEP IN 10.3.**

---

## G. Text/date/number inputs

### AnalyticsSelect

Uses:

- `premium-control`;
- `premium-select-trigger`;
- canonical dropdown/portal system.

Role: **shared reference implementation.**

### NumberStepperInput

Uses:

- `premium-control`;
- dedicated desktop/touch stepper controls.

Role: **shared numeric-input family.**

### DateInput

Currently relies more heavily on local field classes and `premium-icon-action` than the other shared control primitives.

This is a **10.1/10.2 audit candidate**, not a declared defect.

Questions:

- is the difference intentional because native date input behavior requires it?
- can the accepted control primitive be composed without changing behavior?
- does mobile native-picker behavior impose constraints?

Status: **AUDIT CANDIDATE.**

---

# Dense-data inventory

Primary dense-data owners:

- `PositionsTable.tsx`;
- `ClosedCyclesView.tsx`;
- `TradingJournal.tsx`;
- `CashBalanceView.tsx`;
- `TickerDirectoryView.tsx`;
- report tables.

Shared families already present:

- `premium-dense-data`;
- `premium-dense-row`;
- `premium-dense-summary`;
- `premium-dense-summary-card`;
- `premium-dense-toolbar`;
- `premium-dense-workflow`;
- `premium-table-shell`.

10.5 audit must compare:

- shell;
- table header;
- numeric alignment/typography;
- ticker identity;
- metadata;
- row separators;
- row hover;
- action cells;
- semantic state;
- mobile record fallback;
- horizontal overflow.

Rule:

**Do not solve dense consistency by turning each row into a glowing standalone card.**

---

# Modal/workflow inventory

## Shared modal infrastructure observed

- `premium-modal`;
- `premium-modal-backdrop`;
- `premium-modal-viewport`;
- `premium-modal-frame`;
- `premium-modal-scroll-body`;
- `premium-modal-section`;
- `premium-modal-backdrop-panel-scroll`.

Two established shell patterns exist in source:

1. viewport-centered modal pattern;
2. frame + internal scroll-body pattern for larger workflows.

This is a **10.8 audit subject**, not something to collapse into one shell automatically.

## Workflow list

| Workflow | Source | Current shared family | 10.8 focus |
| --- | --- | --- | --- |
| Add Trade | `AddTradeModal.tsx` | modal + dropdown portal + actions + time input | form controls, autocomplete, receipt path, viewport safety |
| Edit Position | `EditPositionModal.tsx` | modal viewport + subpanel | field/control parity |
| Sell Position | `SellPositionModal.tsx` | modal viewport + subpanel | warning/destructive hierarchy, viewport safety |
| Quick Cash | `QuickCashModal.tsx` | modal viewport | cash-action consistency |
| Google Sheets | `GoogleSheetsModal.tsx` | modal frame + scroll body | long-workflow containment |
| Backup & Reconcile | `PortfolioBackupModal.tsx` | modal viewport + sections | action hierarchy |
| Delete confirmation | `ConfirmDeleteModal.tsx` | modal viewport + danger action | destructive consistency |
| Receipt scanner | `TradeScreenshotModal.tsx` | modal frame + scroll body | long workflow + form consistency |
| Price Alerts | `PriceAlertsModal.tsx` | modal frame + scroll body | tabs/controls/status rows |
| Schema sync | `PythonSchemaSyncModal.tsx` | modal viewport | utility workflow |
| Transaction edit | `TradingJournal.tsx` | embedded modal primitives | consistency with standalone modal family |
| Cash edit | `CashBalanceView.tsx` | embedded modal primitives | consistency with standalone modal family |
| PWA install | `PWAInstallButton.tsx` | modal frame + actions | low-priority workflow |

Status: **FULL AUDIT DEFERRED TO 10.8.**

---

# Floating/overlay inventory

Known families:

- Data & Tools dropdown — frozen reference;
- AnalyticsSelect dropdown;
- chart dropdowns;
- ticker/autocomplete dropdown;
- app toasts;
- undo toast;
- modal backdrops;
- tooltip surfaces.

10.3 and 10.9 must verify:

- correct portal ownership;
- z-index;
- viewport clamping;
- safe areas;
- no clipping by transformed/backdrop-filter parents;
- no accidental page reflow;
- internal scrolling for tall menus.

---

# Source-level audit observations from 10.0

These observations identify where later inspection should concentrate. They are **not automatic implementation orders**.

## Observation 1 — premium primitives are already widespread

All seven primary destinations already use substantial portions of the premium hierarchy/material/control system.

Therefore Phase 10 should be a **targeted convergence pass**, not a wholesale migration.

## Observation 2 — local Slate utility classes remain throughout mature components

This occurs even in accepted reference components.

Conclusion:

- do not treat `text-slate-*`, `border-slate-*`, or local neutral backgrounds as legacy by definition;
- inspect their visual role first;
- migrate only when they duplicate or conflict with an accepted primitive.

## Observation 3 — selectors have more than one implementation shape

The source includes:

- AnalyticsSelect;
- selector shells;
- compact selectors;
- chart controls;
- page-local segmented filters.

This makes **10.2** a high-value audit before page-by-page cleanup.

## Observation 4 — modal infrastructure has two valid structural patterns

Small/medium workflows generally use viewport-centered shells.
Long workflows use frame + internal scroll-body.

Do not collapse them into one pattern unless an actual inconsistency is demonstrated.

## Observation 5 — Reports remain the most material-sensitive area

Monthly Performance is both:

- a canonical visual reference;
- a complex mixed-semantic report.

Any 10.4/10.6 changes must be validated against this benchmark before propagation.

## Observation 6 — global summary is shared across every tab

It must not be independently restyled during each 10.7 page pass.

## Observation 7 — header is out of Phase 10 implementation scope

The header may be included in responsive regression screenshots/tests, but visual changes require reopening Phase 9 explicitly.

---

# Phase 10 pass sequence

## 10.0 — Baseline freeze + inventory

**Status: COMPLETE AT SOURCE LEVEL.**

Deliverables:

- this document;
- seven-page composition map;
- primitive-family inventory;
- modal/overlay inventory;
- frozen Phase 8 + Phase 9 dependencies;
- Phase 10 baseline regression test.

Production visual changes: **none**.

---

## 10.1 — Primitive & token ownership audit

Goal:

- identify duplicated local recipes;
- identify components bypassing accepted primitives;
- map shared ownership before changing pages.

Do not restyle accepted references.

Gate:

- every proposed primitive change must list all known consumers;
- visual behavior of accepted reference components must remain unchanged.

---

## 10.2 — Buttons, selectors & interactive controls

Audit:

- actions;
- icon buttons;
- segmented controls;
- filters;
- search;
- select triggers;
- date/time fields;
- numeric inputs;
- pagination.

Gate:

- equivalent role shares the same family;
- financial semantics are not used merely as generic action colors;
- desktop/mobile control parity.

---

## 10.3 — Dropdowns, menus, popovers & overlays

Audit all custom application dropdowns against the canonical contract.

Gate:

- portal context;
- viewport containment;
- max height/internal scroll;
- correct material;
- no content push/clipping.

---

## 10.4 — Card hierarchy & surface consistency

Audit H1–H5 composition before adjusting intensity.

Gate:

- hierarchy assignment verified before visual change;
- material remains independent;
- nested surfaces do not compete with parents.

---

## 10.5 — Dense data & table system

Audit positions, transactions, cash, cycles, directory, and report tables together.

Gate:

- dense information remains dense;
- mobile repeated records preserve semantic scan cues;
- no indiscriminate row glow.

---

## 10.6 — Semantic-state consistency

Audit BUY/WIN/LOSS/BREAKEVEN meaning and rendering.

Gate:

- aura + additive edge;
- no parent semantic leakage;
- correct dense-row exception;
- no financial semantic color used decoratively.

---

## 10.7 — Page-by-page closure

Order:

- 10.7A Overview;
- 10.7B Open Positions;
- 10.7C Closed Cycles;
- 10.7D Transactions;
- 10.7E Cash Ledger;
- 10.7F Reports & Performance;
- 10.7G Stocks & Prices.

Each page receives:

- hierarchy audit;
- typography audit;
- controls audit;
- material audit;
- semantic audit;
- dense/empty state audit;
- responsive audit.

The shared global PortfolioSummary is not reworked seven times.

---

## 10.8 — Modal & workflow consistency

Audit every modal/workflow listed above.

Gate:

- viewport safety;
- long-content scrolling;
- form-control consistency;
- destructive/primary hierarchy;
- mobile keyboard behavior where relevant;
- no workflow/business logic changes.

---

## 10.9 — Responsive cross-app parity

Representative widths:

- 320;
- 359;
- 390;
- 430;
- short phone landscape;
- 768;
- 1024;
- 1280;
- 1440;
- 1600;
- 1920;
- 2560.

Audit:

- page overflow;
- menu clipping;
- glow clipping;
- modal containment;
- control wrapping;
- grid collapse;
- nested scroll traps;
- excessive 2XL stretching;
- header regression only, without redesigning it.

---

## 10.10 — Visual regression closure

No redesign.

Freeze:

- hierarchy model;
- material contract;
- semantic contract;
- control families;
- dropdown/overlay contract;
- modal contract;
- dense-data system;
- responsive coverage;
- Phase 8 material reference;
- Phase 9 header architecture.

Final external gate:

- typecheck;
- full tests;
- production build.

Only then mark Phase 10 **CLOSED / CI CLEAN**.

---

# Phase 10.0 exit criteria

10.0 is complete when all are true:

- [x] Phase 8 visual/material contract identified and frozen.
- [x] Phase 9 header architecture identified and frozen.
- [x] All seven main destinations mapped.
- [x] Shared global PortfolioSummary ownership documented.
- [x] Shared card/panel/hierarchy families inventoried.
- [x] Semantic-state families inventoried.
- [x] Buttons/actions inventoried.
- [x] Selectors/inputs inventoried.
- [x] Dropdown/overlay contract identified.
- [x] Dense-data families inventoried.
- [x] Modal/workflow families inventoried.
- [x] Responsive audit widths defined.
- [x] Source differences explicitly classified as audit candidates rather than automatic defects.
- [x] Production visual changes prohibited during 10.0.
- [ ] External CI/typecheck/test/build validation for the connector-written Phase 10 baseline commit.

Next implementation pass after the baseline gate: **10.1 — Primitive & token ownership audit.**
