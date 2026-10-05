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

**Historical transition:** Pass 2.2 followed this boundary and is now complete.

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

**Historical transition:** Pass 2.3 followed and is now complete.

---

## Pass 2.3 — Convert transaction edit/delete and cash workflows — COMPLETE / CI GREEN

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

No mixed optimistic/persist-first financial model remains **inside these source-ledger workflows**.

### 2.3 implementation record

Implemented through:

- `src/services/ledgerWorkflowMutations.ts`;
- `src/services/ocrLedgerMutations.ts`;
- pure cash-ledger preparation helpers;
- one shared executor helper in `usePortfolioState.ts`;
- persistence-aware Journal/OCR/Cash/Backup/Sheets UI contracts.

Accepted behavior:

- transaction edit/delete is persist-before-apply;
- edited BUY/SELL source cash fields are recomputed instead of retaining stale values;
- derived SELL P&L/outcome/holding data is rebuilt by reconciliation;
- cash add/edit/delete/dividend/adjustment shares the global mutation gate;
- OCR single uses canonical BUY/SELL and OCR batch persists as one candidate snapshot;
- backup and Sheets imports are ledger-authoritative;
- projection-only financial restores without a ledger are rejected;
- reconciliation itself persists its canonical result before success UI;
- transaction Undo persists the prior source ledger rather than reverting React state only;
- async destructive/edit/import modals do not claim success before persistence.

Exact-head validation:

- runtime: `d069f62d`;
- Phase 10 Visual Closure **#36944695939**;
- TypeScript passed;
- **84 / 84 test files, 475 / 475 tests**;
- production build and Worker dry-run green;
- 12 / 12 responsive geometries at 0px page overflow;
- 16 / 16 golden screenshots at 0.000% diff;
- Rendered Visual Regression **#36944695986** passed on the same runtime head.

CI also caught a real compatibility regression during the pass: legacy opening capital could be re-seeded after deleting it. The wrapper now honors the prepared capital value and the original cash-ledger regression test is green again.

**Next: Pass 2.4 — derived Position / Closed Cycle deletion ownership.**

---

## Pass 2.4 — Remove direct accounting deletion from derived Position / Closed Cycle — COMPLETE / CI GREEN

Positions and Closed Cycles are projections, not independent accounting records.

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

Also remove independent/local-only deletion of a derived Closed Cycle. A closed cycle may only change when its contributing ledger executions change.

Acceptance:

- no derived Position action silently deletes source ledger history;
- no derived Closed Cycle action hides/removes accounting history independently of the ledger;
- DCA + partial-sell correction behavior is deterministic and regression-tested.

### 2.4 implementation record

Implemented in:

- `src/services/ledgerProjectionOwnership.ts`;
- Open Positions correction action;
- Closed Cycles correction action;
- scoped Trading Journal correction mode;
- App navigation ownership cleanup;
- removal of the FIFO deletion helper and hook mutation.

Accepted behavior:

- Position/Closed Cycle no longer expose independent accounting deletion;
- Position correction scopes the **active aggregate-share cycle**, not FIFO lots;
- DCA + partial sell includes every execution in the active cycle;
- full close + reopen starts a fresh correction scope;
- Closed Cycle correction prefers canonical stored transaction IDs;
- legacy closed-cycle date/cycle matching is navigation fallback only;
- source transaction edit/delete remains the only way to correct accounting history;
- derived projections rebuild automatically after persisted ledger correction.

Exact-head validation:

- runtime/test head: `7a5d8bde`;
- Phase 10 Visual Closure **#36957879472**;
- TypeScript passed;
- **86 / 86 test files, 484 / 484 tests**;
- production build and Worker dry-run green;
- 12 / 12 responsive geometries at 0px page overflow;
- 16 / 16 rendered states passed;
- only intended visual changes: Positions desktop **0.021%**, Closed Cycles desktop **0.012%**;
- Rendered Visual Regression **#36957879457** passed;
- Intraday 1m Migration Smoke **#36957765990** passed on runtime commit `95c6b13a`.

**Next: Pass 2.5 — remove hidden trade cash modes.**

---

## Pass 2.5 — Remove hidden trade cash modes — COMPLETE / CI GREEN

Remove/retire:

- BUY `deductFromCash=false`;
- SELL `addToCash=false`;

from normal portfolio accounting.

A trade always records its real broker cash effect.

If cash differs from broker reality, record the real reason as a separate ledger event.

### 2.5 implementation record

Removed end-to-end:

- Add Trade cash-deduction checkbox;
- `deductFromCash` from modal/App/hook/preparation/validation contracts;
- `addToCash` from App/hook/preparation contracts;
- temporary Stage 2.2 rejection branches for those compatibility flags.

The Add Trade workflow keeps the cash impact visible as information, but no longer makes accounting optional.

Canonical trade rows now have one legal cash model:

```text
BUY  → negative broker cash impact including fees
SELL → positive broker cash impact net of fees
```

BUY pre-validation now rejects insufficient broker cash directly, matching the canonical persistence service.

Cash discrepancies must use an explicit ledger event.

Regression coverage:

- `Stage25CanonicalTradeCashEffect.test.ts`;
- Stage 2.2 source contract updated to require absence of bypass branches;
- BUY cash-availability validation always runs when authoritative cash is provided.

Exact-head validation:

- runtime: `208aa5e9`;
- Phase 10 Visual Closure **#37048999587**;
- TypeScript passed;
- **87 / 87 test files, 487 / 487 tests**;
- production build and Worker dry-run green;
- 12 / 12 responsive geometries at 0px page overflow;
- 16 / 16 rendered states passed;
- Rendered Visual Regression **#37048999583** passed.

The predecessor Stage 2.5 runtime `33fb9871` passed Intraday 1m Migration Smoke **#37048671583** before the validation-only follow-up commit.

**Next: Pass 2.6 — freeze weighted-average / proportional remaining cost as the single accounting basis.**

---

## Pass 2.6 — Freeze one cost-basis method — COMPLETE / CI GREEN

Canonical contract:

> **EGX Portfolio open-cost allocation uses weighted-average/proportional remaining cost.**

Implemented:

- added the explicit `WEIGHTED_AVERAGE_PROPORTIONAL` accounting method identifier;
- retained `calculateSellAccounting()` as the shared partial-SELL allocation authority;
- removed the independent FIFO reconstruction engine from Google Sheets;
- routed Sheets Position / Closed Trade reconstruction through `reconcilePortfolioFromLedger()`;
- preserved the Sheets no-live-price fallback to reconstructed weighted-average entry price;
- routed secondary analytics SELL replay through `calculateSellAccounting()`;
- corrected Closed Cycles so source BUY/SELL phases remain traceability-only while realized economics come from the canonical `ClosedTrade` projection;
- added `Stage26CanonicalCostBasis.test.ts` and aligned the frozen Closed Cycles source-contract test with the corrected accounting ownership.

Acceptance scenario:

```text
BUY 100 @ 10, buy fee 10
BUY 100 @ 20, buy fee 20
SELL 100 @ 30, sell fee 30

canonical allocated gross cost = 1,500
canonical allocated buy fees  = 15
remaining shares              = 100
remaining average buy price   = 15
remaining buy fees            = 15
realized P&L                  = 1,455
```

Validated runtime:

- `c12e7404`;
- Phase 10 Visual Closure **#37096359624**;
- TypeScript passed;
- **88 / 88 test files, 493 / 493 tests**;
- production build and Worker dry-run green;
- **12 / 12** responsive geometries at 0px page overflow;
- **16 / 16** rendered states passed;
- Rendered Visual Regression **#37096359625** passed.

No FIFO helper remains in an accounting/import path for remaining-cost ownership.

**Next: Pass 2.7 — clarify cash-adjustment semantics.**

---

## Pass 2.7 — Clarify cash-adjustment semantics — COMPLETE / CI GREEN

Stage 2.7 replaces one ambiguous cash-adjustment meaning with an explicit semantic taxonomy.

Canonical classes:

```text
capital:
  DEPOSIT
  WITHDRAWAL

performance:
  DIVIDEND
  FEE
  OTHER_INCOME
  OTHER_EXPENSE

bookkeeping / return-neutral:
  RECONCILIATION_ADJUSTMENT
```

Implemented:

- added `cashFlowSemantics.ts` as the normalization/sign/classification authority;
- changed new manual cash-balance correction writes to `RECONCILIATION_ADJUSTMENT`;
- retained `CASH_ADJUSTMENT` as read-only backward compatibility and normalize it to the canonical reconciliation type;
- limited contributed-capital changes to DEPOSIT/WITHDRAWAL;
- kept dividends, fees and other income/expense inside portfolio performance;
- neutralized reconciliation adjustments in TWR/MWRR without adding them to `netDeposits`;
- separated trading realized P&L, cash performance P&L and bookkeeping reconciliation in the equity bridge;
- added cash performance to secondary realized-P&L replay;
- applied the same semantics to Today/intraday reconstruction;
- preserved synthetic opening capital when reconciliation is the only explicit neutral cash flow;
- normalized imported cash rows to BUY/SELL direction according to semantic signed impact;
- preserved signed legacy reconciliation imports;
- extended Google Sheets Transaction Logger with `Cash Flow Type` / `Cash Flow Amount` and made old headers upgrade on write;
- made Cash Ledger audit copy acknowledge full canonical ledger replay when extended cash semantics exist.

Regression coverage includes:

- capital/performance/reconciliation separation;
- legacy `CASH_ADJUSTMENT` migration;
- signed reconciliation import;
- OTHER_INCOME / OTHER_EXPENSE / FEE direction;
- return-neutral reconciliation with capital-only net deposits;
- legacy opening-capital + reconciliation interaction;
- secondary realized-P&L composition;
- Sheets semantic round-trip;
- source guard preventing new normal runtime writers from emitting legacy `CASH_ADJUSTMENT`.

Validated runtime:

- `899bb4fa`;
- Phase 10 Visual Closure **#37099343374**;
- TypeScript passed;
- **89 / 89 test files, 504 / 504 tests**;
- production build and Worker dry-run green;
- **12 / 12** responsive geometries at 0px page overflow;
- **16 / 16** rendered states passed;
- Rendered Visual Regression **#37099343371** passed.

**Next: Pass 2.8 — financial acceptance suite.**

---

## Pass 2.8 — Financial acceptance suite — COMPLETE / CI GREEN

Stage 2.8 closes Stage 2 with cross-workflow acceptance coverage rather than adding a second accounting implementation.

Implemented:

- `src/services/Stage28FinancialAcceptance.test.ts`;
- stale-device accounting-write quote safety coverage in `src/services/supabaseStorage.test.ts`.

Acceptance scenarios now cover:

- multiple DCA buys;
- proportional partial sells;
- repeated partial sells;
- full close and reopen;
- source BUY correction after partial sell;
- failed authoritative persistence across every Stage 2 mutation family;
- duplicate OCR execution import;
- dated deposit/withdrawal inside the selected performance period;
- dividends and fees as portfolio performance;
- reconciliation adjustment as return-neutral bookkeeping;
- deterministic same-day round trip ordering;
- stale-device accounting write rebased on the latest remote quote;
- Stage 2 source-contract guards for persist-before-apply, projection ownership, canonical cost basis and hidden cash-mode removal.

### Stage 2 exit gate — CLOSED

Verified:

- every financial mutation is persistence-confirmed before local apply;
- Position / Closed Cycle are projection-only for accounting;
- `WEIGHTED_AVERAGE_PROPORTIONAL` is the canonical cost-basis method;
- hidden cash modes are gone;
- persistence failure leaves previous local financial state intact;
- capital/performance/reconciliation cash semantics stay distinct;
- accepted visual behavior remains frozen.

Validated runtime:

- `70ad1148`;
- Phase 10 Visual Closure **#37121788769**;
- TypeScript passed;
- **90 / 90 test files, 513 / 513 tests**;
- production build and Worker dry-run green;
- **12 / 12** responsive geometries at 0px page overflow;
- **16 / 16** rendered states passed;
- Rendered Visual Regression **#37121788757** passed.

**Stage 2 is complete.**

**Next: Pass 3.1 — reconcile branch divergence.**

---

# 6. Stage 3 — Production, CI & market-data convergence

## Pass 3.1 — Reconcile branch divergence — COMPLETE / CI GREEN

The live pre-integration comparison on 2026-10-03 was:

- `feature/premium-ui-redesign` **1,466 commits ahead of `main`**;
- **12 commits behind `main`**;
- merge base `ce142a02`;
- `main` head `3259bb67`.

All 12 main-only commits were reviewed individually and recorded in:

- `docs/STAGE3_BRANCH_DIVERGENCE_REVIEW.md`.

Classification result:

- **1 required** — restore the missing unified-analytics history-gap signal test;
- **9 superseded by premium** — the useful historical-repair implementation already exists in newer premium form;
- **2 obsolete** — Render deployment blueprint and the old merge node as independent content;
- **0 unresolved conflicts**.

Integration sequence:

1. restored the required test in `1c212324`;
2. created reviewed two-parent merge `356740d5`, preserving the premium tree while making `main` a parent;
3. added `Stage31BranchConvergence.test.ts` to guard retained historical repair behavior and Cloudflare deployment authority.

Post-integration comparison:

- **0 commits behind `main`**;
- branch status: **ahead**;
- obsolete `render.yaml` remains absent.

Validated runtime:

- `6a842b7d`;
- Phase 10 Visual Closure **#37123523107**;
- TypeScript passed;
- **91 / 91 test files, 517 / 517 tests**;
- production Vite/PWA build passed;
- Cloudflare Worker dry-run passed;
- **12 / 12** responsive geometries at 0px page overflow;
- **16 / 16** rendered states passed;
- Rendered Visual Regression **#37123523123** passed.

**Next: Pass 3.2 — make the default production branch authoritative.**

---

## Pass 3.2 — Make the default production branch authoritative — COMPLETE / CI GREEN

`main` is now the repository production/default authority.

Implemented:

- changed all branch-scoped production/diagnostic workflow triggers from `feature/premium-ui-redesign` to `main`;
- preserved schedule-only workflows as default-branch consumers;
- added `src/services/Stage32ProductionBranchAuthority.test.ts`;
- fast-forward promoted `main` to the reviewed premium production tree without force or history rewrite;
- made the exact-head contract commit directly on `main`;
- mirrored the old premium branch to `main` only for compatibility, removing it as an independent production truth.

Promotion evidence from `main`:

- Intraday 1m Diagnostic **#37131125252** — success;
- Intraday 1m Migration Smoke **#37131125291** — success;
- EGX Ticker Registry **#37131125243** — success;
- Quality Checks **#37131157043** — success.

Supabase production verification confirmed:

- project status **ACTIVE_HEALTHY**;
- `replace_portfolio_accounting_snapshot` exists;
- `price_history` exists;
- `intraday_price_history` exists;
- `ticker_registry` exists;
- current intraday/ticker-registry migrations are recorded in production migration history.

Validated runtime:

- `main@00afd739`;
- Phase 10 Visual Closure **#37131157044**;
- TypeScript passed;
- **92 / 92 test files, 522 / 522 tests**;
- production build and Worker dry-run green;
- **12 / 12** responsive geometries at 0px page overflow;
- **16 / 16** rendered states passed;
- Rendered Visual Regression **#37131157017** passed.

Deferred intentionally to Pass 3.3:

- npm/Bun production-audit normalization;
- final legacy automation retirement/concurrency cleanup.

**Next: Pass 3.3 — automation normalization.**

---

## Pass 3.3 — Automation normalization — COMPLETE / CI GREEN

Automation now follows one production contract.

### Canonical toolchain

All production workflows use:

- Node **22**;
- npm **11.6.0**;
- committed `package-lock.json`;
- `npm ci --no-audit --no-fund`.

The previous Bun-only production-audit path is removed.

### Intraday writer ownership

Every workflow that persists intraday bars shares:

```text
group: egx-intraday-market-data
cancel-in-progress: false
```

This includes:

- scheduled raw 1m / derived 5m sync;
- production-writing 1m migration smoke;
- manual legacy direct 5m repair.

The diagnostic workflow does not join the writer lock because it does not persist bars.

### Legacy producer containment

`.github/workflows/intraday-prices.yml` is manual-only:

- `workflow_dispatch` only;
- no schedule;
- no push trigger.

Only `.github/workflows/intraday-1m-sync.yml` is a scheduled intraday bar writer.

### Regression guard

Added:

- `src/services/Stage33AutomationNormalization.test.ts`.

It guards:

- Node/npm/lockfile ownership;
- removal of Bun workflow commands;
- shared writer concurrency;
- manual-only legacy 5m repair;
- exactly one scheduled intraday writer;
- read-only production-audit permissions and canonical npm command.

Validated runtime:

- `main@15f47190`;
- PR #39 Quality Checks **#37149643306** passed;
- main Quality Checks **#37149729081** passed;
- Intraday 1m Diagnostic **#37149729036** passed;
- Intraday 1m Migration Smoke **#37149729061** passed;
- EGX Ticker Registry **#37149729046** passed;
- Phase 10 Visual Closure **#37149729005** passed;
- **93 / 93 test files, 527 / 527 tests**;
- production build and Worker dry-run green;
- **12 / 12** geometries at 0px overflow;
- **16 / 16** rendered states passed;
- Rendered Visual Regression **#37149729076** passed.

The live read-only production-data audit itself is intentionally part of Pass 3.4's final exact-head candidate gate.

**Next: Pass 3.4 — exact-head quality gate.**

---

## Pass 3.4 — Exact-head quality gate — COMPLETE / CI GREEN

Canonical workflow:

- `.github/workflows/production-candidate-gate.yml`.

The gate is intentionally non-writing and manually reusable after its initial `main` promotion run.

Validated candidate:

- `main@ce60f932`;
- Production Candidate Gate **#37180662256 — success**.

Same-head checks:

- clean `npm ci` — passed;
- candidate-delta `git diff --check` — passed;
- TypeScript — passed;
- full Vitest — **94 / 94 files, 531 / 531 tests**;
- focused intraday — **9 / 9 files, 49 / 49 tests**;
- focused ticker registry — **3 / 3 files, 22 / 22 tests**;
- Vite/PWA production build — passed;
- Cloudflare Worker dry-run — passed;
- live read-only production-data audit — passed.

Production audit returned:

- **0 issues**;
- stored/rebuilt positions **8 / 8**;
- stored/rebuilt cash **EGP 12,301.85 / EGP 12,301.85**;
- duplicate-equivalent transactions **0**;
- missing market execution timestamps **0**;
- stored/rebuilt closed trades **30 / 30**;
- stored/rebuilt realized P&L **EGP 116.72 / EGP 116.72**;
- latest daily history **2026-10-01**, no open-ticker gaps;
- latest intraday session **2026-10-01**, no open-ticker gaps.

The initial candidate `d868fd42` exposed historical whole-tree whitespace debt because the first implementation compared the repository against an empty tree. That was a gate-scope error, not a runtime failure. PR #41 corrected the check to the candidate delta; no unrelated accepted source was rewritten.

Supporting same-head workflows:

- Quality Checks **#37180662247** — success;
- Phase 10 Visual Closure **#37180662178** — success;
- Rendered Visual Regression **#37180662271** — success.

**Next: Pass 3.5 — live-session soak.**

---

## Pass 3.5 — Live-session soak — FAILED / DEFERRED TECHNICAL DEBT

The soak harness is deployed on `main@7299c623`.

Canonical implementation:

- `scripts/verifyLiveSessionSoak.ts`;
- `.github/workflows/live-session-soak.yml`;
- `npm run verify:live-session-soak`;
- `src/services/Stage35LiveSessionSoak.test.ts`.

Five read-only checkpoints cover pre-open, early session, mid-session, near close and post-grace close for **2026-10-04**.

The verifier reuses the production authorities rather than reimplementing them:

- `resolveIntradaySessionTickers()`;
- `aggregateIntradayBars()`;
- `selectBestIntradayResolution()`;
- `reconcilePortfolioFromLedger()`;
- `applyLivePricesToPortfolio()`;
- `buildIntradayAnalyticsResult()`.

Automated acceptance covers:

- accounting snapshot reconciliation;
- advancing 1m session coverage;
- exact 1m → derived 5m reconstruction;
- no competing direct 5m producer in the target session;
- strict manual 1m behavior;
- same-session Auto selection;
- production scanner proxy health;
- complete held-ticker live reference;
- Today/reference NAV convergence;
- post-close daily history advancement.

The previous completed session, **2026-10-01**, provides a calibrated baseline: all eight current holdings had 1m observations from 10:00 through 14:29 Cairo and derived 5m through 14:25.

Still requires one physical-app observation:

- phone and desktop show the same authoritative portfolio snapshot/value.

Do not close this pass from CI alone. Close only after the strict post-close run and device-parity observation are recorded.

**Deferral record — 2026-10-04:** the failed scheduler-ingestion soak is intentionally carried as technical debt for one session while Stage 3.6 proceeds. Retry is scheduled for **2026-10-05**. Stage 3.5 remains open and cannot be silently closed by Stage 3.6.

---

## Pass 3.6 — Data Health Center — IMPLEMENTED / CI GREEN

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

### 3.6 implementation record

Merged through PR #45 at `main@f5ae6ad6`. PR Quality Checks passed TypeScript, **98 / 98 test files, 550 / 550 tests**, and the production build.

Implemented source direction:

- read-only `dataHealth.ts` authority derives one held-universe health snapshot from Supabase;
- the frozen Header Settings affordance opens `DataHealthCenterModal` without adding a new primary Header action;
- health checks distinguish expected EGX session from the latest persisted raw-1m session so an older complete session cannot look healthy;
- derived 5m tail alignment is checked against each held ticker's latest raw 1m five-minute bucket;
- daily history, live quote freshness, ticker registry resolution, portfolio sync age and last ingestion are visible;
- Vite embeds the exact build commit for the diagnostics surface;
- the surface is diagnostic only: no accounting writes and no synthetic market data.

Stage 3.6 does **not** waive the Stage 3.5 live-session gate.

### Stage 3 exit gate

One promoted production truth, one active ingestion model, exact-head CI clean, and a live-session verification record.

---

# 7. Stage 4 — Architecture consolidation

This is a **refactor, not a rewrite**.

## Pass 4.1 — Establish module ownership — COMPLETE / CI GREEN

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

### 4.1 implementation record

Merged through PR #46 at `main@9d43f7c5`.

Implemented:

- canonical source-level ownership map;
- accounting, performance and market domain facades;
- Supabase data boundary;
- Google Sheets and OCR integration facades;
- Portfolio and Reports feature facades;
- regression coverage preventing business logic from being duplicated into the facade layer.

Quality Checks passed before merge.

---

## Pass 4.2 — Reduce App orchestration — COMPLETE / CI GREEN

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

### 4.2 implementation record

Merged through PR #47 at `main@e8b74f24`.

Implemented:

- `usePortfolioNavigation()` owns tab transitions and ledger-correction routing;
- `useAppOverlayState()` owns modal/overlay state;
- `useAppNotifications()` owns toast timing and persisted Undo orchestration;
- `useHistoricalPortfolioAnalytics()` owns history loading, trustworthy backfill and visual-regression isolation;
- `useLivePriceSheetMirror()` owns live-price Google Sheets mirroring/throttling;
- `usePortfolioWorkflows()` owns BUY/SELL, edit/delete, OCR, reconciliation, cash and post-persistence Sheets sequencing;
- existing scanner/alert lifecycle remains isolated in its dedicated hooks rather than returning to App;
- App moved onto Stage 4.1 Portfolio/Reports/domain facades where applicable;
- older Stage 2/3 source-contract tests were migrated to the new owners instead of reintroducing orchestration into App.

Validation on PR #47 Quality Checks #37228318969:

- TypeScript passed;
- **100 / 100 test files, 556 / 556 tests passed**;
- production build passed.

`App.tsx` no longer owns `useState`, `useEffect`, or `useRef` workflow state machines.

**Next: Pass 4.3 — split `usePortfolioState`.**

---

## Pass 4.3 — Split `usePortfolioState` — COMPLETE / CI GREEN

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

### 4.3 implementation record

Merged through PR #48 at `main@38e1986c`.

The legacy `usePortfolioState()` return shape remains as a compatibility facade, while implementation ownership is now split into:

- `state/usePortfolioLocalState.ts` — React-facing portfolio state;
- `state/portfolioCompatibility.ts` — localStorage/legacy initialization and metadata rehydration;
- `hydration/usePortfolioHydration.ts` — initial authoritative load, retry and subscription lifecycle;
- `persistence/portfolioRepository.ts` — Supabase-backed repository adapter;
- `persistence/usePortfolioRepositoryActions.ts` — direct repository actions/force sync;
- `ledger/usePortfolioLedgerMutations.ts` — canonical persisted ledger mutation execution.

Older Stage 2 and visual source-contract tests now follow the canonical owners instead of forcing implementation back into the compatibility hook.

Validation on the original broad PR #48 was green, but Stage 4.3 is now being accepted in smaller gates to avoid oversized implementation passes.

Granular acceptance sequence:

- **4.3.1 — local state + compatibility cache — ACCEPTED / CI GREEN** via PR #50 at `main@b0ecb4b7`; Quality Checks #37229492006 passed TypeScript, **103 / 103 test files, 566 / 566 tests**, and production build.
- **4.3.2 — remote hydration/subscription ownership — ACCEPTED / CI GREEN** via PR #51 at `main@dce45fc6`; Quality Checks #37230637442 passed TypeScript, **104 / 104 test files, 571 / 571 tests**, and production build.
- **4.3.3 — canonical ledger mutation ownership — ACCEPTED / CI GREEN** via PR #52 at `main@87a10cd4`; Quality Checks #37231285634 passed TypeScript, **105 / 105 test files, 577 / 577 tests**, and production build.
- **4.3.4 — repository/persistence action ownership — ACCEPTED / CI GREEN** via PR #53 at `main@4653347c`; Quality Checks #37240842829 passed TypeScript, **106 / 106 test files, 583 / 583 tests**, and production build.
- **4.3.5 — compatibility facade cleanup + regression closure — ACCEPTED / CI GREEN** via PR #54 at `main@98ca8653`; Quality Checks #37241869884 passed TypeScript, **107 / 107 test files, 588 / 588 tests**, and production build.

Stage 4.3 is now fully closed through the granular acceptance sequence.

The broad Stage 4.4 implementation already exists on `main`, but its acceptance will likewise be broken into small validation sub-passes before Stage 4.5. The next execution point is **4.4.1 — shared route/request contract authority validation**.

---

## Pass 4.4 — Shared Worker/Express API contracts — IMPLEMENTATION LANDED / GRANULAR ACCEPTANCE ACTIVE

Production uses Cloudflare Worker + static assets. Express remains valuable for local development and compatibility.

Prevent route drift by sharing:

- request schemas;
- response schemas;
- scanner payload;
- auth/error semantics;
- route constants where practical.

No two runtimes should silently implement different field lists again.

### 4.4 implementation record

Merged through PR #49 at `main@b2e15e6a`.

Implemented:

- `src/api/contracts.ts` as the shared API route/method/request/error/health contract;
- Cloudflare Worker and Express/Vite now consume the same route constants;
- shared price-tick, ticker-list, symbol-search and backfill request parsing;
- shared auth-error classification;
- health responses now share one versioned shape while preserving runtime identity;
- the existing EGX scanner request payload remains a shared authority;
- intentional runtime capability differences are explicit rather than silent: Node owns on-demand history repair, service-account Sheets and migration; Worker keeps compatibility/no-op or unavailable behavior where designed;
- Stage 3 route guards now follow the shared route authority.

Validation on the original broad PR #49 Quality Checks #37229111809:

- TypeScript passed;
- **102 / 102 test files, 563 / 563 tests passed**;
- production build passed.

The broad implementation is now being revalidated through smaller acceptance gates:

- **4.4.1 — shared route/request contract authority — ACCEPTED / CI GREEN** via PR #55 at `main@895dc351`; Quality Checks #37242757469 passed TypeScript, **108 / 108 test files, 593 / 593 tests**, and production build.
- **4.4.2 — auth/error response contract parity — ACCEPTED / CI GREEN** via PR #56 at `main@41f37430`; Quality Checks #37243628532 passed TypeScript, **109 / 109 test files, 599 / 599 tests**, and production build.

Do not advance Stage 4.4 as fully accepted merely because later broad implementation code already exists on `main`.

- **4.4.3 — runtime capability/deprecation contract validation — ACCEPTED / CI GREEN** via PR #57 at `main@406c171d`; Quality Checks #37245209262 passed TypeScript, **110 / 110 test files, 606 / 606 tests**, and production build.
- **4.4.4 — Google Sheets payload/response contract consolidation — ACCEPTED / CI GREEN** via PR #58 at `main@40fa5b81`; Quality Checks #37247685414 passed TypeScript, **111 / 111 test files, 611 / 611 tests**, and production build.
- **4.4.5 — scanner request/response contract closure — NEXT**

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
