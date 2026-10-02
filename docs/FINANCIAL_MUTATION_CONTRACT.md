# Financial Mutation Contract

## Status

**Canonical Stage 2 financial mutation boundary.**

Stage 2.1 established the boundary; Stage 2.2 migrated BUY/SELL; Stage 2.3 has now migrated transaction, cash, OCR, restore/import and reconciliation workflows. Current validated runtime head: `d069f62d`.

This document defines the mutation ordering and failure semantics that later Stage 2 passes must use.

Stage 2.1 creates the boundary; it does **not** claim that all existing workflows already use it.

Current adoption sequence:

1. **2.1 — boundary implemented — complete**
2. **2.2 — BUY/SELL migration — complete**
3. **2.3 — transaction/cash/OCR/import/reconciliation migration — complete**
4. **2.4 — derived Position / Closed Cycle deletion ownership — next**
5. later Stage 2 passes remove remaining accounting ambiguities

---

## Core invariant

Financial mutations must follow this order:

```text
prepare
  ↓
validate
  ↓
persist authoritative canonical snapshot
  ↓
apply local UI state
  ↓
report success / optional integrations
```

The UI must never report a financial success state before authoritative persistence succeeds.

If persistence fails:

- the pre-mutation financial UI state remains intact;
- no success toast/state is applied;
- the caller receives a structured failure result.

---

## Canonical implementation

Service:

`src/services/ledgerMutationService.ts`

Primary factory:

`createLedgerMutationExecutor()`

Canonical snapshot:

```ts
CanonicalLedgerSnapshot {
  transactions
  positions
  closedTrades
  cashBalance
  capitalDeposits
  tickers
}
```

The ledger remains authoritative.

A mutation preparation step proposes:

- candidate `transactions`;
- optional `capitalDeposits`;
- optional `tickers`;
- optional existing-position reconciliation seed;
- optional caller result/value.

It does **not** supply authoritative:

- position shares/cost basis;
- closed-cycle accounting;
- reconciled cash.

Those projections are rebuilt through `reconcilePortfolioFromLedger()`.

---

## Prepare contract

A prepare callback receives the current canonical snapshot and returns the candidate source ledger.

Responsibilities of a workflow-specific prepare function:

- normalize workflow input before constructing the ledger change;
- create/edit/delete the intended ledger row(s);
- preserve IDs intentionally;
- carry the current ledger forward without dropping unrelated transactions;
- return any persisted transaction/result the UI or optional integrations need after success.

Preparation errors return:

`PREPARE_FAILED`

No persistence or local apply occurs.

---

## Canonical reconciliation

After preparation, the executor:

1. normalizes every transaction through the existing transaction normalizer;
2. resolves candidate capital/ticker inputs;
3. runs `reconcilePortfolioFromLedger()`;
4. derives:
   - open positions;
   - closed cycles;
   - cash balance;
5. produces the canonical snapshot sent to persistence.

There is no second accounting engine inside the mutation service.

The executor consumes the existing reconciliation/accounting rules.

---

## Validation contract

Before persistence, the executor rejects malformed financial state.

Current validation covers:

- duplicate transaction IDs;
- missing transaction IDs/tickers;
- unsupported transaction type;
- invalid transaction dates;
- non-finite or non-positive shares;
- invalid price/fee/amount values;
- non-finite cash-impact/P&L values;
- invalid position projections;
- invalid closed-trade projections;
- duplicate open-position ticker projections;
- non-finite reconciled cash;
- invalid contributed capital;
- candidate cash differing from canonical reconciliation;
- newly introduced reconciliation discrepancies.

### Legacy discrepancy rule

An existing discrepancy must not silently become permission to add another one.

However Stage 2.1 also avoids bricking all future mutations solely because an older ledger already contains a known discrepancy.

The executor compares:

- baseline reconciliation discrepancies;
- candidate reconciliation discrepancies.

A mutation is rejected when it introduces **new** discrepancies.

Existing ones remain visible for explicit later correction.

---

## Persistence contract

The default executor persistence path is:

```text
ledgerMutationService
  → forceFullSyncToFirestore()
  → supabaseStorage
  → savePortfolioToSupabase()
  → replace_portfolio_accounting_snapshot RPC
```

Despite the legacy `Firestore` function names, this path is Supabase-backed.

The accounting RPC atomically replaces:

- portfolio cash/capital;
- transactions;
- positions;
- closed trades.

Ticker quote persistence remains a separate market-data concern.

A persistence result of `false` is a financial failure, not success.

Persistence failures return:

`PERSIST_FAILED`

and local financial state must not be applied.

---

## Apply contract

Local React/application state is applied only after authoritative persistence returns success.

If local apply unexpectedly throws **after** persistence succeeded, the executor returns:

`APPLY_FAILED`

with:

`persisted: true`

That distinction matters because the database is already authoritative and the correct recovery is reload/resync, not retrying the same financial mutation blindly.

---

## Concurrency contract

Exactly one financial mutation may be in flight through one executor instance.

A second mutation attempted while another is unresolved returns:

`BUSY`

This is stronger than merely relying on the persistence queue.

Why:

Two different candidate snapshots can be prepared from the same old local state even when network writes themselves are serialized. Serializing preparation/persist/apply at the mutation boundary prevents that stale-snapshot race.

Stage 2.2 connects this state to BUY/SELL modal submission locking. A modal also disables its submit/cancel actions while awaiting the executor result, while the executor remains the cross-workflow serialization authority.

---

## Structured result contract

Current failure stages:

- `busy`
- `prepare`
- `validate`
- `persist`
- `apply`

Current codes:

- `BUSY`
- `PREPARE_FAILED`
- `VALIDATION_FAILED`
- `PERSIST_FAILED`
- `APPLY_FAILED`

A successful result includes:

- `persisted: true`;
- canonical snapshot;
- workflow-provided persisted value/result.

Optional integrations such as Google Sheets should consume the successful result **after** portfolio persistence.

They must not be allowed to roll back or falsely fail the authoritative portfolio write.

---

## Position seed boundary

Reconciliation can receive an existing-position seed so it may preserve reconciliation-owned identity/metadata where the current accounting engine already supports that behavior.

This seed does not make Position an accounting source.

Shares, cost basis, closed cycles and cash still come from the ledger.

### Target/stop/notes ownership — resolved in Stage 2.2

Persist-first BUY exposed that reconciliation previously let ticker-directory target/stop defaults overwrite portfolio-authored target/stop metadata.

Stage 2.2 fixes the ownership order:

```text
existing position metadata
  → BUY ledger metadata
  → ticker-directory default
```

This applies to target and stop; notes prefer existing position metadata and then the BUY ledger note.

This is metadata ownership only.

Position shares, cost basis, fees, cash and realized/closed accounting remain deterministic ledger projections.

For DCA, `prepareBuyTradeMutation()` updates the reconciliation position seed when the user explicitly supplies new target/stop/notes, so those new portfolio values survive the canonical persist/rebuild cycle.

---

## Stage 2.1 regression coverage

Tests:

- `src/services/ledgerMutationService.test.ts`
- `src/services/Stage21MutationBoundary.test.ts`

Covered scenarios include:

- canonical projections derived from ledger;
- persist-before-apply ordering;
- persistence failure leaves apply untouched;
- prepare failure;
- malformed/duplicate transaction rejection;
- new oversell discrepancy rejection;
- pre-existing discrepancy tolerance;
- one-mutation-in-flight serialization;
- persisted-but-apply-failed distinction;
- reconciliation seed behavior;
- atomic Supabase accounting RPC remains the authoritative persistence mechanism;
- Stage 2.1 intentionally stopped before workflow adoption; Stage 2.2 now covers BUY/SELL.

Exact-head validation:

**Phase 10 Visual Closure #36924616787** on `eb3f776e`

Passed:

- TypeScript;
- **79 / 79 Vitest files, 447 / 447 tests**;
- production Vite/PWA build;
- Cloudflare Worker dry-run;
- 12/12 responsive geometry checks with 0px page overflow;
- 16/16 frozen golden screenshots with 0.000% diff.

The visual closure workflow remains useful after Phase 10 because Stage 2 changes must not silently reopen the frozen visual contract.

---

## Stage 2.2 — BUY/SELL adoption

Trade-specific preparation now lives in:

`src/services/tradeLedgerMutations.ts`

### BUY

`prepareBuyTradeMutation()`:

- resolves the canonical ticker;
- validates accounting inputs through the existing buy-accounting engine;
- validates authoritative available cash;
- creates one canonical BUY ledger row;
- assigns the next trade ID;
- records gross trade value and negative net cash impact;
- updates the reconciliation metadata seed for explicit DCA target/stop/notes changes;
- returns the persisted BUY transaction as the successful executor value.

The hook then invokes the canonical executor and only applies its returned snapshot after persistence.

### SELL

`prepareSellTradeMutation()`:

- resolves the current position from the executor snapshot rather than trusting a stale UI object;
- rejects a sale if that position disappeared before preparation;
- uses the existing proportional/weighted-average sell accounting engine;
- creates canonical gross/net proceeds, fee allocation, realized P&L and holding-day metadata;
- returns the persisted SELL transaction as the successful executor value.

The App resolves the resulting closed-cycle projection from the successful canonical snapshot by the persisted SELL transaction ID.

### Modal and UI contract

Both Add Trade and Sell workflows are async.

While one is saving:

- its submit button is disabled;
- cancel/close requests are blocked;
- the modal remains visible;
- no success toast is emitted.

On prepare/validate/persist failure:

- prior portfolio financial state remains unchanged;
- the modal remains open;
- the user gets a failure message.

On success:

1. the canonical Supabase accounting snapshot has already persisted;
2. local financial state has been applied;
3. the modal closes;
4. success UI is allowed;
5. optional Google Sheets append may run.

A Sheets failure does not roll back or redefine the portfolio save.

### Persisted-but-apply-failed recovery

If persistence succeeds but applying local state throws:

- the executor returns `APPLY_FAILED` with `persisted: true`;
- App tells the user the trade is already saved;
- the modal closes to prevent accidental resubmission;
- the correct recovery is reload/resync.

### Legacy hidden cash modes

Stage 2.2 refuses:

- BUY `deductFromCash=false`;
- SELL `addToCash=false`.

This prevents the persist-first migration from reproducing the old local-only cash illusion.

Stage 2.5 still owns complete removal of those legacy controls/API flags.

### Stage 2.2 regression coverage

Added:

- `src/services/tradeLedgerMutations.test.ts`;
- `src/services/Stage22PersistedTradeMutations.test.ts`.

Coverage includes:

- DCA BUY construction;
- insufficient-cash rejection;
- BUY cash-bypass rejection;
- proportional partial SELL;
- full close;
- same-day execution ordering;
- stale-position SELL rejection;
- SELL cash-bypass rejection;
- App awaits persistence before Sheets/success;
- Add Trade and Sell modal in-flight locking;
- canonical metadata ownership during BUY reconciliation.

Exact-head validation:

**Phase 10 Visual Closure #36941746467** on `d012aeff`

Passed:

- TypeScript;
- **81 / 81 Vitest files, 462 / 462 tests**;
- production Vite/PWA build;
- Cloudflare Worker dry-run;
- 12 / 12 responsive geometries with 0px page overflow;
- 16 / 16 frozen golden screenshots with 0.000% diff.

Independent market-data validation:

**Intraday 1m Migration Smoke #36941746472 — PASSED** on the same runtime head.

---

## Stage 2.3 — source-ledger workflow adoption

Stage 2.3 extends the executor beyond BUY/SELL.

Preparation ownership is split into:

- `ledgerWorkflowMutations.ts` for edit/delete, cash, reconciliation and restore/import;
- `ocrLedgerMutations.ts` for dependency-aware batch execution import;
- `cashLedger.ts` pure preparation helpers for cash rows and contributed-capital changes.

All of these are invoked through the same executor instance held by `usePortfolioState`.

### Transaction edit

A transaction edit is source-ledger correction, not an edit of derived accounting snapshots.

The preparation step recomputes canonical financial fields.

BUY source fields:

```text
grossTradeValue = shares × price
totalAmount     = grossTradeValue + fees
netCashImpact   = -totalAmount
```

SELL source fields:

```text
grossTradeValue = shares × price
totalAmount     = max(0, grossTradeValue - fees)
netCashImpact   = totalAmount
```

Stored/editable SELL:

- realized P&L;
- realized P&L percent;
- outcome;
- holding days

are cleared as source facts and rebuilt by ledger reconciliation.

This prevents an edited share/price/fee row from retaining stale cash/P&L snapshots.

### Transaction delete and persisted Undo

General transaction deletion now:

1. prepares the ledger without the row;
2. recalculates contributed capital where required;
3. persists the canonical snapshot;
4. applies local state;
5. only then exposes success / Sheets mirror.

The Undo record stores the previous source ledger plus capital and position metadata seed.

Undo itself is another executor mutation. It no longer restores React financial state without restoring Supabase.

### Cash events

Deposit, withdrawal, dividend, cash adjustment, cash-row edit and cash-row deletion use the same global executor.

The old cash-specific in-flight lock is removed.

Cash preparation is pure:

- candidate transactions;
- candidate contributed capital;
- optional source cash transaction result.

The executor remains responsible for reconciliation, persistence and apply.

### OCR

Single OCR execution delegates to the canonical Stage 2.2 BUY/SELL handlers.

A multi-row OCR batch is prepared as **one candidate ledger**.

Preparation:

- orders executions by explicit execution time;
- uses BUY-before-SELL only for timestamp ties on the same ticker;
- blocks strong duplicate executions;
- applies accepted BUY rows to the working ledger;
- allows later dependent SELLs to reconcile against those BUYs;
- skips unreconcilable SELLs rather than creating orphan local rows.

The resulting candidate ledger is persisted once.

### Backup and Google Sheets import

Restore/import is ledger-authoritative.

Required source:

`transactions`

Imported derived values are not independently authoritative:

- positions may seed stable position metadata/IDs;
- closed trades are rebuilt;
- cash is rebuilt;
- realized P&L is rebuilt.

A backup with meaningful financial projections but no transaction ledger is rejected.

This avoids replacing ledger accounting with a stale exported projection.

### Reconciliation

Manual reconciliation itself now runs through the executor.

Therefore “Reconcile” success means the canonical rebuilt snapshot has been persisted, not merely recomputed in React.

### Persistence-aware UI

Stage 2.3 extends the no-premature-success contract to:

- transaction edit;
- transaction delete confirmation;
- OCR import;
- Quick Cash;
- cash reconciliation;
- backup restore;
- backup reconciliation;
- Google Sheets import.

A failed authoritative write leaves the workflow open where appropriate and does not report financial success.

### Stage 2.3 regression coverage

Added:

- `src/services/ledgerWorkflowMutations.test.ts`;
- `src/services/ocrLedgerMutations.test.ts`;
- `src/services/Stage23WorkflowMigration.test.ts`.

The existing `cashLedger.test.ts` suite also remains authoritative.

During CI it caught a real migration regression: a deleted legacy synthetic opening-capital row was correctly prepared with zero contributed capital, but the compatibility wrapper initially reintroduced the old fallback capital. The wrapper was corrected to reconcile using the prepared capital value.

Exact-head validation:

**Phase 10 Visual Closure #36944695939** on `d069f62d`

Passed:

- TypeScript;
- **84 / 84 Vitest files, 475 / 475 tests**;
- production Vite/PWA build;
- Cloudflare Worker dry-run;
- 12 / 12 responsive geometry checks at 0px page overflow;
- 16 / 16 frozen golden screenshots at 0.000% diff.

**Rendered Visual Regression #36944695986** also passed on the same runtime head.

### Remaining exception boundary

The ordinary source-ledger mutation paths are now unified.

Two derived-record operations remain deliberately outside this completion claim:

- direct Position deletion;
- direct/local Closed Cycle deletion.

These are not valid independent accounting records. Stage 2.4 removes their projection-as-source behavior.

---

## Migration rule for later passes

When a workflow is converted to the executor:

1. remove local financial state mutation before persistence;
2. construct only the candidate ledger/change inputs;
3. execute through the canonical boundary;
4. keep the previous local state on prepare/validate/persist failure;
5. apply canonical snapshot only after persistence;
6. drive success UI from the successful executor result;
7. run optional integrations afterwards;
8. add persistence-failure and duplicate-submit regression tests.

Do not keep a second optimistic path “temporarily” once a workflow has been migrated.

That would recreate the mixed mutation model Stage 2 exists to remove.
