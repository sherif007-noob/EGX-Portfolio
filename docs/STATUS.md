# EGX Portfolio — Current Status

## Purpose

This is the short current-state document.

Update it after every accepted implementation pass. Detailed historical reasoning belongs in the domain/phase documents; sequencing belongs in `MASTER_STABILIZATION_ROADMAP.md`.

## Snapshot

**Date:** 2026-10-05  
**Authoritative production/default branch:** `main`  
**Legacy premium branch:** mirrored to `main` at Stage 3.2 closure; no longer production authority  
**Current validated runtime head:** `54530841` — Stage 4.5.3.2.2.2.3 neutral hero-card material body
**Current full verification:** PR Quality Checks #37339018295 + main Quality Checks #37339172950 — TypeScript + **121 / 121 test files, 660 / 660 tests** + production build; Phase 10 Visual Closure #37339173120 + Rendered Visual Regression #37339172988 — Worker dry-run green, **12 / 12** responsive geometries at 0px overflow and **16 / 16** rendered states passed
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

Financial integrity is closed; production/CI/market-data convergence is now active.

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

Stage 3 completed:

- **Stage 3.1 — Reviewed branch divergence reconciliation**
- **Stage 3.2 — Default production branch authority**
- **Stage 3.3 — Automation normalization**
- **Stage 3.4 — Exact-head quality gate**

Stage 3 active:

- **Stage 3.5 — Live-session soak — FAILED / deferred technical debt; retry scheduled for the 2026-10-05 live session**
- **Stage 3.6 — Data Health Center — IMPLEMENTED / PR CI GREEN / merged to `main`**

Stage 3.6 is merged on `main@f5ae6ad6`. PR #45 Quality Checks passed TypeScript, **98 / 98 test files, 550 / 550 tests**, and the production build. It exposes a read-only production trust surface from the existing Settings affordance. It reports held-universe quote health, expected vs selected EGX session, latest raw 1m coverage, derived 5m tail alignment, daily-history coverage, ticker resolution, Supabase portfolio sync age, last raw-ingestion age, and the build commit. It does not mutate accounting or manufacture missing market data.

Stage 3.5 remains deferred technical debt for the scheduled 2026-10-05 live-session retry.

Stage 4 accepted:

- **Stage 4.1 — module ownership — merged / CI green**
- **Stage 4.2 — App orchestration extraction — merged / CI green**
- **Stage 4.3.1 — local state + compatibility cache — accepted / CI green**
- **Stage 4.3.2 — remote hydration/subscription ownership — accepted / CI green**
- **Stage 4.3.3 — canonical ledger mutation ownership — accepted / CI green**
- **Stage 4.3.4 — repository/persistence action ownership — accepted / CI green**
- **Stage 4.3.5 — compatibility facade cleanup + regression closure — accepted / CI green**
- **Stage 4.4.1 — shared route/request contract authority — accepted / CI green**
- **Stage 4.4.2 — auth/error response contract parity — accepted / CI green**
- **Stage 4.4.3 — runtime capability/deprecation contract validation — accepted / CI green**
- **Stage 4.4.4 — Google Sheets payload/response contract consolidation — accepted / CI green**
- **Stage 4.4.5 — scanner request/response contract closure — accepted / CI green**
- **Stage 4.4.6 — symbol-search response contract + Stage 4.4 exit regression closure — accepted / CI green**
- **Stage 4.5.1 — CSS ownership inventory + layer-entry contract — accepted / CI + rendered green**
- **Stage 4.5.2 — canonical token extraction — accepted / CI + rendered green**
- **Stage 4.5.3.1 — shared neutral material/refraction primitives — accepted / CI + rendered green**
- **Stage 4.5.3.2.1 — Reports + dense-data composite materials — accepted / CI + rendered green**
- **Stage 4.5.3.2.2.1 — base composite card + neutral overlay material bodies — accepted / CI + rendered green**
- **Stage 4.5.3.2.2.2.1 — safe non-conflicting Phase 8 material ownership — accepted / CI + rendered green**
- **Stage 4.5.3.2.2.2.R — failed wholesale extraction reverted / baseline restored — accepted / CI + rendered green**
- **Stage 4.5.3.2.2.2.1 — safe non-card Phase 8 material ownership — accepted / CI + rendered green**
- **Stage 4.5.3.2.2.2.2 — Overview hero neutral refraction role — accepted / CI + rendered green**
- **Stage 4.5.3.2.2.2.3 — neutral hero-card material body — accepted / CI + rendered green**

`Stage 4.3` and `Stage 4.4` are now fully accepted and closed through granular gates.

Stage 4 active:

- **Stage 4.5 CSS ownership consolidation — 4.5.3.2.2.2.4 FAILED RENDERED; recovery 4.5.3.2.2.2.4.R merged at main@e5f12297 with post-merge rendered validation pending; 4.5.3.2.2.2.5 generic hover material candidate prepared**

PR #66 at `main@2bd55d68` passed source CI but is **not an accepted runtime**. Rendered regression exceeded the frozen 1% threshold on Positions phone (**1.035%**), Journal desktop (**1.947%**), and Semantic Summary desktop (**3.137%**). The wholesale extraction was reverted, then the safe non-card subset was reintroduced through PR #68 and passed full rendered validation.

PR #71 at `main@928fb8f6` is likewise **not an accepted runtime**. Moving only the hierarchy-card resting base body reproduced the same failing states: Positions phone **1.035%**, Journal desktop **1.947%**, and Semantic Summary desktop **3.137%**. Recovery pass **4.5.3.2.2.2.4.R** restores the accepted `main@54530841` runtime behavior before any further ownership migration.

Next:

1. Confirm **4.5.3.2.2.2.4.R** restored the frozen rendered baseline on main
2. Validate **4.5.3.2.2.2.5 — generic card hover material interaction**; merge only after recovery rendered acceptance
3. Continue Stage 4.5 in small visual-preserving sub-passes
3. Stage 5 Reports workspace redesign
4. Retry the deferred Stage 3.5 live-session soak after the ingestion reliability fix is ready

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

### Stage 3.1 reviewed branch convergence

The old 12-commit `main` divergence is resolved.

Before integration:

```text
feature/premium-ui-redesign
  ahead of main:  1,466
  behind main:       12
```

All 12 main-only commits were reviewed individually in `docs/STAGE3_BRANCH_DIVERGENCE_REVIEW.md`:

- **1 required** — the missing unified-analytics `missingTickers` repair-signal regression test;
- **9 superseded by premium** — historical repair service/route/client/App/docs/date-authority work already exists in newer premium architecture;
- **2 obsolete** — the Render deployment blueprint and the old merge commit as independent content;
- **0 unresolved conflicts**.

The required test was restored in `1c212324`.

Reviewed graph integration was then created in merge commit `356740d5` with:

- premium as first parent;
- `main` head `3259bb67` as second parent;
- premium tree preserved intentionally;
- no `render.yaml` imported.

A Stage 3.1 convergence guard was added at runtime head `6a842b7d`.

After integration:

```text
feature/premium-ui-redesign
  behind main: 0
  status:      ahead
```

Exact-head validation on `6a842b7d`:

- **Phase 10 Visual Closure #37123523107** — passed;
- TypeScript — passed;
- **91 / 91 Vitest files, 517 / 517 tests** — passed;
- production Vite/PWA build — passed;
- Cloudflare Worker dry-run — passed;
- **12 / 12 responsive geometries at 0px page overflow** — passed;
- **16 / 16 rendered states** — passed;
- **Rendered Visual Regression #37123523123** — passed.

Rendered differences remain at the accepted frozen baseline:

- Positions desktop: **0.021%**;
- Closed Cycles desktop: **0.012%**;
- all other tracked states: **0.000%**.

---

### Stage 3.2 default production branch authority

`main` is now the production/default source of truth.

Promotion sequence:

1. branch-scoped production workflows were changed from `feature/premium-ui-redesign` to `main`;
2. `Stage32ProductionBranchAuthority.test.ts` was added to guard against feature-branch production coupling;
3. `main` was fast-forwarded from old head `3259bb67` to the reviewed premium production tree;
4. exact-head contract commit `00afd739` was made directly on `main`;
5. the old premium branch was fast-forwarded to the same commit as a compatibility mirror, not as production authority.

Production-facing workflows confirmed from `main` during promotion:

- **Intraday 1m Diagnostic #37131125252 — passed**;
- **Intraday 1m Migration Smoke #37131125291 — passed**;
- **EGX Ticker Registry #37131125243 — passed**;
- **Quality Checks #37131157043 — passed**.

The live Supabase project was verified **ACTIVE_HEALTHY**. The canonical accounting RPC and the daily/intraday/ticker-registry objects required by the repository are present.

Exact-head validation on `main@00afd739`:

- **Phase 10 Visual Closure #37131157044 — passed**;
- TypeScript — passed;
- **92 / 92 Vitest files, 522 / 522 tests** — passed;
- production Vite/PWA build — passed;
- Cloudflare Worker dry-run — passed;
- **12 / 12 responsive geometries at 0px page overflow** — passed;
- **16 / 16 rendered states** — passed;
- **Rendered Visual Regression #37131157017 — passed**.

Accepted frozen visual deltas remain unchanged:

- Positions desktop: **0.021%**;
- Closed Cycles desktop: **0.012%**;
- all other tracked states: **0.000%**.

Stage 3.2 deliberately does **not** normalize the Bun-based production audit or alter the legacy manual 5m repair workflow; those belong to Stage 3.3.

---

### Stage 3.3 automation normalization

Production automation now has one explicit toolchain and one intraday-writer serialization policy.

Implemented through PR **#39**, merged as `15f47190`:

- production audit migrated from Bun to **Node 22 + npm 11.6 + npm ci**;
- all production workflows now install from the committed `package-lock.json` using `npm ci --no-audit --no-fund`;
- scheduled raw 1m ingestion, production-writing 1m migration smoke, and manual legacy 5m repair all share:
  - `group: egx-intraday-market-data`;
  - `cancel-in-progress: false`;
- legacy direct 5m repair remains **workflow_dispatch-only** with no schedule or push trigger;
- only the raw 1m workflow is a scheduled intraday bar writer;
- `Stage33AutomationNormalization.test.ts` guards the toolchain, writer lock, manual-only legacy path and read-only audit contract.

Validation on `main@15f47190`:

- PR Quality Checks **#37149643306 — passed**;
- main Quality Checks **#37149729081 — passed**;
- Intraday 1m Diagnostic **#37149729036 — passed**;
- Intraday 1m Migration Smoke **#37149729061 — passed**;
- EGX Ticker Registry **#37149729046 — passed**;
- Phase 10 Visual Closure **#37149729005 — passed**;
- **93 / 93 Vitest files, 527 / 527 tests**;
- production build and Worker dry-run passed;
- **12 / 12** responsive geometries at 0px page overflow;
- **16 / 16** rendered states passed;
- Rendered Visual Regression **#37149729076 — passed**.

The production-data audit workflow configuration is normalized in this pass. Executing the read-only audit against the final production candidate remains an explicit Stage 3.4 exact-head gate rather than being silently conflated with the automation refactor.

---

### Stage 3.4 exact-head production candidate gate

A dedicated non-writing production gate now binds the release checks to one exact commit:

- workflow: `.github/workflows/production-candidate-gate.yml`;
- runtime candidate: `main@ce60f932`;
- Production Candidate Gate **#37180662256 — passed**.

The gate proves on the same SHA:

- Node 22 + npm 11.6;
- clean locked `npm ci`;
- candidate-delta `git diff --check`;
- TypeScript;
- full Vitest;
- focused intraday regressions;
- focused ticker-registry regressions;
- production Vite/PWA build;
- Cloudflare Worker dry-run;
- live read-only production-data audit.

Exact results:

- **94 / 94 Vitest files, 531 / 531 tests**;
- focused intraday: **9 / 9 files, 49 / 49 tests**;
- focused ticker registry: **3 / 3 files, 22 / 22 tests**;
- production build — passed;
- Worker dry-run — passed;
- production audit — **passed with zero issues**.

Production audit snapshot at the gate:

- transactions: **79**;
- stored/rebuilt positions: **8 / 8**;
- stored/rebuilt cash: **EGP 12,301.85 / EGP 12,301.85**;
- duplicate-equivalent ledger groups: **0**;
- market trades missing `executedAt`: **0**;
- stored/rebuilt closed trades: **30 / 30**;
- stored/rebuilt realized P&L: **EGP 116.72 / EGP 116.72**;
- latest daily history date: **2026-10-01**;
- open tickers missing latest daily history: **0**;
- latest intraday date: **2026-10-01**;
- open tickers missing latest intraday session: **0**.

The first candidate run `d868fd42` intentionally failed before runtime checks because an initial whole-tree whitespace scan exposed unrelated pre-existing whitespace debt. The gate was corrected to inspect the **candidate delta**, matching the intended `git diff --check` release contract without mass-editing accepted historical/UI code.

Supporting exact-head evidence on `ce60f932` is also green:

- Quality Checks **#37180662247**;
- Phase 10 Visual Closure **#37180662178**;
- Rendered Visual Regression **#37180662271**;
- **12 / 12** responsive geometries at 0px page overflow;
- **16 / 16** rendered states passed.

Accepted frozen visual deltas remain unchanged:

- Positions desktop: **0.021%**;
- Closed Cycles desktop: **0.012%**;
- all other tracked states: **0.000%**.

---

### Stage 3.5 live-session soak — ACTIVE / OBSERVING

Implementation head:

- `main@7299c623`;
- PR **#42** — merged;
- PR Quality Checks **#37181674408** — passed;
- main Quality Checks **#37181737852** — passed;
- Phase 10 Visual Closure **#37181737863** — passed;
- Rendered Visual Regression **#37181737872** — passed.

Added:

- `scripts/verifyLiveSessionSoak.ts`;
- `.github/workflows/live-session-soak.yml`;
- `npm run verify:live-session-soak`;
- `Stage35LiveSessionSoak.test.ts`.

The soak is **read-only**. It does not run a market-data writer, ticker-registry writer, accounting mutation, database RPC, or real Cloudflare deployment.

Five checkpoints are scheduled for the real Sunday **2026-10-04** session:

- ~09:45 Cairo — pre-open baseline;
- ~10:20 Cairo — early-session ingestion;
- ~12:00 Cairo — mid-session advancement;
- ~14:20 Cairo — near-close coverage;
- ~15:20 Cairo — post-ingestion-grace strict verdict.

Every run uploads a JSON evidence artifact.

Automated checks include:

- source-ledger cash/position reconciliation;
- current session-relevant ticker universe;
- raw 1m advancement;
- duplicate timestamp detection;
- exact persisted 1m → derived 5m OHLCV reconstruction;
- absence of competing direct-5m rows in the strict final session;
- Auto resolution restricted to the requested session;
- manual 1m remaining strict rather than silently falling back;
- daily-history advancement after close;
- production `/api/egx/scan` proxy availability;
- complete held-ticker scanner snapshot;
- in-memory reference NAV from the same live-price application path used by the app;
- Today endpoint convergence on that scanner-derived NAV.

Pre-open production baseline captured before the session:

- open positions: **8** — ACTF, ETEL, KORA, MASR, MPCO, ORAS, ORHD, TALM;
- stored cash: **EGP 12,301.85**;
- latest completed daily session: **2026-10-01**;
- latest persisted intraday session: **2026-10-01**;
- all eight current holdings had previous-session raw 1m coverage from **10:00 through 14:29 Cairo**;
- previous-session derived 5m coverage extended through **14:25 Cairo**.

This makes the October 4 soak a meaningful regression comparison rather than an arbitrary completeness threshold.

One criterion remains intentionally manual:

- **phone vs desktop displayed snapshot parity**.

CI can prove that both clients consume the same authoritative persisted/live-data contracts, but it cannot honestly prove two physical logged-in devices rendered the same number. That observation must be recorded from the actual app rather than simulated.

Stage 3.5 is not closed until the post-close strict verdict and device-parity observation exist.

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

## Current pass

**Stage 3.5 — Live-session soak — FAILED / REMEDIATION REQUIRED.**

The October 4 production soak failed because no target-session 1m/5m bars were persisted and daily history had not advanced past October 1. The production scanner proxy remained healthy. The only scheduled 1m writer run recorded for October 4 started at 15:53 Cairo and explicitly skipped outside the 15:15 ingestion window, so it wrote no bars. Repeat Stage 3.5 only after scheduled ingestion reliability is repaired.
