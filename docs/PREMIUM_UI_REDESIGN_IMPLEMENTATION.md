# Premium UI Redesign Implementation Log

## Purpose

This document records what has actually been implemented for the EGX Portfolio premium UI redesign on **feature/premium-ui-redesign**.

- **Plan:** intended scope, boundaries, phases, and acceptance criteria.
- **Implementation log:** actual changes, validation findings, representative commits, provisional work, and exceptions/restorations.

Repository: **sherif007-noob/EGX-Portfolio**  
Branch: **feature/premium-ui-redesign**  
Baseline: **ce142a0**  
Pull request: **#27 — Premium UI redesign foundation**

## Strict visual-only rule

This branch must not intentionally modify portfolio accounting, analytics calculations, transaction semantics, persistence, schemas, market-data rules, or business logic.

A redesign-caused regression may be restored so an existing interaction remains usable, but unrelated functional work belongs outside this visual-redesign branch.

## Status

| Phase | Status | Notes |
| --- | --- | --- |
| 1 | Complete | Premium foundations/page shell established. |
| 2 | Complete | Core glass surfaces/shared primitives established. |
| 3 | Complete / validating | Full component migration performed. |
| 3.2 | Complete / validating | Completeness sweep, selectors, modal parity, overlays. |
| 3.3 | Complete / validating | Semantic glows, report hierarchy, control-color consistency. |
| 4 | **In progress** | v3 Motion-for-React lifecycle rebuild implemented; awaiting phone/desktop visual validation. |
| 5–11 | Not started | See plan. |

## Phase 1 — Foundations

Representative commits:

- **9f6ffca** — add premium visual system foundations
- **b8ff431** — apply premium page shell

Implemented:
- Premium page canvas and global visual language.
- Shared glass/elevation tokens and CSS primitives.
- Base motion variables and reduced-motion foundations.
- Reusable surface hierarchy.

## Phase 2 — Core surfaces and primitives

Representative commits:

- **909cbce** — premium glass header and navigation
- **50fddad** — elevate portfolio summary surfaces
- **54b1893** — premium shared dropdown surfaces
- **64b794b** — premium analytics floating surfaces
- **4c64cf7** — add premium panel/modal/table primitives
- **d5c25ea** — premium positions surfaces and controls
- **e589666** — elevate unified analytics surface
- **8d29137** — elevate realized trajectory panel
- **5b37fa9** — premium performance report surfaces

Implemented:
- Header/navigation glass.
- Portfolio hero/summary surfaces.
- Shared floating/dropdown system.
- Panel/modal/field/inset/table hierarchy.
- Positions and primary analytics integration.

## Phase 3 — Full component migration

Representative commits:

- **298f1e4** — premium Journal surfaces
- **e815f36** — premium Closed Cycle surfaces
- **b7ef9dc** — premium Cash Ledger surfaces
- **e311a61** — premium shared number fields
- **f9776ba** — premium shared date field
- **09ede5a** — premium Ticker Directory surfaces
- **4ad5b41** — premium Add Trade modal
- **5e9243a** — premium Sell modal
- **88cc3e4** — premium Edit Position modal
- **ca5522d** — premium Quick Cash modal
- **cebf3fd** — Backup modal glass surfaces
- **2c7b62e** — Sheets glass surfaces
- **2330807** — Schema Sync glass surfaces

Coverage:
- Overview, Positions, Closed Cycles.
- Transactions / Trading Journal.
- Cash Ledger.
- Add Trade, Sell, Edit Position, Quick Cash, Edit Transaction, cash edit, confirmation flows.
- Reports, Trading Performance, Monthly Performance, Realized P&L.
- Ticker Directory, Price Alerts, Backup, Google Sheets, Schema Sync, OCR/screenshot import, PWA/error states.
- Shared date/numeric controls.

## Phase 3.2 — Completeness and control-system sweep

Representative commits:

- **36c36e9** — add Phase 3 completeness primitives
- **a43d5f5** — complete Transactions styling and portal editor
- **1283db3** — complete Cash Ledger controls and portal editor
- **2d515a1** — complete Add Trade premium styling
- **a4208f2** — complete Positions action styling
- **68e3aae** — complete Closed Cycles controls
- **2dec071** — complete Directory action styling
- **23d4392** — unify Header command buttons
- **e181955** — unify app-level actions/toasts
- **9a93790** — finalize shared premium control primitives
- **502625b** — finish Cash Ledger migration
- **5dbfe29** — finish Transaction Journal migration
- **89d041b** — finish Add Trade form styling
- **0e96b40** — finish Header migration
- **a9c1d25** — finish Positions table migration

User-validation refinements:
- Default selector language changed to the segmented style inspired by Realized P&L and Portfolio Allocation.
- Cash Deposit/Withdraw and cash-history filters standardized.
- Transaction ALL/OPEN/WIN/LOSS/BUY/SELL filters standardized.
- Performance timeframe and Monthly month selectors revised.
- Selected-state hover bug fixed.
- Edit/Delete actions standardized.
- Transaction/cash edit modals use body portals to remain viewport-focused.
- Add Trade and Edit Transaction hierarchy aligned.
- Report KPI cards moved to hero-card hierarchy.
- Dropdown stacking raised above report/month content.
- Notes surfaces corrected so text is not visually buried beneath glass.
- Execution Time visually aligned with DateInput while preserving native time-value behavior.

Representative validation commits:

- **1686e36** — unify selector and report hero language
- **aa4daa9** — repair Journal selectors/pagination presentation/edit modal
- **2b503a8** — align Performance selectors and hero metrics
- **a0ae79e** — align Monthly selectors and hero cards
- **455f13c** — finalize cash selector/modal parity
- **34ff893** — finalize Journal edit-modal parity
- **68b2bff** — validation cleanup

### Behavior-preservation note

During visual validation, Journal **Show → All** was corrected because the visible “All” option was internally capped at 1000 rows. This was treated as restoration of the interaction exposed by the existing UI, not as a new product feature. Further unrelated behavior changes must not be added to this branch.

## Phase 3.3 — Semantic polish and final consistency

Representative commits:

- **c13e1b9** — semantic report glow primitives
- **3d89d1b** — semantic report summary KPI glows
- **34d201a** — institutional-performance KPI semantics
- **835af8d** — Monthly Performance semantic glow
- **d5683ea** — Realized Trajectory net-P&L glow
- **b9709cf** — true blur glass and visible edge glow
- **7b97455** and related commits — unified frosted dropdown treatment
- **e1bb855** — dropdown fixes and semantic state glows
- **63197a9** — Transaction glow mapped to outcome
- **3a32e1c** — Closed Cycle glow mapped to realized outcome
- **5bf073a** — open-position glow mapped to unrealized P&L
- **5c83497** — portfolio hero mapped to daily state
- **95336e4** — realized/unrealized KPI glow
- **2c86365** — semantic Today analytics curve

Latest user-driven polish:

- **1b23bc0** — align semantic button/selector/dropdown colors
- **d5b6895** — semantic frosted dropdown hover states
- **12d4e66** — match execution-time control to DateInput
- **1ea1595** — finish Edit Transaction modal visual parity
- **492cfe0** — shared selector language in Edit Transaction
- **d4a9785** — carry dropdown accent into select trigger
- **0fe18fa** — keep dropdown trigger accents semantically consistent

Established rules:
- Neutral buttons remain neutral on hover.
- Semantic buttons glow only in their own color family.
- Icon color cannot force an unrelated button glow.
- Selected selector glow derives from the selected semantic color.
- Non-selected dropdown hover uses a frosted accent wash; selected rows remain distinct.
- Date/time controls belong to the same visual family.

## Phase 4 — Motion: accepted five-family implementation

Phase 4 was originally started before Phase 3 completeness was fully validated, then paused. The provisional motion was noticeable, but user validation identified four problems:

1. Motion was generally **too fast**.
2. Motion coverage was incomplete/inconsistent across the application.
3. The analytics transition to/from **Today** no longer matched the smooth transition between other timeframes after the provisional chart-stage remount was introduced.
4. Secondary analytics charts explicitly disabled animation for intraday/Today, so their Today curve behavior differed from daily timeframes.

The accepted implementation now uses five motion families:

1. **Navigation / page context**
2. **Interactive controls**
3. **Overlays**
4. **Content / state changes**
5. **Charts / financial data visualization**

Existing provisional Phase 4 commits remain useful historical context, including:

- **9443028** — initial Phase 4 motion system
- **f2f3781** — analytics tooltip entrance
- **e79c52b** — dropdown micro-interactions
- **a748dbb** — analytics controls/timeframes
- **7d1223a** — menu/select motion
- **9735c6c** — Closed Cycle accordion
- **aba7bcc** — cash action switching
- **15dc243** — allocation segmented controls
- **8fa209a** — realized-chart mode switcher
- modal-motion commits for delete, screenshot, alerts, Schema Sync, Sheets, and Backup
- **b8bb158** — main-tab transitions
- **b146767** — stronger provisional motion
- **d9eea80**, **68951ad**, **9d4c181**, **3c107b0** — report/month/chart motion work
- **cdfa147** — later Phase 3/3.2 overrides that also altered motion timing

### Current accepted Phase 4 implementation

Representative commits:

- **87a9053** — establish five-family Phase 4 motion system
- **358e3f9** — restore unified analytics timeframe interpolation
- **b4dcf91** — unify Today secondary-chart transitions
- **1abaf0e** — animate allocation state transitions
- **a4db661** — animate Trading Performance filter-result changes
- **375dde6** — animate Monthly report state changes
- **f2ae057** — scope Edit Transaction BUY/SELL state motion correctly
- **06ded20** — normalize surface response timing
- **44d2820** — align Journal feedback with content-family motion
- **c53fb17** — align Cash feedback with content-family motion
- **9417325** — animate Add Trade contextual state

Canonical timing after user validation and full motion audit:
- Controls: ~320 ms
- Selectors: ~420 ms
- Dropdowns/overlays: ~480 ms
- Modals: ~560 ms
- Content/state/result changes: ~520 ms
- Main navigation/context: ~560 ms
- Charts: ~520 ms
- Tooltips: ~220 ms

### Analytics transition correction

The provisional **9d4c181** change keyed/remounted the main analytics plot on every timeframe/mode change and added an outer chart-stage animation. That disrupted the previously smooth Today <-> daily interpolation.

The accepted correction:
- Keeps one main chart instance across timeframe changes.
- Lets Recharts interpolate the data-series change directly.
- Slows the primary/secondary series animation to ~520 ms.
- Enables the same animation for intraday/Today secondary charts instead of disabling it with `isAnimationActive={!intraday}`.

This is presentation-only: it does not modify analytics observations, calculations, timeframe resolution, market data, or financial semantics.

### Full motion audit correction

User validation of the first accepted Phase 4 pass found:
- general control/overlay timing still felt too fast;
- Trading Performance filters felt even faster than the surrounding motion;
- tabs animated the incoming page but had no visible outgoing transition;
- Transaction filters changed results with no transition;
- Edit Transaction entered correctly but disappeared instantly on close.

The audit changed the architecture from entrance-only animation to coordinated old -> new / exit transitions.

Representative audit commits:
- **aec8fe3** — shared visual-transition coordinator
- **1419389** — true outgoing-to-incoming tab transitions
- **ca0b21b** — outgoing transitions + slower canonical cadence
- **0aeac2b** — true Trading Performance filter transitions
- **39f1de4**, **aa9a022** — Transaction filter/result transition and modal-exit work
- **71f71e3** — unified premium modal snapshot exit
- **fa73eef** — Edit Transaction exit unified with overlay family
- **d43bf85** — Cash Edit modal exit
- modal-exit coverage added across Add Trade, Sell, Edit Position, Quick Cash, confirmation, Alerts, Sheets, Schema Sync, Backup, and Screenshot flows
- **ccc39e1** — Cash action/history result transitions
- **972c170** — Closed Cycle result transitions
- **dca8e2d** — Monthly report result transitions
- **e0bba21** — Open Positions sector-result transition
- **6b6b728** — Ticker Directory sector-result transition
- **16692d3**, **140bf5d**, **70231d2** and related commits — remove legacy fast local durations and normalize helper motion
- **e0e33e9** — flush React state before native transition snapshots for deterministic old/new capture

### Coverage implemented so far

- Family 1: active navigation plus genuine outgoing -> incoming main-tab transitions.
- Family 2: shared actions, icon actions, selectors, controls, dropdown triggers, accordion triggers, form fields, chevrons, and toggles use audited timing.
- Family 3: dropdown/menu entrances, modal entrances, modal backdrops, and premium modal exits.
- Family 4: Cash Deposit/Withdraw, Cash history, Closed Cycle filters, Transaction filters, Edit Transaction BUY/SELL sections, allocation state changes, Trading Performance filters, Monthly filters, Positions sector filters, Directory sector filters, feedback/state banners, and accordion reveals.
- Family 5: primary unified analytics chart and all secondary Risk & Cost chart series.



### Screen-recording deep audit — mobile + desktop

Two real recordings were reviewed frame-by-frame after the audit pass:

- iPhone/mobile recording: ~71.4 s at ~55.8 fps, 1320×2868.
- Desktop Chrome recording: ~50.3 s at 24 fps, 1920×1200.

The recordings exposed problems that were not obvious from static code review:

- Browser View Transition snapshots painted old and new application trees simultaneously, producing visible duplicate cards, duplicated report headings, ghosted controls, and stale content overlays.
- Several tab/filter changes contained near-empty midpoint frames because the outgoing snapshot faded before the incoming snapshot became readable.
- Snapshot geometry interpolation interacted badly with long responsive pages and current scroll position, producing apparent jumps/crops on phone.
- A large tab wrapper was permanently promoted with `will-change` / `translateZ(0)`, forcing expensive raster/compositor work over very tall mobile pages.
- Nested/legacy entrance animations could replay inside a parent transition, making a single state change look like several unrelated appearances.
- Rapid repeated state changes could complete one animation while a newer request was pending, allowing an older cached tree to flash back before the next transition began.
- Modal exits were inconsistent: some used presence, some instant unmount, and some retained legacy exit classes.

#### Recording-driven correction — historical, superseded by v3

The accepted architecture is now **single-tree sequential motion**:

`current tree exits in place -> React swaps once -> latest requested tree enters`

No app-content transition uses browser full-page snapshots.

Implementation:
- **943ff47 / 9ef1e28 / 619275d** — retire snapshot-based app-content transitions and introduce deterministic motion primitives.
- **9f22b49** — deterministic tab exit/swap/enter.
- **8a2e48f** — duplicate-free Transaction filter swaps.
- **7f27137** — Trading Performance transitions one stable result tree.
- **e366256** — Monthly report swaps one stable tree.
- **368041c / cc0f827 / 9bac54c / 973504c** — stabilize Closed Cycles, Positions, Directory, and Cash result swaps.
- **963a1c6** — make the MotionSwap state machine resilient to rapid repeated state changes so an older tree cannot flash back.
- **a6767d2** — reduce midpoint disappearance, remove permanent whole-page GPU promotion, reduce mobile displacement, and fully neutralize retired `view-transition-name` behavior.
- **22a3eef** — unify modal exit behavior without snapshot compositing; presence-aware overlays keep their React exit, legacy overlays receive a short DOM exit before their normal close callback.
- **f981a5e / b39fdbf** — repair MotionSwap wrapper markup found by CI during the recording-driven rewrite.

The revised transition midpoint intentionally remains partially visible instead of fading near zero:
- tabs meet around ~46–52% opacity;
- state/result changes meet around ~58–62% opacity.

This masks the single React swap without creating duplicate layers or a blank flash.

The chart family remains unchanged because the user had already validated Today <-> daily main/secondary chart interpolation as correct.


### Phase 4 v3 — Motion for React reimplementation

After the recording-driven stability rewrite removed ghosting/duplication, user validation found that the timer-based sequential system had over-corrected: major transitions became too subtle and often read as plain state replacement.

A dedicated implementation plan was created first:

- **680c6f2** — add `docs/PHASE4_MOTION_REIMPLEMENTATION_PLAN.md`

The v3 architecture makes **Motion for React** (`motion@12.23.24`) the sole lifecycle orchestration layer.

Core rules:
- `AnimatePresence mode="wait"` owns main tab and keyed result replacement.
- Real DOM nodes remain mounted for exit; no browser View Transition screenshots.
- No timer-driven cached React trees.
- `MotionConfig reducedMotion="user"` honors accessibility preferences.
- CSS owns hover/focus/press/semantic transitions only.
- Recharts remains the sole owner of analytics-series interpolation.
- Each interaction has one lifecycle-motion owner.

Representative implementation commits:
- **8a79c5a** — add root Motion accessibility configuration.
- **2afb3b5** — rebuild `MotionSwap` and shared presence primitives on Motion for React.
- **ec8c619** — make Motion authoritative over lifecycle CSS.
- **1da5852**, **cbcad89**, **fd06213** — migrate Add Trade, Quick Cash, and confirmation overlays.
- **a87f265** — add bidirectional Motion presence to shared AnalyticsSelect dropdowns.
- **ed26181** — add bidirectional accordion presence to Closed Cycles.
- **221aae3**, **70f9044** — migrate Edit/Sell Position with retained visual data during exit.
- **05f8262**, **2eb1cd5**, **20e8dc1**, **bb86319**, **b131138** — migrate Alerts, Sheets, Schema Sync, Backup, and Screenshot overlays.
- **9c8f0da**, **a4b5d7c** — animate modal-internal tab/result changes.
- **00e08a3**, **76081fd** — migrate Transaction/Cash inline editors to Motion presence.
- **f848399** — physically remove obsolete snapshot/timer-era Phase 4 lifecycle CSS systems.
- **6ac6041** — add canonical shared dropdown presence and remove the compatibility presence hook.
- **20f6b29** — remove legacy DOM-query/timer transition orchestration; state updates are immediate and Motion owns presentation lifecycle.
- **5cfe67e**, **dcf709e** — migrate ticker suggestions and analytics mode menu to Motion dropdown presence.
- **5429959** and related commits — remove historical page-entry classes from active React code.

Repository-wide v3 audit result:
- zero React usages of `premium-section-enter`;
- zero React usages of `premium-content-swap`;
- zero React usages of `premium-reveal`;
- zero React usages of the retired `useMotionPresence` hook;
- zero React browser View Transition calls;
- zero React legacy modal-exit classes.

Current v3 choreography:
- tabs: ~220 ms exit + ~380 ms enter;
- result/state swaps: ~180 ms exit + ~310 ms enter;
- modal: ~330 ms enter / ~240 ms exit;
- dropdown: ~240 ms enter / ~170 ms exit;
- localized surfaces: ~260 ms enter / ~180 ms exit;
- charts: validated ~520 ms Recharts interpolation, unchanged.

### Phase 4 v3 choreography refinement

A second phone/desktop recording review found the Motion architecture safe but not yet visually smooth enough. Main findings:
- `mode="wait"` produced a visible old-tree exit -> replacement -> new-tree entrance cut;
- result-surface height changes were not visually integrated with presence;
- dropdowns were too fast;
- modal entrances were too subtle relative to their size;
- the 1W chart transition remained noticeably less smooth than other ranges because the short weekly daily series has a much smaller point count/domain than Today/monthly ranges.

Implemented corrections:
- **b021260** — switch tab/result presence to `mode="popLayout"`, add controlled overlap, and animate state-result container size;
- **744c9cf / 6d80ac5** — centralize all dropdown timing and move AnalyticsSelect onto the shared slower dropdown presence;
- **f71e742 / 31049e6** — introduce 1W chart-boundary crossfade and secondary-chart parity;
- **1167b25 / 736ae04** — isolate SVG gradient definitions while old/new weekly-boundary charts overlap;
- **f597b66** — scope layout measurement to actual result-key changes;
- **8beffa9** — align canonical motion tokens to the choreography pass.

Current choreography targets:
- tabs: ~280 ms outgoing with ~440 ms incoming and a short controlled overlap;
- state/results: ~220 ms outgoing with ~360 ms incoming plus layout-size interpolation;
- dropdowns: ~360 ms in / ~240 ms out;
- modal panels: ~420 ms in / ~300 ms out;
- normal analytics timeframes: validated Recharts ~520 ms interpolation;
- 1W boundary: localized chart-system crossfade (~460 ms in / ~280 ms out) with inner series interpolation suppressed only during the boundary.

The 1W correction does **not** resample or invent intermediate financial data. Old and new real chart states are handed off visually as complete coordinate systems.

### Analytics chart rollback after choreography pass

The first choreography implementation attempted to special-case transitions crossing **1W** by crossfading complete chart coordinate systems. User validation immediately rejected this because it replaced the previously approved native Recharts curve morph with a generic fade and degraded **all analytics chart transitions** perceptually.

That approach is fully rolled back.

Rollback commits:
- **87bda85** — restore native primary analytics chart interpolation.
- **4938913** — restore native secondary analytics chart interpolation.

Current rule:
- all timeframe transitions again use the original continuous Recharts series interpolation at ~520 ms;
- no chart-level Motion fade/crossfade wrapper;
- no suppression of Recharts series animation;
- no alternate chart lifecycle system;
- the remaining **1W-only smoothness issue** is tracked separately and must be solved without changing the already-approved transitions for the other timeframes.

Phase 4 remains **in progress** pending fresh phone + desktop validation of the non-chart choreography and a separate surgical 1W investigation.


### 1W regression root cause — preserve the complete outgoing curve

The follow-up recording provided the decisive comparison:

- **Today -> 1M** is smooth because 1M has enough target points that Recharts preserves a detailed approximation of the outgoing Today curve during the first animation frame.
- **Today -> 1W** is not smooth because 1W has only a handful of daily points. Recharts' normal matching reduces the complete outgoing curve to that tiny target point count before interpolation begins. The first visible frame therefore loses most of the outgoing shape and becomes a broad simplified hill.

This explains why fixing only X placement improved the right-quarter artifact but did not make 1W feel like Today <-> 1M.

The final correction stays inside the existing mounted Recharts Area/Line lifecycle:

- 1W crossings use key matching only to retain **all previous and next rendered points** for the transition calculation;
- the custom `animationInterpolateFn` reconstructs the complete outgoing and incoming profiles;
- both profiles are transition-only sampled to at least 24 points (capped at 96);
- source and target Y geometry are sampled across normalized chart width;
- Today source/target geometry uses linear sampling;
- daily source/target geometry uses a cardinal spline matching the chart's 0.55 tension;
- intermediate X coordinates span the complete target plot from the first frame;
- at animation completion Recharts returns the untouched real target dataset;
- final 1W points, calculations, tooltips, axes, and financial observations are unchanged;
- ordinary non-1W transitions remain on the default Recharts interpolation path;
- secondary analytics were restored to their already-approved native interpolation until the main 1W behavior is visually approved.

Representative commits:
- **f9c5852** — preserve complete previous/next profiles and add curve-aware transition sampling.
- **6f850de** — use the full-profile interpolator only for main-chart 1W crossings.
- **e7825cf** — restore secondary analytics to approved native interpolation.

Quality Checks #502 passed typecheck, tests, and production build for the final implementation.

### Desktop motion-performance optimization

Phone validation was smooth while desktop/PC showed frame stutter during tab and state transitions. Code audit identified desktop-specific render cost rather than a need to weaken the choreography:

- desktop state/result swaps were using Motion `layout="size"` plus child `layout="position"` across large tables/reports;
- main tab transitions briefly render old/new heavy desktop trees together;
- tiny whole-page scale transforms forced raster resampling of large glass-heavy pages;
- controls still carried persistent `will-change: transform` hints from older passes;
- moving result trees applied blanket `backface-visibility: hidden` to nested tables/cards/panels, encouraging unnecessary compositor layers.

The optimization preserves the visible Phase 4 motion while lowering desktop cost:

- desktop is detected with `(min-width: 1024px) and (hover: hover) and (pointer: fine)`;
- phone/tablet behavior is unchanged;
- desktop state/result swaps keep the same opacity/y enter-exit choreography but disable Motion layout projection;
- desktop main tabs keep the same opacity/x/y choreography but remove the nearly invisible scale component to avoid full-page raster resampling;
- persistent per-control `will-change` is removed;
- blanket nested `backface-visibility` promotion is removed;
- Motion shells use `contain: layout style` to reduce layout/style invalidation without clipping glass/shadows;
- ordinary row hover motion remains intact.

Representative commits:
- **324498a** — reduce desktop Motion layout/raster cost.
- **7364d4d** — reduce compositor pressure and remove persistent layer hints.
- **cfa29d9** — preserve row hover motion after compositor cleanup.

The analytics chart implementation, including the approved 1W full-profile fix, is not changed by this performance pass.

### Heavy-tab desktop scheduling and paint deferral

Follow-up desktop testing showed the remaining stutter was strongest when entering tabs with large synchronous render/paint cost, especially Overview/Open Positions/Reports.

A second PC-only optimization layer was added without changing visible transition timing:

- desktop tab selection is wrapped in `React.startTransition`, allowing React to render the heavy incoming tree as concurrent work rather than monopolizing the main thread immediately;
- phone/tablet tab updates remain immediate and unchanged;
- desktop `.premium-table-shell` and `.premium-report-table` surfaces use `content-visibility: auto` so off-screen heavy tables are not fully rasterized while the incoming tab animates;
- `contain-intrinsic-size` supplies stable placeholder geometry and remembers real dimensions after layout;
- layout/style containment is applied to heavy table/report surfaces to reduce invalidation spread.

Representative commits:
- **2289337** — schedule heavy desktop tab mounts concurrently.
- **ee95f08** — add off-screen desktop table/report paint deferral.
- **2c0018d** — scope paint containment to table surfaces only so floating dropdown/report-glass overflow remains unaffected.

The transition choreography, chart interpolation, phone behavior, and row/control micro-interactions are unchanged.

Phase 4 remains **in progress** pending desktop visual/performance validation.

## Current validated visual rules

- Realized P&L / Portfolio Allocation segmented language is the default selector family.
- Add Trade / Open Position primary actions remain intentionally distinct.
- Hero cards outrank secondary/inset cards.
- Reports use the same hierarchy as dashboard cards.
- Dropdowns are true overlays.
- Selected selector state is immediately visible, including while hovered.
- Button/selector glow matches semantic color.
- Modal families share shell, grouping, fields, actions, and close-control language.
- Phase 4 follows the approved five-family motion system; new motion must map to one of those families.

## Quality / CI

The branch uses **.github/workflows/quality.yml** (“Quality Checks”).

Every visual phase should continue to pass the repository’s existing typecheck/tests/build gates. Phase 11 performs the final dedicated regression, accessibility, and performance audit.

## Updating this log

When a phase is completed:

1. Update the status table.
2. Summarize actual implementation, not only intended scope.
3. Add representative commit SHAs.
4. Record any approved visual-only exception/restoration.
5. Record user-validation findings that changed implementation.
6. Do not mark a phase complete until the plan acceptance criteria are met.
