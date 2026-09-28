# Phase 9 — Header, Navigation & Global Command Architecture

## Status

**PHASE 9 SOURCE-FROZEN — Pass 9.9 closure matrix is implemented. Architecture, responsive behavior, interaction/focus/motion, status semantics, and Phase 8 boundaries are regression-locked. Final CI typecheck/tests/build remains the only external closure gate.**

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
- shared horizontal rhythm with content; desktop header/navigation may use a wider bounded shell when the standard content max-width would otherwise create unnecessary command overflow;
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

**Status: COMPLETE / CI CLEAN — initial gate #36273301109 passed; visual hierarchy correction applied after device-direction review.**

Implemented:
- explicit active vs idle navigation roles;
- quieter inactive text/icon treatment while keeping premium glass/refraction;
- active tab is intentionally **more prominent than inactive tabs** with stronger glass depth, luminous accent border, icon bloom, and underline; it must never be "quieter" than the idle state;
- localized active-tab aura remains scoped to navigation so it does not compete with Phase 8 content hero cards;
- active-group label emphasis without changing group structure;
- refined separators and group spacing;
- dedicated compact/full nav label hooks;
- explicit keyboard focus-visible treatment;
- narrow-phone spacing refinement while retaining direct horizontal navigation;
- regression coverage for all seven destinations, keyboard behavior, overflow affordances, and Phase 8 material isolation.

Refine:

- active/inactive hierarchy;
- group spacing and separators;
- compact/full labels;
- icon treatment;
- overflow behavior;
- keyboard/focus states.

Do not bury primary navigation in a hamburger-only interaction.

### 9.2 correction note — active prominence + full button language

After visual-direction review, the 9.2 interpretation was corrected:

- the **active tab must be louder than idle tabs**, not quieter;
- idle tabs retain premium translucent glass/refraction rather than becoming flat;
- active tabs receive stronger border luminosity, glass depth, icon bloom, and localized underline/aura;
- every header button now participates in one premium material family rather than leaving utilities as plain toolbar controls;
- utility buttons use functional structural accents (amber/cyan/emerald/purple/neutral) with restrained local bloom;
- Add Trade and Scan Receipt remain stronger creation actions through intensity, not through an unrelated material recipe.

Correction gate: **Quality Checks #36273839931 — PASS**.

### 9.3 — Primary creation architecture

**Status: COMPLETE / CI CLEAN — Quality Checks #36277267864 passed.**

Implemented:
- Add Trade is explicitly marked as the primary creation action;
- Scan Receipt is explicitly marked as the secondary creation action;
- both actions now sit inside one dedicated creation cluster so they read as two paths into the same activity;
- the creation cluster itself uses restrained premium glass/refraction so it groups the actions without competing with them;
- Add Trade retains the strongest border luminosity, blue aura and aurora/shimmer treatment;
- Scan Receipt keeps the accepted emerald premium treatment at a lower intensity;
- touch-target behavior remains protected on narrow phones;
- both original callbacks/workflows are unchanged;
- source regression coverage prevents Scan Receipt from becoming primary or Add Trade from losing primary ownership.

Rules retained:
- Add Trade owns primary global action styling;
- Scan Receipt is a clearly related secondary creation path;
- both creation buttons use the accepted premium button language: translucent glass, refraction, luminous border, controlled aura/bloom, and hierarchy-appropriate intensity;
- preserve both workflows unchanged.

### 9.4 — Utility/data-management consolidation

**Status: COMPLETE / CI CLEAN — Quality Checks #36281063871 passed.**

Implemented:
- Price Alerts remains a direct amber utility because unread state is time-sensitive;
- Sync Prices remains a direct cyan utility because it is operationally frequent;
- Google Sheets and Backup & Reconcile are consolidated behind a single premium **Data & Tools** command;
- the Data & Tools menu preserves the existing Google Sheets and backup/reconcile callbacks unchanged;
- Google Sheets connected/expired state remains visible on the Data & Tools trigger;
- the menu closes on outside click, Escape, or after an action is chosen;
- Settings stays directly visible as a neutral premium utility and remains future-only;
- the data-management cluster and dropdown use the same accepted translucent glass/refraction/luminous-border/bloom language as the rest of the header;
- the dropdown is intentionally outside the horizontally scrolling frequent-utility rail so it is not clipped by overflow;
- source regression coverage protects direct-vs-consolidated utility ownership, callback preservation, Settings visibility, status visibility, and Phase 8 material isolation.

Resulting utility architecture:
- direct: Price Alerts;
- direct: Sync Prices;
- grouped under Data & Tools: Google Sheets + Backup & Reconcile;
- direct future affordance: Settings.

**Viewport-safety correction:** the Data & Tools dropdown must never rely on trigger-relative right alignment on narrow screens. It is rendered through a body portal, uses fixed viewport geometry, clamps to the resolved safe-inline header bounds, and repositions on resize / visual-viewport changes. This prevents the menu from opening outside the screen or being clipped by sticky-header/backdrop-filter/overflow contexts. Quality Checks #36282456713 passed after this fix.

Reduce equal-weight utility competition.

Final structure:

- direct compact Sync trigger;
- Alerts remain separately discoverable because unread state matters;
- Google Sheets status/configuration is grouped with data tools;
- Backup & Reconcile lives inside the lower-frequency data-management context;
- Settings remains a visible future affordance.

**Header utility button design-language rule:** this phase finalizes the visual treatment of **every utility button**, not only Settings. Price Alerts, Sync Prices, Google Sheets, Backup & Reconcile, and Settings must all use the accepted premium language: translucent glass, refraction, luminous semantic/structural border, visible but subordinate local aura/bloom, and consistent hover/focus depth. Utilities may differ by functional accent (amber/cyan/emerald/purple/neutral), but they must look like members of the same premium system. They must not become flat toolbar buttons just to communicate lower priority.

**Settings-specific rule:** Settings follows the same premium utility recipe using a neutral structural accent. It must not become a primary CTA, use financial WIN/LOSS semantics, or introduce a separate visual language just because its functionality is reserved for the future.

### 9.5 — Status communication

**Status: COMPLETE / CI CLEAN — Quality Checks #36282139801 passed.**

Implemented:
- Alerts now uses a compact amber unread badge, green active dot, or muted paused dot;
- the Alerts button only receives stronger attention treatment when unread alerts actually exist;
- removed the bouncing BellRing treatment so the unread count carries urgency without theatrical motion;
- Sync Prices exposes an explicit running state with spinner, text and cyan status dot while keeping the normal idle button at regular utility intensity;
- Data & Tools stays purple in normal/connected state and temporarily switches to amber attention treatment only when the Sheets token is expired;
- Sheets connected/expired state stays visible as a compact status dot on the consolidated trigger;
- shared status vocabulary now covers connected / warning / running / muted / count-badge states;
- reduced-motion rules stop sync rotation where requested;
- status semantics are exposed through aria labels/data-status without relying only on color;
- source regression coverage protects the temporary-promotion rule and Phase 8 material isolation.

Rules:
- prefer compact status indicators over whole-button semantic promotion;
- warnings may temporarily elevate importance; resolved states return to normal utility priority;
- status must never be conveyed by color alone.

### 9.6 — Mobile command architecture

**Status: COMPLETE / CI CLEAN — Quality Checks #36298460804 passed.**

Implemented:
- portrait mobile now has an explicit two-tier header: brand/context first, command rail second;
- the command rail is a three-zone grid: quick utilities | Data/Settings | creation;
- only the quick-utility zone is allowed to scroll horizontally;
- Data & Tools, Settings, Scan Receipt, and Add Trade remain fixed-access;
- quick utilities use scroll snapping and a controlled fade affordance instead of pushing creation off-screen;
- all command buttons retain the 44px touch-target contract;
- compact navigation auto-centers the active/focused tab on phone while retaining direct horizontal navigation;
- nav spacing/edge affordances are tightened for mobile without changing route ownership or active-state material;
- <=359px receives an extra density guard without reducing touch targets;
- short-landscape phones now override the older whole-command-rail overflow fallback: only quick utilities may scroll, while data/settings and creation remain fixed;
- safe-area padding remains owned by the existing header safe-inline primitives;
- semantic/material behavior from Phases 8 and 9.1–9.5 is unchanged.

Rules:
- brand/context remains visually first;
- Add Trade remains fixed-access and primary;
- Scan Receipt remains fixed-access and secondary;
- direct utilities may scroll only in their own bounded region;
- Data & Tools and Settings may not be pushed off-screen by utility overflow;
- navigation remains directly accessible and active-tab centered on compact viewports;
- no command action may fall below the 44px touch target;
- mobile layout changes must not reopen Phase 8 content hierarchy or material.

### 9.7 — Desktop / 2XL refinement

**Status: COMPLETE — rendered desktop-width correction accepted and closure-locked by 9.9.**

Use width for clearer grouping, not more visible noise.

Implemented:
- desktop top-row geometry is now an explicit bounded grid instead of an inherited wrapping / `justify-between` layout;
- command ownership reads as three stable desktop zones: frequent utilities | Data/Settings | creation;
- the command rail is content-sized, while the desktop header shell may expand beyond the main content max-width (up to 100rem) so available viewport width is used before horizontal overflow is introduced;
- 1024–1279px desktop intentionally collapses lower-priority labels while keeping Add Trade readable and dominant;
- 1280px+ restores normal command labels without inflating the buttons themselves;
- 1536px+ uses the existing full navigation labels, navigation group labels, and Settings label for context instead of adding new commands;
- navigation remains horizontally overflow-safe and keeps its existing active-state, keyboard, scroll-into-view, edge-fade, and reduced-motion infrastructure; when the whole row fits again, stale horizontal scroll is reset to zero so the first tab cannot remain clipped;
- desktop rules are gated by `min-height: 521px` so the Phase 9.6 short-landscape architecture cannot be overridden;
- no Phase 8 card/material/semantic rules, page content, callbacks, destinations, charts, or data behavior were changed;
- dedicated `Phase97DesktopHeaderRefinement.test.ts` coverage locks the geometry, laptop compaction, 2XL context rule, mobile isolation, navigation behavior, and Phase 8 material boundary.


**9.7 desktop-width correction after rendered review:** the original implementation preserved `max-w-7xl` on both header rows. That left large unused side gutters on wide desktops while navigation could still overflow inside the narrower shell. The header/nav shell now expands at `xl` up to `100rem`, keeping the main page content width unchanged. Horizontal nav scrolling remains only as a fallback when the controls genuinely cannot fit, and retained scroll position is cleared once overflow disappears.

Target conceptual zones:

`brand/context | navigation | utilities | creation`

Validation gate before freeze:
- typecheck/tests/build;
- 1024 / 1280 / 1440 / 1600 / 1920 / 2560 desktop-width review;
- downward regression across 2XL → XL → desktop → tablet boundary;
- verify no viewport overflow or command clipping in the final rendered app.

### 9.8 — Interaction / focus / motion

**Status: COMPLETE — source-validated and regression-locked during the 9.9 closure audit.**

Validated:
- navigation idle/active hover treatment remains explicit;
- navigation and every global header command retain visible `:focus-visible` treatment;
- ArrowLeft / ArrowRight / Home / End navigation and focus transfer remain intact;
- Data & Tools retains `aria-haspopup`, `aria-expanded`, Escape close, and viewport-safe portal behavior;
- unread Alerts, sync-running, Sheets connected, and Sheets-expired states remain local status treatments rather than permanent hierarchy promotion;
- sync rotation is the only purposeful status animation and is disabled under reduced motion;
- nav scrolling switches to non-animated behavior under reduced motion;
- no bounce/theatrical notification motion was reintroduced;
- dedicated `Phase98InteractionFocusMotion.test.ts` coverage locks these contracts.

No new theatrical header animation family was introduced.

### 9.9 — Regression + closure

**Status: IMPLEMENTED / SOURCE-FROZEN — final CI gate pending.**

#### Closure rules

1. **Freeze, do not redesign.** 9.9 may fix only a regression proven by the closure audit; it may not introduce a new header concept, control, visual language, or motion family.
2. **One architecture across all widths.** Phone portrait, <=359px, short phone landscape, tablet, desktop, XL, and 2XL must remain adaptations of the same command/navigation model.
3. **Overflow is fallback, never default.** Desktop must consume genuinely available header width before horizontal navigation scrolling appears; stale scroll position must clear when overflow disappears.
4. **Creation priority is immutable.** Add Trade remains the only primary creation command; Scan Receipt remains secondary.
5. **Utility ownership is immutable.** Alerts and Sync remain direct; Google Sheets + Backup/Reconcile remain inside Data & Tools; Settings remains a direct future affordance.
6. **Interaction/accessibility is part of the architecture.** Existing IDs, callbacks, `aria-current`, disclosure semantics, focus-visible states, keyboard navigation, reduced-motion handling, and safe-area behavior are frozen contracts.
7. **Status never becomes permanent hierarchy.** Unread/warning/running states may temporarily elevate locally; normal states return to their normal utility weight.
8. **Phase 8 is a hard boundary.** Closure work must not alter content-card hierarchy, semantic aura/glow, additive semantic edge, charts, page content, or financial/data behavior.
9. **No opportunistic cleanup.** Anything outside the global header/navigation scope belongs to a later phase.
10. **Closure requires evidence.** Source regression matrix first; typecheck, tests, and production build are the final external gate before calling Phase 9 CI-clean.

#### Implemented closure matrix

- all three navigation groups and all seven destinations are frozen;
- every global command ID and callback owner is frozen;
- Add Trade / Scan Receipt priority is frozen;
- keyboard navigation, active `aria-current`, focus transfer, active-item scroll-into-view, overflow fades, and stale-scroll recovery are frozen;
- mobile two-tier / three-zone command architecture, <=359px density guard, 44px targets, short-landscape isolation, and safe areas are frozen;
- desktop 1024–1279 compaction, 1280+ full labels, 2XL contextual labels, and the widened 100rem desktop header shell are frozen;
- Alerts / Sync / Sheets status vocabulary and reduced-motion behavior are frozen;
- Data & Tools body portal and viewport clamping are frozen;
- Phase 8 semantic/material markers are explicitly protected and financial WIN/LOSS semantics are forbidden on header chrome;
- dedicated `Phase99HeaderClosure.test.ts` covers the cross-phase acceptance matrix.

#### Final gate

Run:
- typecheck;
- full test suite;
- production build.

Until that external runner executes against the connector-written HEAD, Phase 9 is **source-frozen but not labeled CI-clean**.

## Global button-language rule

Every visible header control that is a button must belong to the same established premium material family.

This includes:
- navigation tabs;
- Price Alerts;
- Sync Prices;
- Google Sheets;
- Backup & Reconcile;
- Settings;
- Scan Receipt;
- Add Trade.

Priority is expressed through **intensity and semantic accent**, not by flattening lower-priority controls. Even a low-priority utility still gets translucent glass, refraction, a luminous border, and a restrained aura. Add Trade and Scan Receipt remain stronger because of their creation role; active navigation is stronger than idle navigation; utilities remain visibly premium but subordinate.

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
