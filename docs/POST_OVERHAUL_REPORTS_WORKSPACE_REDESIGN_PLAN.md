# Post-Overhaul Reports Workspace Redesign Plan

## Status

**ACTIVE — R1 through R6 are accepted. R7 motion/state polish is the active implementation pass. R6 validated the Reports workspace across phone, short landscape, tablet, desktop and 2XL without adding Reports-only breakpoint styling or new golden screenshots.**

This plan is intentionally **not part of Phases 8–11** of the current premium UI redesign roadmap.

The current visual-overhaul plan should continue unchanged. This document remains the detailed design authority for the later **Reports & Performance** information-architecture redesign. The master roadmap owns sequencing; this file owns the R1–R8 Reports behavior and acceptance details.

---

# 1. Product direction

The current Reports tab is fundamentally a long-form analytical page:

> Here is everything we know. Scroll.

The later redesign should turn Reports into a focused analytical workspace:

> Here is how the portfolio is doing. Something deserves attention? Inspect it. Need depth? Enter that report.

The redesign should reduce cognitive density without removing analytical depth.

The main structural ideas are:

1. Reports gets its own internal navigation.
2. Reports remembers the user's last-used report mode.
3. Reports Overview becomes a **diagnostic screen**, not a smaller duplicate of every full report.
4. Compact diagnostic previews can expand in place.
5. Expanded previews can promote into the corresponding full report.
6. Existing trusted report/chart components should be reused rather than rewritten.

---

# 2. Internal Reports navigation

Directly beneath the Reports heading, add an internal report-mode navigator:

- **Overview**
- **Analytics**
- **Trading**
- **Allocation**
- **Monthly**

This navigation exists only inside **Reports & Performance**. It does not add more top-level application tabs.

Selecting a mode replaces the Reports body instead of scrolling the user to a different section in one giant page.

## Navigation behavior

- default mode for a new user/session state: **Overview**;
- active mode is visually obvious;
- active mode should automatically remain visible in the horizontal rail on small screens;
- phone layout should horizontally scroll instead of wrapping into multiple rows;
- use the established premium selector/navigation language, but give it slightly more structural authority than a normal filter;
- structural navigation colors should remain in the cyan/blue/purple family;
- do not use financial-state green/red/amber for navigation.

---

# 3. Remember the last report mode

Reports should remember where the user was working.

Example:

1. user opens Reports;
2. switches to **Analytics**;
3. leaves Reports for Transactions;
4. returns to Reports;
5. Reports opens directly in **Analytics**.

Suggested persisted state:

```text
reports:lastMode = analytics
```

## Persistence rules

Initially persist only the report mode.

Do **not** automatically persist every internal filter, selector, month, timeframe, or chart state as part of this project. Those can be evaluated independently later.

Explicit navigation overrides the remembered mode.

Example:

- if the user's remembered mode is Analytics;
- but they tap **Open Allocation Report** from a diagnostic preview;
- Reports should open Allocation immediately.

---

# 4. Reports Overview becomes a diagnostic screen

The purpose of Reports Overview should be:

> **How is my portfolio doing, and what deserves a closer look?**

It should not be a miniature copy of Analytics, Trading, Allocation, and Monthly.

The Overview should answer a small number of important questions quickly.

## Proposed diagnostic structure

### Portfolio State — dominant context

This is the primary Overview analytical surface.

Possible contents:

- current overall performance state;
- net/realized performance headline;
- compact main-performance visualization;
- selected-period context;
- enough data to understand direction without exposing every analytics control.

This should be the dominant analytical region on the screen.

---

### Trading Quality preview

Answers:

> Am I trading well?

Compact state could show:

- Win Rate;
- Profit Factor;
- Expectancy.

Expanded preview could additionally show:

- Average Winner;
- Average Loser;
- Average Holding Period;
- closed-trade count;
- **Open Trading Report →**

---

### Risk & Costs preview

Answers:

> Is the portfolio taking problematic drawdown or paying too much in costs?

Compact state could show:

- Max Drawdown;
- Fees;
- Realized vs Unrealized status.

Expanded preview can reveal a little more detail but should stop before reproducing the full Analytics workspace.

Action:

- **Open Analytics Report →**

---

### Concentration preview

Answers:

> Is the portfolio too concentrated?

Compact state could show:

- largest holding or sector;
- largest allocation percentage;
- top-3 concentration;
- small allocation visualization.

Expanded state could show:

- top holdings/sectors;
- cash share if enabled;
- **Open Allocation Report →**

---

### Current Month preview

Answers:

> How is this month going?

Compact state could show:

- monthly P&L;
- closed trades;
- holdings contribution;
- monthly win rate or equivalent summary.

Expanded state could add:

- realized vs unrealized contribution;
- best/worst closed trade where appropriate;
- **Open Monthly Report →**

---

# 5. Progressive disclosure on Overview

Overview should support four levels of analytical depth:

```text
headline
→ compact preview
→ expanded preview
→ full analytical workspace
```

## Expansion behavior

Only **one diagnostic preview card may be expanded at a time**.

Example:

- Trading Quality is expanded;
- user expands Concentration;
- Trading Quality collapses automatically.

This prevents Overview from gradually becoming another giant report page.

Expanded cards should remain medium-detail previews, not full reports.

---

# 6. Full Analytics workspace

The Analytics mode should answer:

> How is portfolio performance evolving, and where are the risk/cost drivers?

Suggested composition:

## Main Analytics

Full existing Phase 7 main analytics system, including its established:

- modes;
- timeframes;
- Today resolutions;
- tooltips;
- comparison logic;
- transitions;
- synchronized behavior.

## Risk & Cost Analytics

- Performance Drawdown;
- Cumulative Fees;
- Realized vs Unrealized P&L.

## Realized Gain / Loss Trajectory

Full existing trajectory system:

- cumulative curve;
- trade-by-trade;
- All / 1D / 1W / 1M / 90D / YTD;
- persistent trade observations;
- semantic selection.

## Portfolio Equity Bridge

Place the accounting/capital bridge here if the final conceptual audit confirms that it best fits the performance/accounting flow.

Suggested analytical flow:

```text
performance
→ risk & cost
→ realized trade path
→ equity/accounting bridge
```

---

# 7. Full Trading workspace

The Trading mode should answer:

> **Am I trading well?**

Suggested contents:

- Trading Performance Indicators;
- Profit Factor;
- Expectancy;
- Win Rate;
- Average Winner;
- Average Loser;
- Holding Period metrics;
- institutional/benchmark indicators;
- Closed Trade Summary;
- other closed-trade analytical breakdowns.

Do not place Portfolio Allocation here.

Monthly analysis should also remain separate.

Trading should feel like an execution-quality workspace rather than a generic performance dump.

---

# 8. Full Allocation workspace

The Allocation mode should answer:

> **How is the portfolio structured and where is concentration risk?**

At the top:

## Portfolio Allocation

Preserve the complete existing allocation system:

- donut;
- Holdings / Sectors;
- Include Cash;
- linked ranked breakdown;
- selected segment semantics;
- tooltip behavior;
- stable identity colors.

Below it, consider:

## Concentration Summary

Possible metrics:

- largest position;
- top-three concentration;
- largest sector;
- number of meaningful holdings;
- cash allocation;
- concentration flags if a later analytical rule is formally defined.

Future portfolio-structure features should naturally live here.

Do not place trading-quality statistics here.

---

# 9. Full Monthly workspace

The Monthly mode becomes a dedicated audit environment rather than a section buried near the bottom of Reports.

Preserve the current monthly audit system while giving it room to breathe.

Suggested contents:

- selected month;
- All / Liquidated / Holdings;
- monthly summary;
- realized/unrealized composition;
- holdings contribution;
- closed trade detail;
- monthly cards/rows;
- CSV / Print / export tools;
- month navigation.

This should feel like deliberately entering a monthly review workflow.

---

# 10. Mode-specific controls

Controls should appear only when relevant to the active report.

Overview should **not** expose:

- every Analytics mode/timeframe;
- Holdings/Sectors allocation controls;
- Monthly filters;
- full Trading period selectors;
- report-specific export controls.

Those appear only inside their corresponding workspaces.

This is a core density-reduction principle:

> reveal complexity when the user asks for the analytical context that needs it.

---

# 11. Proposed component architecture

The redesign should reuse existing trusted components.

High-level structure:

```text
PerformanceReports
│
├── ReportsHeader
├── ReportsNavigation
│
└── ActiveReport
    ├── ReportsOverview
    ├── AnalyticsReport
    ├── TradingReport
    ├── AllocationReport
    └── MonthlyReport
```

Suggested reuse:

```text
AnalyticsReport
├── PerformanceTimeframeChart
├── SecondaryAnalyticsCharts
├── RealizedTrajectoryChart
└── EquityBridge

TradingReport
├── TradingPerformanceReport
└── ClosedTradeSummary

AllocationReport
└── PortfolioAllocation

MonthlyReport
└── MonthlyPerformanceReport
```

The objective is information-architecture restructuring, not analytical-engine rewriting.

---

# 12. Motion and transition model

Switching Reports modes should feel like moving between analytical workspaces, not navigating to a completely different application page.

Use:

- the established premium swap language;
- restrained directional motion;
- fast enough for analytical work;
- reduced-motion support;
- no heavy page-scale effects.

Expanded Overview preview cards can use the existing state-expansion motion family.

Do not create a separate animation language specifically for Reports.

---

# 13. Responsive model

## Phone

- horizontally scrollable Reports navigation;
- active mode automatically brought into view;
- one-column diagnostic Overview;
- compact previews;
- one expanded preview at a time;
- full report modes retain existing phone chart/table behavior.

## Short landscape

- preserve the accepted safe-area/header behavior;
- Reports navigation remains one horizontal row;
- avoid oversized charts consuming the viewport;
- no wrapped two-row report navigation.

## Tablet / desktop

- use additional width to create stronger workspace composition;
- do not simply expose more equal-weight cards;
- Overview can use a curated diagnostic grid;
- full analytical modes can use wider chart/detail relationships where useful.

---

# 14. Data and behavior boundaries

This redesign must not change:

- accounting calculations;
- chart data;
- trajectory trade inclusion;
- allocation calculations;
- Trading Performance formulas;
- Monthly audit calculations;
- fees;
- report exports;
- market-data behavior;
- Supabase behavior;
- persistence outside the newly introduced last-report-mode preference unless explicitly planned.

Existing report components should first be moved into the new architecture with **zero analytical behavior changes**.

---

# 15. Implementation sequence

## Stage R1 — Report workspace architecture — ACCEPTED / CI + RENDERED GREEN

Implemented on branch `stage5-r1-reports-workspace`:

- canonical report-mode contract: Overview / Analytics / Trading / Allocation / Monthly;
- dedicated `ReportsNavigation` under the Reports heading;
- synchronous restore from `reports:lastMode` with invalid/stale fallback to Overview;
- explicit mode changes persist back to `reports:lastMode`;
- active mode is kept visible inside the horizontal rail;
- the established `MotionSwap` state transition family is reused;
- the full existing long-form Reports body remains intact beneath the mode shell.

R1 deliberately does **not** move report sections between modes. That begins in R2.

Acceptance:
- modes switch reliably;
- remembered mode restores correctly;
- stale persisted values fall back safely;
- active mobile mode remains visible in the one-row rail;
- current Trading/Analytics/Allocation/Monthly content remains present;
- no report calculation, chart-data, allocation, trading-statistic or monthly-audit logic changes;
- TypeScript, full tests, production build and rendered regression remain green.

### R1 acceptance record

R1 product architecture merged through PR #88 as `main@3aa6459a`. The intentional Reports mode rail changed only the tracked `reports-desktop` visual state. The rendered artifact was inspected; all 12 geometry checks remained at **0px overflow**, every non-Reports visual stayed within the frozen threshold, and the Reports delta was exactly the new rail plus the corresponding vertical shift of the unchanged long report body.

PR #89 then recorded that inspected Reports image by exact SHA-256 rather than weakening the global 1% threshold. Final accepted head: `main@4e9203bc`.

Final gates:
- Quality Checks #37378407121 — passed;
- Phase 10 Visual Closure #37378407119 — passed;
- Rendered Visual Regression #37378407114 — passed;
- `reports-desktop` reported `accepted-change` at 13.625% only because its PNG bytes exactly matched the reviewed hash;
- future pixel drift still fails normally.

---

## Stage R2 — Split the current long page into workspaces — VALIDATION CANDIDATE

Move existing components into:

- Analytics;
- Trading;
- Allocation;
- Monthly.

Do not redesign the components during this stage.

Acceptance:
- every current report remains available;
- filters/actions remain functional;
- nothing is lost compared with the current Reports tab.

---

## Stage R3 — Build the diagnostic Overview

Create the new Overview around:

- Portfolio State;
- Trading Quality;
- Risk & Costs;
- Concentration;
- Current Month.

The Overview should intentionally omit most report controls.

Acceptance:
- first screen answers how the portfolio is doing;
- user can identify areas worth investigating without scrolling through full reports.

---

## Stage R4 — Progressive preview expansion — ACCEPTED / INSPECTED VISUAL CHANGE

- allow one preview to expand at a time;
- expanded preview adds meaningful medium-detail information;
- add **Open full report →** actions;
- explicit report opening overrides last-mode persistence.

Candidate implementation:
- `ReportsOverview` owns one `expandedPreview` ID, so opening another diagnostic closes the previous one;
- the default view is shorter than R3 because secondary diagnostic metrics move behind the inline expansion;
- Portfolio State and Risk & Costs open Analytics;
- Trading Quality opens Trading;
- Concentration opens Allocation;
- Current Month opens Monthly;
- full-report actions route through the existing `reportMode` state so the trusted workspaces/calculation engines are reused.

Acceptance:
- Overview does not become a long accordion page;
- moving from diagnosis to depth is obvious;
- TypeScript, full tests and production build pass;
- rendered Reports inspection confirms the default compact state remains readable and hierarchy-safe.

Acceptance record:
- implementation merged at `main@5b1af622`;
- Quality #37430549239 passed;
- Intraday 1m Migration Smoke #37430549221 passed;
- Rendered #37430549099 changed only `reports-desktop` materially, at **22.311%**;
- inspected screenshot SHA-256: `105c3dcbbdc10b8e3904b1480b3e261f745beeffc2d41570450de5f775a74e2e`;
- exact-hash acceptance is scoped to `reports-desktop`; `VISUAL_MAX_DIFF_RATIO=0.01` remains unchanged.

---

## Stage R5 — Persistence and restoration polish — MERGED / SOURCE + RENDERED GREEN

Validate:

- returning to Reports restores last mode;
- direct report-opening actions override remembered mode;
- invalid/stale persisted values safely fall back to Overview;
- state restoration does not cause visible flicker.

Candidate implementation:
- initial `reportMode` remains a lazy synchronous read from `reports:lastMode`, so restoration occurs on first render instead of after mount;
- `handleReportModeChange` persists the target mode before applying local state;
- both the Reports navigation and R4 full-report actions use that same handler;
- stale/unknown persisted values continue to normalize to Overview through `parseReportsMode`;
- persistence remains intentionally limited to the workspace mode only.

---

## Stage R6 — Responsive workspace pass — ACCEPTED / CI + RENDERED GREEN

Validate:

- portrait phone;
- short landscape;
- tablet;
- desktop;
- 2XL.

Check:

- Reports navigation;
- preview cards;
- expanded states;
- full workspaces;
- tooltip bounds;
- chart sizing;
- safe areas;
- dense report tables.

Candidate evidence layer:
- `renderedRegression.mjs` opens Reports at 390×844, 844×390, 768×1024, 1440×1000 and 2560×1440;
- the mode rail must remain one row at every tier and may scroll horizontally rather than wrap;
- the default Overview and an expanded diagnostic preview must remain inside the viewport;
- Analytics, Trading, Allocation and Monthly are each opened and checked for page/stage horizontal overflow;
- existing tooltip, chart, table and short-landscape contracts remain source-guarded;
- this pass adds no new Reports-only breakpoint styling and no new screenshot baselines.

Acceptance record:
- accepted through PR #97 at `main@33ab8278`;
- Quality Checks #37432757200 passed;
- Phase 10 Visual Closure #37432757207 passed;
- Rendered Visual Regression #37432757249 passed;
- the dedicated Reports geometry matrix covered 390×844 phone, 844×390 short landscape, 768×1024 tablet, 1440×1000 desktop and 2560×1440 2XL;
- no Reports-only breakpoint styling or new golden screenshots were required.

---

## Stage R7 — Motion and state polish — ACTIVE / IMPLEMENTATION CANDIDATE

Candidate implementation:
- report-mode transitions continue through the existing `MotionSwap` state variant keyed by `reportMode`;
- diagnostic preview enter/exit lifecycle uses one shared `DisclosurePresence` primitive built on Motion for React `AnimatePresence`;
- the single `expandedPreview` owner remains authoritative, so only one diagnostic can be open at a time;
- remembered mode still restores synchronously from `reports:lastMode` on first render, avoiding post-mount restoration flicker;
- existing Analytics loading/empty surfaces and Allocation empty-state ownership remain unchanged;
- reduced-motion users receive a short opacity-only disclosure transition with no height/y choreography;
- no Reports-only CSS keyframes, motion tokens or breakpoint rules are introduced.

Acceptance:
- mode switching and preview expansion/collapse use the established premium motion language;
- collapsing content remains mounted through its exit lifecycle rather than disappearing instantly;
- reduced-motion behavior avoids spatial movement;
- persisted-mode restoration remains first-render authoritative;
- loading/empty states do not manufacture data or replace existing analytical owners;
- TypeScript, full tests and production build pass;
- rendered Reports regression and responsive geometry remain green.

---

## Stage R8 — Full regression and closure

Regression matrix:

- Overview diagnosis values;
- Analytics modes/timeframes/Today resolutions;
- synchronized tooltips;
- 1W transition;
- trajectory modes/timeframes;
- Trading statistics/filters;
- Allocation Sectors/Holdings/Cash;
- Monthly All/Liquidated/Holdings;
- exports;
- navigation restoration;
- direct-mode opening;
- phone/desktop/landscape;
- typecheck/tests/build.

---

# 16. What not to build

Do not turn the current long Reports page into a wall of independent accordions.

Collapsible sections can be useful locally, but using them as the primary information architecture would preserve the same conceptual problem while merely hiding content.

The preferred model is:

**diagnostic Overview + dedicated analytical workspaces + progressive disclosure.**

---

# 17. Success criteria

The redesign is successful when:

- opening Reports immediately answers **how the portfolio is doing**;
- the user is not forced to scroll through unrelated analytical contexts;
- Analytics, Trading, Allocation, and Monthly each have an obvious purpose;
- deep functionality remains available without appearing all at once;
- the user can return to their last-used report context;
- Overview remains concise even after preview expansion exists;
- existing trusted analytical calculations/components remain intact;
- Reports feels like a mini analytical application inside EGX Portfolio rather than one oversized page.

---

## Master-roadmap integration\n\nRoadmap owner: **Stage 5 — Reports workspace redesign**.\n\nRequired entry gates:\n\n1. Phase 10 closed / CI-clean;\n2. persistence-confirmed financial mutation model closed;\n3. production/default-branch + scheduler convergence closed;\n4. architecture ownership sufficient to move trusted report components without reimplementing analytics.\n\nThe existing R1–R8 sequence in this document is preserved. Benchmarking, risk-dashboard expansion, execution analytics and other new calculations are later roadmap features and must not be smuggled into the workspace restructuring.\n\n---\n\n## Deferred implementation rule

Do not begin this plan until the current premium visual overhaul is formally complete.

This document should remain separate from the active Phase 8–11 roadmap unless the user explicitly decides to schedule the Reports workspace redesign afterward.
