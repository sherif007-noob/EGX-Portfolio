# Stage 4.5 — CSS Ownership Consolidation

Stage 4.5 is a **visual-preserving architecture refactor**. The accepted Phase 10 appearance is frozen. This stage may reorganize ownership and remove redundant cascade debt, but it must not redesign the application.

## Baseline inventory at 4.5.1

The runtime currently imports one application stylesheet:

- `src/index.css`
- **5,886 lines**
- approximately **173.7 KB**
- **158** `!important` declarations
- **62** `@media` blocks
- **23** `@keyframes` blocks
- **8** `:root` blocks

The file contains overlapping generations of accepted work from Phase 3 through Phase 10. Later rules frequently correct or constrain earlier rules, especially around controls, overlays, header geometry, mobile/landscape behavior, semantic aura, hierarchy restoration and motion ownership.

This makes selector ownership hard to reason about and allows a local fix near the end of the file to mutate an unrelated accepted component.

## Permanent ownership order

`src/index.css` remains the one application entry imported by `src/main.tsx`.

It imports Tailwind first, then the Stage 4.5 ownership entry:

```css
@import "tailwindcss";
@import "./styles/index.css";
```

`src/styles/index.css` establishes this canonical cascade order:

1. `tokens.css` — reusable custom properties only;
2. `materials.css` — neutral glass/refraction/surface depth;
3. `semantics.css` — financial-state color, aura, glow and edge behavior;
4. `hierarchy.css` — typography, spacing and information hierarchy only;
5. `controls.css` — shared buttons, inputs, segmented controls and triggers;
6. `overlays.css` — portaled/floating surfaces, modal/dropdown/tooltip geometry and z-index;
7. `motion.css` — CSS-owned transitions/keyframes/reduced-motion handling;
8. `responsive.css` — cross-app breakpoint, safe-area, containment and touch/viewport safety;
9. `features/index.css` — feature-specific rules that cannot be generalized safely.

Each import has its own named cascade layer. Existing accepted rules remain **unlayered in `src/index.css`** until their owning migration pass moves them. This is intentional: 4.5.1 must be visually inert, and each later extraction must prove its own cascade effect before deleting the corresponding legacy rules.

## Ownership invariants

- Material ownership and financial semantic ownership remain separate.
- Hierarchy classes must remain material-neutral and semantic-neutral.
- Overlay geometry does not belong to trigger/control styling.
- Motion-for-React lifecycle animation must not be recreated in CSS.
- Responsive rules may change geometry/containment, not glass, semantic strength or information hierarchy.
- Feature CSS is the last resort, not a place to recreate shared primitives.
- New late-file repair blocks in `src/index.css` are prohibited during Stage 4.5; fix the owning module instead once that family has migrated.
- `!important` removal is not a numerical goal by itself. A declaration is removed only when the owning cascade has been proven equivalent by tests/rendered regression.

## Compressed execution sequence — adopted 2026-10-05

Stage 4.5 keeps the same ownership end-state but no longer turns every extraction family into a top-level roadmap section. Small cascade-sensitive commits remain valid implementation gates; they do not create new roadmap stages.

- **4.5.1 — inventory + ownership/layer entry contract — ACCEPTED**
- **4.5.2 — token extraction — ACCEPTED**
- **4.5.3 — materials + cascade-safety closure — ACTIVE**
  - finish the remaining neutral card/hierarchy interaction material as one ordered family;
  - keep the hierarchy `background: ... !important` bridge unlayered until competing semantic/tone important owners move with it;
  - historical `4.5.3.x` micro-passes below remain acceptance evidence, not additional roadmap stages.
- **4.5.4 — semantics + hierarchy**
  - move financial semantic aura/state ownership and hierarchy ownership together;
  - resolve the important-background layer contract as one proven cascade.
- **4.5.5 — interaction surfaces**
  - consolidate controls, dropdown/modal overlay surfaces, hover/focus/tactile material, and CSS-owned motion without redesigning behavior.
- **4.5.6 — responsive + feature/legacy closure**
  - migrate responsive/safe-area/table-safety ownership;
  - drain feature-specific leftovers;
  - complete duplicate/`!important` audit, legacy stylesheet drain, and final rendered-regression closure.

The former planned `4.5.7–4.5.11` scopes are folded into 4.5.5–4.5.6. No separate roadmap sections are created for them.

Implementation rule: combine declarations only when they are part of one cascade contract. If a family needs several commits to remain rendered-safe, those commits stay internal to the numbered pass rather than expanding the roadmap.

## 4.5.1 — Inventory + ownership/layer entry contract — ACCEPTED / CI + RENDERED GREEN

### Scope

- measure the current stylesheet;
- create the permanent ownership directories/files;
- establish named layer/import order;
- attach the new entry immediately after Tailwind;
- keep every accepted selector/declaration in its existing location;
- add source contracts proving the skeleton is visually empty.

### Explicitly out of scope

- moving any existing selector;
- changing any CSS declaration value;
- deleting any `!important`;
- changing breakpoints, motion, glass, aura, hierarchy, controls or overlay geometry;
- Stage 5 Reports work.

### Acceptance

- `src/main.tsx` still imports only `src/index.css` as the app stylesheet;
- Tailwind remains the first CSS import;
- the Stage 4.5 ownership entry is second;
- ownership modules are imported in the canonical order and named layers;
- all ownership modules remain declaration-free at 4.5.1;
- representative Phase 7/8/9/10 accepted CSS still resides in the legacy body;
- TypeScript, full tests and production build are green;
- rendered visual regression is unchanged before any real extraction begins.

### 4.5.1 acceptance record

Accepted through PR #61 at `main@a8cb0956`.

Quality Checks #37274673986 passed:

- TypeScript;
- **114 / 114 test files, 628 / 628 tests**;
- production build.

Main-push closure also passed:

- `build:cloudflare`;
- Wrangler Worker dry-run;
- Phase 10 closure gate;
- Rendered Visual Regression #37275238651;
- **12 / 12 responsive geometries at 0px overflow**;
- **16 / 16 rendered states passed**.

Rendered diffs remained effectively unchanged: 14 states were exactly 0.000%; the two non-zero deterministic states remained tiny and accepted (Positions desktop 0.021%, Closed Cycles desktop 0.012%), well below the 1% visual threshold.

No existing selector or declaration moved in 4.5.1. The ownership modules are still visually empty, so this pass establishes architecture only.

The first Cloudflare GitHub App deployment check on `a8cb0956` failed even though the same head passed the repository's Cloudflare production build and Wrangler dry-run. Recent neighboring main commits show the same intermittent external build behavior. This documentation closure push intentionally triggers a fresh Cloudflare deployment attempt without changing runtime code.

Next: **4.5.2 — token extraction**.


## 4.5.2 — Token extraction — ACCEPTED / CI + RENDERED GREEN

### Scope

- move the six non-responsive base `:root` token blocks from `src/index.css` into `src/styles/tokens.css`;
- preserve declaration values and original block order;
- keep responsive hierarchy token overrides in the legacy stylesheet until 4.5.9;
- update existing token-ownership regression guards to follow the canonical token owner;
- keep every later Stage 4.5 ownership module declaration-free.

### Extracted baseline

The token owner now contains:

- **6** base `:root` blocks;
- **88** base custom-property declarations;
- premium material/effect primitives;
- semantic palette/effect primitives;
- touch/viewport primitives;
- canonical motion easing/duration/family tokens;
- base hierarchy spacing/type/padding tokens.

The legacy stylesheet intentionally retains only the two responsive `:root` override blocks:

- `@media (max-width: 767px)`;
- `@media (max-width: 390px)`.

Those two blocks contain **20** responsive hierarchy override declarations and remain unlayered until the responsive ownership pass so breakpoint behavior is unchanged.

### Explicitly out of scope

- moving material selectors;
- moving semantic state/aura selectors;
- moving hierarchy selectors;
- moving controls, overlays, keyframes or responsive rules;
- changing any token value;
- removing `!important`;
- redesigning any Phase 10-approved surface;
- Stage 5 Reports work.

### Acceptance

- `src/styles/tokens.css` is the only base-token owner;
- it contains only `:root` custom-property declarations;
- all 88 extracted base declarations preserve their accepted values;
- legacy `src/index.css` retains only responsive hierarchy root overrides;
- all later ownership modules remain visually empty;
- TypeScript, full tests and production build are green;
- rendered visual regression remains within the frozen Phase 10 threshold.

### 4.5.2 acceptance record

Accepted through PR #62 at `main@9e18daa8`.

PR Quality Checks #37282283539 passed:

- TypeScript;
- **115 / 115 test files, 633 / 633 tests**;
- production build.

Main-push closure also passed:

- Phase 10 Visual Closure #37282467066;
- production Vite/PWA build;
- Cloudflare Worker compile + Wrangler dry-run;
- Rendered Visual Regression #37282467090;
- **12 / 12 responsive geometries at 0px overflow**;
- **16 / 16 rendered states passed**.

Rendered diffs remained at the frozen baseline profile: 14 states were exactly 0.000%; Positions desktop remained 0.021% and Closed Cycles desktop remained 0.012%, both far below the 1% threshold.

Extraction integrity was also checked directly: the six moved `:root` blocks are byte-identical to their pre-extraction source, all **88** base token declarations are preserved, and exactly two responsive root-override blocks remain in the legacy stylesheet.

The first PR CI run failed only because the new guard miscounted responsive root declarations. The assertion was corrected to measure the actual root bodies; no runtime CSS change was required.

Next: **4.5.3 — neutral material extraction**.


## 4.5.3.1 — Shared neutral material/refraction primitives — ACCEPTED / CI + RENDERED GREEN

Stage 4.5.3 is split because the legacy material system spans both reusable primitives and later composite/Phase-8 restoration rules. They are validated separately so a cascade regression can be isolated.

### Scope

Move only reusable neutral material ownership into `src/styles/materials.css`:

- shared `.premium-surface/.premium-card/.premium-glass` frame;
- `.premium-surface` material;
- `.premium-glass` material;
- base `.premium-panel`;
- base `.premium-subpanel`;
- `.premium-inset-glass`;
- static refraction primitives;
- primary/secondary/hero/overlay refraction-tier role mappings.

### Explicitly deferred to 4.5.3.2

- mixed `.premium-card` material + transition block;
- Reports glass/table composite surfaces;
- dropdown/floating/modal material bodies;
- dense table material;
- Phase 8 hierarchy-linked material restoration;
- neutral material-tone families and their hover/restoration rules.

### Explicitly out of Stage 4.5.3

- semantic state/aura rules (4.5.4);
- hierarchy ownership (4.5.5);
- controls (4.5.6);
- overlay geometry (4.5.7);
- motion (4.5.8);
- responsive rules (4.5.9).

### Acceptance

- extracted primitive declaration values are unchanged;
- `materials.css` contains no semantic-state selector, keyframe, media query, control body, or overlay body;
- later composite material families remain unmodified in `src/index.css`;
- TypeScript, full tests, and production build are green;
- main-push rendered regression remains inside the frozen Phase 10 baseline.

### 4.5.3.1 acceptance record

Accepted through PR #63 at `main@1948c41a`.

PR Quality Checks #37285896557 passed:

- TypeScript;
- **116 / 116 test files, 638 / 638 tests**;
- production build.

Main-push closure also passed:

- Quality Checks #37286043290;
- Phase 10 Visual Closure #37286043106;
- production Vite/PWA build;
- Cloudflare Worker compile + Wrangler dry-run;
- Rendered Visual Regression #37286043136;
- **12 / 12 responsive geometries at 0px overflow**;
- **16 / 16 rendered states passed**.

Rendered diffs stayed exactly on the frozen profile: 14 states at **0.000%**, Positions desktop at **0.021%**, and Closed Cycles desktop at **0.012%**.

This sub-pass moved only the shared neutral surface/refraction primitives. Composite Reports/table/dropdown/modal material, the mixed card material block, and Phase 8 hierarchy-linked restoration remain in the legacy stylesheet for the next isolated gate.

Next: **4.5.3.2 — composite + Phase 8 material restoration closure**.


## 4.5.3.2.1 — Reports + dense-data composite materials — ACCEPTED / CI + RENDERED GREEN

The remaining 4.5.3.2 scope is split again to keep the cascade review local. This sub-pass owns only Reports/table material; Phase 8 hierarchy/card/overlay restoration remains separate.

### Scope

- move `.premium-table-shell` base material, table-header material and row-hover material;
- move Reports glass, soft-glass and table material recipes;
- move the Reports mobile-only material overrides with their owning material family;
- move the later stronger Reports glass override;
- split `.premium-report-glass-soft` out of the later shared soft-surface override while leaving subpanel/inset/form/modal-section material in legacy.

### Explicitly deferred to 4.5.3.2.2

- base/mixed `.premium-card` material and highlight;
- dropdown/floating/modal material bodies;
- Phase 8 hierarchy-linked neutral material restoration;
- material-tone card/market-strip families;
- inset/dense/report-summary Phase 8 restoration;
- neutral card material hover/resting restoration.

### Explicitly out of this material stage

- financial semantic aura/state ownership;
- hierarchy, controls, overlay geometry, motion and responsive ownership.

### Acceptance

- Reports and table-shell material lives in `materials.css`;
- table/report motion declarations remain in the legacy stylesheet for 4.5.8;
- no semantic/control/overlay body is pulled into the material owner early;
- TypeScript, full tests and production build are green;
- rendered regression remains inside the frozen Phase 10 baseline.

### 4.5.3.2.1 acceptance record

Accepted through PR #64 at `main@0e9330ed`.

PR Quality Checks #37289566366 passed:

- TypeScript;
- **117 / 117 test files, 643 / 643 tests**;
- production build.

Main-push closure also passed:

- Quality Checks #37289687498;
- Phase 10 Visual Closure #37289687438;
- production Vite/PWA build;
- Cloudflare Worker compile + Wrangler dry-run;
- Rendered Visual Regression #37289687328;
- **12 / 12 responsive geometries at 0px overflow**;
- **16 / 16 rendered states passed**.

Rendered diffs stayed on the frozen profile: 14 states at **0.000%**, Positions desktop at **0.021%**, and Closed Cycles desktop at **0.012%**.

The first CI run failed only because the historical 4.5.3.1 guard still required Reports glass to remain in the legacy stylesheet. That guard was advanced to protect only the material families still deferred to 4.5.3.2.2; no runtime CSS had to be reverted.

Next: **4.5.3.2.2 — Phase 8 neutral hierarchy/card/overlay restoration closure**.


## 4.5.3.2.2.1 — Base composite card + neutral overlay material bodies — ACCEPTED / CI + RENDERED GREEN

### Scope

- move base `.premium-card` material while keeping its transition/hover motion in legacy;
- move the neutral card highlight body while keeping opacity transition in legacy;
- move `.premium-floating` material;
- move modal backdrop/body/highlight material while keeping modal viewport/scroll geometry in legacy;
- move dropdown body/highlight material;
- move dropdown mobile material while keeping mobile geometry/clamping in legacy;
- move the remaining shared subpanel/inset/form/modal-section composite material.

### Explicitly deferred to 4.5.3.2.2.2

- Phase 8 hierarchy-linked neutral card material;
- material-tone card families;
- structural panel/report restoration;
- market-strip material;
- Phase 8 inset/dense/report-summary restoration;
- neutral card Phase 8 hover/resting restoration.

### Explicitly out of this pass

- semantic state/aura ownership;
- control styling;
- overlay geometry/z-index ownership;
- motion ownership;
- responsive geometry ownership.

### Acceptance

- neutral card/overlay material bodies live in `materials.css`;
- card/dropdown/modal motion and geometry remain in their later owners;
- semantic/control rules are not pulled forward;
- all Phase 8 hierarchy-linked material remains in legacy for the final material gate;
- TypeScript, full tests and production build are green;
- rendered regression remains inside the frozen Phase 10 baseline.

### 4.5.3.2.2.1 acceptance record

Accepted through PR #65 at `main@5f5a1d1e`.

PR Quality Checks #37332186760 passed:

- TypeScript;
- **118 / 118 test files, 649 / 649 tests**;
- production build.

Main-push closure also passed:

- Quality Checks #37332396137;
- Phase 10 Visual Closure #37332396168;
- production Vite/PWA build;
- Cloudflare Worker compile + Wrangler dry-run;
- Rendered Visual Regression #37332396116;
- **12 / 12 responsive geometries at 0px overflow**;
- **16 / 16 rendered states passed**.

The rendered matrix remained within the frozen Phase 10 threshold. Highest observed diffs were Add Trade phone **0.282%**, Transaction Edit desktop **0.041%**, Positions desktop **0.026%**, Journal desktop **0.022%**, and Closed Cycles desktop **0.012%**; all other captured states were **0.000%**.

The first CI attempt failed only because two historical dropdown visual guards still read the canonical glass recipe from `src/index.css`. Those guards were advanced to the new `materials.css` owner; no runtime CSS value changed.

Next: **4.5.3.2.2.2 — Phase 8 neutral hierarchy/material restoration closure**.


## 4.5.3.2.2.2 — Phase 8 neutral hierarchy/material restoration closure — FAILED RENDERED / REVERTING

### Scope

- move explicit `premium-material-tone-*` material variables;
- move neutral hierarchy-card material and neutral highlight;
- move explicitly-toned hierarchy-card material;
- move neutral structural panel/report restoration;
- move market-strip material-tone restoration;
- move inset/detail material;
- move dense-data material;
- move Reports summary-band material;
- move transparent structural-shell material reset;
- move neutral hierarchy-card fine-pointer material hover;
- move Phase 8 mobile material-only blur/saturation overrides;
- keep every financial semantic aura/state/hover selector in legacy for 4.5.4.

### Explicitly out of scope

- semantic win/loss/buy/breakeven aura and state surfaces;
- semantic edge;
- hierarchy spacing/typography;
- controls;
- overlay geometry;
- motion;
- general responsive ownership.

### Acceptance

- every neutral Phase 8 material/restoration selector is owned by `materials.css`;
- financial semantic Phase 8 selectors remain in legacy;
- no control, keyframe, or general responsive rule is pulled into materials;
- TypeScript, full tests and production build are green;
- rendered regression remains inside the frozen Phase 10 baseline.

### Failed rendered attempt record

PR #66 merged as `main@2bd55d68` after its source gate passed TypeScript, **119 / 119 test files, 656 / 656 tests**, and production build.

The main-push rendered matrix then exposed a real cascade regression despite the workflow job itself reporting success:

- Positions phone: **1.035%** diff;
- Journal desktop: **1.947%** diff;
- Semantic Summary desktop: **3.137%** diff.

Those states exceed the frozen **1%** Phase 10 threshold, so PR #66 is **not accepted**.

Root cause: the moved Phase 8 restoration rules were late **unlayered** rules in `src/index.css`. Moving them wholesale into the named `egx-materials` layer lowered their cascade priority beneath still-unlayered legacy rules. This is a cascade-ownership problem, not a declaration-value problem.

No compensating visual values or new `!important` patches will be introduced.

### Recovery sequence

- **4.5.3.2.2.2.R — visual revert / accepted-baseline restoration — ACCEPTED / CI + RENDERED GREEN**
- **4.5.3.2.2.2.1 — safe non-conflicting Phase 8 material ownership — NEXT after revert**
- further Phase 8 material chunks will be defined only after each rendered gate proves cascade safety.

The hierarchy-card restoration matrix, neutral hierarchy hover, and related mobile material overrides remain explicitly blocked from wholesale layering until their competing unlayered owners are isolated or migrated safely.

Stage 4.5.3 remains **ACTIVE**. It is not closed by PR #66.


### 4.5.3.2.2.2.R recovery acceptance record

Recovery head `main@8ec414fe` restored the accepted Stage 4.5.3.2.2.1 runtime state.

Main-push validation passed:

- Quality Checks #37335363101;
- **118 / 118 test files, 649 / 649 tests**;
- production build;
- Phase 10 Visual Closure #37335363137;
- Cloudflare Worker dry-run;
- Rendered Visual Regression #37335363252;
- **12 / 12 responsive geometries at 0px overflow**;
- **16 / 16 rendered states passed**.

The frozen visual profile returned to the accepted baseline: Positions desktop **0.026%**, Closed Cycles desktop **0.012%**, Journal desktop **0.022%**, Add Trade phone **0.282%**, Transaction Edit desktop **0.041%**, and all remaining states **0.000%**.

Recovery is closed. The retry continues through a smaller non-card material slice.


## 4.5.3.2.2.2.1 — Safe non-conflicting Phase 8 material ownership — ACCEPTED / CI + RENDERED GREEN

This retry intentionally excludes the hierarchy-card material bundle that failed rendered validation in PR #66.

### Scope

Move only Phase 8 material families that do not depend on the late card/semantic cascade:

- explicit `premium-material-tone-*` custom-property owners;
- neutral structural panel/report restoration;
- market-strip material-tone restoration;
- inset/detail material;
- dense-data material;
- Reports summary-band material;
- transparent structural-shell material reset.

### Explicitly retained unlayered

- hierarchy-card base material;
- hierarchy-card highlight;
- Overview hero neutral refraction role;
- explicitly-toned hierarchy-card material body;
- neutral hierarchy-card fine-pointer hover material;
- Phase 8 mobile card/panel material override block;
- every financial semantic aura/state/hover rule.

### Acceptance

- only the safe non-card material families move to `materials.css`;
- the six cascade-sensitive card families remain in `src/index.css`;
- semantic rules remain unlayered and untouched;
- TypeScript, full tests and production build are green;
- rendered visual regression stays below the frozen 1% threshold for every state.

### 4.5.3.2.2.2.1 acceptance record

Accepted through PR #68 at `main@dcb0df5f`.

PR Quality Checks #37336618605 passed:

- TypeScript;
- **119 / 119 test files, 654 / 654 tests**;
- production build.

Main-push validation passed:

- Quality Checks #37336829763;
- Phase 10 Visual Closure #37336829761;
- Cloudflare Worker dry-run;
- Rendered Visual Regression #37336829803;
- **12 / 12 responsive geometries at 0px overflow**;
- **16 / 16 rendered states passed**.

Rendered diffs preserved the recovered baseline profile: Positions desktop **0.026%**, Closed Cycles desktop **0.012%**, Journal desktop **0.022%**, Add Trade phone **0.282%**, Transaction Edit desktop **0.042%**, and every remaining state **0.000%**.

The safe retry proves the non-card Phase 8 material families can live in `egx-materials` without disturbing the frozen cascade.

Next: **4.5.3.2.2.2.2 — Overview hero neutral refraction role**. This is intentionally a one-rule gate before any hierarchy-card body moves.


## 4.5.3.2.2.2.2 — Overview hero neutral refraction role — ACCEPTED / CI + RENDERED GREEN

This is a one-rule cascade gate after the successful non-card retry.

### Scope

Move only:

```css
.premium-overview-hero.premium-hero-card {
  --premium-refraction-shadow: var(--premium-refraction-tier-hero);
}
```

into `materials.css`.

The same hero refraction tier is already the canonical neutral role for `.premium-hero-card`; this gate proves the Overview-specific reinforcement can move without disturbing the semantic hero overrides that remain unlayered.

### Explicitly retained unlayered

- hierarchy-card base material;
- hierarchy-card highlight;
- explicit material-tone hierarchy-card body;
- neutral hierarchy-card hover;
- Phase 8 mobile hierarchy-card/panel material overrides;
- all semantic aura/state/hover rules.

### Acceptance

- no declaration value changes;
- no other Phase 8 card rule moves;
- TypeScript, full tests and production build are green;
- all 16 rendered states stay below the frozen 1% threshold.

### 4.5.3.2.2.2.2 acceptance record

Accepted on `main@ed5642a5`.

Main-push validation passed:

- Quality Checks #37337833081;
- TypeScript;
- **120 / 120 test files, 657 / 657 tests**;
- production build;
- Phase 10 Visual Closure #37337833145;
- Cloudflare Worker dry-run;
- Rendered Visual Regression #37337833095;
- **12 / 12 responsive geometries at 0px overflow**;
- **16 / 16 rendered states passed**.

Rendered diffs remained on the frozen accepted profile: Positions desktop **0.026%**, Closed Cycles desktop **0.012%**, Journal desktop **0.022%**, Add Trade phone **0.282%**, Transaction Edit desktop **0.042%**, and every remaining state **0.000%**.

The one-rule gate is accepted. The Overview hero refraction role can remain in `egx-materials` without disturbing the still-unlayered semantic hero overrides.

Next: **4.5.3.2.2.2.3 — neutral hero-card material body**.


## 4.5.3.2.2.2.3 — Neutral hero-card material body — ACCEPTED / CI + RENDERED GREEN

This pass removes one more neutral unlayered material competitor before the hierarchy-card body itself is layered.

### Scope

Move only the neutral `.premium-hero-card` body:

- hero background recipe;
- hero neutral border color.

No hover, hierarchy, semantic, motion, geometry or responsive declaration moves with it.

### Why this comes before the hierarchy-card body

The neutral hero body is currently unlayered and therefore outranks any future hierarchy-card rule moved into the named material layer. Moving it first preserves the intended material ordering inside `egx-materials` and reduces the number of unlayered competitors before the hierarchy-card body gate.

### Explicitly retained unlayered

- hierarchy-card base material;
- hierarchy-card highlight;
- explicit material-tone hierarchy-card body;
- neutral hierarchy-card hover;
- generic card hover and highlight-hover interaction;
- Phase 8 mobile hierarchy-card/panel material overrides;
- all semantic aura/state/hover rules.

### Acceptance

- declaration values remain byte-for-byte equivalent;
- `.premium-hero-card` body lives in `materials.css`;
- all cascade-sensitive hierarchy and semantic rules remain unlayered;
- TypeScript, full tests and production build are green;
- all 16 rendered states remain below the frozen 1% threshold.

### 4.5.3.2.2.2.3 acceptance record

Accepted through PR #70 at `main@54530841`.

Validation passed:

- PR Quality Checks #37339018295;
- main Quality Checks #37339172950;
- **121 / 121 test files, 660 / 660 tests**;
- production build;
- Phase 10 Visual Closure #37339173120;
- Cloudflare Worker dry-run;
- Rendered Visual Regression #37339172988;
- **12 / 12 responsive geometries at 0px overflow**;
- **16 / 16 rendered states passed**.

Rendered diffs remained on the frozen accepted profile: Positions desktop **0.026%**, Closed Cycles desktop **0.012%**, Journal desktop **0.022%**, Add Trade phone **0.282%**, Transaction Edit desktop **0.042%**, and every remaining state **0.000%**.

The neutral hero-card body can live in `egx-materials` without changing the accepted hierarchy/semantic cascade.

Next: **4.5.3.2.2.2.4 — hierarchy-card base material body**.


## 4.5.3.2.2.2.4 — Hierarchy-card base material body — FAILED RENDERED / REVERTING

Candidate PR #71 passed source CI after advancing three stale ownership guards, but the post-merge rendered gate reproduced the original cascade regression. This pass is rejected.

This gate moves only the resting neutral hierarchy-card body after the generic card and hero-card neutral materials have already moved into `egx-materials`.

### Scope

Move only the shared H1–H5 hierarchy-card resting body:

- `--phase8-material-rgb`;
- `--phase8-material-deep-rgb`;
- primary refraction tier;
- resting border;
- resting background;
- resting box-shadow;
- resting desktop backdrop-filter.

### Explicitly retained unlayered

- hierarchy-card `::before` highlight body;
- explicit `premium-material-tone-*` hierarchy-card body;
- neutral fine-pointer hierarchy-card hover;
- generic `.premium-card:hover` and `.premium-card:hover::before` interaction;
- Phase 8 mobile hierarchy-card/panel backdrop overrides;
- every semantic aura/state/hover selector.

### Pre-merge cascade hypothesis — DISPROVEN BY RENDERED GATE

The candidate assumed that leaving semantic and explicit-tone hierarchy rules unlayered would guarantee that they continued to outrank the layered neutral hierarchy body. That is true for the normal declarations in the rule, but **not** for its `background: ... !important` declaration: important cascade-layer priority reverses. The rendered failure below is the evidence that invalidated this hypothesis.

### Failed rendered attempt record

PR #71 passed source CI after the historical guards were advanced:

- Quality Checks #37340415304;
- **122 / 122 test files, 663 / 663 tests**;
- production build.

It merged as `main@928fb8f6`, but Rendered Visual Regression #37340612935 reproduced the same cascade-regression signature as the earlier wholesale Phase 8 attempt:

- Positions phone: **1.035%**;
- Journal desktop: **1.947%**;
- Semantic Summary desktop: **3.137%**.

Additional states that had previously remained effectively unchanged also shifted materially, including Overview phone 390 at **0.969%** and Closed Cycles desktop at **0.816%**.

Rendered-artifact comparison isolated the precise mechanism: the neutral hierarchy body contains `background: ... !important`. For important declarations, named cascade-layer precedence is reversed relative to normal declarations. Moving that background into the earlier `egx-materials` layer made the neutral hierarchy background outrank still-unlayered semantic/tone `background: ... !important` owners. That is why Brokerage Fees and semantic transaction/position cards changed even though their semantic selectors were untouched.

The failure is therefore an **important-layer precedence** problem, not a declaration-value problem. Normal hierarchy declarations can be tested independently, but the important background cannot move into `egx-materials` under the current layer order.

No compensating CSS values and no new `!important` patches are permitted.

### Recovery sequence

- **4.5.3.2.2.2.4.R — restore accepted 4.5.3.2.2.2.3 runtime baseline — MERGED / POST-MERGE RENDERED VALIDATION PENDING** via PR #72 at `main@e5f12297`
- restore hierarchy-card body to `src/index.css`;
- restore the three historical guards to their accepted ownership boundary;
- remove the rejected 4.5.3.2.2.2.4 guard;
- prove the frozen rendered profile is back before choosing a different next slice.

After recovery, do **not** retry the hierarchy-card body unchanged. The next Stage 4.5 move must first address the competing unlayered ownership boundary that makes the body unsafe to layer.

## 4.5.3.2.2.2.5 — Cascade-safe hierarchy shell — VALIDATION CANDIDATE

This pass is a root-cause-driven retry, not a smaller copy of the rejected 4.5.3.2.2.2.4 move.

### Scope

Move only the hierarchy declarations that are safe inside the named material layer:

- `--phase8-material-rgb`;
- `--phase8-material-deep-rgb`;
- `--premium-refraction-shadow`;
- desktop `-webkit-backdrop-filter`;
- desktop `backdrop-filter`.

Keep the following hierarchy-card declarations unlayered as an explicit importance/interaction bridge:

- resting `border-color`;
- the complete resting `background: ... !important` recipe;
- resting `box-shadow`.

### Why the bridge is required

The background must remain unlayered because putting an important declaration in `egx-materials` changes its priority relative to the still-unlayered semantic/tone important backgrounds. The border and box-shadow stay unlayered in this pass because the generic `.premium-card:hover` rule has equal class/pseudo-class specificity; moving hierarchy border/shadow early would also change accepted hover ordering.

The safe shell is placed before the already-accepted Overview hero refraction role inside `materials.css`, so the Overview-specific hero refraction continues to win exactly as before.

### Explicitly retained unlayered

- hierarchy-card importance/interaction bridge;
- hierarchy-card `::before` highlight;
- explicit material-tone hierarchy-card body;
- neutral hierarchy-card hover;
- generic card hover interaction;
- Phase 8 mobile hierarchy-card/panel overrides;
- every semantic aura/state/highlight/hover owner.

### Acceptance

- no declaration values change;
- the safe shell contains no `background`, `border-color`, `box-shadow` or `!important`;
- the important background bridge remains unlayered;
- Overview hero refraction remains ordered after the shell;
- TypeScript, full tests and production build are green;
- recovery main must be rendered-green before this candidate merges;
- after merge, all 16 rendered states must remain below the frozen 1% threshold.

Next after acceptance: evaluate border/shadow ownership separately only after generic hover material ordering has its own rendered-safe gate. The important hierarchy background remains blocked until the semantic/important layer strategy is explicitly redesigned.

## 4.5.4 — Semantics + hierarchy — ACCEPTED / CI + RENDERED GREEN

This compressed pass closes the cross-owner cascade problem discovered during the rejected hierarchy-body extraction.

### Structural solution

The accepted visual precedence is preserved without adding compensating values:

- explicit material-tone hierarchy bodies live in `egx-materials`;
- financial semantic hierarchy bodies live in `egx-semantics`;
- information hierarchy remains material-neutral in `egx-hierarchy`;
- the neutral hierarchy `background: ... !important` fallback lives in one explicitly unlayered `cascade-bridge.css`.

This arrangement is deliberate. For `!important` declarations, named-layer priority reverses, while unlayered important declarations rank below layered important declarations. The neutral fallback therefore remains authoritative only when no explicit tone or financial semantic state is present.

### Scope

- move canonical financial palette, semantic-role geometry, state/aura surfaces and additive semantic edge to `semantics.css`;
- move non-responsive H0-H5 typography, spacing, structural composition and action-importance ownership to `hierarchy.css`;
- move the remaining neutral hierarchy frame/highlight, explicit tone card body and hierarchy material hover into `materials.css`;
- move generic card hover light/highlight into `materials.css` while leaving transform choreography for 4.5.5;
- isolate the neutral important background fallback in `cascade-bridge.css`;
- retain responsive hierarchy overrides in legacy until 4.5.6;
- retain generic transition/motion bridges until 4.5.5.

### Acceptance

- no visual declaration values change;
- `hierarchy.css` contains no material background recipe or financial semantic selector;
- `materials.css` contains no financial semantic hierarchy owner;
- `semantics.css` contains no explicit material-tone owner;
- the neutral important fallback is the only rule in the unlayered bridge;
- TypeScript, full tests and production build pass;
- Phase 10 Visual Closure passes;
- all rendered states remain within the accepted regression threshold.

### 4.5.4 acceptance record

Accepted through PR #81 at `main@f3266418`.

Validation evidence:

- PR exact-head Quality Checks passed on `13e210a`;
- post-merge Phase 10 Visual Closure #37368157990 passed;
- post-merge Rendered Visual Regression #37368273304 passed;
- the concurrent post-merge Quality Checks run #37368157987 was cancelled rather than test-failed, so it is not contradictory failure evidence;
- no compensating visual values or new `!important` patches were introduced.

The important-background problem is now resolved structurally: explicit tone and financial semantic important owners are layered, while the neutral important fallback is isolated in the intentionally unlayered bridge.

Next is **4.5.5 — interaction surfaces**.

## 4.5.5 — Interaction surfaces — VALIDATION CANDIDATE

This compressed pass consolidates the reusable interaction vocabulary without pulling responsive or feature-specific ownership forward.

### Scope

- move reusable actions, fields, filters, choices, checkboxes, selector shells, compact selectors, dense-search controls and shared navigation interaction into `controls.css`;
- move modal/dropdown/fixed-overlay geometry, viewport clamping, portal rules, overlay safe-area behavior and stacking into `overlays.css`;
- move CSS-owned transitions, keyframes, reduced-motion fallbacks, legacy lifecycle compatibility and Motion-for-React neutralization into `motion.css`;
- keep generic financial hover presentation in `semantics.css` while moving only its transition choreography to `motion.css`;
- preserve all accepted declaration values and source-order precedence inside each new owner.

### Cascade safety

The field family is migrated as one competing-important contract: base `.premium-field`, nested modal/panel field overrides, strong-field overrides and textarea overrides move together so named-layer `!important` precedence cannot invert their accepted ordering.

Older Phase 4 control visuals are also moved into `controls.css` before the later Phase 3.3/3.2 refinement blocks. This prevents an older unlayered selector from silently outranking the new control owner.

Mixed dense-row rules are split by ownership: static row background remains outside motion while only transition choreography moves to `motion.css`. The later Phase 4 v3 transition owner therefore keeps the same final precedence.

### Explicitly deferred to 4.5.6

- breakpoint-only touch sizing and safe-area/containment rules;
- Phase 9 Header-specific command/navigation CSS;
- chart/allocation/cash feature-specific motion and presentation;
- advanced-effect feature residue;
- final feature CSS drain;
- final duplicate/`!important` audit and legacy stylesheet closure.

### Acceptance

- `controls.css` is the canonical reusable control owner;
- `overlays.css` is the canonical reusable overlay geometry owner;
- `motion.css` is the canonical generic CSS-motion owner;
- generic financial hover presentation remains semantic-owned;
- legacy CSS no longer contains the migrated reusable interaction families;
- responsive and feature-specific residue remains intentionally available for 4.5.6;
- TypeScript, full tests and production build pass;
- Phase 10 Visual Closure passes;
- Rendered Visual Regression remains within the accepted threshold.

After acceptance, the only remaining Stage 4.5 pass is **4.5.6 — responsive + feature/legacy closure**.

