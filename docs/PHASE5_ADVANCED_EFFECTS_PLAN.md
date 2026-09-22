# Phase 5 Advanced Effects Plan

**Status: IMPLEMENTATION IN PROGRESS — Pass 0 complete; Pass 1 representative checkpoint awaiting visual validation.**

This document is the detailed execution plan for Phase 5 of the premium UI redesign. It exists specifically to prevent the problems seen in earlier phases: main-screen-only coverage, duplicated styling systems, late discovery of secondary surfaces, effect stacking, and performance regressions caused by adding visual behavior without a whole-app inventory first.

The active high-level roadmap remains `PREMIUM_UI_REDESIGN_PLAN.md`. Actual implementation history remains in `PREMIUM_UI_REDESIGN_IMPLEMENTATION.md`.

---

## 1. Phase goal

Add restrained premium finishing effects that improve depth, material quality, and hierarchy without competing with financial information or making the Phase 4 motion/performance baseline worse.

Phase 5 is **not** an effects showcase. It is a controlled finishing system.

The target feeling is:
- more dimensional glass;
- cleaner edge illumination;
- subtle refraction/light-catching cues;
- intentional semantic glow;
- limited continuous CTA aurora-border flow on explicitly approved high-value actions;
- no casino-dashboard visual noise;
- no new persistent animation burden.

---

## 2. Audit scope

The planning audit covered:
- `src/App.tsx`;
- all **33 non-test TSX component files** under `src/components`;
- `src/index.css`;
- the current analytics visual-system documentation;
- the completed Phase 4 architecture/performance constraints.

This means Phase 5 planning is based on the full component inventory rather than only Overview, Positions, Reports, or the most visible modals.

### Current effect inventory found during audit

The existing redesign already contains a meaningful advanced-effect layer:

- two fixed page-level ambient aurora blobs;
- desktop-only continuous page-aurora motion;
- `premium-radial` hover illumination on selected larger surfaces;
- `premium-shimmer-border` with a continuous 5.5 s border-flow animation on desktop;
- semantic card glows for win/loss/breakeven/buy states;
- glass surface highlights, multi-layer box shadows, radial gradients, and backdrop blur;
- custom report glass, modal glass, dropdown glass, tooltip glass, and floating surfaces;
- state/status pulse animations in a few live/sync/offline contexts.

The stylesheet audit also found substantial accumulated complexity:
- 76 `backdrop-filter` declarations including prefixed copies;
- 96 `box-shadow` declarations;
- 18 radial-gradient declarations;
- 59 linear-gradient declarations;
- 3 currently infinite animation declarations;
- 74 distinct `.premium-*` selector families, with many repeated definitions across historical passes.

Representative repeated selector counts include:
- `.premium-dropdown`: 26 rule occurrences;
- `.premium-card`: 21;
- `.premium-segment`: 12;
- `.premium-report-table`: 11;
- `.premium-modal`: 10;
- `.premium-table-shell`: 8.

These counts do not mean each occurrence is wrong; media queries and state selectors legitimately repeat some rules. They do mean Phase 5 must **consolidate effect ownership instead of appending another override generation**.

---

## 3. Core Phase 5 decision

### Phase 5 is refinement + consolidation, not “add more animation”

The app already has enough moving/blurred/glowing material that simply adding shimmer, parallax, animated blobs, or extra drop shadows would likely:
- increase GPU/compositor pressure;
- reduce information hierarchy;
- create visual conflict with semantic P&L colors;
- make the remaining desktop tab stutter worse;
- force another cleanup phase later.

Therefore the Phase 5 architecture is:

1. keep the existing page ambience as the maximum continuous ambient layer;
2. make most new premium quality come from **static edge/refraction detail**;
3. preserve the original continuous CTA aurora/iridescent border flow, but restrict it to the audited high-value CTA set rather than running it broadly;
4. keep semantic glow tied to actual financial/state meaning;
5. apply effects through shared primitives and tiers, not component-specific one-offs.

---

## 4. Non-negotiable scope boundaries

### Phase 5 may change

- shared effect tokens;
- surface edge highlights;
- static refraction/light-catch pseudo-elements;
- static/hover glow intensity;
- shimmer/sheen behavior;
- ambient background intensity;
- effect degradation on mobile/reduced-motion;
- visual-only CSS organization needed to establish one canonical effect system.

### Phase 5 must not change

- accounting, valuation, cash, P&L, reconciliation, or analytics calculations;
- transaction meaning or state;
- persistence/data fetching;
- Phase 4 tab/state/modal/dropdown lifecycle choreography;
- chart data interpolation logic;
- responsive layout/breakpoints except a minimal effect-specific safety fix;
- navigation structure;
- typography/spacing hierarchy;
- header layout/composition.

### Later-phase ownership boundaries

- **Phase 6:** responsive/mobile layout and density.
- **Phase 6.5:** navigation structure/active hierarchy.
- **Phase 7:** chart internals, axes, grids, plot styling, chart-specific visual polish.
- **Phase 8:** typography, spacing, and overall visual hierarchy.
- **Phase 9:** bespoke header layout/readability/utility refinement.
- **Phase 10:** final whole-app consistency cleanup.
- **Phase 11:** final profiling/accessibility/regression audit and deeper remaining PC optimization.

Phase 5 may improve a shared primitive used by those areas, but it must not pre-implement their dedicated work.

---

## 5. Effect families

Phase 5 uses four primary effect families. Every implemented effect must belong to one family.

### Family A — Ambient canvas

Purpose:
- create low-frequency environmental depth behind the app;
- keep the dark financial workspace from feeling flat.

Current implementation:
- two fixed blurred `.premium-page` pseudo-elements;
- cyan/blue and purple/blue families;
- animated only on desktop/non-reduced-motion.

Phase 5 rule:
- **two ambient page elements is the hard maximum**;
- no additional full-screen blobs;
- no parallax;
- no mouse-following light;
- no animated background on each tab;
- no new large fixed filter layers.

Allowed work:
- tune opacity, radius, position, and motion amplitude if necessary;
- make the existing ambience less expensive if production testing shows cost.

### Family B — Edge light & glass refraction

Purpose:
- make glass read as material through rim light rather than stronger blur.

This is the main Phase 5 family.

Use on:
- hero surfaces;
- primary panels/cards;
- report surfaces;
- modal shells;
- dropdown/floating shells;
- selected high-value secondary surfaces.

Visual language:
- thin top/upper-corner highlight;
- restrained cyan/neutral spectral edge;
- faint opposite-edge falloff;
- no bright white outline;
- no inner glowing blob behind text;
- no moving blur.

Implementation principle:
- shared pseudo-elements/tokens;
- no extra React wrapper unless CSS cannot safely express the effect;
- clipping/overflow rules must respect dropdowns/tooltips.

### Family C — CTA aurora / iridescent border flow

Purpose:
- make a small set of high-value actions feel premium through continuously shifting color around the button perimeter.

The historical `premium-shimmer-border` name is retained for compatibility, but the approved visual is **not a light sweep**. It is a moving multi-stop blue/cyan/purple gradient around the CTA border/perimeter.

Target rule:
- eligible CTA borders continuously carry the aurora/iridescent flow on desktop;
- the effect remains limited to the audited high-value CTA set;
- no moving light beam crosses the full button face;
- no border-flow effect on warning/danger actions;
- no border-flow effect on routine Save Changes actions;
- no border-flow effect on modal panels, table rows, filters, passive cards, or financial values;
- reduced motion disables the loop;
- mobile/touch may degrade to a static border treatment.

Eligible examples:
- Add Trade / Open Position primary CTA;
- intentional high-value primary modal confirmation;
- install/connect/sync CTA when it is the primary action.

Not eligible:
- every Edit/Delete icon;
- filter pills;
- table rows;
- every modal shell;
- passive cards;
- financial values.

### Family D — Semantic halo

Purpose:
- reinforce meaningful financial or system state without changing meaning.

Existing semantic mappings remain authoritative:
- emerald: positive/win;
- rose: negative/loss/destructive;
- amber: breakeven/warning;
- blue/cyan: informational/buy/live;
- purple: secondary analytical/contextual.

Rules:
- semantic halo is mostly static or hover-strengthened;
- P&L values/cards never pulse simply because the number is positive/negative;
- glow strength follows hierarchy: hero > primary card > dense row;
- table rows keep edge indicators rather than large halos;
- semantic color never becomes decorative on neutral controls.

---

## 6. Effect intensity tiers

Effects are assigned by surface role, not by file.

### Tier 0 — Data-dense / precision surfaces

Examples:
- table rows;
- form fields;
- chart plot regions;
- date/number inputs;
- dense lists.

Allowed:
- existing focus/selection indication;
- subtle static edge separation.

Not allowed:
- shimmer;
- ambient blobs;
- large halo;
- animated blur;
- moving light.

### Tier 1 — Inset / secondary surfaces

Examples:
- `premium-subpanel`;
- `premium-inset-glass`;
- `premium-report-glass-soft`;
- form/modal sections.

Allowed:
- static edge catch;
- faint depth/refraction;
- local semantic border where meaningful.

### Tier 2 — Primary surfaces

Examples:
- `premium-card`;
- `premium-panel`;
- `premium-report-glass`;
- table shells.

Allowed:
- stronger static edge/refraction;
- restrained hover light;
- semantic halo where state is meaningful.

### Tier 3 — Hero / floating / overlay surfaces

Examples:
- `premium-hero-card`;
- report hero metrics;
- modal shell;
- dropdown/floating surface.

Allowed:
- strongest static depth and rim light in the system;
- carefully controlled CTA aurora-border flow for explicitly eligible primary actions;
- still no looping surface animation.

---

## 7. Performance and compositor budget

These are Phase 5 acceptance rules, not optional optimization suggestions.

### Continuous-animation budget

- **No broad decorative infinite-animation system.**
- Existing two desktop page auroras remain the maximum ambient continuous effects.
- Approved exception: the audited high-value CTA set may use the original continuous aurora/iridescent border-flow loop.
- The CTA aurora must stay border/perimeter-oriented; moving full-face sweep/flash effects are prohibited.
- Warning/danger/routine-save controls do not receive the loop.
- Status pulses may remain only where they communicate an actual live/active state.

### Forbidden expensive patterns

Do not add:
- animated `backdrop-filter`;
- animated `filter: blur()`;
- hue-rotate/brightness blur loops;
- full-page scale/transform effects;
- persistent `will-change`;
- new `translateZ(0)` promotion hacks;
- JavaScript mousemove/pointer-tracked lighting;
- one pseudo-element per table row for decorative animation;
- simultaneous chart and page effect animation orchestration.

### Mobile

On touch/mobile:
- no animated CTA aurora loop;
- no new continuous decorative animation;
- edge/refraction should resolve to static CSS;
- existing page ambience remains static as it is today;
- effects must not increase clipping or overlay overflow.

### Reduced motion

`prefers-reduced-motion: reduce` must:
- remove optional CTA aurora animation;
- remove ambient motion;
- preserve useful static depth/semantic state.

### Phase 4 baseline rule

If a Phase 5 effect makes production `npm start` tab transitions visibly worse, the effect is changed or removed during Phase 5. It is **not** allowed to be knowingly pushed to Phase 11 as new debt.

Phase 11 owns the remaining pre-existing optimization debt, not regressions introduced by Phase 5.

---

## 8. Full component coverage matrix

Every component receives an explicit Phase 5 disposition. A file does not need a new effect to be considered covered; “inherits shared effect,” “defer,” and “intentionally no effect” are valid outcomes.

### App shell / persistent surfaces

| File | Phase 5 disposition |
| --- | --- |
| `src/App.tsx` | Ambient canvas only through shared page primitives. No Phase 5 component logic. |
| `Header.tsx` | Inherit shared glass edge/refraction only. Bespoke header treatment remains Phase 9. |
| `PortfolioSummary.tsx` | Hero depth/refraction + existing semantic halos; live-feed status remains meaningful, not decorative. |

### Main tabs / data surfaces

| File | Phase 5 disposition |
| --- | --- |
| `PositionsTable.tsx` | Mobile cards inherit semantic/edge system; desktop table uses row edge state only; no per-row shimmer. Primary Add action may use CTA sheen. |
| `ClosedCyclesView.tsx` | Closed-trade cards inherit semantic halo; accordion/detail areas Tier 0/1; no decorative motion. |
| `TradingJournal.tsx` | Transaction cards inherit semantic effects; tables/dense results stay restrained; edit modal inherits modal family. |
| `CashBalanceView.tsx` | Cash hero and primary action surfaces receive shared depth; existing multiple shimmer usages must be normalized, not expanded. |
| `TickerDirectoryView.tsx` | Main panel/refraction only; no glow/shimmer on every ticker item. |
| `PerformanceReports.tsx` | Report surfaces receive shared Tier 1–3 edge/refraction; allocation/chart plot internals are excluded for Phase 7. |

### Reports and charts

| File | Phase 5 disposition |
| --- | --- |
| `RealizedTrajectoryChart.tsx` | Outer report shell only. Recharts plot/series/points remain Phase 7. |
| `charts/PerformanceTimeframeChart.tsx` | Outer analytics panel only. No change to timeframe interpolation or plot effects. |
| `charts/SecondaryAnalyticsCharts.tsx` | Card/surface framing only if shared primitives reach it; chart internals defer to Phase 7. |
| `charts/AnalyticsChartTheme.tsx` | Tooltip/floating shell may inherit shared edge depth; no chart-theme redesign in Phase 5. |
| `reports/MonthlyPerformanceReport.tsx` | Report hero/card/table shells inherit effect tiers; table rows remain Tier 0. |
| `reports/TradingPerformanceReport.tsx` | Report hero/card/table shells inherit effect tiers; result data stays visually precise. |

### Modal / overlay family

All modal shells must use one effect language. Do not create modal-specific refraction/shimmer recipes.

| File | Phase 5 disposition |
| --- | --- |
| `AddTradeModal.tsx` | Shared modal rim/refraction; primary CTA eligible for interaction sheen. |
| `EditPositionModal.tsx` | Shared modal rim/refraction; no unique effect. |
| `SellPositionModal.tsx` | Shared modal rim/refraction; warning/destructive semantics preserved. |
| `QuickCashModal.tsx` | Shared modal rim/refraction; success CTA semantic. |
| `ConfirmDeleteModal.tsx` | Shared modal rim/refraction; destructive action stays rose, never cyan shimmer. |
| `PriceAlertsModal.tsx` | Shared modal system; existing local gradient/shadow should be checked for duplication. |
| `GoogleSheetsModal.tsx` | Shared modal system; connect/sync primary CTA may use interaction sheen. |
| `PythonSchemaSyncModal.tsx` | Shared modal system; no bespoke decorative effect. |
| `PortfolioBackupModal.tsx` | Shared modal system; restore/export actions remain semantic. |
| `TradeScreenshotModal.tsx` | Shared modal system; upload/scan states remain functional and semantic. |
| `PWAInstallButton.tsx` | Button follows CTA rules; install modal follows shared modal system. |

### Shared controls / secondary states

| File | Phase 5 disposition |
| --- | --- |
| `AnalyticsSelect.tsx` | Dropdown shell receives shared static rim/refraction; no row stagger/sheen. |
| `DateInput.tsx` | Tier 0; retain focus treatment, no advanced decoration. |
| `NumberStepperInput.tsx` | Tier 0; retain control depth/focus only. |
| `OfflineIndicator.tsx` | Status-specific surface only; no added continuous decorative loop. |
| `ErrorBoundary.tsx` | Shared static app/surface depth only; error readability dominates effects. |
| `SupabaseAuthGate.tsx` | No bespoke Phase 5 effect. If visible shell needs alignment, use existing shared static primitive only. |
| `StockLogo.tsx` | Intentionally excluded from Phase 5 effects. |
| `PremiumMotion.tsx` | Frozen for Phase 5; no lifecycle timing/easing changes. |

This matrix is mandatory during implementation. Phase 5 cannot be marked complete until every row is rechecked against the final code.

---

## 9. Planned implementation passes

No implementation should skip directly to individual screens.

### Pass 0 — Effect-system cleanup and baseline

**Status: COMPLETE.**

Goal:
- establish one canonical place/ownership model for existing effects before adding anything new.

Work:
- inventory the current canonical definitions for page ambience, radial hover, shimmer, semantic glow, modal/dropdown edge light, report glass;
- consolidate **effect-related** duplicate overrides where safe;
- define shared effect tokens/intensity values;
- do not refactor unrelated motion or layout CSS;
- do not append a new “final override” section as the primary architecture.

Started implementation:
- **2d24dcd** — centralize Phase 5 effect primitives without changing the accepted appearance.
- Page ambient blur/opacity, radial-hover color/opacity, and existing shimmer palette/opacity/duration now read from canonical Phase 5 CSS custom properties.
- Card semantic halos (buy/win/loss/breakeven) now share one halo recipe; individual classes provide semantic values only.
- Compact report semantic states now share one halo recipe; individual classes provide semantic values only.
- Existing effect values and animation timing are intentionally unchanged in this pass.

Validation:
- intended visual appearance should remain materially unchanged;
- Phase 4 production motion must not regress;
- typecheck/tests/build pass.

Validation result: Quality Checks #539 passed typecheck, tests, and production build. Pass 0 is complete.

### Pass 1 — Static edge light and refraction foundation

**Status: COMPLETE.**

Goal:
- obtain most of the Phase 5 quality with static material cues.

Foundation:
- **3bcee3d** — add the reusable static `premium-refraction` shadow-slot primitive plus hero/overlay intensity variants.
- The primitive adds only static inset edge light. It adds no pseudo-element, blur, animation, JavaScript, React wrapper, or lifecycle ownership.

Representative surfaces:
- **00afaf0** — Overview Total Portfolio Value hero.
- **08ad05d** — Reports Portfolio Allocation panel.
- **73cbd6b** — Quick Cash modal shell.
- **2011e71** — shared AnalyticsSelect dropdown shell.

Apply through shared primitives to:
- hero cards;
- primary cards/panels;
- report surfaces;
- modal shell;
- dropdown/floating shell;
- selected secondary surfaces.

Validation checkpoint before expansion:
- Overview;
- Reports;
- Quick Cash modal;
- an AnalyticsSelect dropdown;
- desktop + phone.

Quality Checks #544 passed typecheck, tests, and production build for the representative checkpoint.

User validation found the first refraction intensity **too subtle**. The architecture was kept unchanged and the shared primitive was strengthened centrally rather than editing individual components:
- **5dd2bfa** — brighter static spectral edge rims plus faint static inner cyan/purple falloff on the same four representative surfaces.
- No new blur, animation, pseudo-element, React wrapper, or broader rollout was introduced.

User re-validation accepted the stronger material treatment. The approved refraction was then rolled out through shared effect tiers rather than component-by-component classes:
- **3fb75b8** — map hero, primary, secondary/inset, and overlay surface families to canonical refraction tiers while keeping tables/rows/fields/chart plots at Tier 0.
- **5e54a17 / 4d66a94 / 522666b / 017bc77** — remove the temporary representative JSX classes so the four checkpoint surfaces inherit from the same shared tier system as the rest of the app.

Quality Checks #551 passed typecheck, tests, and production build after the full shared-tier rollout. Pass 1 is complete.

### Pass 2 — CTA aurora-border normalization

**Status: REVISED — original continuous aurora/iridescent border flow restored on the audited CTA set; awaiting validation before Pass 3.**

Goal:
- preserve the premium always-on border-flow effect the user approved originally, while restricting it to appropriate high-value CTAs.

Work:
- audit every `premium-shimmer-border` use;
- classify each as keep-as-CTA / replace-with-static-edge / remove;
- keep one canonical aurora/iridescent border-flow behavior;
- preserve warning/danger semantics by excluding those controls;
- no continuous effect on modal panels, routine saves, tables, filters, or passive cards.

Implementation:
- repository audit found **17** active `premium-shimmer-border` uses;
- **10** remain on intentional high-value CTAs;
- **7** were removed from routine Save Changes and warning/danger actions;
- **e851bca** — first attempt replaced the original border flow with a short hover/focus sweep;
- user validation rejected that version because it read as a fast flash rather than the premium perimeter-light effect;
- **46e6351** — second attempt used a slower recurring moving light band, but user clarified that this still represented the wrong effect family;
- **9d07c8c** — restore the actual original effect family: a continuous blue/cyan/purple aurora/iridescent gradient flowing around the CTA perimeter at the original 5.5 s cadence;
- the historical `premium-shimmer-border` class name remains, but documentation now calls the effect **CTA aurora border flow**;
- mobile/reduced-motion keep the loop disabled;
- warning/danger/routine-save removals remain intact.

Removal commits:
- **50c79f4** — Journal routine Save Changes;
- **a170f33 / 3e74738 / 109d81b** — audited cash warning, cash withdrawal danger, routine cash edit save;
- **204da43** — routine target save;
- **0bb93b1** — sell confirmation warning;
- **7992b78** — delete confirmation danger.

Verification:
- remaining aurora-border uses are exactly Header Add Trade, Positions Add Trade, Cash Deposit, Add Position/DCA, Quick Cash update, Google Sheets Save Connection, Python Validate & Sync, Backup restore, Trade Screenshot log, and PWA install;
- the effect is continuously animated only on those 10 audited CTAs and stays perimeter-oriented;
- Quality Checks #558 passed for the rejected hover-triggered flash version.
- Quality Checks #560 passed for the rejected moving-band version.
- The restored aurora-border version requires fresh CI.

Validation:
- aurora border reads as continuously alive rather than as a flashing/sweeping beam;
- destructive controls remain semantic and free of the effect;
- the border motion does not noticeably worsen the accepted production tab-motion baseline.

Pass 2 is not accepted until the restored CTA aurora border flow is visually validated in production.

### Pass 3 — Semantic and ambient refinement

Goal:
- normalize semantic halo intensity and page ambience.

Work:
- hero/summary semantics;
- position/transaction/closed-cycle states;
- report hero semantic treatment;
- status surfaces;
- page aurora tuning only if needed.

Rules:
- no pulsing financial state;
- no new page blob;
- dense rows stay edge-coded.

### Pass 4 — Full-app coverage sweep

Use the component matrix above and audit every file, including:
- secondary modals;
- PWA/offline/error/auth states;
- shared fields/selects;
- report subcomponents;
- chart outer shells.

For each file, record:
- direct Phase 5 change;
- inherited shared change;
- intentional exclusion;
- deferred later-phase ownership.

No file is silently omitted.

### Pass 5 — Final Phase 5 validation

Required:
- desktop production build;
- phone/touch validation;
- Overview -> Positions -> Reports -> Journal -> Cash -> Directory switching;
- open/close every modal family;
- dropdown overlay checks;
- table overflow checks;
- reduced-motion check;
- semantic color review;
- visual noise review;
- Quality Checks.

Only after this pass can Phase 5 be marked complete.

---

## 10. Validation checkpoints designed to prevent earlier mistakes

### Checkpoint A — architecture before rollout

After Pass 0:
- effect ownership is clear;
- no duplicate new effect system;
- no component styling rollout yet.

### Checkpoint B — representative primitive validation

After Pass 1:
- validate one hero, one report panel, one modal, one dropdown on phone and desktop.

If the primitive is wrong, fix the primitive before touching the rest of the app.

### Checkpoint C — complete coverage before acceptance

After Pass 4:
- inspect the full matrix;
- explicitly verify secondary/rare surfaces;
- no “main screens look good, phase done” acceptance.

### Checkpoint D — performance before completion

Before Phase 5 completion:
- production motion must be at least as smooth as the accepted Phase 4 baseline;
- newly introduced effect cost is fixed inside Phase 5.

---

## 11. Phase 5 acceptance criteria

Phase 5 is complete only when all are true:

### System
- one coherent effect vocabulary exists;
- edge/refraction/shimmer/semantic halo each have one clear owner;
- no new effect is implemented as a one-off because a component was missed by the shared system.

### Coverage
- every component in the matrix has been reviewed;
- all modal families share the same effect language;
- all main tabs and secondary states have an explicit disposition;
- rare states such as PWA/offline/error/auth are not forgotten.

### Visual quality
- glass appears more dimensional without becoming brighter/noisier;
- important surfaces catch light more than dense data surfaces;
- sheen is exceptional, not omnipresent;
- financial-state colors remain semantically correct;
- charts remain readable and untouched internally until Phase 7.

### Performance
- zero new infinite animations;
- no new animated blur/backdrop-filter;
- no persistent layer-promotion hacks;
- no Phase 5-caused regression in accepted tab motion;
- mobile/touch uses static/degraded effects appropriately.

### Accessibility
- reduced motion disables optional effect animation;
- focus indicators remain visible;
- effect layers never reduce text contrast or pointer usability.

### Regression
- overlays keep correct z-index/overflow behavior;
- pseudo-elements do not block clicks;
- tables/charts/modals do not clip because of effect wrappers;
- typecheck, tests, and production build pass.

---

## 12. Documentation rule for Phase 5

Documentation updates happen during each pass:
- this file records Phase 5 decisions and deviations;
- the main redesign plan tracks Phase 5 status;
- the implementation log records actual commits, validation findings, rollbacks, and accepted exceptions.

When Phase 5 is complete, this file becomes a historical phase-specific architecture record just like the Phase 4 motion plan.
