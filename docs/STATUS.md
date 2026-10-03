# EGX Portfolio — Current Status

## Purpose

This is the short current-state document.

Update it after every accepted implementation pass. Detailed historical reasoning belongs in the domain/phase documents; sequencing belongs in `MASTER_STABILIZATION_ROADMAP.md`.

## Snapshot

**Date:** 2026-10-03  
**Active development branch:** `feature/premium-ui-redesign`  
**Current validated runtime head:** `70ad1148` — Stage 2.8 financial acceptance suite / Stage 2 exit closure  
**Current full exact-head verification:** Phase 10 Visual Closure #37121788769 on `70ad1148`  
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
- **Stage 2.5 — Hidden trade cash-mode removal**
- **Stage 2.6 — Canonical weighted-average / proportional cost-basis freeze**
- **Stage 2.7 — Explicit cash-flow semantics / return-neutral reconciliation**
- **Stage 2.8 — Financial acceptance suite / Stage 2 exit closure**

**Stage 2 is CLOSED / CI CLEAN.**

Next:

1. **Stage 3.1 — Reconcile branch divergence**

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

Historical Stage 2.2 behavior temporarily rejected the legacy BUY/SELL cash-bypass flags while the surrounding UI/API still exposed them.

**Stage 2.5 has now removed those flags and the BUY checkbox entirely.**

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

### Stage 2.5 canonical trade cash effect

Runtime head `208aa5e9` removes the final BUY/SELL cash-bypass compatibility surface and aligns pre-submit BUY validation with the same broker-cash invariant enforced by canonical persistence.

Removed from runtime:

- BUY `deductFromCash`;
- SELL `addToCash`;
- Add Trade's **Deduct from cash** checkbox;
- App forwarding booleans;
- hook compatibility fields;
- preparation-layer bypass branches.

The trade APIs can no longer express a real BUY/SELL that avoids its broker-cash effect.

#### BUY

The Add Trade modal now shows a non-interactive **Broker cash effect** notice with:

- exact total debit including fees;
- current available broker cash;
- guidance that any real discrepancy belongs in the Cash Ledger.

Canonical preparation always writes:

```text
totalAmount   = gross cost + fees
netCashImpact = -totalAmount
```

If the outlay exceeds available broker cash, pre-validation now fails immediately with an **Insufficient cash** error, matching the canonical mutation service rather than allowing a warning followed by a later rejection.

#### SELL

SELL preparation no longer accepts an `addToCash` option.

Canonical preparation always writes:

```text
totalAmount   = net sale proceeds
netCashImpact = +net sale proceeds
```

#### Cash differences

A real broker-cash discrepancy must be represented by its actual explicit ledger event rather than hidden inside trade behavior.

Stage 2.7 will further split the semantics of generic `CASH_ADJUSTMENT`.

#### Validation

Exact-head **Phase 10 Visual Closure #37048999587** passed on `208aa5e9`:

- TypeScript: passed;
- **87 / 87 Vitest files, 487 / 487 tests**;
- production Vite/PWA build: passed;
- Cloudflare Worker dry-run: passed;
- 12 / 12 responsive geometries at 0px page overflow;
- 16 / 16 rendered states passed.

Separate **Rendered Visual Regression #37048999583** also passed on the same exact head.

Rendered output introduced no new Stage 2.5 regression. Existing accepted Stage 2.4 action deltas remain:

- Positions desktop: 0.021%;
- Closed Cycles desktop: 0.012%;
- all other tracked states, including Add Trade phone: 0.000%.

The Stage 2.5 predecessor runtime `33fb9871` also passed **Intraday 1m Migration Smoke #37048671583** before the validation-only tightening in `208aa5e9`.

---

### Stage 2.6 canonical cost-basis freeze

The accounting method is now explicit and tested:

> **Open cost allocation uses weighted-average / proportional remaining cost.**

For a SELL with ratio `r = sold shares / open shares`:

```text
allocated gross cost = open gross cost × r
allocated buy fees   = open buy fees × r
remaining gross cost = open gross cost × (1 - r)
remaining buy fees   = open buy fees × (1 - r)
```

Stage 2.6 removed the remaining conflicting or duplicated paths:

- `portfolioAccounting.ts` exposes `CANONICAL_COST_BASIS_METHOD = WEIGHTED_AVERAGE_PROPORTIONAL`;
- Google Sheets reconstruction no longer consumes FIFO lots and now delegates to `reconcilePortfolioFromLedger()`;
- the Sheets no-live-quote fallback remains the reconstructed weighted-average entry price rather than a stale directory quote;
- secondary analytics reuses `calculateSellAccounting()` instead of cloning the allocation formula;
- Closed Cycles keeps all contributing BUY/SELL executions for traceability, but financial outlay/average values come from the canonical reconciled `ClosedTrade` projection rather than summing all linked BUY shares.

Regression coverage is in `src/services/Stage26CanonicalCostBasis.test.ts`.

Exact-head validation on runtime `c12e7404`:

- **Phase 10 Visual Closure #37096359624** — passed;
- TypeScript — passed;
- **88 / 88 Vitest files, 493 / 493 tests** — passed;
- production Vite/PWA build — passed;
- Cloudflare Worker dry-run — passed;
- **12 / 12 responsive geometries at 0px page overflow** — passed;
- **16 / 16 rendered states** — passed;
- **Rendered Visual Regression #37096359625** — passed.

Rendered differences remain at the already accepted visual baseline:

- Positions desktop: **0.021%**;
- Closed Cycles desktop: **0.012%**;
- all other tracked states: **0.000%**.

---

### Stage 2.7 explicit cash-flow semantics

The ambiguous generic cash-adjustment model is retired from new runtime writes.

Canonical cash events are now separated into three economic classes:

```text
investor capital:
  DEPOSIT
  WITHDRAWAL

portfolio performance:
  DIVIDEND
  FEE
  OTHER_INCOME
  OTHER_EXPENSE

bookkeeping / return-neutral:
  RECONCILIATION_ADJUSTMENT
```

Legacy `CASH_ADJUSTMENT` remains read-compatible only. Normalization maps it to `RECONCILIATION_ADJUSTMENT`, while normal runtime writers no longer emit the legacy value.

Accounting and analytics now agree on the consequences:

- only deposits/withdrawals change contributed capital;
- dividends/income/fees/expenses remain portfolio performance;
- reconciliation adjustments change ledger cash but do not become investment P&L;
- TWR/MWRR neutralize reconciliation corrections without counting them as net deposits;
- the equity bridge shows known bookkeeping reconciliation separately instead of labeling it unexplained performance or accounting error;
- secondary realized-P&L analytics include performance cash events;
- Today/intraday replay uses the same signed cash semantics;
- synthetic opening capital remains available for legacy portfolios even if a reconciliation adjustment is the first explicit cash row.

Google Sheets transaction-ledger round-trip now preserves `Cash Flow Type` and `Cash Flow Amount`. Existing older logger headers are extended when the app writes the ledger, and CASH rows no longer receive fake stock running-share/cycle metadata.

Regression coverage is centered in `src/services/Stage27CashAdjustmentSemantics.test.ts`, with supporting tests in performance, analytics, cash-ledger and storage suites.

Exact-head validation on runtime `899bb4fa`:

- **Phase 10 Visual Closure #37099343374** — passed;
- TypeScript — passed;
- **89 / 89 Vitest files, 504 / 504 tests** — passed;
- production Vite/PWA build — passed;
- Cloudflare Worker dry-run — passed;
- **12 / 12 responsive geometries at 0px page overflow** — passed;
- **16 / 16 rendered states** — passed;
- **Rendered Visual Regression #37099343371** — passed.

Rendered differences remain at the accepted baseline:

- Positions desktop: **0.021%**;
- Closed Cycles desktop: **0.012%**;
- all other tracked states: **0.000%**.

---

### Stage 2.8 financial acceptance suite / Stage 2 closure

Stage 2.8 is the cross-workflow exit gate for the financial architecture established in Stages 2.1–2.7.

Primary acceptance coverage is in:

- `src/services/Stage28FinancialAcceptance.test.ts`;
- supporting stale-device persistence coverage in `src/services/supabaseStorage.test.ts`.

The suite now exercises:

- multiple DCA BUYs;
- weighted-average / proportional partial SELL allocation;
- repeated partial SELLs;
- full close and later reopen as a new cycle;
- source BUY correction after a partial SELL, including recomputed realized and remaining cost;
- duplicate OCR execution rejection while allowing a distinct execution in the same import;
- dated deposit/withdrawal behavior inside a performance period;
- dividend and fee performance treatment;
- return-neutral reconciliation adjustments;
- exact same-day round trips ordered by execution timestamp;
- authoritative-persistence failure across BUY, SELL, edit, delete, cash event/edit/reconciliation, OCR, restore, snapshot restore and ledger reconciliation;
- stale-device accounting edits rebased on the latest remote quote;
- source-level Stage 2 exit guards for persist-before-apply, canonical cost basis, projection ownership and removal of hidden cash modes.

### Stage 2 exit gate — CLOSED

The following are now enforced and acceptance-tested:

- every financial mutation is persistence-confirmed before local financial state is applied;
- Position and Closed Cycle remain derived accounting projections;
- `WEIGHTED_AVERAGE_PROPORTIONAL` is the single cost-basis method;
- hidden BUY/SELL cash modes are absent;
- persistence failure leaves the prior local money/share state untouched;
- cash semantics distinguish investor capital, portfolio performance and bookkeeping repair;
- stale quote interaction does not override fresher remote quote state in the tested accounting-write path.

Exact-head validation on runtime `70ad1148`:

- **Phase 10 Visual Closure #37121788769** — passed;
- TypeScript — passed;
- **90 / 90 Vitest files, 513 / 513 tests** — passed;
- production Vite/PWA build — passed;
- Cloudflare Worker dry-run — passed;
- **12 / 12 responsive geometries at 0px page overflow** — passed;
- **16 / 16 rendered states** — passed;
- **Rendered Visual Regression #37121788757** — passed.

Rendered differences remain at the accepted frozen baseline:

- Positions desktop: **0.021%**;
- Closed Cycles desktop: **0.012%**;
- all other tracked states: **0.000%**.

---

## Highest-priority post-visual work

### Completed — Stage 2 financial mutation/accounting foundation

Stages 2.1–2.8 now enforce:

- persistence-confirmed financial mutations;
- ledger-authoritative transaction/cash/OCR/import/reconciliation workflows;
- Position and Closed Cycle correction through source ledger executions rather than destructive projection deletion;
- mandatory broker cash effect for BUY/SELL;
- one weighted-average / proportional remaining-cost method across reconciliation, Sheets reconstruction, secondary analytics and Closed Cycles reporting;
- explicit separation of investor capital flows, portfolio income/expense, and return-neutral bookkeeping reconciliation;
- cross-workflow acceptance coverage proving the full Stage 2 contract under DCA, repeated partial exits, correction, import, persistence failure, dated cash flows, same-day execution and stale-device quote interaction.

Stage 2 is closed. The roadmap now moves to production/CI/market-data convergence in Stage 3.

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

**Stage 3.1 — Reconcile branch divergence.**

Review the main-only commits against `feature/premium-ui-redesign` individually, classify each as required/superseded/conflicting/obsolete, and produce one reviewed integration result rather than blind-merging branch history.
