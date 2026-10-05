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

## Granular sequence

- **4.5.1 — inventory + ownership/layer entry contract**
- **4.5.2 — token extraction**
- **4.5.3 — neutral material extraction**
  - **4.5.3.1 — shared neutral material/refraction primitives**
  - **4.5.3.2 — composite + Phase 8 material restoration closure**
    - **4.5.3.2.1 — Reports + dense-data composite materials**
    - **4.5.3.2.2 — Phase 8 neutral hierarchy/card/overlay restoration closure**
- **4.5.4 — semantic state/aura extraction**
- **4.5.5 — hierarchy extraction**
- **4.5.6 — shared controls extraction**
- **4.5.7 — overlays/portal geometry extraction**
- **4.5.8 — CSS-owned motion extraction**
- **4.5.9 — responsive/safe-area/table-safety extraction**
- **4.5.10 — feature CSS drain**, split into smaller 4.5.10.x passes if needed
- **4.5.11 — legacy drain, duplicate/`!important` audit and rendered-regression closure**

No pass may combine unrelated ownership families merely to reduce line count.

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


## 4.5.3.2.1 — Reports + dense-data composite materials — VALIDATION IN PROGRESS

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

Next after acceptance: **4.5.3.2.2 — Phase 8 neutral hierarchy/card/overlay restoration closure**.
