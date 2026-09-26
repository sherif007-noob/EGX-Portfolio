# Phase 9 — Header, Navigation & Global Command Architecture

## Status

**IN PROGRESS — Passes 9.0/9.1 CODE COMPLETE / CI CLEAN. Quality Checks #36272919126 passed. Pass 9.2 navigation refinement is next.**

Phase 9 redesigns the global command/navigation layer only. Phase 8 content hierarchy, glass, aura, semantic edge, chart behavior, dense workflows, selectors, and financial behavior remain frozen.

## Core rule

> The header is a control plane, not another dashboard.

The user should be able to answer four questions immediately:

1. Where am I?
2. What is the primary global action?
3. Where are secondary tools?
4. Is anything demanding attention?

The header must not compete visually with the content hero surfaces below it.

## Information architecture

### Brand / context

- EGX Portfolio identity;
- logo;
- compact market/context indicator;
- visually quiet relative to content.

### Navigation

Retain the three current groups:

- **Portfolio** — Overview, Open Positions, Closed Cycles;
- **Activity** — Transactions, Cash Ledger;
- **Insights** — Reports & Performance, Stocks & Prices.

Navigation answers only “where am I?” and must not be overloaded with synchronization/status meaning.

### Primary global creation

- **Add Trade** remains the dominant global CTA.
- **Scan Receipt** remains an immediately accessible creation companion but must not compete at equal priority.

### Utilities / status

- Price Alerts;
- Sync Prices;
- Google Sheets;
- Backup & Reconcile;
- **Settings**.

The utility layer is deliberately subordinate to navigation and Add Trade.

## Future Settings affordance

Phase 9 adds a visible **Settings** button to the utility layer as a reserved future entry point.

Rules:

- the Settings button exists now so the final header architecture already has a stable home for it;
- Phase 9 does **not** build a Settings modal, settings screen, preference model, persistence schema, or business logic;
- until future settings work begins, activation only provides a lightweight informational acknowledgement;
- Settings must never receive primary CTA styling;
- future work should attach functionality to the existing entry point rather than redesigning the header again.

## Frozen behavior

Phase 9 must preserve:

- sticky header behavior;
- safe-area handling;
- max-width alignment with content;
- all seven navigation destinations;
- grouped navigation semantics;
- active-tab `aria-current`;
- horizontal navigation scrolling;
- left/right overflow affordances;
- automatic active-item scroll into view;
- ArrowLeft / ArrowRight / Home / End keyboard behavior;
- reduced-motion handling;
- Alerts unread/active state;
- Sync loading state;
- Sheets connected/expired state;
- all existing modal/action callbacks;
- existing tab IDs.

## Pass plan

### 9.0 — Functional inventory + contract lock

**Status: COMPLETE / CI CLEAN.**

Current control ownership is now locked in source-level regression coverage. The test protects all seven destinations, the three navigation groups, existing callbacks, keyboard navigation, scroll affordances, active-tab semantics, and the primary-vs-utility action contract.

Audit and classify every existing header control as:

- brand/context;
- navigation;
- primary action;
- creation companion;
- status;
- utility;
- data-management.

Add regression coverage before deeper movement of controls.

### 9.1 — Command-zone shell

**Status: COMPLETE / CI CLEAN.**

Implemented:
- utilities are grouped into a dedicated quiet glass cluster;
- Add Trade / Scan Receipt live in a separate creation cluster;
- the creation cluster remains fixed-access while utility overflow can scroll on narrow phones;
- a visible Settings affordance is present now but intentionally opens no Settings modal;
- the Settings action is wired only to an informational acknowledgement for future expansion;
- existing navigation remains untouched functionally.

Build the structural header shell:

- brand/context zone;
- utility cluster;
- creation cluster;
- navigation zone;
- Settings future affordance.

The shell should be coherent glass, but materially quieter than Phase 8 hero cards.

### 9.2 — Navigation refinement

Refine:

- active/inactive hierarchy;
- group spacing and separators;
- compact/full labels;
- icon treatment;
- overflow behavior;
- keyboard/focus states.

Do not bury primary navigation in a hamburger-only interaction.

### 9.3 — Primary creation architecture

- Add Trade owns primary global action styling.
- Scan Receipt becomes a clearly related secondary creation path.
- preserve both workflows unchanged.

### 9.4 — Utility/data-management consolidation

Reduce equal-weight utility competition.

Likely structure:

- direct compact Sync trigger;
- Alerts remain separately discoverable because unread state matters;
- Google Sheets status/configuration grouped with data tools;
- Backup & Reconcile moves into the lower-frequency data-management context;
- Settings remains a visible future affordance.

### 9.5 — Status communication

Prefer compact status indicators over whole-button semantic promotion.

Warnings may temporarily elevate importance; resolved states return to normal utility priority.

### 9.6 — Mobile command architecture

Design narrow phone intentionally:

- brand/context;
- fixed-access creation;
- navigation;
- scrollable/collapsed utility access;
- no six-button full-width action rail;
- safe-area and touch-target contracts preserved.

### 9.7 — Desktop / 2XL refinement

Use width for clearer grouping, not more visible noise.

Target conceptual zones:

`brand/context | navigation | actions/utilities`

### 9.8 — Interaction / focus / motion

Validate:

- hover/press/focus;
- keyboard navigation;
- unread alerts;
- sync progress;
- connected/expired Sheets;
- reduced motion.

No new theatrical header animation family.

### 9.9 — Regression + closure

Validate phone portrait, phone landscape, tablet, desktop, and 2XL.

Run typecheck, tests, build, and freeze the final header architecture.

## Material rules

- neutral premium glass first;
- no full-header financial semantic aura;
- active nav gets localized accent only;
- Add Trade may retain the strongest global CTA treatment;
- genuine warning states may temporarily elevate;
- content hero cards remain visually stronger than header chrome.

## Mobile rules

- Add Trade remains reachable without horizontal utility scrolling;
- navigation remains directly accessible;
- utility overflow must not push creation off-screen;
- Settings stays reachable even while it remains future-only;
- no action depends on hover/title text;
- existing minimum touch target remains protected.

## Out of scope

Phase 9 does not redesign:

- Overview / Reports / dense content cards;
- charts;
- page-level headers;
- modal bodies;
- selectors;
- semantic card material;
- financial calculations;
- persistence or Supabase;
- ticker resolution;
- performance profiling.

## Acceptance

Phase 9 is complete only when:

- current location is obvious;
- Add Trade is the dominant global action;
- Scan Receipt is clearly secondary but easy to reach;
- utilities feel grouped and subordinate;
- Alerts/warnings can demand attention without permanently dominating;
- Settings has a stable visible home without prematurely implementing settings;
- every prior navigation/accessibility behavior still works;
- mobile does not become a horizontally scrolling wall of utilities;
- the header remains visually quieter than the content hierarchy;
- typecheck, tests and production build pass.
