# Phase 8 — Visual Hierarchy Plan

## Status

**IN PROGRESS — Pass 8.0 complete; Pass 8.1 Overview hierarchy implemented, validation pending.**

Phase 8 is an editorial hierarchy pass over the premium system already established in Phases 1–7. It is not an aesthetic reboot and must not replace the accepted glass, semantic-color, chart, selector, motion, or responsive languages.

The purpose is to make the interface easier to scan by giving different information different visual weight.

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
- surface hierarchy and strength;
- card grouping and visual containment;
- typography scale, weight, contrast, and metadata treatment;
- spacing rhythm;
- summary-vs-detail composition;
- action emphasis/de-emphasis;
- desktop/mobile responsive hierarchy where information order is unchanged;
- decorative intensity when necessary to establish hierarchy.

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
- clear glass/card boundary;
- medium elevation;
- semantic border/glow only when financially meaningful;
- should not visually overpower H1.

### H3 — Secondary information surface

Purpose:
- useful supporting metrics, summaries, utilities, or related context.

Treatment:
- quieter border and shadow;
- reduced glow;
- smaller metric typography;
- may use grouping instead of separate full-strength cards.

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
- information density over decoration;
- row-level state primarily through edge/border/accent, not full-card halo;
- toolbars and summaries must remain visually separate from rows.

## Semantic intensity rule

**Hierarchy and financial state are separate axes.**

A loss should not automatically become more visually important than the hero because it is red.

Rules:
- structural hierarchy comes from scale, layout, depth, spacing, and typography;
- semantic color communicates state within that hierarchy;
- emerald / rose / amber should be preserved for meaningful financial state;
- cyan / blue / purple remain the preferred structural/accent families;
- avoid decorative green/red/amber when no financial state is being communicated.

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
- add hierarchy-specific semantic intensity variables so financial color and structural importance remain separate axes;
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

**Status: IMPLEMENTED — validation pending.**

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

### Goal

Make Positions, Closed Cycles, Transactions, Cash Ledger, and Stocks easier to scan during actual work.

### Scope

- separate summary, controls, and data regions more deliberately;
- filters/search/sort toolbars become quiet H4 utility bands;
- dense result lists/tables remain H5;
- reduce full-card treatment on repeated rows where an edge/accent state is sufficient;
- keep selected/expanded rows legible without turning every row into a hero card;
- standardize section headings/counts/actions above tables;
- make empty/loading states clearly subordinate to the screen title but stronger than helper copy.

### Acceptance

- user can identify the current dataset, active filters, and primary action without scanning every row;
- table/list rows remain dense and readable;
- semantic row state stays meaningful without excessive halo saturation.

---

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
