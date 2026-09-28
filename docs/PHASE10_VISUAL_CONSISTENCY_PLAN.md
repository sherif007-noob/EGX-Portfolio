# Phase 10 — Full-App Visual Consistency & System Closure

## Status

**PHASE 10.6 — SEMANTIC-STATE CONSISTENCY IMPLEMENTED AT SOURCE LEVEL. The canonical semantic hero/card/record role layer is restored and consumed by the existing strong 8.3b halo engine; repeated financial records use bounded semantic-record bloom plus additive edge; true breakeven states render amber rather than leaking into positive/negative; Monthly parent neutrality and dense-row exceptions remain intact. External full CI/render validation remains pending.**

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

**Status: IMPLEMENTED AT SOURCE LEVEL — external CI/render validation pending.**

Goal:

- identify duplicated local recipes;
- identify components bypassing accepted primitives;
- map shared ownership before changing pages.

Do not restyle accepted references.

### Ownership findings

#### 1. CSS remains the visual/material owner

The audit confirms that the accepted CSS primitive classes remain the source of rendered appearance. Phase 10.1 does **not** move glass, glow, semantic, spacing, or motion styling into React.

Canonical structural primitive names now also have a React-side registry in:

- `src/components/VisualPrimitives.ts`

The registry exists only to prevent shared React controls from inventing parallel class-name families. It does not contain style values.

Registered structural families include:

- action;
- control;
- field;
- icon action;
- selector shell;
- select trigger;
- floating/dropdown/menu item;
- inset glass;
- panel/subpanel;
- table shell;
- modal/modal section.

Financial semantic state is deliberately excluded from this registry. WIN / LOSS / BUY / BREAKEVEN continue to belong to the independent semantic system.

#### 2. Shared control ownership is now explicit

The following shared controls now consume the primitive registry without changing their accepted class composition or behavior:

- `AnalyticsSelect.tsx`;
- `DateInput.tsx`;
- `NumberStepperInput.tsx`.

This establishes the intended ownership chain:

`shared control component -> canonical primitive class name -> CSS visual implementation`

rather than:

`shared control component -> duplicated literal primitive names -> CSS`.

No field sizing, tint, border, refraction, focus state, dropdown geometry, native date behavior, or number-stepper behavior was intentionally changed.

#### 3. Motion duration tokens had two global owners

The source contained an early Phase 4 duration block and a later Phase 4.1 duration block defining the same six global tokens:

- `--motion-instant`;
- `--motion-fast`;
- `--motion-control`;
- `--motion-popover`;
- `--motion-panel`;
- `--motion-modal`.

Because CSS custom properties resolve from the winning cascade value, the later Phase 4.1 definitions were already the runtime values everywhere.

10.1 removes the dead earlier duration definitions while retaining the early easing-token definitions.

Result:

- each canonical duration token now has exactly one global definition;
- runtime duration values remain the existing Phase 4.1 values;
- no intentional motion-speed change.

#### 4. Responsive hierarchy tokens are not duplicate ownership

Repeated hierarchy variables inside:

- base `:root`;
- `max-width: 767px`;
- `max-width: 390px`;

are intentional responsive overrides, not ownership duplication.

They remain untouched.

#### 5. Local neutral utility classes are not automatically legacy

Mature components still contain local Slate text/border/background utilities alongside premium primitives.

10.1 does **not** mass-remove them because many are legitimate:

- typography contrast;
- row separators;
- dense metadata;
- border-width declarations;
- native-control compatibility;
- accepted local neutral treatment.

They will only be removed/replaced when 10.2–10.8 proves that a specific local recipe duplicates or conflicts with a canonical primitive.

#### 6. Selector accent layering requires visual audit, not primitive rewrite

`premium-select-trigger` currently has:

- a shared expanded-state structural treatment;
- later accent-variable ownership for icon/accent parity.

This is retained in 10.1. Any actual accent inconsistency belongs to the rendered control audit in 10.2, not token-ownership cleanup.

#### 7. Modal shell variants remain intentionally separate

The viewport-centered and frame/internal-scroll modal patterns both compose canonical modal primitives.

10.1 does not merge them.

Their visual/workflow consistency remains a 10.8 responsibility.

### Implemented changes

- added `VisualPrimitives.ts` as the canonical React-side structural primitive registry;
- migrated `AnalyticsSelect`, `DateInput`, and `NumberStepperInput` to registry-owned primitive names;
- removed the obsolete first owner of the six global motion-duration tokens;
- retained easing ownership and all existing final motion values;
- added `Phase101PrimitiveOwnership.test.ts`.

### Regression contract

`Phase101PrimitiveOwnership.test.ts` locks:

- the canonical primitive registry;
- registry usage by the three shared controls;
- semantic-state exclusion from structural primitive ownership;
- exactly one global owner for each canonical motion-duration token;
- intentional responsive hierarchy overrides;
- Phase 8 material boundary;
- Phase 9 header freeze.

### Gate

- every proposed primitive change must list all known consumers;
- visual behavior of accepted reference components must remain unchanged;
- semantic financial state must remain independent from structural primitive ownership;
- responsive overrides must not be mistaken for duplicate tokens;
- no page-level restyling belongs in 10.1.

### Deferred to later passes

- selector/filter sizing and selected-state parity -> **10.2**;
- dropdown rendered material/viewport parity -> **10.3**;
- card/panel hierarchy consistency -> **10.4**;
- dense table/record consistency -> **10.5**;
- semantic aura/edge correctness -> **10.6**;
- modal shell/workflow parity -> **10.8**.

Production appearance intent for 10.1: **no visible change.**

---

## 10.2 — Buttons, selectors & interactive controls

**Status: IMPLEMENTED AT SOURCE LEVEL — external CI/render validation pending.**

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

### Findings and implementation

#### 1. Compact dropdown triggers were not explicitly bound to the segmented-control height contract

`AnalyticsSelect compact` already used the accepted selector material, but its compact trigger sizing was owned only by local padding.

It now also composes `premium-compact-selector`.

Result:

- compact AnalyticsSelect triggers and compact segmented pills share the same 36px desktop height contract;
- existing mobile/coarse-pointer 44px touch-target rules remain authoritative;
- dropdown material, portal behavior, accent logic, and menu geometry are unchanged.

#### 2. Dense toolbar search fields had small cross-page height differences

Search controls on:

- Open Positions;
- Closed Cycles;
- Transactions;
- Stocks & Prices;

used the same `premium-field` material but local vertical padding differed.

Added the structural `premium-dense-search` sizing class:

- 36px minimum desktop height;
- canonical compact-selector vertical padding;
- no background/border/material ownership;
- mobile/coarse-pointer field rules still raise controls to the existing 44px touch target.

The four dense toolbar searches now compose that class.

#### 3. Page-level segmented filters now explicitly use the compact-selector role

The following page-level filter groups now compose:

`premium-selector-shell + premium-filter-pill + premium-compact-selector`

where they represent compact toolbar/report filtering:

- Closed Cycles outcome filters;
- Transactions ALL / OPEN / WIN / LOSS / BUY / SELL;
- Cash Ledger Deposit / Withdraw action selector;
- Cash Ledger history filters;
- Monthly Performance month selector;
- Trading Performance timeframe selector;
- existing Portfolio Allocation selectors;
- existing analytics timeframe/resolution selectors.

This makes their role explicit rather than relying only on the selector-shell descendant rule.

#### 4. Cash Ledger edit modal no longer invents a second Deposit/Withdrawal selector language

The Edit Cash Transaction modal previously used:

- `premium-choice-success`;
- `premium-choice-danger`;

for the same Deposit/Withdrawal role represented elsewhere by selector pills.

That workflow now uses the canonical selector shell + compact filter pills with the existing emerald/rose active states.

Behavior is unchanged:

- same `editType`;
- same callbacks;
- same DEPOSIT / WITHDRAWAL values.

#### 5. Workflow decisions remain intentionally larger

The BUY / SELL decision inside the transaction edit workflow remains a larger `premium-filter-pill` pair and does **not** receive `premium-compact-selector`.

Reason:

- it is a form/workflow decision, not a dense toolbar filter;
- making it compact would reduce decision weight for the sake of superficial uniformity.

#### 6. Real switches remain switches

Portfolio Allocation's **Include cash** control remains:

- `role="switch"`;
- `aria-checked`;
- dedicated switch-track/knob treatment.

It is not converted into a segmented selector because its interaction semantics are different.

#### 7. Secondary and utility actions now declare priority explicitly

Added existing Phase 8 action-priority classes where the role was previously visually implicit:

- Closed Cycles search Clear -> utility;
- Closed Cycles Expand/Collapse All -> secondary;
- Stocks & Prices Export JSON -> utility;
- Monthly Performance Export CSV / Print -> utility;
- Trading Performance Export CSV / Print -> utility;
- Cash quick amount/percentage presets -> utility.

Primary actions such as Add Trade remain untouched and continue using their accepted stronger action material.

### Intentionally unchanged

10.2 does not normalize everything into one control:

- transaction-edit BUY/SELL remains larger;
- Include Cash remains a switch;
- icon-only pagination remains the existing icon-action family;
- report export buttons retain their accepted report-context glass composition while gaining utility priority;
- success/warning/danger action accents remain operation/function accents and are not reinterpreted as financial WIN/LOSS semantics;
- DateInput, NumberStepperInput, and AnalyticsSelect behavior remains unchanged;
- chart timeframe/resolution logic is untouched;
- no card/panel material or semantic aura work belongs in this pass.

### Regression coverage

Added `Phase102InteractiveControls.test.ts`, protecting:

- compact dropdown / segmented-control sizing parity;
- dense toolbar search sizing;
- page-level compact selector ownership;
- Cash Ledger edit-selector convergence;
- intentional larger workflow choice;
- real switch semantics;
- utility/secondary action priorities;
- primary action preservation;
- Phase 8 material/semantic boundary;
- Phase 9 header freeze;
- chart behavior boundary.

### Gate

- equivalent toolbar/filter role shares the same family and size contract;
- workflow decisions may remain more prominent than toolbar filters;
- switches remain switches;
- utility/secondary actions do not compete with primaries;
- financial semantic color is not repurposed as generic structure;
- desktop/mobile touch-target rules remain intact;
- no Phase 8 material, Phase 9 header, chart behavior, or data logic changes.

---

## 10.3 — Dropdowns, menus, popovers & overlays

**Status: IMPLEMENTED AT SOURCE LEVEL — external CI/render validation pending.**

Audit all custom application dropdowns against the canonical contract.

### Audit result

There are four current custom application dropdown/menu owners:

- `AnalyticsSelect`;
- Add Trade ticker autocomplete;
- Unified Portfolio Analytics mode menu;
- Header Data & Tools.

The first three use the shared `DropdownPresence` lifecycle/geometry primitive. Header Data & Tools remains the accepted Phase 9-owned exception because its safe-inline header geometry and command-zone composition are frozen dependencies.

### Findings and implementation

#### 1. Portal context was already correct for content dropdowns

All three non-header dropdown owners already use:

- a real anchor ref;
- `portal`;
- `createPortal(..., document.body)` through `DropdownPresence`;
- fixed positioning;
- `visualViewport`-aware geometry;
- left/right viewport clamping;
- automatic above/below placement.

This is retained. No content dropdown is converted back to inline/absolute layout, so opening a menu cannot push surrounding cards/tables or become trapped by an ancestor overflow context.

#### 2. The shared geometry layer was overriding the menus' intended max-height caps

`DropdownPresence` previously wrote:

`style.maxHeight = geometry.maxHeight`

for every portaled menu.

Because inline style wins over utility/CSS `max-height`, this silently defeated intended content caps such as:

- AnalyticsSelect `max-h-72`;
- Add Trade suggestions `max-h-64`;
- the canonical mobile dropdown `min(70dvh, 24rem)` cap.

Viewport safety still worked, but a menu could become much taller than its intended visual family before internal scrolling began.

10.3 moves that ownership into the canonical overlay primitive.

`DropdownPresence` now accepts an explicit `maxHeight` content cap and resolves:

`min(viewport-available-height, content-cap)`

while keeping `overflow-y: auto` and `overscroll-behavior: contain`.

Its default cap is:

`min(70dvh, 24rem)`

so future canonical portaled menus cannot silently grow to the full available viewport.

#### 3. Existing dropdown families now declare their intended caps explicitly

The current content dropdowns use:

- AnalyticsSelect -> **18rem**;
- Add Trade ticker suggestions -> **16rem**;
- Unified Portfolio Analytics mode menu -> **24rem**.

The obsolete local max-height/overflow utilities on AnalyticsSelect and Add Trade were removed because the shared overlay primitive now owns the actual scroll box.

No menu-row density, selected state, accent, option content, callback, or open/close behavior changed.

#### 4. Canonical glass/material ownership is unchanged

All application dropdowns continue to use the accepted:

`premium-floating + premium-dropdown`

overlay material, whose Data & Tools glass recipe remains the visual reference.

10.3 does not alter:

- glass transparency;
- blur/saturation;
- border/refraction;
- semantic item accents;
- hover/focus language;
- Phase 5 refraction tiers.

This pass fixes geometry/scroll ownership, not the accepted appearance.

#### 5. Header Data & Tools remains the intentional Phase 9 exception

The Header menu is not migrated to `DropdownPresence` in 10.3.

It already satisfies the pass gate through its Phase 9 implementation:

- body-level portal;
- fixed overlay;
- safe-inline-header clamping;
- explicit 304px maximum working width;
- `min(70dvh, 24rem)` height cap;
- internal vertical scrolling;
- canonical `premium-dropdown` material;
- no content push.

Changing that architecture here would violate the Phase 9 source freeze for no visual or behavioral benefit.

### Regression coverage

Added `Phase103DropdownOverlays.test.ts`, protecting:

- body-level portal ownership;
- fixed/visualViewport-aware geometry;
- shared max-height cap ownership;
- internal scrolling and overscroll containment;
- explicit per-family content caps;
- canonical dropdown material;
- Header Data & Tools as the frozen Phase 9 exception;
- Phase 8 material/semantic boundary;
- chart/data behavior boundary.

Also corrected `DropdownVisualStandard.test.ts` so canonical menu-row ownership through `PREMIUM_PRIMITIVE_CLASS.menuItem` is recognized alongside literal class composition. This aligns the older test with the accepted Phase 10.1 primitive registry; it does not change rendered UI.

### Gate

- every content dropdown is body-portaled from a real anchor;
- portaled geometry is clamped to the live visual viewport;
- available viewport height and family content cap both constrain the scroll box;
- long menus scroll internally and contain overscroll;
- canonical dropdown glass/material remains unchanged;
- no dropdown opening pushes surrounding content;
- Header Data & Tools remains Phase 9-owned and source-frozen;
- no Phase 8 hierarchy/material, card system, modal workflow, chart/data behavior, or business logic changes.

---

## 10.4 — Card hierarchy & surface consistency

**Status: IMPLEMENTED AT SOURCE LEVEL — external full CI/render validation pending.**

Audit H1–H5 composition before adjusting intensity.

### Audit result

The existing Phase 8 top-level composition is fundamentally correct and does **not** need another hierarchy redesign.

Verified/frozen:

- global PortfolioSummary keeps H1 Total Portfolio Value, H2 primary support, H3 secondary support, and H4 utility context;
- main Reports analytics remains the sole H1 visualization;
- supporting report visualizations remain H2;
- report bridge/summary sections remain H3 with H4 detail surfaces;
- dense workflow result records remain H5 and are deliberately deferred to 10.5;
- Phase 9 Header remains outside Phase 10 card implementation scope.

The actual 10.4 debt was narrower: several nested detail surfaces were visually implemented with the right general material family but did not consistently declare the same H4 role, and one Cash reconciliation group mixed shared subpanels with two one-off tinted result slabs.

### Findings and implementation

#### 1. Open Positions nested statistics now declare the H4 detail role

The mobile position record remains H5.

Its internal Shares / Avg Buy / Current / Market Value statistics surface now explicitly composes the existing H4 detail hierarchy on top of the existing `premium-subpanel` material.

No position-card semantic state, row density, action layout, or data behavior changed.

#### 2. Closed Cycles nested metrics and expanded execution detail now share H4 ownership

The six core cycle metric subpanels now explicitly use the H4 detail role.

The expanded multi-phase execution container also uses H4 while the outer realized cycle record remains H5.

This preserves the intended relationship:

`H5 repeated cycle record -> H4 execution/detail surfaces`

without changing realized WIN / LOSS / BREAKEVEN meaning or the additive semantic edge.

#### 3. Transaction attribute detail now explicitly uses H4

The transaction Shares / Price / Date / Fee / Net Outlay-or-Proceeds block already used the accepted inset glass material.

10.4 adds the H4 detail role rather than inventing another nested-card recipe.

The outer transaction record remains H5.

#### 4. Cash reconciliation had a real surface-family inconsistency

Inside **Capital Ledger & Cash Balance Audit**, five peer calculation steps were visually split between:

- three `premium-subpanel` surfaces;
- one custom emerald opaque/tinted slab;
- one custom blue opaque/tinted slab.

Those five items have the same structural role: line-by-line H4 accounting detail under one H3 reconciliation panel.

10.4 converges all five onto:

`premium-subpanel + H4`

while retaining the existing emerald/blue text emphasis for the calculated Cash and NAV values.

This removes a local one-off material exception and prevents the last two calculation steps from reading as peer outer cards.

It does **not** reinterpret positive cash or NAV as WIN/LOSS semantic state.

#### 5. Monthly Performance hierarchy is now explicit without touching its accepted material

Monthly Performance remains the canonical material benchmark and receives no material/intensity rewrite.

Its information roles are now explicitly recorded:

- month audit shell -> H3;
- quick month metrics -> H4;
- nested Shares / Commissions / Entry / Exit details -> H4;
- repeated audit record -> H5.

The repeated audit record deliberately keeps its accepted `premium-report-hero-card` material while using `data-hierarchy="h5"`.

That is intentional and demonstrates the protected three-axis rule:

**high-quality/strong material does not automatically mean high information hierarchy.**

10.4 does not add `premium-hierarchy-h5` to that record, because doing so merely to make the material look weaker would violate the accepted Monthly reference and the hierarchy/material independence rule.

### Intentionally unchanged

10.4 does **not**:

- retune glass opacity, blur, refraction, shadow, or aura;
- add a new Phase 10 CSS override block;
- change semantic WIN / LOSS / BUY / BREAKEVEN rendering;
- change dense table/record styling owned by 10.5;
- change any chart data, interpolation, selectors, timing, or tooltips;
- change Header composition;
- normalize alerts/status banners into ordinary cards;
- convert every local badge/chip/field treatment into a card primitive.

### Representative commits

- `8e13ac3` — Open Positions H4 detail ownership.
- `95cda58` — Closed Cycles nested H4 convergence.
- `7f479d8` — Transactions H4 attribute detail.
- `aed6551` — complete Cash reconciliation five-step H4 convergence.
- `596f52a` — explicit Monthly H3/H4/H5 information roles with material preserved.
- `31b54a6` — finalized Phase 10.4 regression contract.

Source-contract verification after the final corrections passed **22/22 targeted checks**. A full generic Quality Checks workflow has not been emitted for the final branch head, so full typecheck/test/build and rendered device validation remain pending.

### Regression coverage

Added `Phase104CardHierarchy.test.ts`, protecting:

- the global PortfolioSummary H1/H2/H3/H4 mapping;
- H4 nested-detail ownership in Positions, Closed Cycles, and Transactions;
- all five Cash reconciliation steps using one H4 subpanel family;
- removal of the two Cash one-off opaque/tinted calculation surfaces;
- Monthly H3/H4/H5 information-role mapping while preserving its accepted hero-grade audit-card material;
- Reports H1 -> H2 -> H3/H4 composition;
- dense H5 records remaining intact for 10.5;
- Phase 8 material/semantic contract;
- Phase 7 chart behavior;
- Phase 9 Header freeze.

### Gate

- hierarchy assignment is verified before any surface change;
- equivalent nested detail roles converge on H4;
- material remains an independent axis and accepted material references are preserved;
- nested detail surfaces remain subordinate to their parent context;
- mixed semantic report parents do not inherit child state;
- dense H5 record/table styling remains deferred to 10.5;
- no broad CSS override or hierarchy-driven glow attenuation is introduced.

---

## 10.5 — Dense data & table system

**Status: IMPLEMENTED AT SOURCE LEVEL — external full CI/render validation pending.**

Audit positions, transactions, cash, cycles, directory, and report tables together.

### Audit result

The application already has two valid dense-data presentation modes:

1. **true tables** for wide, columnar data;
2. **repeated H5 records/cards** where responsive scanning is more important than column alignment.

10.5 preserves that split rather than forcing every dataset into one visual structure.

Verified existing repeated-record families:

- Open Positions mobile records -> H5;
- Closed Cycles records -> H5;
- Transactions records -> H5;
- Stocks & Prices records -> H5;
- Monthly Performance responsive audit records -> H5 information role with accepted report material.

These remain dense records and are not promoted to H1/H2 cards.

### Findings and implementation

#### 1. Positions was the only wide operational table without horizontal containment

The Positions desktop table contains nine columns but previously used:

- `overflow-hidden`;
- no table minimum width.

At laptop/desktop widths this allowed the columns to compress rather than behaving like the other dense tables.

10.5 changes the table shell to:

- `overflow-x-auto`;
- `overscroll-x-contain`;
- `min-w-[1080px]` on the table itself.

The existing `lg` desktop / card fallback split remains unchanged.

This is a density/containment repair only; position calculations, sorting/filtering, actions, and semantic row state are untouched.

#### 2. Cash Ledger and Positions now share the same dense header role

Operational table headers previously differed:

- Positions used local slate text + medium weight;
- Cash Ledger used local slate text + semibold.

Both now use the existing `premium-type-metadata` role plus semibold weight and the existing divider.

No new table-header material or CSS primitive is introduced.

#### 3. Report tables now explicitly declare H5 information hierarchy

Monthly Performance and Trading Performance desktop tables already used the correct `premium-report-table` material and responsive `2xl` table mode.

They now explicitly declare:

`data-hierarchy="h5"`

This records their information role without adding `premium-hierarchy-h5`, which could alter their accepted report material through existing hierarchy/material composition rules.

Therefore:

- information hierarchy = H5;
- report material = unchanged.

#### 4. Report material and operational table material remain intentionally distinct

10.5 does **not** replace `premium-report-table` with `premium-table-shell`.

Those are two intentional material families:

- operational ledger/positions tables;
- report/institutional tables.

Consistency is established through dense behavior and information anatomy, not by flattening both into one surface.

#### 5. Empty rows now use subordinate helper typography

Positions and Cash Ledger empty table states now explicitly compose `premium-type-helper`.

This keeps an empty dataset readable without giving it the same emphasis as row content or section summaries.

#### 6. Repeated records already satisfy the structural dense-data contract

Closed Cycles, Transactions, and Stocks & Prices already share:

- H5;
- `premium-dense-row`;
- dense metric typography;
- nested H4 detail surfaces where applicable.

No visual rewrite was justified.

10.5 deliberately leaves their semantic aura/edge ownership to **10.6** rather than mixing dense-data and semantic-state work.

#### 7. No indiscriminate row glow was added

Desktop Position rows retain the accepted:

- `premium-row-win`;
- `premium-row-loss`;
- `premium-row-breakeven`;

edge-coded row state.

Cash and report table rows remain neutral unless their cell content communicates state.

No `premium-glow-*` class is applied to true table rows.

### Intentionally unchanged

10.5 does **not**:

- add a new dense-data CSS override layer;
- turn rows into standalone glowing cards;
- change BUY / WIN / LOSS / BREAKEVEN semantic rendering;
- alter the semantic-record role contract owned by 10.6;
- change table data, calculations, sorting, filtering, pagination, exports, or actions;
- change report material;
- change chart behavior;
- change Header composition.

### Representative commits

- `c32644d` — Positions table containment + dense header/empty-state alignment.
- `8a195ec` — Cash Ledger dense header/empty-state alignment.
- `27aff7a` — Monthly audit table explicit H5 role.
- `8b0b245` — Trading benchmark table explicit H5 role.
- `759a25d` — Phase 10.5 dense-data regression contract.

Source-contract verification after implementation passed **27/27 targeted checks**. The final branch head still has no emitted generic Quality Checks run, so full typecheck/test/build and rendered device validation remain pending.

### Regression coverage

Added `Phase105DenseDataSystem.test.ts`, protecting:

- Positions and Cash horizontal table containment;
- explicit minimum widths for wide operational tables;
- metadata-grade table headers;
- H5 declaration for report desktop tables;
- report-material independence from operational table material;
- H5 repeated-record families across Positions/Cycles/Transactions/Directory;
- Position desktop row semantic-edge classes;
- absence of `premium-glow-*` on true table rows;
- responsive report card/table mode separation;
- subordinate empty-state typography;
- Phase 8 hierarchy/material boundary;
- Phase 7 chart behavior;
- Phase 9 Header freeze.

### Gate

- dense information remains dense rather than being inflated into hero cards;
- wide tables scroll horizontally before their columns become unreadably compressed;
- responsive record fallbacks remain separate from true desktop tables;
- report and operational table materials may remain different while sharing dense anatomy;
- mobile/repeated records preserve their existing semantic scan cues;
- no indiscriminate table-row glow is introduced;
- semantic-state changes remain deferred to 10.6.

---

## 10.6 — Semantic-state consistency

**Status: IMPLEMENTED AT SOURCE LEVEL — external full CI/render validation pending.**

Audit BUY/WIN/LOSS/BREAKEVEN meaning and rendering.

### Audit result

10.6 found a real architecture regression rather than merely a color mismatch.

The protected Phase 8 contract requires exactly three independent semantic surface roles:

- `premium-semantic-hero`;
- `premium-semantic-card`;
- `premium-semantic-record`.

The current source still had the canonical BUY / WIN / LOSS / BREAKEVEN colors and strong 8.3b halo values, but the role classes themselves had disappeared from both CSS and their intended consumers.

As a result, halo geometry was effectively coupled back to H-level selectors even though the documentation correctly stated that semantic role and information hierarchy must be independent.

10.6 restores that role layer without weakening the accepted material or aura.

### Findings and implementation

#### 1. The three canonical semantic roles are restored as halo-geometry owners

`src/index.css` now defines exactly:

- `premium-semantic-hero`;
- `premium-semantic-card`;
- `premium-semantic-record`.

These classes own only semantic halo geometry/intensity variables.

They do **not** own:

- material background;
- glass opacity;
- backdrop blur;
- refraction;
- semantic color;
- hierarchy.

The existing `premium-glow-*` / `premium-state-*` families remain the financial-color owners.

#### 2. Accepted 8.3b glow strength is preserved

10.6 does not lower the previously accepted strong aura.

Canonical resting roles:

- hero -> near **58px / 0.40**, far **132px / 0.24**;
- normal semantic card -> near **48px / 0.34**, far **112px / 0.18**;
- repeated semantic record -> near **48px / 0.34**, far **96px / 0.18**.

The record role retains the same visible near-aura and alpha strength but uses a tighter far radius so repeated records remain strongly semantic without flooding adjacent list items.

Hover preserves the accepted strong 8.3b alpha values; repeated records again use the tighter far-field geometry.

#### 3. The existing halo engine now consumes semantic role variables

Both the original Phase 5 semantic-card path and the restored Phase 8 hierarchy/material path resolve semantic radius/intensity through the role variables.

This removes the accidental dependency:

`H-level -> semantic halo size`

and restores the canonical dependency:

`financial state -> semantic color`
+
`semantic surface role -> halo geometry`
+
`H-level -> information hierarchy only`.

No new screen-specific glow engine is introduced.

#### 4. Overview semantic composition is restored

The global PortfolioSummary now maps:

- Total Portfolio Value -> `semantic-hero` + WIN/LOSS/BREAKEVEN;
- Unrealized P&L -> `semantic-card` + WIN/LOSS/BREAKEVEN;
- Realized Gain -> `semantic-card` + WIN/LOSS/BREAKEVEN;
- Brokerage Fees -> `semantic-card` + amber BREAKEVEN/cost state.

The following remain intentionally structural/neutral:

- Total Market Value -> cyan material tone, no financial semantic halo;
- Cash Available -> blue material tone, no WIN/LOSS interpretation.

This prevents structural accents from being confused with portfolio performance state.

#### 5. True zero values now render as BREAKEVEN instead of positive/negative

Several components already used an amber breakeven card glow but still rendered zero-value text/icons with binary `>= 0` logic.

10.6 makes visual state genuinely three-way without changing calculations.

Corrected:

- Overview Today;
- Overview Unrealized P&L;
- Overview Realized Gain;
- Open Positions desktop P&L;
- Open Positions responsive record P&L;
- Monthly Performance summary state;
- Monthly closed audit records.

Zero/flat now uses amber and neutral/flat direction imagery rather than green/up or red/down.

No numeric value or outcome calculation is changed.

#### 6. Repeated financial records now explicitly use semantic-record

The repeated semantic card families now compose:

`premium-card + premium-semantic-record + premium-semantic-edge + H5 + premium-glow-*`

for:

- Open Positions responsive records;
- Closed Cycles;
- Transactions.

The semantic edge remains additive.

It does not replace:

- the full-card halo;
- far bloom;
- material;
- refraction;
- border.

#### 7. Trading Performance semantic KPIs use semantic-card

The four standalone Trading Performance KPI cards now explicitly use `premium-semantic-card`.

Their existing threshold logic and compact `premium-state-*` color mapping remain unchanged.

#### 8. Desktop table rows retain the dense-row exception

True Position table rows remain:

- `premium-row-win`;
- `premium-row-loss`;
- `premium-row-breakeven`.

They do not receive full-card `premium-glow-*` halos.

This is the canonical dense-row exception and remains separate from repeated card records.

#### 9. Monthly Performance keeps parent neutrality and its accepted report material

The month audit shell remains a neutral H3 structural container.

Financial state stays local to its child summaries/records, preventing mixed winning and losing content from tinting the parent shell.

The accepted Monthly audit-card report material remains the visual benchmark and is **not** converted into the standard record material.

10.6 only corrects semantic meaning inside that accepted system:

- no matching activity -> neutral slate;
- actual flat/breakeven -> amber;
- positive -> emerald;
- negative -> rose.

Closed BREAKEVEN audit records now receive the report warning/amber tone rather than falling through to LOSS styling.

Holding audit records also separate two previously conflated axes:

- the outer audit-card aura now follows the holding's actual P&L state: emerald / rose / amber;
- the holding-status badge remains structural: blue for Active Holding and purple for Held at Month-End.

This prevents a losing holding from receiving a blue/purple outer semantic aura merely because it is still open or was held at the reporting boundary.

#### 10. Cash and Stocks remain intentional non-P&L exceptions

Cash Ledger deposit/withdrawal accents are operational/accounting direction, not portfolio WIN/LOSS.

Stocks & Prices green/red trend text describes market movement, not a portfolio P&L semantic surface.

10.6 therefore does **not** add semantic halos or `semantic-record` to those surfaces.

### Regression coverage

Added `Phase106SemanticConsistency.test.ts`, protecting:

- exactly three semantic surface roles;
- role/material/state independence;
- accepted 8.3b hero/card strength;
- bounded record far bloom;
- Overview hero/card/cost mapping;
- real three-state zero/breakeven rendering;
- semantic-record + additive-edge composition;
- desktop row-edge exception;
- Monthly parent neutrality;
- Monthly local BREAKEVEN semantics;
- Trading Performance semantic-card mapping;
- Cash and Directory intentional non-P&L treatment;
- additive edge ownership;
- Phase 7 chart and Phase 9 Header boundaries.

Existing Phase 8/9 material regression tests were also migrated away from literal pre-role shadow strings so they now protect the same accepted strength through the canonical semantic-role variables.

### Validation

Final source-contract verification after the holding-aura correction passed **31/31 targeted checks**.

A further audit of **14 existing Phase 8/9 regression files** found no remaining stale assertions against the old hard-coded semantic shadow strings.

The generic Quality Checks workflow has not been emitted for the final feature-branch head, so full external typecheck/test/build and rendered-device validation remain pending.

### Representative commits

- `95d1209` / `ffc41f3` — restore Overview semantic roles and true three-state detail rendering.
- `6320e8b` — Open Positions semantic-record ownership.
- `762992d` — Closed Cycles semantic-record ownership.
- `7a977cd` — Transactions semantic-record ownership.
- `3814a7d` — Trading Performance semantic-card ownership.
- `df5d023` — restore the canonical three-role semantic halo engine.
- `fe83da4` / `f8acabd` — position BREAKEVEN rendering and source cleanup.
- `5c77e17` / `a35494b` — Monthly Performance BREAKEVEN consistency and P&L-aura/status-accent separation.
- `c8fff9d` / `68aef7a` — Phase 10.6 semantic regression contract, including holding aura/status separation.
- `14b3b0f` / `dbf2bbc` — migrate older material guards to role-aware assertions.

### Gate

- BUY remains blue;
- WIN / positive remains emerald;
- LOSS / negative remains rose;
- BREAKEVEN / cost remains amber where financially meaningful;
- aura and far bloom remain visible at rest;
- additive edge never replaces aura;
- semantic role is independent from H-level;
- parent mixed-content surfaces do not inherit child financial state;
- true dense table rows remain the edge-coded exception;
- structural/operational accents are not reinterpreted as financial P&L semantics;
- no accounting, data, chart, Header, persistence, or workflow behavior changes.

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
