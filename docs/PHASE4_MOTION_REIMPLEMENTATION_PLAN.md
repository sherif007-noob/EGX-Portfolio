# Phase 4 Motion Reimplementation Plan

## Why Phase 4 is being rebuilt again

The first Phase 4 pass made motion noticeable but inconsistent and too fast.  
The second pass introduced browser View Transition snapshots, which produced ghost copies, blank midpoint frames, layout/scroll drift, and mobile compositor instability in real screen recordings.  
The recording-driven stability pass removed those artifacts, but the deterministic timer-based sequential system over-corrected: transitions became too subtle and often read as simple state replacement rather than continuous motion.

This document defines the third and final architectural direction for Phase 4.

## Non-negotiable boundary

Phase 4 remains strictly presentation-only.

It may change:
- animation/presence/layout orchestration;
- visual timing/easing;
- transform/opacity choreography;
- modal/dropdown/accordion presence;
- selector/control feedback;
- chart presentation timing.

It must not change:
- accounting or financial calculations;
- portfolio/transaction semantics;
- persistence or schemas;
- market-data behavior;
- analytics observations;
- filtering meaning;
- business rules.

## Core architectural decision

### Motion for React owns lifecycle motion

The repository already includes:

`motion@12.23.24`

Phase 4 will use the official React APIs from:

`motion/react`

Primary primitives:
- `AnimatePresence` for enter/exit lifecycle;
- `motion.*` for transform/opacity animation;
- `useReducedMotion` for user accessibility preference;
- `layout` / `layoutId` only for small localized layout changes where it is clearly useful.

### What is retired

The following must not orchestrate application state transitions:

- Browser View Transition API.
- Snapshot/cross-document-style compositing.
- Timer-driven React tree caching/swap state machines.
- Permanent whole-page `will-change` / `translateZ(0)`.
- Large-surface blur/filter animation.
- Multiple nested entrance systems responding to one state change.

### Ownership rule

Every interaction has exactly one lifecycle-motion owner.

Examples:
- Main tab change -> TabPresence only.
- Transaction filter result change -> StatePresence only.
- Modal opening/closing -> ModalPresence only.
- Dropdown opening/closing -> DropdownPresence only.
- Accordion expanding/collapsing -> ExpandPresence only.
- Chart timeframe change -> Recharts only.

Child components may still have hover/focus/press styling, but must not replay a second whole-surface entrance for the same interaction.

---

# Motion families

## Family 1 — Navigation / context

### Main tabs

Use:
- `AnimatePresence mode="wait"`
- one keyed real DOM tree at a time;
- no browser screenshots;
- no timer state machine;
- no overlapping full application pages.

Choreography:
- outgoing tab: opacity 1 -> ~0.42, x 0 -> -12 px, y 0 -> -2 px;
- incoming tab: opacity ~0.42 -> 1, x +14 px -> 0, y +3 px -> 0;
- no blur;
- no large-page scale;
- outgoing ease-in;
- incoming emphasized ease-out.

Target:
- exit ~200–230 ms;
- enter ~340–380 ms;
- total perceived context change ~560–610 ms.

The movement is intentionally visible, but small enough not to look like a carousel.

### Navigation selection

Navigation control state updates immediately.

The active indicator/control should settle over ~300–360 ms, independent from page lifecycle motion.

---

## Family 2 — Interactive controls

CSS remains the primary implementation for:
- buttons;
- icon actions;
- selector pills;
- segmented controls;
- form focus;
- press feedback;
- chevrons.

Target:
- hover/focus: ~240–280 ms;
- press: ~120–170 ms;
- selected-state settle: ~300–360 ms.

Rules:
- semantic color remains the same before/during/after motion;
- controls never translate far enough to disturb layout;
- no bouncing loops;
- no icon animation that makes a neutral control appear semantically colored.

Optional Motion layout animation:
- small shared selected indicators may use `layoutId`;
- never animate the layout of whole tables/pages for selector feedback.

---

## Family 3 — Overlays

### Modals

All premium modals should eventually use one shared presence primitive.

Use:
- `AnimatePresence`;
- real modal DOM remains mounted until exit completes;
- backdrop and panel animate independently but synchronously.

Entrance:
- backdrop opacity 0 -> 1;
- panel opacity 0 -> 1;
- panel y +18 -> 0;
- panel scale 0.972 -> 1.

Exit:
- panel opacity 1 -> 0;
- panel y 0 -> +12;
- panel scale 1 -> 0.982;
- backdrop opacity 1 -> 0.

Target:
- enter ~300–340 ms;
- exit ~220–260 ms.

Rules:
- no animated blur;
- no screenshot compositing;
- close callbacks should not remove the modal before exit completes;
- rapid reopen/close must remain interruptible.

### Dropdowns

Use `AnimatePresence` around the menu surface.

Entrance:
- opacity 0 -> 1;
- y -6 -> 0;
- scale .985 -> 1.

Exit:
- opacity 1 -> 0;
- y 0 -> -4;
- scale 1 -> .99.

Target:
- enter ~220–260 ms;
- exit ~150–190 ms.

Menu rows themselves should not stagger. The dropdown is one surface.

---

## Family 4 — Content / state changes

Use a shared state-presence component based on:

`AnimatePresence mode="wait"`

Applies to:
- Transaction filters;
- Trading Performance timeframe/type;
- Monthly report month/type;
- Cash Deposit/Withdraw;
- Cash history filters;
- Closed Cycle outcome/sort;
- Positions sector filter;
- Ticker Directory sector filter;
- other result-surface replacements.

Choreography:
- outgoing content: opacity 1 -> ~0.35, y 0 -> -6 px;
- incoming content: opacity ~0.35 -> 1, y +8 px -> 0;
- no blur;
- no scale on dense tables;
- no duplicate result trees after exit completes.

Target:
- exit ~160–190 ms;
- enter ~280–330 ms;
- total ~440–520 ms.

The selector itself updates immediately so input feels responsive; the affected result surface then transitions.

### Accordions / conditional sections

For localized content:
- use `AnimatePresence`;
- animate height 0 <-> auto plus opacity;
- optional y of 4 px;
- surrounding content can use Motion `layout` only in that localized component.

Do not use layout animation on full-page wrappers.

---

## Family 5 — Charts / financial data

The current validated chart behavior remains authoritative.

Recharts owns:
- main analytics timeframe interpolation;
- Today <-> daily interpolation;
- secondary Risk & Cost series interpolation.

Current target:
- ~520 ms.

Motion must not remount the chart purely to create animation.

No chart wrapper animation may compete with Recharts.

---

# Shared implementation primitives

## 1. PremiumMotionConfig

A root `MotionConfig` should:
- use `reducedMotion="user"`;
- centralize the default easing curve where practical.

## 2. MotionSwap

Retain the existing component name to minimize component churn, but replace its internals completely.

New implementation:
- `AnimatePresence mode="wait"`;
- keyed `motion.div`;
- no timers;
- no cached React nodes;
- no manual phase state;
- no permanent GPU promotion.

Variants:
- `tab`
- `state`

Optional future variant:
- `subtle`

## 3. PremiumModalPresence

A shared modal presence wrapper should own:
- backdrop;
- panel;
- entrance;
- exit;
- click-away behavior hook points;
- reduced motion.

Existing modal styling classes remain unchanged.

## 4. PremiumDropdownPresence

AnalyticsSelect should use:
- `AnimatePresence`;
- one `motion.div` menu surface;
- exit motion as well as entrance.

## 5. ExpandPresence

Reusable localized expand/collapse primitive:
- height;
- opacity;
- light y offset.

---

# CSS cleanup plan

The stylesheet currently contains several generations of Phase 4 rules.

They include:
- original provisional motion;
- Phase 4.1 perceptibility overrides;
- five-family CSS pass;
- browser View Transition pass;
- recording-driven sequential pass.

This creates a high risk of cascade conflicts.

The reimplementation must add one final authoritative section and then remove/neutralize obsolete lifecycle animation ownership.

CSS should continue to own:
- visual tokens;
- hover/focus/press transitions;
- semantic glow transitions;
- non-lifecycle micro-interactions.

React Motion should own:
- page enter/exit;
- state-result enter/exit;
- modal presence;
- dropdown presence;
- accordion/conditional presence.

No element should have both a CSS `animation` and Motion `initial/animate/exit` for the same lifecycle event.

---

# Component migration order

## Pass A — foundation

1. Rewrite `src/components/PremiumMotion.tsx`.
2. Add root MotionConfig.
3. Neutralize lifecycle CSS that conflicts with Motion.
4. Keep chart CSS/Recharts unchanged.

Acceptance:
- typecheck/tests/build pass;
- tabs visibly transition;
- rapid tab switching cannot show stale content;
- no duplicate page trees.

## Pass B — state/result surfaces

Migrate/validate:
1. Transactions.
2. Trading Performance.
3. Monthly Performance.
4. Cash action/history.
5. Closed Cycles.
6. Positions.
7. Ticker Directory.

Acceptance:
- every state change has one visible result transition;
- no stacked entrance animations;
- rapid repeated filtering resolves to the latest state;
- no blank midpoint frame.

## Pass C — overlays

1. Add shared modal presence primitive.
2. Migrate Add Trade.
3. Edit Transaction.
4. Cash Edit.
5. Sell Position.
6. Edit Position.
7. Quick Cash.
8. Confirm/Delete.
9. Alerts.
10. Sheets.
11. Schema Sync.
12. Backup.
13. Screenshot/OCR.

Acceptance:
- entrance and exit both visible;
- close never snaps;
- no modal remains visually after state closes;
- rapid open/close is interruptible.

## Pass D — dropdowns / localized reveals

1. AnalyticsSelect.
2. Report mode menus.
3. Closed Cycle accordions.
4. BUY/SELL conditional edit sections.
5. contextual Add Trade/DCA panels.

Acceptance:
- dropdown exit exists;
- no menu-row stagger duplicates;
- accordion expands/collapses smoothly;
- surrounding layout movement is localized and stable.

## Pass E — complete motion audit

Sweep for:
- `animate-in`;
- `fade-in`;
- `slide-in-*`;
- `zoom-in`;
- old `premium-*-enter` lifecycle animation;
- timer-driven presence;
- `view-transition-name`;
- duplicate Motion + CSS lifecycle animation;
- unnecessary persistent `will-change`;
- large-surface animated blur/filter.

---

# Device-specific constraints

## Desktop

Can use:
- slightly larger x/y displacement;
- subtle scale on modal/dropdown surfaces.

Must remain responsive during rapid selection.

## Mobile

Prefer:
- smaller displacement;
- opacity + y over scale for large content;
- no whole-page GPU promotion;
- no large blur/filter animation;
- no viewport/screenshot transition APIs.

Timing remains close to desktop so the app still feels like one system.

---

# Validation matrix

## Main navigation

Test rapid sequences:
- Overview -> Positions -> Transactions -> Reports -> Cash -> Overview.
- Repeated two-tab toggling.
- Switching while scrolled.

Reject if:
- old tab flashes back;
- screen blanks;
- two pages are readable simultaneously;
- vertical scroll jumps because of animation.

## Result filters

Rapidly test:
- Transactions ALL/WIN/LOSS/OPEN/BUY/SELL.
- Trading Performance All Time/YTD/90D/30D and trade type.
- Monthly month/status.
- Cash action/history.
- Closed Cycle outcome/sort.
- Positions/Directory sector.

Reject if:
- selector and result disagree after transition;
- stale intermediate state appears;
- result content snaps with no motion;
- nested cards independently replay a page entrance.

## Overlays

Repeatedly open/close:
- Add Trade.
- Edit Transaction.
- Sell.
- Edit Position.
- Quick Cash.
- Alerts.
- Delete confirmations.

Reject if:
- exit is missing;
- backdrop disappears before panel;
- panel remains after backdrop;
- fast reopen creates duplicate modal surfaces.

## Charts

Regression-test:
- Today <-> 1W/1M/3M.
- Today secondary charts.
- report chart mode/timeframe.

Reject if the current validated Recharts transition changes.

---

## Choreography refinement after second recording review

Fresh phone + desktop recordings of the first v3 implementation showed that the architecture was stable but the choreography still felt discontinuous:

- `AnimatePresence mode="wait"` created a perceptual hard cut between outgoing and incoming tab/result trees.
- result height/layout changes occurred as a separate event after opacity motion;
- dropdowns were too fast and read as pop-in surfaces;
- modal entrance movement was too subtle for the panel size;
- transitions into **1W** remained asymmetric because Recharts was morphing between very different point counts and coordinate domains.

The refinement pass therefore changes choreography without reintroducing snapshot/timer systems:

- tabs and result swaps use **controlled real-DOM overlap with `mode="popLayout"`**;
- result shells use Motion layout-size interpolation with measurements scoped by `layoutDependency`;
- tab entrance/exit uses more visible horizontal displacement with a short overlap;
- dropdowns use ~360 ms entrance / ~240 ms exit with a larger anchored transform;
- modal panels use ~420 ms entrance / ~300 ms exit with more legible y/scale displacement;
- ordinary chart timeframe changes remain Recharts-owned;
- **Rejected experiment:** crossing to/from 1W via whole-chart crossfade was tested and rolled back because it degraded the approved Recharts morphing across the complete analytics family.
- Current chart rule: preserve native Recharts interpolation for every timeframe.
- 1W uses the same native Recharts morph as every other timeframe. The only special case is restoring the pre-v2 320 ms duration when entering/leaving 1W; normal timeframe transitions remain at the current 520 ms. The rejected date-matching/crossfade experiments are removed.

This remains presentation-only: chart observations/data are unchanged; the special 1W handling changes only how two real chart states are visually handed off.

---

## Implementation status

Implemented:
- Pass A foundation: MotionConfig + AnimatePresence-based MotionSwap.
- Pass B result surfaces: Transactions, Trading Performance, Monthly, Cash, Closed Cycles, Positions, and Directory use keyed Motion presence.
- Pass C overlays: premium modal families use shared real-DOM enter/exit presence.
- Pass D dropdowns/localized reveals: AnalyticsSelect, ticker suggestions, analytics mode menu, accordions, conditional panels, and feedback surfaces use Motion presence.
- Pass E cleanup: obsolete browser snapshot/timer-era lifecycle CSS removed; active React source has no retired lifecycle classes/APIs.

Validation:
- Repository typecheck/tests/build must remain green.
- Phase 4 remains open until fresh phone + desktop visual validation confirms the v3 choreography.

---

# Completion definition

Phase 4 is not complete until:

- all five families are represented by one coherent implementation;
- Motion for React owns lifecycle presence;
- browser snapshot transitions are absent from app content;
- timer-driven MotionSwap is removed;
- tabs and filters use controlled overlap + layout continuity and are visibly animated but smooth;
- modal exits are consistent;
- dropdowns animate in and out;
- accordions animate both directions;
- charts retain validated interpolation;
- phone and desktop recordings show no duplicates, blank frames, stale flashes, or jitter;
- Quality Checks pass;
- this plan and the implementation log are updated with final representative commits.
