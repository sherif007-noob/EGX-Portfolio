# Phase 6.5 — Navigation Refinement Plan

**Status: IN PROGRESS — Pass 1 architecture and active-location treatment.**

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

- Validate label density and grouping at phone, tablet, desktop, and 2XL.
- Tune compact labels without changing destination meaning.
- Ensure edge fades disappear exactly when no hidden navigation remains.
- Verify keyboard/focus and reduced-motion behavior.
- Review sticky header/navigation handoff without pulling Phase 9 header redesign forward.

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
- Existing tab behavior and Phase 4 transition behavior remain unchanged.
