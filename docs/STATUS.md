# EGX Portfolio — Current Status

## Purpose

This is the short current-state document.

Update it after every accepted implementation pass. Detailed historical reasoning belongs in the domain/phase documents; sequencing belongs in `MASTER_STABILIZATION_ROADMAP.md`.

## Snapshot

**Date:** 2026-10-02  
**Active development branch:** `feature/premium-ui-redesign`  
**Current validated runtime head:** `7a5d8bde` — Stage 2.4 projection ownership / ledger-correction workflow  
**Current full exact-head verification:** Phase 10 Visual Closure #36957879472 on `7a5d8bde`  
**Application type:** private/personal EGX portfolio tracker  
**Primary database/auth:** Supabase Postgres + Supabase Auth  
**Production web runtime:** Cloudflare Worker serving Vite assets and `/api/*` routes  
**Local/development compatibility runtime:** Express/Vite via `server.ts`

Documentation-only commits may be newer than the runtime baseline above.

---

## Current execution point

### Visual system

**Phase 10 is CLOSED / CI CLEAN.**

Completed:

- 10.7A Overview;
- 10.7B Open Positions;
- 10.7C Closed Cycles;
- 10.8 Modal & workflow consistency;
- 10.9 Responsive cross-app parity;
- rendered browser regression harness;
- **10.10 exact-head visual regression closure.**

Frozen visual contracts now remain protected while the roadmap moves into financial integrity work.

Financial-integrity work has started.

Completed:

- **Stage 2.1 — Canonical financial mutation executor**
- **Stage 2.2 — BUY and SELL persist-confirmed migration**
- **Stage 2.3 — Transaction/cash/OCR/import/reconciliation workflow migration**
- **Stage 2.4 — Derived Position / Closed Cycle projection ownership**

Next:

1. **Stage 2.5 — Remove hidden trade cash modes**

---

### Phase 10.8 validation

Runtime head `d3395be5` passed **Intraday 1m Migration Smoke #36643635140** end-to-end:

- TypeScript passed;
- focused intraday regression suite passed;
- ACTF/NAPR/ORAS rebuild path passed;
- session-relevant portfolio-universe sync passed.

10.8 standardized all 13 inventoried modal/workflow owners on the shared body-level modal contract, including Visual Viewport keyboard safety and one-scroll-owner behavior.

Historical 10.8 note: full-suite/build/rendered closure was intentionally deferred at that pass and is now satisfied by Phase 10.10 run #36921005365.

---

### Phase 10.9 validation

Runtime head `74741fa9` passed **Intraday 1m Migration Smoke #36647092353** end-to-end:

- TypeScript passed;
- focused intraday regression suite passed;
- ACTF/NAPR/ORAS rebuild path passed;
- session-relevant portfolio-universe sync passed.

Source parity now explicitly covers the 320/359 narrow-phone tier, 390/430 phone layouts, short landscape, tablet, laptop, desktop and 2XL containment rules without reopening the frozen Header or chart behavior.

Historical 10.9 note: the rendered evidence gap was intentionally deferred and is now satisfied by the golden-baseline harness plus Phase 10.10 exact-head closure.

---

### Rendered regression validation

The Phase 10 rendered layer is now active and green.

Deterministic runtime head `ac7703b3` passed **Intraday 1m Migration Smoke #36917666997**.

Tracked golden baselines were established in `6b61b321` only after manual artifact inspection.

Required-baseline Chromium run **#36918687347** on verification head `38bc2b4f` reported:

- **12 / 12 responsive geometry checks at 0px page-level horizontal overflow**;
- **16 / 16 golden screenshots passed**;
- **0.000% pixel diff for every golden state**;
- no rendered-regression errors;
- baseline promotion correctly skipped because baselines already existed.

The bootstrap capture initially exposed a Supabase-configuration message inside the analytics surface. That image was rejected; deterministic local visual history/intraday isolation was added before the golden set was promoted.

---

### Phase 10.10 final closure

Runtime head `50db10b2` passed **Phase 10 Visual Closure #36921005365** on October 1, 2026.

Same-head results:

- TypeScript: passed;
- full Vitest: **77 / 77 files, 435 / 435 tests**;
- production Vite/PWA build: passed;
- Cloudflare Worker `wrangler deploy --dry-run`: passed;
- deterministic Chromium required-baseline comparison: passed;
- responsive geometry: **12 / 12 widths at 0px page overflow**;
- golden images: **16 / 16 at 0.000% diff**.

The closure gate initially exposed four obsolete source-string contracts. They were updated to assert the current accepted architecture; production visuals/business/data logic were not changed to satisfy stale tests.

**Visual system state: CLOSED / CI CLEAN.**

Next execution point: **Stage 2.1 — Canonical financial mutation executor.**

---

### Stage 2.1 financial mutation boundary

Runtime head `eb3f776e` introduces:

`src/services/ledgerMutationService.ts`

Canonical ordering is now defined as:

```text
prepare → validate → persist → apply → report
```

The executor:

- accepts a candidate source ledger rather than caller-computed accounting projections;
- rebuilds positions, closed cycles and cash through `reconcilePortfolioFromLedger()`;
- validates finite/positive financial values and duplicate transaction IDs;
- rejects newly introduced reconciliation discrepancies;
- tolerates an already-existing discrepancy long enough for explicit correction;
- serializes financial mutations so two stale candidate snapshots cannot be in flight concurrently;
- persists through the existing atomic Supabase accounting snapshot RPC;
- applies local state only after persistence succeeds;
- distinguishes a rare post-persistence local apply failure from a failed database write.

Stage 2.1 deliberately does **not** convert BUY/SELL yet. Existing workflow behavior is unchanged until Stage 2.2.

Validation run **#36924616787** passed on the exact runtime head:

- TypeScript;
- **79 / 79 Vitest files, 447 / 447 tests**;
- production Vite/PWA build;
- Cloudflare Worker dry-run;
- 12/12 responsive geometry checks at 0px page overflow;
- 16/16 frozen golden screenshots at 0.000% diff.

Stage 2.1 also exposed a target/stop metadata ownership mismatch. That issue was deliberately resolved in Stage 2.2: position/BUY-authored target, stop and notes now take precedence over ticker-directory defaults during canonical reconciliation.

See `FINANCIAL_MUTATION_CONTRACT.md`.

---

### Stage 2.2 persist-confirmed BUY/SELL

Runtime head `d012aeff` converts both user-facing trade mutations onto the canonical executor.

BUY and SELL now:

- prepare a candidate ledger through `tradeLedgerMutations.ts`;
- execute through the shared `ledgerMutationService`;
- rebuild positions, closed cycles and cash from the ledger;
- persist the complete canonical accounting snapshot before local financial state changes;
- leave the previous local financial state intact when prepare/validate/persist fails;
- keep Add Trade / Sell modals open on a failed write;
- disable submit/cancel paths while the mutation is unresolved;
- close and show success only after authoritative persistence;
- run the optional Google Sheets mirror only after portfolio persistence has succeeded;
- serialize against every other executor-backed financial mutation.

The rare `persisted: true / APPLY_FAILED` case is handled distinctly: the user is told the trade is already authoritative and should reload instead of retrying and creating a duplicate.

### Trade-accounting prerequisites fixed

Persist-first BUY exposed a pre-existing projection-metadata ownership bug that optimistic local state had been masking.

Canonical reconciliation now preserves:

```text
position-authored target/stop/notes
  → BUY-authored metadata
  → ticker-directory defaults
```

Ticker-directory target/stop values are defaults, not owners of portfolio thesis metadata.

Accounting ownership remains unchanged:

- shares;
- average cost;
- fees;
- cash;
- realized P&L;
- closed cycles

are still ledger-derived.

### Hidden cash modes during migration

The legacy flags remain in the current UI/API surface until Stage 2.5 removes them completely, but Stage 2.2 no longer permits them to create noncanonical money:

- BUY with `deductFromCash=false` is rejected;
- SELL with `addToCash=false` is rejected.

A real trade always changes broker cash. Any reconciliation difference must be represented by an explicit ledger event.

### Validation

Exact-head **Phase 10 Visual Closure #36941746467** passed on `d012aeff`:

- TypeScript;
- **81 / 81 Vitest files, 462 / 462 tests**;
- production Vite/PWA build;
- Cloudflare Worker `wrangler deploy --dry-run`;
- 12 / 12 responsive geometries at 0px page overflow;
- 16 / 16 frozen golden screenshots at 0.000% diff.

Independent **Intraday 1m Migration Smoke #36941746472** also passed on the same head, including:

- TypeScript;
- focused intraday regression suite;
- ACTF/NAPR TradingView 1m rebuild;
- current session-relevant portfolio-universe sync.

No market-data or visual regression was introduced by the financial mutation migration.

---

### Stage 2.3 unified persisted ledger workflows

Runtime head `d069f62d` removes the remaining in-scope mixed optimistic/persist-first ledger workflows.

All of the following now execute through the **same** `ledgerMutationService` instance used by BUY/SELL:

- transaction edit;
- transaction delete;
- cash deposit;
- cash withdrawal;
- dividend;
- cash adjustment;
- cash-ledger edit/delete;
- manual ledger reconciliation;
- OCR single trade through the Stage 2.2 BUY/SELL path;
- OCR batch as one candidate-ledger mutation;
- JSON backup restore;
- Google Sheets ledger import;
- persisted Undo of transaction changes.

### Transaction edit integrity

Editing a trade now rebuilds source financial fields from shares/price/fees instead of retaining stale cached values.

For BUY:

- gross value;
- total outlay;
- negative net cash impact

are recomputed.

For SELL:

- gross proceeds;
- net proceeds

are recomputed, while editable/stored `realizedPnlEgp`, `realizedPnlPercent`, `outcome` and `holdingDays` are cleared as source facts and re-derived by reconciliation.

### OCR batch integrity

OCR batch import no longer mutates App financial state row-by-row.

The complete candidate batch is prepared first, including:

- duplicate execution blocking;
- dependency-aware BUY-before-SELL handling;
- proportional SELL accounting;
- unreconcilable SELL skipping.

One canonical snapshot is then persisted. A failed write leaves the previous financial state untouched.

### Restore/import integrity

Backup and Google Sheets imports now treat the transaction ledger as authority.

Imported:

- positions;
- closed trades;
- cash balance

are **not** independent accounting sources.

Positions may seed stable IDs / portfolio metadata, but shares, cost, cash, realized P&L and closed cycles are rebuilt from the imported ledger.

Projection-only backups containing financial state but no transaction ledger are rejected rather than allowed to overwrite ledger-authoritative accounting.

### Cash workflow consolidation

The old cash-specific in-flight/write path is gone.

Cash add/edit/delete/adjustment now uses the global executor lock and the same persistence ordering as trades.

The migration exposed and fixed one regression during CI: deleting legacy synthetic opening capital could be accidentally re-seeded by a compatibility wrapper. The corrected wrapper reconciles using the **prepared capital value**, preserving a real deletion.

### Workflow UI behavior

Persistence-aware UI now includes:

- transaction editor stays open while save is unresolved and on failure;
- async transaction delete confirmation stays open if deletion fails;
- OCR scanner locks while saving;
- Quick Cash closes only after persistence;
- Backup restore/reconciliation waits for persistence;
- Google Sheets import reports success only after the authoritative portfolio snapshot succeeds.

### Validation

Exact-head **Phase 10 Visual Closure #36944695939** passed on `d069f62d`:

- TypeScript: passed;
- **84 / 84 Vitest files, 475 / 475 tests**;
- production Vite/PWA build: passed;
- Cloudflare Worker `wrangler deploy --dry-run`: passed;
- 12 / 12 responsive geometries at 0px page overflow;
- 16 / 16 frozen golden screenshots at 0.000% diff.

Separate **Rendered Visual Regression #36944695986** also passed on the same runtime head.

The Stage 2.3 changes do not touch the market-data ingestion implementation.

### Remaining financial mutation exceptions

Stage 2.3 intentionally does **not** normalize derived-record deletion.

Current legacy exceptions are now isolated for the next pass:

- Position deletion still infers/deletes contributing BUY rows through `getOpenBuyTransactionIdsForTicker()`;
- Closed-cycle deletion can still hide a derived closed-trade projection locally.

Those are projection-ownership problems, not ordinary ledger edit/import workflows.

They move together into **Stage 2.4**.

---

### Stage 2.4 projection ownership and ledger correction

Runtime head `7a5d8bde` removes the remaining user-facing projection-as-source deletion paths.

Positions and Closed Cycles are now treated as what the accounting model says they are:

> deterministic projections of the source transaction ledger.

#### Open Position correction

The old **Delete Position Record** action and its confirmation modal are gone.

The replacement action opens the Transaction Ledger in a scoped correction mode.

For an active position, `ledgerProjectionOwnership.ts` finds the current active trade cycle by **aggregate running shares**, not FIFO lot ownership.

Example:

```text
BUY 100 @ 10
BUY 100 @ 20
SELL 100
```

The open 100-share position's correction scope contains **all three source executions**.

It does not treat the second BUY as the sole remaining owner.

After a full close and later reopen, the scope resets to only the new active cycle.

#### Closed Cycle correction

Closed Cycle cards no longer expose an independent delete action.

Their replacement action opens the Journal scoped to the cycle's source executions.

Canonical `buyTransactionIds` / `sellTransactionIds` are preferred when available. The existing bounded legacy matching path remains only for old data that lacks those links.

Editing or deleting a source execution through the Journal then rebuilds the derived Closed Cycle through the normal canonical executor/reconciliation path.

#### Journal correction mode

The Transaction Ledger now accepts a temporary correction scope:

- Position;
- Closed Cycle.

It:

- filters to the linked source execution IDs;
- switches to chronological ordering;
- explains that the derived record cannot be deleted independently;
- keeps normal persisted transaction edit/delete controls;
- can return to the full ledger with **Show Full Ledger**.

Leaving the Journal clears the temporary correction scope.

#### Removed accounting debt

Removed:

- `getOpenBuyTransactionIdsForTicker()` FIFO ownership helper;
- `usePortfolioState.deletePosition()`;
- App-level `handleDeletePosition()`;
- App-level local-only `handleDeleteTrade()`;
- Position delete confirmation UI;
- Closed Cycle delete UI;
- obsolete derived-delete callback props in Trading Journal.

#### Validation

Exact-head **Phase 10 Visual Closure #36957879472** passed on `7a5d8bde`:

- TypeScript: passed;
- **86 / 86 Vitest files, 484 / 484 tests**;
- production Vite/PWA build: passed;
- Cloudflare Worker dry-run: passed;
- 12 / 12 responsive geometries at 0px page overflow;
- 16 / 16 rendered states passed.

Intentional visual deltas were limited to the two affected desktop actions:

- Positions desktop: **0.021%**;
- Closed Cycles desktop: **0.012%**.

Every other golden state remained **0.000%** different.

Separate **Rendered Visual Regression #36957879457** passed on the same exact head.

Because the runtime accounting change itself landed in `95c6b13a`, **Intraday 1m Migration Smoke #36957765990** also passed on that runtime commit.

The first Stage 2.4 full-suite run correctly failed only because three Phase 10 source tests still required the retired destructive buttons. Those tests were updated to preserve the accepted compact action geometry while asserting ledger-correction semantics; no accounting behavior was reverted.

---

## Highest-priority post-visual work

### P0 — financial mutation integrity

Known inconsistency:

- cash deletion already follows a persist-first pattern;
- BUY, SELL, transaction edit, position edit and position deletion can update local financial state before the authoritative save is confirmed.

Target invariant:

> no financial success state before persistence succeeds.

### P0 — Position deletion semantics

Open positions are derived from the transaction ledger, but the UI still allows direct position deletion that removes inferred “open BUY” rows.

The helper used for that inference is FIFO-like while reconciliation uses proportional/weighted-average cost allocation after partial sells.

Target:

- remove direct accounting deletion from Position;
- correct the source ledger explicitly;
- freeze one cost-basis method.

### P0 — trade cash semantics

Normal BUY/SELL must not have optional hidden cash behavior.

Retire normal-accounting use of:

- `deductFromCash=false`;
- `addToCash=false`.

### P0 — branch/automation convergence

Audit baseline comparison:

- premium branch ahead of `main`: **1,388 commits**;
- premium branch behind `main`: **12 commits**.

GitHub scheduled workflows execute from the default branch, so the current branch split remains an operational risk until intentionally reconciled/promoted.

### P0 — CI/toolchain inconsistency

The premium branch declares npm and removed `bun.lock`, while `.github/workflows/production-data-audit.yml` still uses Bun with `--frozen-lockfile`.

Normalize this during production convergence.

---

## Market-data state

Current premium intraday policy:

- raw source: TradingView 1m;
- derived: deterministic 5m from persisted raw 1m;
- fallback: legacy 15m;
- display choices: Auto / 1m / 5m / 15m / client-derived 1h;
- raw retention: 30 days;
- derived retention: 90 days;
- timezone/session logic: `Africa/Cairo`;
- regular session: 10:00–14:30 Cairo;
- scheduled ingestion grace: through 15:15 Cairo.

Current premium workflow cron:

```text
*/5 7-13 * * 0-4
```

This is only the production scheduler once the reviewed workflow exists on the default branch.

The September 28 repair corrected major issues around wrong-session Today data, stale 15m fallback, startup hydration, quote freshness, pagination and primary/secondary analytics consistency.

Remaining rollout requirement: production/default-branch convergence and live-session verification.

---

## Ticker identity state

The service-managed ticker registry is the intended authority:

- `ticker_registry`;
- `ticker_aliases`;
- quote snapshot table remains separate.

Resolution supports canonical ticker and ISIN fallback.

The registry schedule is also subject to the default-branch promotion rule.

---

## Analytics state

Strong/current foundation:

- unified portfolio NAV/equity;
- net deposits;
- TWR;
- selected-period MWR;
- annualized XIRR reference;
- drawdown;
- cumulative fees;
- realized/unrealized composition;
- transaction-aware Today reconstruction;
- daily 1W / 1M / 90D / YTD / All;
- realized trajectory;
- monthly audit;
- trading-performance indicators.

Do not rewrite this engine during the Reports workspace redesign.

---

## Reports workspace

`POST_OVERHAUL_REPORTS_WORKSPACE_REDESIGN_PLAN.md` is now integrated into the master roadmap as **Stage 5 / R1–R8**.

Its visual entry gate is now satisfied because Phase 10 is closed.

It remains deferred until the remaining gates close:

1. financial mutation integrity;
2. production/automation convergence;
3. enough architecture ownership exists to move report components safely.

---

## Sector momentum scanner

Current implementation:

- foreground React hook;
- 60-second polling during an active session;
- 5–10 minute baseline window;
- momentum + liquidity + RVOL filters;
- multi-member sector/industry cluster detection;
- browser/service-worker notification display;
- localStorage snapshot/dedup state.

Important limitation:

> The detector itself is not background/server-side. If the app is suspended/closed, new clusters are not detected.

Server-side/background operationalization is deferred until the underlying data source has been validated.

---

## Architecture pressure points

Current large owners include:

- `App.tsx`;
- `usePortfolioState.ts`;
- `index.css`;
- Trading Journal;
- Cash Balance;
- Closed Cycles;
- Performance Reports;
- Header;
- several integration modals.

Plan: incremental extraction after financial/release stabilization. No rewrite.

---

## Documentation authority

Start with:

1. `docs/STATUS.md` — current state;
2. `docs/MASTER_STABILIZATION_ROADMAP.md` — sequencing;
3. `docs/README.md` — map of canonical/active/historical docs.

Current domain authorities:

- `ARCHITECTURE.md`
- `DATA_MODEL.md`
- `AUTH_AND_SECURITY.md`
- `OPERATIONS.md`
- `TESTING.md`
- `PERFORMANCE_ANALYTICS.md`
- `INTRADAY_MARKET_DATA.md`
- `TICKER_REGISTRY.md`
- `PREMIUM_VISUAL_LANGUAGE_CONTRACT.md`
- `FINANCIAL_MUTATION_CONTRACT.md`

---

## Next pass

**Stage 2.5 — Remove hidden trade cash modes.**

The next pass removes the remaining `deductFromCash` / `addToCash` UI/API compatibility flags so every real BUY/SELL always records its actual broker cash effect without a hidden bypass.
