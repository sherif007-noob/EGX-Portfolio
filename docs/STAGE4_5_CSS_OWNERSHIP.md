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
