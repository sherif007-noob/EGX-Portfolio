# Premium Visual Language Contract

## Status

**CANONICAL — HIERARCHY / MATERIAL SEPARATION**

Phase 8 hierarchy is active again, but it is structurally separated from the visual material system. Hierarchy may control information weight, grouping, layout, typography, spacing, and action priority. It may not redefine glass, refraction, aura, glow, or semantic-state rendering.

The accepted pre-Phase-8 glass/refraction and semantic aura behavior—especially the Monthly Report card treatment—is the material source of truth. Hierarchy classes must remain material-neutral and compose with those existing primitives rather than attenuating or replacing them.

This contract applies to the remainder of the premium overhaul and to later visual work unless the user explicitly reopens the visual system.

---


## Additive semantic edge rule

For transaction cards, open-position cards, closed-cycle cards, and Monthly Performance audit cards, a semantic left-edge accent is part of the accepted visual language.

The edge is never a substitute for semantic aura. It must be layered **on top of** the existing glass + full-card glow system. Implement it as an independent decoration layer so it cannot override the host card's background, box-shadow, refraction, border, near aura, or far bloom.

The accepted edge geometry follows the card's real rounded left border: it remains continuous through both left corner curves, then fades into the top and bottom borders rather than stopping short of the corners.

## Canonical dropdown surface

The **Data & Tools** dropdown is the visual reference for every custom application dropdown/menu.

Canonical implementation:
- every custom menu/listbox uses `premium-floating + premium-dropdown`;
- dropdown rows use `premium-menu-item`;
- individual menus may supply an accent for selected/hover state, but may not invent a separate background material;
- the canonical surface keeps the Data & Tools layered-glass/refraction recipe while being approximately **12% more transparent** than its initial Phase 9.4 appearance;
- desktop base tint: `rgba(8, 15, 31, 0.60)`;
- mobile base tint: `rgba(8, 15, 31, 0.56)`;
- blur/refraction, luminous border and overlay elevation remain shared across menus;
- legacy opaque slate dropdown recipes such as `bg-slate-950/98 + shadow-2xl + backdrop-blur-xl` are prohibited.

This standard applies to AnalyticsSelect menus (including sector/filter dropdowns), ticker autocomplete, analytics mode menus, Data & Tools, and future custom dropdowns.

### Overlay-context rule

Matching the `premium-dropdown` CSS alone is not sufficient. Nested `backdrop-filter` / transformed card and panel contexts can materially change the perceived glass result.

Therefore every custom dropdown surface must also render in the **body-level overlay context**:
- shared dropdowns use the portaled `DropdownPresence` path anchored to their trigger;
- Data & Tools uses its equivalent body portal;
- geometry is viewport-clamped and follows the trigger on scroll/resize;
- dropdown clicks must remain inside the overlay interaction boundary;
- content cards/panels may not become the dropdown's backdrop containing context.

This makes the Data & Tools material reference visually consistent across Positions, Transactions, Cycles, Reports, ticker autocomplete, analytics mode selection, and future dropdowns.

### Viewport-containment rule

Every body-level dropdown must be physically contained by the visible viewport, not merely portaled:
- horizontal geometry is clamped to a fixed gutter on both sides;
- compact selectors target a 320px menu width but may never exceed the safe viewport width;
- trigger width is treated as a minimum when the trigger itself is wider;
- menus near the right edge shift left instead of overflowing;
- menus near the bottom open upward when that side has more usable room;
- max-height is limited to the available side and the menu scrolls internally;
- portaled dropdown CSS must not reintroduce legacy `min-width: 100%` / max-width rules that override the computed geometry;
- the same geometry function is covered with phone, desktop, right-edge, left-edge, bottom-edge, and oversized-width regression cases.

## Monthly Report material reference

The accepted Monthly Performance audit cards are the canonical material benchmark. A hierarchy surface is visually regressed if it becomes more opaque, flatter, loses inner sheen/refraction, or reduces a semantic state to border-only/edge-only emphasis compared with that reference.

For semantic cards, the resting state must include both a visible near aura and a wider far bloom. These effects exist before hover; hover may intensify them but must never be the only place they appear.

# 1. Three independent visual axes

Every surface is composed from independent systems.

## A. Material

Material answers:

> What is this surface physically made of?

Canonical material primitives already accepted before Phase 8 include:

- `premium-card`
- `premium-glass`
- `premium-panel`
- `premium-subpanel`
- `premium-inset-glass`
- `premium-report-glass`
- `premium-report-glass-soft`
- hero/refraction tiers
- modal/dropdown/floating surface primitives
- table-shell primitives

Material owns:

- translucent background;
- frosted blur;
- saturation;
- refraction;
- top-edge highlight;
- base neutral shadow/elevation;
- glass layering.

**Hierarchy classes must never redefine material.**

---

## B. Semantic state and semantic surface role

Semantic state answers:

> What financial state does this surface represent?

Canonical state families:

- BUY / active acquisition → blue;
- WIN / positive → emerald;
- LOSS / negative → rose;
- BREAKEVEN / cost / fee where intentionally mapped → amber.

Existing state-color classes remain the source of semantic color:

- `premium-glow-buy`
- `premium-glow-win`
- `premium-glow-loss`
- `premium-glow-breakeven`
- compact `premium-state-*` variants.

Semantic **surface role** answers:

> How much physical space does this semantic surface occupy, and therefore how large should its halo field be?

Exactly three outer semantic roles are canonical:

### `premium-semantic-hero`

Use for:
- the dominant semantic hero surface;
- e.g. Total Portfolio Value when Today state is win/loss/breakeven.

Contract:
- strongest semantic card role;
- accepted Phase 5 hero intensity;
- broad but bounded;
- must not flood adjacent rows.

### `premium-semantic-card`

Use for:
- normal standalone financial-state cards;
- e.g. Unrealized P&L, Realized Gain, Brokerage Fees;
- full KPI cards with meaningful win/loss/cost state.

Contract:
- accepted Phase 5 standard card halo;
- clearly visible near + far aura;
- full glass material remains visible beneath it.

### `premium-semantic-record`

Use for:
- repeated mobile/list records;
- e.g. position cards, transactions, closed cycles.

Contract:
- visible near/far semantic aura;
- tighter far radius than a standalone card;
- stronger left semantic edge may be added as an additional scan cue;
- edge must never replace the halo.

True dense **table rows**, where an outer card halo is geometrically inappropriate, may continue to use the accepted semantic row-edge system.

---

## C. Information hierarchy

Hierarchy answers:

> How important is this information compared with neighboring information?

Levels:

- H0 — structural grouping / page canvas
- H1 — hero / primary decision context
- H2 — primary support
- H3 — secondary support
- H4 — inset / detail / controls
- H5 — dense data / repeated records

Hierarchy owns:

- layout;
- width/height;
- position/order;
- typography scale;
- spacing;
- grouping;
- density;
- information prominence.

Hierarchy does **not** own:

- glass background;
- backdrop blur;
- saturation;
- refraction;
- neutral material shadow;
- semantic color;
- semantic halo.

An H3 card can therefore use the exact same `premium-semantic-card` halo role as an H2 card. It remains lower hierarchy because of geometry, typography, placement, and grouping—not because its financial state was visually muted.

---

# 2. Composition examples

## Overview

### Total Portfolio Value

```text
premium-card
+ premium-hero-card
+ premium-semantic-hero
+ H1
+ premium-glow-win/loss/breakeven
```

### Unrealized P&L

```text
premium-card
+ premium-semantic-card
+ H2
+ premium-glow-win/loss/breakeven
```

### Market Value

```text
premium-card
+ H2
+ no semantic role/state
```

### Realized Gain

```text
premium-card
+ premium-semantic-card
+ H3
+ premium-glow-win/loss/breakeven
```

### Cash

```text
premium-card
+ H3
+ neutral
```

### Brokerage Fees

```text
premium-card
+ premium-semantic-card
+ H3
+ amber/cost semantic state
```

---

## Positions / Transactions / Cycles

Repeated mobile cards:

```text
premium-card
+ premium-semantic-record
+ H5
+ relevant premium-glow-* state
```

Desktop rows remain table rows and can retain the existing semantic edge treatment.

---

# 3. Prohibited patterns

The following are regressions:

- `.premium-hierarchy-h2 { background: ... }`
- `.premium-hierarchy-h3 { box-shadow: ... }`
- H5 setting semantic near/far alpha to zero for a card;
- replacing `premium-card` with an H-level class;
- replacing `premium-glass` / `premium-panel` with a hierarchy class;
- phone/coarse-pointer rules that erase a semantic halo;
- creating screen-specific semantic glow engines for Overview, Transactions, Reports, etc.;
- appending emergency late-cascade overrides instead of fixing ownership;
- using stronger/larger semantic fields merely to compensate for flattened glass.

---

# 4. Protected accepted systems

The following accepted systems are considered protected:

- Phase 3–5 glass/refraction/material primitives;
- Phase 5 semantic palette and halo engine;
- Phase 4 motion families;
- Phase 6 responsive/safe-area behavior;
- Phase 6.5 navigation behavior;
- Phase 7 chart visual/interaction system;
- canonical segmented-selector system.

A later phase may **consume** these systems.

A later phase must not silently rewrite them.

If a requirement genuinely needs a primitive changed, that primitive must be explicitly reopened and validated as its own design-system change.

---

# 5. Phase 8 rule

Phase 8 is an editorial hierarchy phase.

It may change:

- composition;
- ordering;
- card size;
- typography;
- grouping;
- spacing;
- density;
- action emphasis;
- structural report grouping.

It must not change the accepted material or semantic systems.

The corrected Phase 8 architecture therefore uses H0–H5 as material-agnostic classes and the three semantic roles above independently.

---

# 6. Regression requirements

Automated tests must protect:

- H1–H5 classes from owning material declarations;
- existence of exactly the three semantic surface roles;
- Overview mapping: hero/card/card roles as appropriate;
- repeated Positions/Transactions/Cycles mapping to `premium-semantic-record`;
- absence of the former emergency Phase 8 visual-reset blocks.

Device validation should compare at minimum:

- Overview;
- Open Positions;
- Transactions;
- Closed Cycles;
- Reports;
- Monthly Report.

The purpose is to verify that information hierarchy improved without losing the already accepted premium material and semantic identity.


---

# 7. Phase 10 closure freeze

Phase 10 is **CLOSED / CI CLEAN** as of October 1, 2026.

Validated exact runtime head:

`50db10b2`

Closure run:

**Phase 10 Visual Closure #36921005365**

The accepted visual system is now a protected contract rather than an active redesign target.

Frozen by default:

- material primitives and refraction/glass behavior;
- semantic aura + additive edge model;
- H0–H5 hierarchy ownership;
- hero/card/record semantic surface roles;
- action priority and control families;
- segmented selectors and chart-control shells;
- dropdown/menu/popover portal geometry and canonical material;
- modal viewport/safe-area/scroll ownership;
- dense tables and repeated mobile records;
- responsive containment from 320 through 2560 and short landscape;
- Phase 8 Monthly Report material benchmark;
- Phase 9 header/navigation architecture;
- accepted analytics chart container/control visual behavior.

## Reopening rule

A later roadmap stage may consume these systems freely.

It may not silently restyle them.

Any intentional visual-system change must:

1. name the primitive/contract being reopened;
2. explain why existing ownership is insufficient;
3. preserve accounting/data behavior unless the task explicitly belongs to those domains;
4. update focused source-contract tests;
5. run the exact-head production/Worker gate;
6. inspect rendered output;
7. deliberately update golden baselines only after the new appearance is accepted.

A failing golden screenshot is therefore a regression signal, not permission to overwrite the baseline automatically.

## Closure evidence

The exact-head gate passed:

- TypeScript;
- **77 / 77 Vitest files, 435 / 435 tests**;
- production Vite/PWA build;
- Cloudflare Worker dry-run;
- **12 / 12 geometry widths with 0px page overflow**;
- **16 / 16 tracked golden states with 0.000% diff**.

This contract now governs later Stage 2+ work unless a future design-system change explicitly reopens it.
