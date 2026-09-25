# Phase 7 — Charts Final Visual System Plan

**Status: IN PROGRESS — Passes 7.1, 7.2, and 7.3 device-accepted; Pass 7.4 Portfolio Allocation implemented, validation pending.**

Phase 7 brings every chart visualization into one final premium EGX Portfolio chart system without changing financial calculations, market-data selection, timeframe semantics, or accepted chart geometry.

The governing visual reference remains `docs/ANALYTICS_VISUAL_SYSTEM.md`. This document is the execution plan for Phase 7.

---

## 1. Goal

Make charts feel native to the premium application rather than like Recharts content placed inside premium cards.

The finished chart system must have:
- one plot-surface language;
- one axis/grid language;
- one tooltip/crosshair language;
- one active-point language;
- consistent semantic financial colors;
- consistent EGP/% formatting;
- deliberate loading and empty states;
- coherent phone/tablet/desktop density;
- no default white/chart-library presentation;
- no visual treatment that changes the financial observations being shown.

---

## 2. Hard boundaries

Phase 7 is presentation-first.

Do **not** change:
- portfolio accounting;
- unified analytics calculations;
- TWR/MWR formulas;
- historical/intraday price reconstruction;
- Today 1m/5m/15m/1h selection or fallback policy;
- timeframe definitions/windows;
- ticker resolution or market-data ingestion;
- exclusion/inclusion of incomplete valuation points;
- transaction activity logic in primary tooltips;
- current chart observations or their ordering;
- the accepted Today rule: intraday observations remain linear/unsmoothed;
- the accepted longer-range smoothing behavior;
- the special 1W transition interpolation/matching implementation;
- primary/secondary `syncId` behavior;
- current series entrance/morph timing unless a regression requires restoration;
- **Realized trajectory trade markers are data-bearing observations, not decoration:** every closed trade point must remain visibly represented in cumulative trajectory mode. Phase 7 must not hide, sample, thin, or replace those trade markers with a generic markerless line. WIN / LOSS / BREAKEVEN identity and the inception marker remain explicit and individually inspectable.

The current phone tab/page transition debt belongs to later motion/QA work and is not part of Phase 7.

Phase 8 still owns global information hierarchy outside chart-specific composition.  
Phase 9 still owns final Header work.  
Phase 10 still owns the final all-component consistency sweep.  
Phase 11 still owns final performance/accessibility/browser regression.

---

## 3. Current chart inventory

The branch currently contains **7 actual chart visualizations** across 4 chart-owning components.

| # | Visualization | Component | Current form | Semantic role |
| --- | --- | --- | --- | --- |
| 1 | Unified Portfolio Analytics | `charts/PerformanceTimeframeChart.tsx` | Area + optional comparison line | Primary portfolio/performance chart |
| 2 | Performance Drawdown | `charts/SecondaryAnalyticsCharts.tsx` | Area | Risk |
| 3 | Cumulative Fees | `charts/SecondaryAnalyticsCharts.tsx` | Step area | Cost |
| 4 | Realized vs Unrealized P&L | `charts/SecondaryAnalyticsCharts.tsx` | Dual line | P&L composition |
| 5 | Realized P&L Cumulative Trajectory | `RealizedTrajectoryChart.tsx` | Area + trade markers | Closed-trade trajectory |
| 6 | Realized P&L Trade-by-Trade | `RealizedTrajectoryChart.tsx` | Bar | Individual closed-trade outcome |
| 7 | Portfolio Allocation | `PerformanceReports.tsx` | Donut/pie | Concentration / composition |

The Portfolio Equity Bridge is an analytical card sequence, not a chart visualization. It remains outside the Phase 7 chart rewrite except for incidental spacing compatibility; its hierarchy belongs to later hierarchy/consistency work.

---

## 4. Existing strengths to preserve

The branch already has a real chart foundation in `charts/AnalyticsChartTheme.tsx`:
- shared dark chart colors;
- shared grid/axis props;
- shared cyan crosshair;
- `ChartTooltipShell`;
- `AnalyticsChartTooltip`;
- shared loading/empty states;
- EGP/percent/compact-axis formatters;
- a defensive dark Recharts fallback theme.

Existing behavior worth preserving:
- primary and secondary analytics share `syncId="portfolio-secondary-analytics"`;
- Today paths are linear;
- longer-range paths use the current restrained interpolation;
- cumulative fees use `stepAfter`;
- primary Today semantic stroke reflects positive/negative/breakeven state;
- active dots already use dark outlines for contrast;
- allocation segments already support hover emphasis;
- responsive chart containers already debounce resize in the primary/secondary analytics;
- tooltips are custom/dark rather than Recharts defaults.

Phase 7 should evolve these foundations instead of replacing them with another parallel system.

---

## 5. Audit findings / visual debt

### Shared system
- `AnalyticsChartTheme.tsx` is currently mostly a palette + base props file, not yet a complete chart UI system.
- Plot backgrounds are largely inherited directly from outer cards; there is no canonical inner plot surface.
- Gradient recipes, active-dot sizes, margins, animation values, and semantic series styling are still repeated locally.
- Some chart formatting remains duplicated outside the shared formatters.

### Primary analytics
- The main chart has the richest behavior but its plot is visually less structured than the surrounding premium card.
- Mode header, headline metric, Today resolution, timeframe rail, plot, and data-quality footer do not yet read as one intentional chart composition.
- The custom primary tooltip is information-rich but visually separate from the generic chart-tooltip grammar.
- Primary/secondary series hierarchy can be clearer without changing line geometry.
- Mobile plot density and axes can be tuned further without changing data.

### Secondary analytics
- Drawdown, Fees, and Realized/Unrealized correctly share a timeline but still look like three locally styled Recharts implementations.
- Their headers/summary metrics and plots need one repeatable mini-chart anatomy.
- Series legends and active-point presentation are implicit rather than systematized.
- The shared crosshair is already correct and should remain synchronized.

### Realized trajectory
- Cumulative and Trade-by-Trade modes share a card but use separate hand-built tooltip/axis conventions.
- EGP formatting is duplicated instead of consistently consuming the chart formatting layer.
- Trade outcome markers are **required data-bearing points** and should become a deliberate win/loss/breakeven chart primitive. One visible marker must remain for every trajectory trade observation; marker reduction/sampling is not allowed.
- Axis compact-format behavior should match the rest of analytics.

### Allocation donut
- It uses a standalone `COLORS` array instead of a named chart palette contract.
- Hover/dimming is already useful but needs touch/reduced-motion parity and a final active-segment language.
- Tooltip presentation is custom and should align with the common chart shell.
- Center summary, chart, and concentration list should read as one visualization instead of adjacent widgets.

---

## 6. Final chart visual contract

### Plot surface
Every Cartesian chart gets a shared inner plot treatment:
- dark transparent/inset surface;
- restrained inner border/highlight;
- no hover lift on the plot itself;
- no heavy glass refraction over dense data;
- consistent plot padding/margins;
- clipping that never cuts active dots/tooltips.

### Grid and axes
- horizontal grid remains subtle;
- axis lines/ticks stay slate and visually subordinate to data;
- zero/reference lines are visually distinct from normal grid lines;
- EGP compact ticks use the shared formatter;
- percentage ticks use consistent precision rules;
- phone axes reduce noise before reducing readability.

### Series hierarchy
- primary data series is strongest;
- comparisons are thinner/dashed/subordinate;
- positive = emerald;
- negative/risk = rose;
- live/informational = cyan;
- comparison/deposits = purple/blue;
- fees/cost = amber;
- neutral/breakeven = slate/amber as appropriate;
- gradients remain restrained and never overpower lines.

### Active point / crosshair
- one active-point grammar: colored core, dark separation ring, restrained glow;
- trajectory trade markers are a separate persistent-marker grammar: every trade stays visible even when it is not the active point;
- crosshair remains thin/dashed cyan;
- synchronized charts keep aligned crosshair behavior;
- inactive series must not visually compete with the active series.

### Tooltips
All chart tooltips share:
- the same floating glass shell;
- the same header/date rhythm;
- monospace financial values;
- semantic signed-value coloring;
- compact label/value rows;
- mobile viewport clamping;
- no fixed width that can force overflow;
- no default Recharts tooltip.

Rich domain-specific content remains allowed; only the shell/spacing/value hierarchy is standardized.

### Legends
- legends use compact chips/rows, not default Recharts legend UI;
- semantic dot/line samples match actual plotted series;
- legends can wrap on phone;
- legends must not compete with the headline metric.

### Empty/loading
- one premium chart skeleton treatment;
- one chart-empty treatment;
- empty states occupy a stable plot-height footprint to avoid layout jumps.

---

## 7. Implementation passes

### Pass 0 — Shared chart primitives and tokens

**Status: COMPLETE — Quality Checks #749 passed (28/28 files, 178/178 tests, build 5.77s).**

Implemented:
- semantic chart tones and named allocation palette;
- shared primary/compact/trajectory margins;
- grid/crosshair/zero-line recipes;
- shared active-dot recipe;
- persistent START/WIN/LOSS/BREAKEVEN trajectory trade-marker contract;
- premium inner plot surface;
- chart legend primitive;
- shared tooltip shell refinement;
- loading skeleton and empty-state plot surfaces;
- reduced-motion handling for chart skeleton/active-dot effects;
- deterministic chart-theme tests.

**Goal:** turn `AnalyticsChartTheme.tsx` into the authoritative visual layer before touching individual charts.

Planned work:
- formalize named semantic chart colors/palette;
- add shared plot-surface classes/primitives;
- centralize active-dot/reference-line recipes;
- define the persistent trajectory trade-marker contract (START/WIN/LOSS/BREAKEVEN) before the trajectory component is migrated;
- centralize chart margins where practical;
- strengthen tooltip variants without removing chart-specific content;
- add legend primitives;
- unify compact EGP/% tick formatters;
- define reduced-motion-safe series behavior helpers only if this can be done without changing current accepted animation behavior;
- extend formatter/theme tests.

Acceptance:
- later chart passes consume shared primitives rather than inventing new local recipes;
- no data/series behavior changes.

### Pass 1 — Unified Portfolio Analytics

**Status: COMPLETE / DEVICE ACCEPTED.**

Started:
- primary chart now uses the shared inner plot surface;
- shared chart margins and zero-line recipe replace local copies;
- percent-axis formatting uses the shared formatter;
- Portfolio vs Net Deposits gains an explicit native comparison legend;
- data, curves, timeframes, syncId, 1W interpolation, and 520ms series timing are unchanged.

Scope:
- `PerformanceTimeframeChart.tsx`;
- primary plot frame;
- mode/header/headline composition;
- Today resolution rail;
- timeframe rail;
- plot/axis/grid/reference-line treatment;
- primary vs comparison series hierarchy;
- active point;
- rich primary tooltip shell;
- data-quality footer.

Protected behavior:
- all four modes: Portfolio vs Return, Portfolio vs Net Deposits, TWR, MWR;
- Today resolution behavior;
- all existing timeframes;
- 1W interpolation workaround;
- Today linear rule;
- existing data points;
- current sync contract.

Acceptance:
- main chart becomes the visual reference implementation for all later charts;
- no geometry/data regression across modes/timeframes.

### Pass 2 — Secondary Risk & Cost Analytics

**Status: COMPLETE / DEVICE ACCEPTED — Quality Checks #754 passed (29/29 test files, 182/182 tests, build 4.85s).**

Implemented:
- all three secondary charts now use the shared Phase 7 inset plot surface and compact chart margins;
- Drawdown gets a rose semantic card accent, rose plot ambience, stronger rose area glow, shared negative active point, shared percent-axis formatter, and shared zero-line treatment;
- Cumulative Fees gets an amber semantic card accent, amber plot ambience, stronger amber step-area glow, shared cost active point, and preserves the existing `stepAfter` curve;
- Realized vs Unrealized gets a cyan family card/plot accent, two metric blocks, explicit legend, and stronger two-series hierarchy;
- Realized uses a solid line; Unrealized uses a dashed line so the two remain distinguishable even if both are negative and therefore both become rose;
- Realized/Unrealized series colors now reflect current sign while preserving series identity through solid vs dashed styling;
- all three keep `syncId="portfolio-secondary-analytics"`, Today linear paths, daily monotone paths, the shared mobile tooltip-dismiss behavior, and 520ms series timing;
- reduced-motion mode strips the extra series glow.

Scope:
- Performance Drawdown;
- Cumulative Fees;
- Realized vs Unrealized P&L.

Planned work:
- shared mini-chart anatomy;
- consistent inner plot shells;
- unified headline metric placement;
- explicit compact legends where multiple series exist;
- shared active-point treatment;
- synchronized tooltip/crosshair styling;
- consistent empty-state height.

Acceptance:
- all three clearly belong to the same family;
- risk/cost/P&L semantics stay immediately recognizable;
- crosshair synchronization remains intact.

### Pass 3 — Realized P&L Trajectory

**Status: COMPLETE / DEVICE ACCEPTED.**

Implemented so far:
- migrate both cumulative and trade-by-trade modes onto the shared Phase 7 plot surface, margins, axes, zero-line, tooltip shell, and formatting helpers;
- persistent cumulative markers now consume the shared START/WIN/LOSS/BREAKEVEN marker contract;
- every cumulative trade observation remains rendered as a visible marker; no marker sampling/thinning;
- active trajectory marker preserves the hovered trade's own outcome color instead of using a generic green dot;
- breakeven trades use amber in markers, badges, tooltips, and bars;
- cumulative trajectory stroke/area reflects overall net realized state while per-trade markers continue to represent each trade outcome independently;
- add an explicit “Each point is one closed trade” legend and empty state;
- add reduced-motion-safe marker emphasis;
- device correction: replace the unintended gray Recharts category cursor with an actual active-bar state; selected bars keep their own WIN/LOSS/BREAKEVEN fill, gain a bright outline + stronger halo, and all bars now use SVG-native glow so the effect survives iPhone/Recharts rendering; strengthen the net-semantic cumulative curve halo;
- add **All / 1D / 1W / 1M / 90D / YTD** trajectory filters using the same EGX session/calendar windows as the analytics system;
- filtered trajectory summaries, cumulative curve, persistent markers, and trade-by-trade bars all use the same filtered closed-trade set;
- retain every trade that falls inside the selected period—no sampling or marker thinning.

Pass 7.2 Secondary Analytics has now resumed and is implemented; validation is running.

Scope:
- cumulative trajectory mode;
- trade-by-trade bar mode;
- mode selector;
- trade markers;
- tooltip content;
- axes/reference line;
- trajectory legend/stat context.

Planned work:
- migrate remaining formatting to shared chart helpers;
- unify plot surface and tooltip grammar;
- make WIN/LOSS/BREAKEVEN markers intentional and consistent;
- align bar positive/negative semantics with the wider chart system;
- preserve chronological trade ordering and cumulative values.

Acceptance:
- switching chart mode feels like two views of the same visualization;
- trade markers remain readable on phone;
- no trade/P&L calculation changes.

### Pass 4 — Portfolio Allocation

**Status: IMPLEMENTED — validation pending.**

Implemented:
- replace rank/index-based donut colors with stable identity-based colors so the same sector/holding keeps its color when values reorder or cash is toggled;
- reserve the comparison-purple family for cash;
- migrate the donut into the shared Phase 7 plot surface with a stronger allocation-specific center ambience;
- keep the center summary visible at all times: it shows Largest by default and Selected while a segment/row is active;
- link donut segments and ranked breakdown rows into one interaction system;
- tapping/hovering/focusing a ranked row highlights the same donut segment;
- tapping a donut segment updates the center summary and active styling;
- active segments use a bright outline and semantic glow while non-active segments dim;
- tooltip dot/percentage now use the actual segment color instead of generic cyan;
- ranked rows, dots, and progress bars carry the same stable segment color;
- cash inclusion/exclusion behavior and allocation calculations remain unchanged;
- reduced-motion disables allocation transitions while preserving static state styling.

Scope:
- sector donut;
- holdings donut;
- cash included/excluded state;
- center summary;
- tooltip;
- ranked concentration list relationship.

Planned work:
- replace anonymous local colors with a named allocation palette;
- align donut stroke/active-segment/dimming behavior with chart tokens;
- unify tooltip shell and number formatting;
- improve touch/reduced-motion behavior without changing allocation calculations;
- strengthen relationship between donut segment color and ranked list row;
- keep current allocation tabs and cash toggle behavior.

Acceptance:
- donut + ranked breakdown reads as one visualization;
- segment identity remains stable and understandable;
- tooltip never escapes phone viewport.

### Interaction correction — mobile tooltip dismissal

Implemented during Phase 7:
- main analytics and all three synchronized secondary charts now share one tooltip-interaction state;
- pressing anywhere outside the interactive chart surfaces forces all analytics tooltips closed;
- interacting with any chart re-enables normal hover/touch tooltip behavior;
- synchronization through `syncId="portfolio-secondary-analytics"` is preserved.

### Pass 5 — Responsive, interaction, and accessibility chart sweep

Scope across all 7 charts:
- 320/360/390/430 phone widths;
- short landscape;
- tablet;
- desktop;
- 2XL;
- pointer/coarse-pointer behavior;
- tooltip clamping;
- chart-height consistency;
- tick density;
- legend wrapping;
- active points;
- touch behavior;
- reduced motion;
- accessible labels/summaries for chart regions.

Important:
- this pass does not retune the already-deferred global tab/page transitions;
- chart series timing changes only if needed to restore accessibility/performance, not for stylistic experimentation.

### Pass 6 — Full chart regression and closure

Validation matrix:
- primary chart: every mode × every timeframe;
- Today: Auto/1m/5m/15m/1h states where data is available;
- primary vs secondary synchronized hover/press;
- 1W transitions to/from neighboring timeframes;
- empty historical data;
- intraday error/loading;
- positive/negative/breakeven portfolio states;
- positive/negative realized trajectory;
- cumulative vs trade-by-trade;
- sector vs holdings allocation;
- cash included/excluded;
- narrow phone tooltip bounds;
- reduced motion;
- typecheck/tests/build.

Phase closes only when:
- all seven chart visualizations use the final shared language;
- no chart falls back to white/default Recharts presentation;
- data points and analytics outputs remain unchanged;
- Quality Checks pass;
- documentation reflects accepted visual behavior and any deferred debt.

---

## 8. Regression protections

During Phase 7, compare behavior against the Phase 6.5 baseline before accepting each pass.

Must remain true:
- Today NAV/value still matches the same underlying analytics result;
- changing visual primitives cannot alter historical coverage or fallback selection;
- timeframe spacing remains calendar/time based where currently implemented;
- main and secondary tooltip synchronization remains correct;
- pressing/hovering the primary chart must not break secondary chart tooltip synchronization;
- 1W transition must not regress to the prior “starts at last quarter” bug;
- Today remains unsmoothed;
- cumulative fees remain step-based;
- allocation totals remain unchanged;
- realized trajectory cumulative total remains unchanged.

---

## 9. Testing strategy

Existing financial-engine tests remain the primary calculation regression gate.

Phase 7 adds/extends tests only for deterministic visual helpers, for example:
- EGP/percent/compact-axis formatting;
- named palette/semantic-tone resolution;
- tooltip formatting helpers;
- shared chart configuration helpers where extraction is useful.

Do not create brittle snapshot tests for full Recharts SVG output unless a specific regression proves they are necessary.

Each meaningful pass:
1. implement;
2. run typecheck/tests/build via the temporary CI-gate pattern;
3. update this plan and the implementation log;
4. get device validation when the pass changes visible phone behavior.

---

## 10. Expected order

**7.0 Shared system → 7.1 Primary → 7.2 Secondary → 7.3 Realized trajectory → 7.4 Allocation → 7.5 responsive/accessibility sweep → 7.6 regression/closure.**

This ordering deliberately establishes the shared primitives and primary reference chart first, then migrates the simpler/specialized charts onto the same system.
