# EGX Portfolio — Master Stabilization & Evolution Roadmap

## Status

**CANONICAL MASTER ROADMAP — created 2026-09-30.**

This is the sequencing authority for work after the September 2026 audit of `feature/premium-ui-redesign`.

The application is a **private personal EGX portfolio system**. The roadmap therefore optimizes for:

1. accounting correctness;
2. persistence integrity;
3. market-data trust;
4. predictable cross-device behavior;
5. maintainability;
6. analytical usefulness;
7. visual quality;
8. feature breadth.

When this roadmap conflicts with an older phase document about *when* work should happen, this roadmap controls sequencing. Domain documents still control their specialist rules.

Current detailed subplans retained as dependencies:

- `PHASE10_VISUAL_CONSISTENCY_PLAN.md` — active visual closure contract;
- `POST_OVERHAUL_REPORTS_WORKSPACE_REDESIGN_PLAN.md` — detailed Reports workspace design, integrated here as Stage 5;
- `INTRADAY_1M_MIGRATION_PLAN.md` — intraday migration history and rollout rules;
- `PREMIUM_VISUAL_LANGUAGE_CONTRACT.md` — frozen visual/material contract;
- `INTRADAY_MARKET_DATA.md`, `PERFORMANCE_ANALYTICS.md`, and `TICKER_REGISTRY.md` — canonical domain behavior.

See `STATUS.md` for the current execution point.

---

# 1. Governing rules

## 1.1 Trust before convenience

A portfolio value, cash balance, trade, realized P&L number, or historical chart is allowed to be unavailable or visibly stale.

It is **not** allowed to look authoritative while being derived from a failed write, stale source, different session, or incompatible accounting rule.

## 1.2 Ledger authority

The transaction ledger is the financial source of truth.

Derived state:

- positions;
- cash;
- closed cycles;
- realized P&L;
- open cost basis;
- historical portfolio state;

must reconcile from the same ledger semantics.

## 1.3 Persistence-confirmed success

A financial mutation is not successful merely because React state changed.

Canonical mutation order:

```text
construct candidate ledger
        ↓
validate accounting invariants
        ↓
persist atomic snapshot
        ↓
persistence succeeded?
   ├─ no → retain prior local financial state + show failure
   └─ yes
        ↓
apply local projection
        ↓
show success
        ↓
optional external integrations
```

No financial workflow may claim success before the authoritative persistence layer confirms it.

## 1.4 One production truth

Application code, Worker API behavior, database expectations, and scheduled ingestion must converge onto the same promoted production revision.

A permanently divergent “real app branch” and “scheduler/default branch” is not an acceptable steady state.

## 1.5 No hidden accounting modes

A BUY always has a cash consequence. A SELL always has a cash consequence. Exceptional bookkeeping is represented as an explicit ledger event rather than a checkbox that changes the economic meaning of a trade.

## 1.6 Missing market data stays missing

Do not manufacture candles, historical closes, sessions, or portfolio valuations to make a graph look complete.

## 1.7 Visual work stays isolated from financial work

Until Phase 10 closes, visual passes must not modify business/data behavior.

After Phase 10 closes, accepted visual/material semantics remain frozen unless a later explicitly scoped redesign owns the change.

## 1.8 Regression evidence follows every accepted bug fix

A defect that can affect money, shares, history, sessions, persistence, or cross-device consistency receives a focused regression test.

Visual source-contract tests remain useful but do not substitute for rendered browser validation.

---

# 2. Execution sequence

The roadmap is intentionally ordered.

```text
Stage 0  Documentation governance                    ← established by this pass
Stage 1  Finish Phase 10 visual closure
Stage 2  Financial mutation & ledger integrity
Stage 3  Production / CI / market-data convergence
Stage 4  Architecture consolidation
Stage 5  Reports workspace redesign
Stage 6  Trust, reconciliation & lifecycle features
Stage 7  Portfolio intelligence
Stage 8  Trading/execution analytics
Stage 9  Scanner/background-alert operationalization
Stage 10 Long-term cleanup and archive closure
```

Do not skip a stage gate merely because a later feature is more interesting.

---

# 3. Stage 0 — Documentation governance

## Objective

Create one obvious answer to each of these questions:

- What is true now?
- What are we doing next?
- Which document is authoritative for a domain?
- Which documents are historical implementation evidence?
- Which old documents are still path-bound by regression tests?

## Deliverables

- `docs/STATUS.md` — current state and next execution point;
- `docs/MASTER_STABILIZATION_ROADMAP.md` — this sequencing authority;
- `docs/README.md` — documentation map;
- `docs/archive/README.md` — archive policy;
- current architecture/operations docs corrected to match the Cloudflare + Supabase + Node-workflow topology;
- deferred Reports plan linked into this roadmap.

## Archive rule

Historical Phase documents are not physically moved merely for tidiness while tests still read them by exact path.

First remove or migrate that path ownership during a later closure pass. Then move safe historical documents under `docs/archive/`.

## Exit gate

- [x] canonical roadmap exists;
- [x] current-status document exists;
- [x] documentation index exists;
- [x] archive policy exists;
- [x] current architecture/operations prose is aligned with the premium branch topology.

---

# 4. Stage 1 — Finish Phase 10 visual closure — COMPLETE / CLOSED / CI CLEAN

**Owner:** `PHASE10_VISUAL_CONSISTENCY_PLAN.md`

**Business/data behavior remains frozen throughout this stage.**

Final completed point: **Pass 1.4 / Phase 10.10 — exact-head closure green on `50db10b2`, run #36921005365.**

## Pass 1.1 — Phase 10.8: modal & workflow consistency — IMPLEMENTED AT SOURCE LEVEL

Audit all user workflows, especially:

- Add Trade;
- Sell Position;
- Edit Position Targets;
- transaction editing;
- screenshot/OCR import;
- quick cash;
- backup/reconciliation;
- Google Sheets;
- price alerts;
- ticker/schema tools;
- destructive confirmation flows.

### Required checks

- modal top/bottom remain reachable;
- no spring-back scroll trap;
- long content scrolls inside the intended container;
- iOS keyboard does not hide the active field/action;
- destructive and primary actions have consistent priority;
- close/cancel actions remain reachable;
- phone safe areas are respected;
- desktop modal placement does not require page scrolling;
- dropdown portals remain viewport-clamped;
- no workflow/accounting behavior changes.

### Gate

Source contract tests + rendered manual validation.

---

## Pass 1.2 — Phase 10.9: responsive cross-app parity — IMPLEMENTED AT SOURCE LEVEL

Required widths:

- 320;
- 359;
- 390;
- 430;
- short phone landscape;
- 768;
- 1024;
- 1280;
- 1440;
- 1600;
- 1920;
- 2560.

Audit:

- horizontal page overflow;
- header overflow;
- modal containment;
- menu/dropdown clipping;
- glow clipping;
- table containment;
- nested scroll regions;
- control wrapping;
- card/grid collapse;
- excessive 2XL stretching;
- tooltip bounds;
- safe-area behavior.

No redesign.

---

## Pass 1.3 — Rendered regression harness — COMPLETE / CI GREEN

Add a small Playwright/browser screenshot matrix after responsive parity is known-good.

Recommended golden states:

- Overview desktop;
- Overview phone;
- Open Positions desktop/mobile;
- Closed Cycles;
- Reports;
- Journal;
- Cash Ledger;
- Add Trade modal;
- transaction edit modal;
- one canonical dropdown open;
- one semantic WIN/LOSS/BREAKEVEN group.

The existing Phase 8–10 tests remain **source-contract tests**. They are not renamed or discarded; browser screenshots add the missing rendered layer.

---

## Pass 1.4 — Phase 10.10: visual regression closure — COMPLETE / CI GREEN

Freeze:

- hierarchy;
- material;
- semantic aura/edge behavior;
- control families;
- dropdown/overlay contract;
- modal contract;
- dense-data system;
- responsive rules;
- Phase 9 header architecture.

Final gate:

- TypeScript;
- full Vitest;
- production build;
- Cloudflare Worker dry-run/build;
- rendered-device/screenshot check.

Closure evidence:

- TypeScript passed;
- **77 / 77 Vitest files, 435 / 435 tests passed**;
- production Vite/PWA build passed;
- Cloudflare Worker dry-run passed;
- **12 / 12 geometry widths at 0px page overflow**;
- **16 / 16 golden screenshots at 0.000% diff**.

Phase 10 is **CLOSED / CI CLEAN**. Its accepted visual contracts are frozen unless explicitly reopened.

---

# 5. Stage 2 — Financial mutation & ledger integrity — ACTIVE

This is the highest-priority non-visual work.

## Pass 2.1 — Canonical mutation executor — COMPLETE / CI GREEN

Introduce one financial mutation boundary, conceptually:

```text
ledgerMutationService
  prepare()
  validate()
  persist()
  apply()
  report()
```

Responsibilities:

- normalize input;
- generate the candidate ledger;
- run reconciliation;
- validate shares/cash/finite-value invariants;
- atomically persist;
- update local state only after success;
- expose structured failure state;
- provide the successfully persisted transaction/result to optional integrations.

No component should need to understand Supabase write ordering.

### 2.1 implementation record

Implemented in `src/services/ledgerMutationService.ts`.

The boundary now:

- derives accounting projections from candidate ledger state;
- validates malformed rows and finite-value invariants;
- rejects newly introduced reconciliation discrepancies;
- serializes all financial mutations through one in-flight gate;
- persists through the atomic Supabase accounting snapshot RPC;
- applies local state only after persistence success;
- returns structured busy/prepare/validate/persist/apply failures.

Exact-head validation: **#36924616787** on `eb3f776e`.

Result: TypeScript + **447/447 tests** + production build + Worker dry-run + frozen visual regression all green.

Detailed authority: `FINANCIAL_MUTATION_CONTRACT.md`.

**Next: Pass 2.2 — Convert BUY and SELL.**

---

## Pass 2.2 — Convert BUY and SELL — COMPLETE / CI GREEN

Current problem:

- BUY/SELL update local financial state before persistence confirmation;
- UI can show a success toast even if the authoritative write fails.

Required change:

- make BUY/SELL async persisted operations;
- disable/dedupe submit while in flight;
- only close/confirm success after persistence;
- on failure, preserve the previous financial state;
- Sheets sync happens **after** portfolio persistence and may fail independently without rolling back the portfolio.

Regression cases:

- persistence failure;
- double-click/double-submit;
- reconnect during write;
- stale remote read arriving while mutation is active;
- partial sell;
- full close;
- same-minute executions.

### 2.2 implementation record

Implemented in:

- `src/services/tradeLedgerMutations.ts`;
- `usePortfolioState.ts`;
- Add Trade and Sell modal workflows;
- App-level trade success/failure/Sheets sequencing.

Accepted behavior:

- BUY/SELL are async canonical executor mutations;
- modal submission is in-flight locked;
- persistence failure keeps the prior financial state and keeps the modal open;
- success/close occurs only after Supabase accounting persistence;
- Google Sheets runs only after authoritative portfolio success and cannot roll it back;
- persisted-but-local-apply-failed is reported as already-saved rather than retried;
- partial/full/same-day SELL semantics remain ledger-derived;
- position/BUY target, stop and notes beat ticker-directory defaults;
- legacy hidden cash-bypass flags are rejected until their Stage 2.5 UI/API removal.

Exact-head validation:

- runtime: `d012aeff`;
- Phase 10 Visual Closure **#36941746467**;
- **81 / 81 test files, 462 / 462 tests**;
- production build and Worker dry-run green;
- 12 / 12 responsive geometries at 0px page overflow;
- 16 / 16 golden screenshots at 0.000% diff;
- Intraday 1m Migration Smoke **#36941746472** green on the same runtime head.

**Next: Pass 2.3 — transaction edit/delete, cash, OCR and backup/import migration.**

---

## Pass 2.3 — Convert transaction edit/delete and cash workflows — NEXT

Transaction deletion already follows much of the preferred persist-first shape.

Bring all of these onto the same executor:

- edit transaction;
- delete transaction;
- deposit;
- withdrawal;
- dividend;
- adjustment;
- OCR single trade;
- OCR batch;
- backup restore/reconciliation.

No mixed optimistic/persist-first financial model remains.

---

## Pass 2.4 — Remove direct accounting deletion from Position

A Position is a projection, not an independent financial record.

Replace **Delete Position Record** with a correction-oriented workflow:

- View contributing transactions;
- Correct ledger;
- edit/delete the erroneous transaction explicitly.

### Specific bug to eliminate

Current reconciliation uses proportional/weighted-average cost allocation on partial sells, while `getOpenBuyTransactionIdsForTicker()` consumes lots FIFO when deciding which BUY rows belong to an “open” position.

Example:

```text
BUY 100 @ 10
BUY 100 @ 20
SELL 100
```

Canonical proportional model leaves economic exposure equivalent to:

```text
50 @ 10
50 @ 20
```

FIFO deletion logic treats the first BUY as fully consumed and the second as open.

The two models cannot both define accounting history.

Acceptance:

- no derived Position action silently deletes source ledger history;
- DCA + partial-sell correction behavior is deterministic and regression-tested.

---

## Pass 2.5 — Remove hidden trade cash modes

Remove/retire:

- BUY `deductFromCash=false`;
- SELL `addToCash=false`;

from normal portfolio accounting.

A trade always records its real broker cash effect.

If cash differs from broker reality, record the real reason as a separate ledger event.

---

## Pass 2.6 — Freeze one cost-basis method

Document and test:

> **EGX Portfolio open-cost allocation uses weighted-average/proportional remaining cost.**

Every helper, closed-cycle calculation, correction tool, report, and future corporate-action path must honor the same method.

No FIFO helper may be used to infer remaining accounting ownership unless FIFO becomes an explicitly separate analytical view.

---

## Pass 2.7 — Clarify cash-adjustment semantics

Current `CASH_ADJUSTMENT` can represent conceptually different events.

Split semantics so performance calculations can distinguish:

- reconciliation/bookkeeping correction;
- other portfolio income;
- other portfolio expense;
- explicit fee;
- dividend;
- external deposit/withdrawal.

A reconciliation correction should repair state without pretending investment performance occurred.

Migration/backward-compatibility rules must be explicit.

---

## Pass 2.8 — Financial acceptance suite

Add scenario tests for:

- multiple DCA buys;
- proportional partial sells;
- repeated partial sells;
- full close and reopen;
- correction after partial sell;
- failed write at every mutation type;
- duplicate execution import;
- deposit/withdrawal during a selected performance period;
- dividends;
- fees;
- reconciliation adjustment;
- same-day round trip;
- cross-device stale quote/write interaction.

### Stage 2 exit gate

- every financial mutation is persistence-confirmed;
- Position is projection-only for accounting;
- one cost-basis method is canonical;
- hidden cash modes are gone;
- failure never leaves the UI claiming unpersisted money/shares.

---

# 6. Stage 3 — Production, CI & market-data convergence

## Pass 3.1 — Reconcile branch divergence

At the 2026-09-30 audit baseline:

- `feature/premium-ui-redesign` was **1,388 commits ahead of `main`**;
- it was **12 commits behind `main`**.

Review the 12 main-only commits individually.

Do not blind-merge and hope.

Classify each as:

- required;
- superseded by premium;
- conflict requiring manual reconciliation;
- obsolete.

Produce one reviewed integration result.

---

## Pass 3.2 — Make the default production branch authoritative

After review:

- application code;
- Cloudflare Worker;
- database migrations;
- 1m ingestion;
- ticker registry workflow;
- quality workflow;
- production audit;

must all be sourced from the same production truth.

Feature branches return to temporary work branches.

---

## Pass 3.3 — Automation normalization

Current premium workflow facts:

- raw 1m sync: `*/5 7-13 * * 0-4`, Cairo-gated through 15:15;
- ticker registry: `15 13 * * 0-4`;
- production audit: `0 14 * * 0-4`;
- historical repair: `17 12-22 * * *`;
- legacy direct 5m workflow is manual-only.

Required cleanup:

- retire any default-branch legacy scheduled 15m producer;
- confirm one shared intraday writer concurrency policy;
- standardize dependency installation.

### Known workflow inconsistency

The premium branch removed `bun.lock` and declares npm as the package manager, but `production-data-audit.yml` still runs:

```text
bun install --frozen-lockfile
bun run verify:production-data
```

Convert that workflow to the canonical npm/Node toolchain or deliberately restore/own a Bun lockfile. Do not leave it ambiguous.

---

## Pass 3.4 — Exact-head quality gate

For the final candidate commit:

- clean install;
- TypeScript;
- full Vitest;
- Vite/PWA build;
- Worker compile/dry run;
- focused intraday tests;
- ticker-registry tests;
- read-only production data audit;
- `git diff --check`.

A smoke workflow is not a substitute for this complete gate.

---

## Pass 3.5 — Live-session soak

Observe at least one complete real EGX session after promotion.

Verify:

- startup value matches broker/reference without manual sync;
- phone and PC use the same authoritative snapshot;
- 1m coverage advances during session;
- post-close final observations arrive;
- derived 5m matches raw aggregation;
- manual 1m remains strict;
- Auto fallback stays on the same session;
- Today endpoint converges on authoritative current NAV;
- no prior-session substitution;
- daily history advances;
- no competing writers.

---

## Pass 3.6 — Data Health Center

Add a compact trust surface answering:

```text
Live quotes              7 / 7 healthy
Selected EGX session     2026-09-30
Latest raw 1m bar        14:29 Cairo
Derived 5m               complete
Daily history            complete for held universe
Ticker resolution        all held symbols resolved
Portfolio sync           Supabase • 14s ago
Last ingestion           successful
App build                <short commit>
```

On failure, show the affected ticker/source and stale timestamp.

This is a diagnostic surface, not another analytics dashboard.

The app should detect market-data degradation before the user notices a suspicious graph.

### Stage 3 exit gate

One promoted production truth, one active ingestion model, exact-head CI clean, and a live-session verification record.

---

# 7. Stage 4 — Architecture consolidation

This is a **refactor, not a rewrite**.

## Pass 4.1 — Establish module ownership

Target direction:

```text
src/
  domain/
    accounting/
    performance/
    market/
  data/
    supabase/
  integrations/
    tradingview/
    google-sheets/
    ocr/
  features/
    portfolio/
    trades/
    cash/
    reports/
    journal/
    directory/
    alerts/
    scanner/
  ui/
    primitives/
    overlays/
    charts/
```

Move gradually. Preserve behavior through tests.

---

## Pass 4.2 — Reduce App orchestration

`App.tsx` should become primarily composition:

```tsx
<AppShell>
  <Header />
  <PortfolioSummary />
  <RouteStage />
  <GlobalOverlays />
</AppShell>
```

Extract:

- trade workflow orchestration;
- modal state;
- Sheets side effects;
- analytics-history loading;
- notifications;
- scanner lifecycle.

---

## Pass 4.3 — Split `usePortfolioState`

Separate:

- presentation state;
- repository/persistence;
- ledger mutations;
- projections/reconciliation;
- remote hydration/polling;
- compatibility/localStorage concerns.

Target application-facing API:

```text
portfolio.load()
ledger.buy()
ledger.sell()
ledger.editExecution()
ledger.deleteExecution()
ledger.recordCashEvent()
portfolio.refreshQuotes()
```

Components should not care whether a save is an RPC, queue, or future implementation.

---

## Pass 4.4 — Shared Worker/Express API contracts

Production uses Cloudflare Worker + static assets. Express remains valuable for local development and compatibility.

Prevent route drift by sharing:

- request schemas;
- response schemas;
- scanner payload;
- auth/error semantics;
- route constants where practical.

No two runtimes should silently implement different field lists again.

---

## Pass 4.5 — CSS ownership consolidation

Only after Phase 10 visual closure.

Break the giant stylesheet into owned layers without changing appearance:

```text
tokens.css
materials.css
semantics.css
hierarchy.css
controls.css
overlays.css
motion.css
responsive.css
features/*.css
```

Introduce explicit cascade layers where useful.

Goals:

- reduce late overrides;
- reduce `!important`;
- make semantic glow/material ownership obvious;
- prevent a local repair from mutating unrelated accepted components.

Rendered screenshot baselines protect the refactor.

---

# 8. Stage 5 — Reports workspace redesign

**Detailed design authority:** `POST_OVERHAUL_REPORTS_WORKSPACE_REDESIGN_PLAN.md`.

This stage begins only after:

- Phase 10 is closed;
- Stage 2 financial integrity is closed;
- Stage 3 production convergence is closed;
- Stage 4 has established enough component ownership to move Reports safely.

The redesign is **information architecture**, not a calculation rewrite.

## R1 — Workspace architecture

Introduce internal modes:

- Overview;
- Analytics;
- Trading;
- Allocation;
- Monthly.

Add last-mode persistence.

Do not redesign report content yet.

Gate: switching/restoration works with zero calculation change.

---

## R2 — Split current long Reports page into workspaces

Move trusted existing components into their intended mode.

Nothing is removed.

Nothing is recalculated differently.

Gate: full functional parity with the existing long page.

---

## R3 — Diagnostic Reports Overview

Build a concise diagnostic layer around:

### Portfolio State
Dominant context.

### Trading Quality
Examples:

- Win Rate;
- Profit Factor;
- Expectancy.

### Risk & Costs
Examples:

- drawdown;
- fees;
- realized/unrealized state.

### Concentration
Examples:

- largest position/sector;
- top-3 concentration;
- cash share.

### Current Month
Examples:

- monthly P&L;
- liquidated vs holding contribution;
- closed-trade context.

Overview answers:

> How is the portfolio doing, and what deserves inspection?

It must not become a miniature full Reports page.

---

## R4 — Progressive disclosure

Depth model:

```text
headline
→ compact preview
→ one expanded preview
→ full workspace
```

Only one diagnostic preview expands at a time.

Each expanded preview gets a clear full-report action.

---

## R5 — Persistence/restoration polish

Validate:

- last mode restores;
- direct Open Analytics/Trading/Allocation/Monthly overrides remembered mode;
- bad/stale persisted values fall back safely;
- no restoration flicker.

---

## R6 — Responsive workspace pass

Validate phone, short landscape, tablet, desktop and 2XL.

The Reports navigation stays one horizontal row on small screens.

Full workspaces retain chart/table safety.

---

## R7 — Motion/state polish

Reuse existing motion language.

No new Reports-only animation system.

Cover:

- mode swap;
- preview expansion;
- loading;
- empty state;
- reduced motion.

---

## R8 — Regression closure

Validate:

- Overview diagnostic values;
- all Analytics modes/timeframes/Today resolutions;
- synchronized tooltips;
- 1W transition;
- realized trajectory;
- Trading filters/statistics;
- Allocation Holdings/Sectors/Cash;
- Monthly All/Liquidated/Holdings;
- exports;
- mode persistence;
- direct opening;
- phone/desktop/landscape.

Only after R8 is the Reports workspace redesign closed.

---

# 9. Stage 6 — Trust, reconciliation & financial lifecycle features

## Pass 6.1 — Broker reconciliation workspace

Allow a broker snapshot/import to be compared against app truth:

```text
Broker             App             Difference
COMI 500            500             ✓
TALM 320            640             +320
Cash 12,403.75      4,399.95        -8,003.80
```

Then identify the ledger events responsible for each discrepancy.

Correction must route through explicit ledger edits, never destructive derived-state patching.

---

## Pass 6.2 — Lightweight audit trail

Record material manual corrections:

- entity/transaction;
- before;
- after;
- timestamp;
- optional reason.

This is for personal traceability, not enterprise compliance.

---

## Pass 6.3 — Corporate actions

Introduce explicit lifecycle events before manual share/price corrections become necessary:

- SPLIT;
- REVERSE_SPLIT;
- BONUS_SHARES;
- RIGHTS_SUBSCRIPTION;
- CASH_DIVIDEND;
- STOCK_DIVIDEND;
- TENDER;
- MERGER/RESTRUCTURE.

Corporate actions must replay deterministically through positions, cost basis and historical analytics.

---

## Pass 6.4 — Ticker-attributed dividends

Store dividend source information such as:

- ticker;
- amount;
- eligible shares;
- ex-date;
- payment date;
- tax/fees when relevant.

Unlock:

- dividend income by company;
- yield on cost;
- portfolio income;
- price return vs total return.

---

# 10. Stage 7 — Portfolio intelligence

These features come after trust/accounting foundations.

## Pass 7.1 — Benchmark comparison

Add benchmark series such as EGX30, and later EGX70/EGX100 where appropriate.

For a selected timeframe show:

- portfolio return;
- benchmark return;
- relative return.

Do not reinterpret this as investment advice; it is contextual measurement.

---

## Pass 7.2 — Personal risk dashboard

Useful personal risk metrics:

- largest position;
- top-3 concentration;
- sector concentration;
- cash allocation;
- capital at stop-loss;
- potential portfolio loss if all current stops trigger;
- realized drawdown;
- current unrealized drawdown.

Avoid institutional metrics that are not actionable for the portfolio.

---

## Pass 7.3 — Position thesis model

Formalize fields around the existing target/stop/notes model:

- entry thesis;
- catalyst;
- invalidation;
- target;
- stop;
- expected horizon;
- planned risk.

On close:

- was thesis correct?;
- did execution follow the plan?;
- mistake category;
- review note.

This turns Journal into a learning tool rather than only a transaction viewer.

---

# 11. Stage 8 — Trading and execution analytics

Requires reliable timestamped executions and dependable intraday data.

## Pass 8.1 — Execution quality

For each BUY/SELL compare execution with nearby market observations:

- execution price;
- 1m reference;
- 5m/VWAP-like reference where defensible;
- slippage;
- time-of-day.

Aggregate:

- average buy slippage;
- average sell slippage;
- execution quality by time of day.

Never synthesize a reference if market observations are missing.

---

## Pass 8.2 — MFE / MAE

For closed cycles calculate:

- Maximum Favorable Excursion;
- Maximum Adverse Excursion.

Use stored market history and explicit coverage quality.

This helps distinguish:

- weak thesis;
- poor stop placement;
- premature exit;
- poor execution.

---

## Pass 8.3 — Position/event timeline

Create one chronological view containing:

- BUY;
- DCA;
- target/stop changes;
- thesis notes;
- SELL;
- dividend;
- corporate action;
- reconciliation/correction events.

The ledger remains authoritative; the timeline is a read model.

---

# 12. Stage 9 — Scanner and background-alert operationalization

The current sector-momentum scanner is a useful prototype but runs from React.

Current implication:

```text
app/PWA suspended or closed
        ↓
no foreground scan
        ↓
no new sector-cluster detection
```

Using a service worker to display a notification does not make the detector itself background/server-side.

## Pass 9.1 — Prove the data source

Before centralizing:

- validate quote freshness;
- validate RVOL/volume fields;
- validate session cadence;
- evaluate false positives;
- add diagnostics.

## Pass 9.2 — Central detector

Only after the source is trustworthy, move detection to an appropriate scheduled/server process.

Persist:

- scan timestamp;
- source timestamp;
- cluster evidence;
- dedup state.

Phone and PC must not maintain conflicting scanner histories.

## Pass 9.3 — Real push/notification delivery

Add an explicit notification delivery path only after central detection exists.

Keep scanner/alert logic separate from portfolio accounting.

---

# 13. Stage 10 — Long-term cleanup & archive closure

After active migrations/redesigns are complete:

- physically move historical implementation journals into `docs/archive/`;
- update/remove tests that bind obsolete doc paths;
- remove compatibility names containing Firestore when they no longer serve migration value;
- retire unused legacy endpoints;
- remove obsolete localStorage schema versions when safe;
- delete old deployment-trigger artifacts;
- reduce duplicate docs once canonical replacements exist.

Do not erase historical reasoning that explains financial or market-data invariants.

---

# 14. Explicitly deferred / not worth building yet

Until earlier stages close, do **not** prioritize:

- another navigation redesign;
- more glass/material variants;
- additional analytics modes merely for quantity;
- generic AI portfolio-advice features;
- dozens of scanner strategies embedded in the portfolio UI;
- direct Level 2 data coupling into accounting;
- another persistence backend;
- native mobile rewrite;
- multi-user/team/SaaS features;
- subscriptions/roles/collaboration.

This is a personal portfolio system. Reliability has higher value than product-surface expansion.

---

# 15. Traceability — audit finding to roadmap owner

| Audit finding | Roadmap owner |
| --- | --- |
| Visual closure unfinished | Stage 1 |
| Modal/viewport issues | Stage 1.1 |
| Need real rendered regression | Stage 1.3 |
| Optimistic financial writes | Stage 2.1–2.3 |
| Delete Position vs ledger authority | Stage 2.4 |
| FIFO helper conflicts with proportional accounting | Stage 2.4–2.6 |
| Deduct/add cash toggles violate ledger semantics | Stage 2.5 |
| Cash adjustment meaning is ambiguous | Stage 2.7 |
| Premium/default branch divergence | Stage 3.1–3.2 |
| 1m scheduler/default-branch mismatch | Stage 3.2–3.5 |
| Production-data audit still uses Bun after npm migration | Stage 3.3 |
| No proactive data trust surface | Stage 3.6 |
| App/usePortfolioState are oversized | Stage 4.2–4.3 |
| Worker/Express drift risk | Stage 4.4 |
| 5,000+ line CSS cascade | Stage 4.5 |
| Reports is a long scrolling workspace | Stage 5 / R1–R8 |
| Need broker truth reconciliation | Stage 6.1 |
| Need correction traceability | Stage 6.2 |
| Corporate actions missing | Stage 6.3 |
| Dividends lack source attribution | Stage 6.4 |
| No benchmark context | Stage 7.1 |
| Risk controls underused analytically | Stage 7.2 |
| Notes/targets not yet a full thesis system | Stage 7.3 |
| Execution quality unknown | Stage 8.1 |
| No MFE/MAE | Stage 8.2 |
| No unified position event history | Stage 8.3 |
| Sector scanner is foreground-only/local-history | Stage 9 |
| Historical docs are hard to navigate | Stage 0 + Stage 10 |

---

# 16. Per-pass definition of done

Every implementation pass should finish with:

1. scope stated before code changes;
2. intended invariant identified;
3. implementation limited to that scope;
4. focused tests added/updated;
5. relevant full regression gate run;
6. documentation updated;
7. known remaining work recorded in `STATUS.md`;
8. no unrelated accepted behavior reopened.

For financial/data changes also require:

9. before/after accounting or data-health verification;
10. explicit confirmation that no unrelated production accounting rows were mutated.

---

# 17. Immediate next action

The next implementation pass is:

> **Phase 10.8 — Modal & workflow consistency**

No Stage 2 financial behavior change should be mixed into 10.8.

After 10.10 closes, move directly to **Stage 2.1 — Canonical mutation executor** before starting Reports R1 or adding another major feature.
