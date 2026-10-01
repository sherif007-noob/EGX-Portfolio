# Financial Mutation Contract

## Status

**Canonical Stage 2 financial mutation boundary.**

Stage 2.1 is implemented and validated on runtime head `eb3f776e`.

This document defines the mutation ordering and failure semantics that later Stage 2 passes must use.

Stage 2.1 creates the boundary; it does **not** claim that all existing workflows already use it.

Current adoption sequence:

1. **2.1 — boundary implemented**
2. **2.2 — BUY/SELL migration — next**
3. **2.3 — transaction/cash/import workflow migration**
4. later Stage 2 passes remove remaining accounting ambiguities

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

Stage 2.2 will connect this state to BUY/SELL submit disabling/deduplication.

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

### Known target/stop ownership issue

Stage 2.1 testing exposed an existing ownership rule:

`portfolioReconciliation.ts` currently gives matching ticker-directory `targetPrice` / `stopLoss` values precedence over seeded position values.

Therefore the Stage 2.1 executor does **not** claim to solve target/stop editing persistence.

That ownership must be handled deliberately in the pass that migrates position metadata/edit semantics.

It must not be changed incidentally during BUY/SELL migration.

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
- BUY/SELL are intentionally not migrated prematurely inside 2.1.

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
