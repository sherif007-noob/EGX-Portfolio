# Phase 6.5 — Navigation Refinement Plan

**Status: IN PROGRESS — Pass 2 mobile/desktop handoff implemented; validation pending.**

Phase 6.5 refines navigation only. It preserves the accepted premium glass/glow system and the Phase 4 motion language while making location, grouping, and overflow behavior clearer across desktop and mobile.

## Boundaries

- Presentation/navigation architecture only.
- No portfolio/accounting/transaction/persistence/market-data behavior changes.
- Do not perform the final Header redesign here; Phase 9 still owns final utility/header composition.
- Do not redesign charts; Phase 7 owns chart visuals.
- Preserve the seven existing destinations and their route/tab behavior.
- Preserve Phase 6 responsive/touch contracts.

## Pass 1 — Main navigation architecture

- Replace duplicated tab markup with one canonical navigation definition.
- Group destinations by task without adding another heavy visual bar:
  - Portfolio: Overview, Positions, Closed Cycles.
  - Activity: Transactions, Cash Ledger.
  - Insights: Reports & Performance, Stocks & Prices.
- Make active location materially clearer than hover/inactive states.
- Keep icons and semantic accent identity.
- Keep the selected tab automatically visible after navigation.
- Add left/right overflow fades so phone users can see when more destinations exist.
- Keep the nav compact enough that it does not compete with portfolio content.

## Pass 2 — Mobile/desktop handoff

**Status: IMPLEMENTED — awaiting device/desktop validation.**

Implemented:
- **070db8b / fa495c4** — keep compact labels below 2XL, move explicit group labels to 2XL only, reduce phone tab padding/gap pressure, and preserve full destination labels at 2XL.
- Add roving keyboard focus across navigation: Left/Right arrows move between destinations; Home/End jump to first/last; Enter/Space preserve normal button activation.
- Active-tab auto-scroll now respects `prefers-reduced-motion` instead of always forcing smooth scrolling.
- **fefd19f** — make navigation overflow feedback geometry-driven at every breakpoint; remove the old 1280px rule that hid fades regardless of actual overflow.
- Add proximity scroll-snap and mobile scroll padding so touch scrolling settles around useful tab positions without forcing hard snapping.
- Preserve the accepted stronger group separator from Pass 1 correction.

Deferred:
- Phone tab/page transition timing is improved but **not considered final**. User accepted moving forward while explicitly requesting deeper transition work later. Treat this as motion debt for a later motion/performance refinement pass, not as a closed 6.5 acceptance item.

Validation targets:
- phone/tablet label density;
- edge fades appear/disappear only when content is actually hidden;
- keyboard focus does not alter active tab until activation;
- reduced-motion has no smooth auto-scroll;
- sticky header/nav/content handoff stays stable without pulling Phase 9 work forward.

## Pass 3 — Validation and closure

- Real-device phone smoke.
- Desktop/tablet regression.
- Typecheck, tests, production build.
- Update roadmap/implementation log and close Phase 6.5 only after acceptance.

## Acceptance

- Current location is obvious at a glance.
- Inactive destinations remain discoverable without competing with the active page.
- Navigation grouping is understandable without visual clutter.
- Mobile horizontal overflow advertises itself and never hides the selected destination.
- No collisions or page-level overflow at supported sizes.
- Existing tab routing behavior remains unchanged; transition timing currently carries documented deferred motion debt.
