# Phase 8 — Visual Hierarchy Plan

## Status

**IN PROGRESS — Phase 8 hierarchy is restored, with material styling explicitly inherited from the accepted pre-Phase-8 visual system.**

On 2026-09-26, the Phase 8 hierarchy/layout work was restored after an over-broad rollback. The implementation now keeps the accepted hierarchy changes while explicitly preventing hierarchy classes from redefining glass, aura, glow, or semantic-state rendering. Commit `7e17bd33c3d61c59dd88dc88365c37bdab6f57ba` restores the hierarchy component structure and uses a material-neutral hierarchy CSS layer over the accepted pre-Phase-8 visual primitives.

Phase 8 is an editorial hierarchy pass over the premium system already established in Phases 1–7. It is not an aesthetic reboot and must not replace the accepted glass, semantic-color, chart, selector, motion, or responsive languages.

The purpose is to make the interface easier to scan by giving different information different visual weight.


### Material restoration gate — 2026-09-26

The hierarchy/material separation has now been implemented and validated. Monthly Performance audit cards are the canonical quality reference for glass depth, refraction, semantic aura and bloom. Phase 8 hierarchy classes must never attenuate those properties. Production commits: `d801db35e46ceb826361bfe43132f25c1269d9c4` and `477f95930d0657e1f9dbcc85e0fc45749b6ed84d`. Quality Checks run `36223796577` passed typecheck, tests and production build.

## Why Phase 8 exists

The application now has a coherent premium visual vocabulary:

- dark navy/slate glass surfaces;
- semantic emerald / rose / amber financial state;
- cyan / blue / purple structural accents;
- consistent selectors, charts, tooltips, glows, and motion;
- accepted mobile and landscape behavior.

The current visual debt is **hierarchy**, not component quality.

Several screens contain many well-designed surfaces with similar visual intensity. As a result:

- supporting KPIs can compete with the most important portfolio number;
- semantic glow can become stronger than structural importance;
- Reports can read as glass-inside-glass-inside-glass;
- dense screens do not always distinguish summary, controls, and data strongly enough;
- metadata labels and helper copy use similar emphasis in too many contexts;
- primary, secondary, utility, and destructive actions are not always separated by visual priority.

Phase 8 must make the system more selective rather than more decorative.

## Non-negotiable boundaries

Phase 8 is presentation-only.

Do not change:
- portfolio/accounting calculations;
- chart data, sampling, interpolation, tooltip semantics, or chart behavior accepted in Phase 7;
- transaction/filter/report semantics;
- persistence, Supabase, Google Sheets, market-data, or resolver behavior;
- the final header/navigation architecture — Phase 9 owns that;
- the canonical segmented-selector language established before Phase 8;
- accepted semantic meaning: green/red/amber remain financial state, not generic decoration.

Phase 8 may change:
- surface composition and information hierarchy;
- card grouping and visual containment;
- typography scale, weight, contrast, and metadata treatment;
- spacing rhythm;
- summary-vs-detail composition;
- action emphasis/de-emphasis;
- desktop/mobile responsive hierarchy where information order is unchanged.

Phase 8 must consume, not redefine, the protected material and semantic systems documented in `docs/PREMIUM_VISUAL_LANGUAGE_CONTRACT.md`.

## Core hierarchy model

Every major surface should belong to one of these levels.

### H0 — Page canvas / structural background

Purpose:
- establish page context without becoming a card.

Treatment:
- no card-like hover;
- minimal border;
- ambient/background depth only.

### H1 — Hero / decision surface

Purpose:
- the single most important value or decision context in a screen.

Treatment:
- strongest typography;
- strongest structural depth;
- semantic state may influence the surface, but hierarchy must remain clear even in neutral state;
- normally one hero region per screen or major report context.

### H2 — Primary supporting surface

Purpose:
- values or visualizations needed to interpret the hero.

Treatment:
- retain the accepted material primitive assigned to the component;
- use layout, scale, typography, and grouping to remain below H1;
- semantic state uses its independent semantic surface role when financially meaningful.

### H3 — Secondary information surface

Purpose:
- useful supporting metrics, summaries, utilities, or related context.

Treatment:
- retain the accepted material primitive;
- use smaller typography, composition, spacing, and grouping to communicate lower importance;
- do not weaken a real financial semantic state merely because the surface is H3.

### H4 — Inset / detail surface

Purpose:
- content nested inside a larger conceptual unit: plot areas, ranked lists, table filters, metric sub-blocks, helper panels.

Treatment:
- visibly subordinate;
- subtle inner border/background;
- avoid full outer-card glow unless the inset itself represents an active semantic selection.

### H5 — Dense data surface

Purpose:
- tables, journals, directories, cycle lists, transaction lists.

Treatment:
- information density over structural prominence;
- repeated card records use the dedicated `premium-semantic-record` role when they carry financial state;
- true table rows may continue using the accepted row-edge semantic treatment;
- toolbars and summaries must remain visually separate from rows.

## Protected visual-language rule

Phase 8 now follows the app-wide contract in `docs/PREMIUM_VISUAL_LANGUAGE_CONTRACT.md`.

Three systems are independent:

1. **Material** — accepted `premium-card`, `premium-glass`, `premium-panel`, `premium-subpanel`, report glass, refraction, modal, table, and overlay primitives.
2. **Semantic state/role** — financial color plus one of exactly three outer roles: `premium-semantic-hero`, `premium-semantic-card`, or `premium-semantic-record`.
3. **Hierarchy** — H0–H5 controls layout, scale, typography, grouping, spacing, and density only.

Rules:
- H1–H5 may not redefine background, border, backdrop-filter, refraction, or box-shadow;
- hierarchy must not attenuate a semantic halo;
- Total Portfolio Value uses `semantic-hero`;
- normal semantic KPI cards use `semantic-card`;
- repeated semantic position/transaction/cycle cards use `semantic-record`;
- true dense table rows may remain edge-coded;
- accepted Phase 3–7 visual primitives are protected unless explicitly reopened;
- emergency late-cascade “restoration” blocks are prohibited; ownership must be fixed at the primitive/class-composition level.

## Typography roles

Phase 8 will standardize six visual roles:

1. **Page / hero title** — rare, strongest contextual text.
2. **Section title** — identifies a major conceptual block.
3. **Metric value** — financial number hierarchy independent of card border/glow.
4. **Metric label** — concise supporting descriptor.
5. **Metadata** — dates, periods, status, counts, secondary measures.
6. **Helper copy** — explanatory text, lowest normal emphasis.

Uppercase tracked metadata remains part of the language but should be used selectively. Not every small label should become a letter-spaced dashboard caption.

## Spacing rhythm

Use a small canonical spacing ladder rather than locally tuned gaps:

- tight inline: 4–6px;
- control/group: 8–10px;
- card internal: 12–16px;
- related sections: 16–20px;
- major section separation: 24–32px.

Desktop should use extra space to strengthen grouping and hierarchy, not simply expose more equal-weight cards.

---

# Pass plan

## Pass 8.0 — Hierarchy primitives and audit map

**Status: COMPLETE — Quality Checks #768 passed.**

Implemented:
- add reusable H0–H5 structural surface recipes in `src/index.css`;
- establish H0–H5 as structural hierarchy primitives; after device regression, these classes were corrected to be fully material-agnostic;
- add six typography roles: page title, section title, metric, metric label, metadata, helper;
- add canonical hierarchy spacing tokens and helpers;
- add four action-priority classes: primary, secondary, utility, destructive;
- add type-safe React primitives/helpers in `src/components/VisualHierarchy.tsx`;
- add regression tests covering H0–H5, typography-role, and action-priority class mappings;
- add `docs/PHASE8_HIERARCHY_AUDIT_MAP.md` mapping Overview, Reports, Positions, Cycles, Transactions, Cash, Stocks, report submodules, modals, and the deferred Header onto the hierarchy model;
- no screen-specific visual migration is part of 8.0; those begin in 8.1.

### Goal

Define reusable hierarchy primitives before changing individual screens.

### Scope

- establish H0–H5 CSS/component conventions;
- define hero/primary/secondary/inset/dense surface recipes;
- define typography roles and canonical metric-value sizes;
- define section-spacing tokens;
- define action priority classes:
  - primary action;
  - secondary action;
  - utility action;
  - destructive action;
- document which current screens/components map to which hierarchy level.

### Initial component map

**Overview**
- Total Portfolio Value → H1.
- Total Market Value + Unrealized P&L → H2.
- Realized Gain + Cash + Fees → H3.
- Live Market Feed → utility/context strip, not hero.

**Reports**
- Main analytics → H1/H2 depending report composition.
- Secondary analytics / trajectory / allocation → H2.
- metric summaries inside report sections → H3/H4.
- plot surfaces and ranked breakdowns → H4.
- dense Monthly/Trading Performance result areas → H3/H5.

**Positions / Cycles / Transactions / Cash / Stocks**
- summary strip → H2/H3;
- filter/search toolbar → H4;
- primary table/list → H5;
- row semantic state stays row-level rather than becoming card-level hierarchy.

### Acceptance

- hierarchy can be described without referring to color alone;
- reusable classes/tokens exist before screen-specific changes;
- no business behavior changes.

---

## Pass 8.1 — Overview information hierarchy

**Status: COMPLETE — Quality Checks #769 passed (33/33 test files, 196/196 tests, build 5.13s).**

Implemented:
- move the EGX Live Market Feed below the KPI summary so portfolio information owns the first visual read;
- replace the six-peer KPI grid with a three-tier composition;
- Total Portfolio Value is the sole H1 hero and now integrates Today EGP/% performance inside the hero surface;
- Unrealized P&L and Total Market Value are H2 primary support surfaces;
- Realized Gain, Cash Available, and Brokerage Fees are quieter H3 support surfaces;
- retain semantic win/loss color while hierarchy-specific semantic intensity prevents H2/H3 state from overpowering H1;
- reduce sync/reconcile controls to utility-priority treatment without changing behavior;
- keep phone density controlled: H1 spans the phone width, H2 metrics stay paired, and the third H3 metric becomes a compact full-width row only below 640px;
- add Overview-specific metric scales and a subdued H4 market-feed treatment;
- add server-render regression coverage for H1/H2/H3/H4 counts, KPI-before-utility reading order, and utility action priority.

### Goal

Make the Overview scan correctly in under a second.

### Target reading order

1. Total Portfolio Value + Today state.
2. Unrealized P&L / market exposure.
3. Market value / holdings context.
4. Realized P&L, cash, fees.
5. Active positions and lower-page detail.

### Scope

- promote Total Portfolio Value into an unmistakable H1 surface;
- make Today change part of the hero, not merely a footer;
- position Unrealized P&L and Total Market Value as H2 supporting metrics;
- reduce Realized Gain, Cash Available, and Brokerage Fees to H3 strength;
- reduce the visual weight of Live Market Feed relative to the portfolio summary;
- keep its sync/reconcile behavior unchanged;
- ensure semantic red/green does not override structural priority;
- review desktop composition so six KPI cards no longer read as six peers;
- preserve compact two-column mobile flow while introducing hierarchy through size/typography/depth rather than excessive vertical expansion.

### Acceptance

- Total Portfolio Value is clearly the first visual anchor in neutral, winning, and losing states;
- secondary KPIs remain readable but cannot overpower the hero;
- Overview feels calmer despite containing the same information;
- mobile still scans naturally without making the first screen excessively tall.

---

## Pass 8.2 — Reports composition hierarchy

**Status: COMPLETE — Quality Checks #770 passed (34/34 test files, 200/200 tests, build 6.24s).**

Implemented:
- make the Reports page intro structural H0 instead of another glass card;
- consolidate Realized Gains / Losses / Net Realized / Fees into one quiet H3 summary band instead of four peer cards;
- promote the main unified analytics surface to the single H1 visualization in Reports;
- place Drawdown, Fees, Realized-vs-Unrealized, Realized Trajectory, and Portfolio Allocation at H2;
- demote chart metric blocks and report detail blocks to H4;
- reduce Portfolio Equity Bridge and Closed Trade Summary to H3;
- convert Trading Performance and Monthly Performance outer shells to structural H0 containers so their internal data is not nested inside another full-strength glass card;
- demote Trading Performance KPI cards to H4 while preserving semantic state;
- keep each Monthly Audit month as an H3 section rather than a full-strength peer card;
- add Reports-specific CSS overrides so H-level classes actually supersede older premium-report-glass / premium-panel shadow intensity;
- preserve every Phase 7 chart interaction, selector, tooltip, animation, calculation, and data pipeline;
- add source-level regression coverage for the H1/H2/H3/H4/H0 composition contracts.

### Goal

Reduce nested-card competition while keeping the strong Phase 7 chart work.

### Scope

- establish major report sections as structural groups rather than every level behaving like a full card;
- main analytics receives the strongest report visualization hierarchy;
- secondary analytics, Realized Trajectory, and Portfolio Allocation remain primary supporting visualizations;
- reduce outer shell intensity when inner chart/metric surfaces already carry enough depth;
- use section headings and spacing to separate concepts instead of adding another glow/border;
- keep plot surfaces as H4 insets;
- keep allocation ranked rows and trajectory metric summaries subordinate to their visualization;
- simplify repeated metadata treatment where several uppercase labels compete;
- preserve all Phase 7 chart visuals/interactions.

### Acceptance

- Reports no longer feels like “glass inside glass inside glass”;
- charts remain visually strong but section boundaries are clearer;
- the eye can distinguish section → visualization → supporting metrics immediately;
- no Phase 7 chart behavior is changed.

---

## Pass 8.3 — Dense workflow hierarchy

**Status: IMPLEMENTED / CI CLEAN — Quality Checks #775 passed (36/36 test files, 210/210 tests, build 6.40s); device validation pending.**

Implemented:
- apply the summary → controls → dense-data hierarchy across Open Positions, Closed Cycles, Transactions, Cash Ledger, and Stocks;
- preserve the accepted `premium-glass`, `premium-card`, `premium-panel`, `premium-subpanel`, table-shell, and report-glass materials instead of replacing them with H-level styling;
- introduce exactly three semantic surface roles: `premium-semantic-hero`, `premium-semantic-card`, and `premium-semantic-record`;
- map Total Portfolio Value to semantic hero, standalone financial KPI cards to semantic card, and repeated Positions/Transactions/Cycles cards to semantic record;
- keep desktop table-row semantics on the accepted edge system;
- remove the accumulated Phase 8 semantic-soul/restoration/hard-reset cascade patches entirely;
- remove material ownership from H1–H5; hierarchy now controls only information structure, typography, spacing, grouping, and density;
- restore accepted report glass primitives to report sections while keeping the reduced nested-card information architecture from 8.2;
- restore accepted glass primitives to workflow context/summary bands;
- add `docs/PREMIUM_VISUAL_LANGUAGE_CONTRACT.md` as the protected app-wide contract for Phases 8–11 and future visual work;
- add regression tests that reject H-level material styling, require the three semantic roles, verify Overview role mapping, and verify record-role mapping across dense workflows;
- preserve all filtering, sorting, pagination, expand/collapse, transaction editing, cash mutation, ticker sync/export, chart behavior, and trade actions.

### Goal

Make Positions, Closed Cycles, Transactions, Cash Ledger, and Stocks easier to scan during actual work.

### Scope

- separate summary, controls, and data regions more deliberately;
- filters/search/sort toolbars become quiet H4 utility bands;
- dense result lists/tables remain H5;
- reduce hierarchy through composition/density while repeated semantic cards keep the canonical `semantic-record` atmosphere;
- keep selected/expanded rows legible without turning every row into a hero card;
- standardize section headings/counts/actions above tables;
- make empty/loading states clearly subordinate to the screen title but stronger than helper copy.

### Acceptance

- user can identify the current dataset, active filters, and primary action without scanning every row;
- table/list rows remain dense and readable;
- semantic record state remains immediately perceptible while using the bounded record role rather than hero/card halo geometry.

---

### Pass 8.3b — Aura / glow intensification

**Status: IMPLEMENTED / CI CLEAN — device visual validation pending.**

After the hierarchy/material split and semantic-edge restoration, device feedback showed that the material system was structurally correct but the aura was still too restrained. Commit `2eebfa0d5ff9647292acaa1ada26e439801283a4` increases resting and hover aura/glow strength without changing hierarchy, glass opacity/blur, spacing, typography, component structure, or the accepted semantic-edge geometry.

Quality Checks run `36253526700` passed typecheck, tests and production build.

## Pass 8.4 — Typography and spacing normalization

### Goal

Make hierarchy survive even if all glow/shadow effects were temporarily removed.

### Scope

- normalize page/section/metric/metadata/helper typography roles;
- reduce overuse of uppercase tracking;
- align numeric hierarchy across Overview and Reports;
- normalize section top/bottom spacing;
- normalize card internal padding by hierarchy level;
- tighten overly sparse areas and open overly dense areas;
- verify EGP/unit labels remain secondary to numeric values;
- ensure desktop uses whitespace intentionally rather than just larger grids.

### Acceptance

- typography alone communicates importance;
- comparable metrics use comparable typography;
- metadata is visibly subordinate;
- spacing clearly groups related elements.

---

## Pass 8.5 — Action priority and control de-emphasis

### Goal

Make actions communicate priority without changing availability.

### Scope

- primary creation/commit actions retain the strongest action treatment;
- secondary navigation/filter actions remain in the accepted selector/control language;
- maintenance utilities such as sync/reconcile/export are visually quieter than core portfolio actions;
- destructive actions remain clearly destructive but are not visually dominant before intent;
- icon-only utilities remain discoverable through tooltip/label/focus treatment;
- do not perform the final Header utility reorganization — Phase 9 owns placement/grouping.

### Acceptance

- there is normally only one visually dominant action in a local context;
- destructive actions do not compete with constructive primary actions;
- utilities remain discoverable but stop competing with content.

---

## Pass 8.6 — Responsive hierarchy sweep

### Goal

Ensure hierarchy survives changes in available space.

### Scope

- portrait phone;
- short landscape;
- tablet;
- desktop;
- 2XL desktop.

Checks:
- H1 remains dominant at every size;
- mobile does not become excessively tall because of hero promotion;
- desktop does not flatten hierarchy into equal grid cards;
- section spacing scales intentionally;
- dense tables do not inherit mobile-card spacing on desktop;
- chart/report hierarchy from Phase 7 remains intact;
- safe-area/header changes remain untouched except for regressions; Phase 9 owns header redesign.

### Acceptance

- same reading order on phone and desktop even when composition changes;
- no overflow/collision introduced;
- no hierarchy depends solely on hover.

---

## Pass 8.7 — Hierarchy regression and closure

### Validation

- visual review of every main tab in portrait and desktop;
- compare neutral / positive / negative semantic states where fixtures allow;
- check that green/red/amber remain meaningful and are not overused;
- verify Overview first-glance reading order;
- verify Reports containment depth;
- verify dense workflow toolbars vs result surfaces;
- verify action priority;
- typecheck/tests/build;
- update implementation and roadmap docs.

### Phase 8 completion criteria

Phase 8 is complete only when:

- every major screen has a clear hero/primary/secondary/inset/dense hierarchy;
- hierarchy remains obvious without relying on semantic color;
- the number of full-strength glowing/card surfaces is intentionally limited;
- Overview has a clear first/second/third reading order;
- Reports no longer suffers from unnecessary nested-card competition;
- dense data screens prioritize scanability;
- typography and spacing roles are consistent;
- Phase 9 can redesign the Header without needing to revisit content hierarchy underneath it.

## Deferred to Phase 9

Do not solve these during Phase 8 unless a regression makes them unusable:

- final header height/shape;
- utility grouping and ordering;
- moving Backup/Reconcile into a new settings/data-management context;
- final Add Trade/header CTA placement;
- header/nav relationship;
- final header desktop/mobile overflow behavior.

## Deferred to Phase 11

- residual desktop transition stutter/performance tuning;
- final browser matrix;
- final contrast/focus audit;
- final reduced-motion audit;
- comprehensive performance profiling.

## Documentation rule

After each Phase 8 pass:
- update this file with status and findings;
- update `PREMIUM_UI_REDESIGN_IMPLEMENTATION.md`;
- update the main roadmap when a pass/phase changes status;
- record any deliberate exception to the hierarchy model.
