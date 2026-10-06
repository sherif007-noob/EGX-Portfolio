# Financial Mutation Contract

## Status

**Canonical Stage 2 financial mutation boundary.**

Stage 2.1 established the boundary; Stage 2.2 migrated BUY/SELL; Stage 2.3 migrated transaction, cash, OCR, restore/import and reconciliation workflows; Stage 2.4 removed independent Position/Closed Cycle accounting deletion; Stage 2.5 removed hidden BUY/SELL cash modes; Stage 2.6 froze weighted-average / proportional remaining cost; Stage 2.7 separated capital, performance and bookkeeping cash semantics; Stage 2.8 closed the stage with cross-workflow financial acceptance coverage. Original Stage 2 closure head: `70ad1148`. The contract remains authoritative through the current validated runtime `5152ca2b`.

This document defines the mutation ordering and failure semantics that all later stages must preserve.

All current financial mutation families use the shared persist-before-apply boundary, including BONUS_SHARES corporate actions.

Current adoption sequence:

1. **2.1 — boundary implemented — complete**
2. **2.2 — BUY/SELL migration — complete**
3. **2.3 — transaction/cash/OCR/import/reconciliation migration — complete**
4. **2.4 — derived Position / Closed Cycle deletion ownership — complete**
5. **2.5 — hidden trade cash-mode removal — complete**
6. **2.6 — canonical cost-basis freeze — complete**
7. **2.7 — cash-adjustment semantics — complete**
8. **2.8 — financial acceptance suite — complete**

**Stage 2 — complete / CI green**

### Post-Stage-2 adoption

The same executor now also owns:

- `CORPORATE_ACTION_BONUS_SHARES` through `prepareBonusSharesMutation()`;
- any later Stage 6 correction workflow must enter through explicit ledger mutation rather than patching derived positions/cash.

See [CORPORATE_ACTIONS_LEDGER.md](CORPORATE_ACTIONS_LEDGER.md).

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

Historical Stage 2.2 temporarily **rejected** the old cash-bypass flags while the API/UI surface still contained them.

Stage 2.5 has now removed those controls and parameters completely.

The canonical BUY/SELL API has no cash-bypass mode.

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

- orders executions by explicit broker execution time when available;
- preserves source/screenshot order when timestamps tie or are ambiguous;
- relies on the dependency-aware retry loop instead of forcing BUY-before-SELL for same-ticker ties, preserving legitimate close → reopen sequences;
- blocks strong duplicate executions against the ledger that existed before the batch;
- does not collapse distinct rows inside one batch merely because ticker/side/size/price/fee/minute match;
- filters exact duplicate image uploads in the scanner UI before OCR;
- applies accepted BUY rows to the working ledger;
- allows later dependent SELLs to reconcile against those BUYs;
- skips unreconcilable SELLs rather than creating orphan local rows.

OCR execution-time extraction prefers the broker trade-row time over unrelated device/status-bar clocks, and the batch review exposes execution time as an editable field before persistence.

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

### Stage 2.4 closure transition

The ordinary source-ledger mutation paths were unified in Stage 2.3.

Stage 2.4 then removed the final derived-record deletion exceptions:

- direct Position deletion;
- direct/local Closed Cycle deletion.

Positions and Closed Cycles are now navigation/projection surfaces for correction, not independent accounting records.

---

## Stage 2.4 — projection ownership and correction routing

Stage 2.4 closes the mismatch between the ledger-authoritative accounting model and destructive actions exposed on derived records.

### Position is projection-only

The retired flow was:

```text
Delete Position
  → infer "open BUY rows"
  → delete inferred rows
  → rebuild ledger
```

That inference used FIFO lot consumption even though canonical sell accounting uses weighted-average / proportional remaining cost.

The helper `getOpenBuyTransactionIdsForTicker()` has been removed.

The replacement is:

```text
Open Position
  → Review source ledger
  → scope Journal to active cycle executions
  → explicitly edit/delete erroneous source transaction
  → canonical executor persists
  → reconciliation rebuilds Position
```

### Active-cycle ownership

`getActivePositionLedgerTransactionIds()` tracks aggregate running shares.

It does **not** assign economic ownership to FIFO lots.

For:

```text
BUY 100 @ 10
BUY 100 @ 20
SELL 100
```

the current open cycle links all three executions.

This matches the accounting model: the remaining position is the projection of the whole active weighted-average cycle.

When running shares reach zero, that cycle ends. A later BUY starts a new correction scope.

### Closed Cycle is projection-only

Closed Cycle delete is also retired.

The correction action navigates to its contributing source executions.

Canonical source links:

- `buyTransactionIds`;
- `sellTransactionIds`

are preferred.

Legacy date/cycle matching remains only to render/navigate older records that lack those IDs; it is not allowed to delete accounting rows automatically.

### Journal correction scope

The Journal accepts a temporary `JournalLedgerFocus`.

It can scope to:

- active Position source IDs;
- Closed Cycle source IDs.

The scope resets Journal filters to chronological/all and explains that correction must happen at the source execution.

Normal transaction edit/delete remains persist-confirmed through the Stage 2.3 executor.

### Stage 2.4 regression coverage

Added:

- `src/services/ledgerProjectionOwnership.test.ts`;
- `src/services/Stage24ProjectionOwnership.test.ts`.

Coverage includes:

- DCA + proportional partial sell;
- full close + reopen cycle reset;
- fully closed ticker has no active Position scope;
- Closed Cycle source ID deduplication;
- removal of FIFO ownership helper;
- removal of hook/App derived-delete mutations;
- replacement Position/Closed Cycle correction actions;
- Journal source-ID scoping.

Three older Phase 10 source tests initially failed because they explicitly required the retired delete controls. They were updated to protect the same compact/touch-safe geometry while asserting the new correction semantics.

Exact-head validation:

**Phase 10 Visual Closure #36957879472** on `7a5d8bde`

Passed:

- TypeScript;
- **86 / 86 Vitest files, 484 / 484 tests**;
- production Vite/PWA build;
- Cloudflare Worker dry-run;
- 12 / 12 responsive geometries at 0px page overflow;
- 16 / 16 rendered states.

Intentional screenshot deltas:

- Positions desktop: **0.021%**;
- Closed Cycles desktop: **0.012%**;
- every other state: **0.000%**.

**Rendered Visual Regression #36957879457** passed on the same head.

**Intraday 1m Migration Smoke #36957765990** passed on the Stage 2.4 runtime commit `95c6b13a`.

---

## Stage 2.5 — canonical trade cash effect

The canonical trade API no longer accepts optional cash behavior.

### BUY invariant

```text
grossTradeValue = shares × price
totalAmount     = grossTradeValue + fees
netCashImpact   = -totalAmount
```

There is no `deductFromCash` field.

The Add Trade UI presents this debit as a required broker-cash effect, not a checkbox.

When authoritative cash is below the outlay, pre-validation fails with the same invariant as canonical preparation.

### SELL invariant

```text
grossTradeValue = shares × price
totalAmount     = grossTradeValue - sell fees
netCashImpact   = +totalAmount
```

There is no `addToCash` field.

### Validation and persistence

No trade path may encode a cash discrepancy by suppressing its normal BUY/SELL cash movement.

Any real discrepancy must become an explicit ledger event with its own semantics.

### Stage 2.5 regression coverage

Added:

- `src/services/Stage25CanonicalTradeCashEffect.test.ts`.

Updated:

- `tradeLedgerMutations.test.ts`;
- `Stage22PersistedTradeMutations.test.ts`;
- BUY pre-validation.

Coverage requires:

- no hidden trade cash flags in the runtime path;
- no Add Trade checkbox;
- visible required BUY cash-effect information;
- insufficient BUY cash rejected before submission;
- canonical negative BUY cash impact;
- canonical positive SELL cash impact;
- explicit cash-adjustment workflow remains the correction path.

Exact-head validation:

**Phase 10 Visual Closure #37048999587** on `208aa5e9`

Passed:

- TypeScript;
- **87 / 87 Vitest files, 487 / 487 tests**;
- production Vite/PWA build;
- Cloudflare Worker dry-run;
- 12 / 12 responsive geometries at 0px page overflow;
- 16 / 16 rendered states.

**Rendered Visual Regression #37048999583** also passed on the same head.

---

## Stage 2.6 — canonical weighted-average / proportional cost basis

Stage 2.6 freezes one economic ownership rule for open cost and realized cost allocation.

### Canonical method

`CANONICAL_COST_BASIS_METHOD` is:

```text
WEIGHTED_AVERAGE_PROPORTIONAL
```

For a valid partial SELL:

```text
ratio                  = sold shares / open shares
allocated gross cost   = open gross cost × ratio
allocated buy fees     = open buy fees × ratio
remaining gross cost   = open gross cost - allocated gross cost
remaining buy fees     = open buy fees - allocated buy fees
realized P&L           = net sell proceeds - allocated gross cost - allocated buy fees
```

A proportional partial SELL therefore does not consume a first or last BUY lot economically. The remaining position continues to represent the same blended open exposure until another BUY changes the weighted average.

### One accounting authority

`calculateSellAccounting()` is the canonical partial-SELL allocation helper.

It is used by:

- normal SELL mutation preparation;
- OCR SELL mutation preparation;
- secondary analytics replay.

`reconcilePortfolioFromLedger()` uses the same proportional rule when rebuilding Positions and Closed Trades.

### Import and report rule

Google Sheets remains an import surface, not a second accounting engine.

Its legacy FIFO reconstruction path was removed. It now sorts the imported ledger and delegates Position / Closed Trade derivation to `reconcilePortfolioFromLedger()`.

Closed Cycles may show every contributing BUY/SELL execution for auditability. Those source phases are traceability metadata; they must not be summed as realized economic cost for a partial cycle. Displayed realized economics come from the canonical `ClosedTrade` projection.

### Quote-preservation rule

Changing the Sheets accounting path must not invent quote freshness.

When Sheets reconstruction receives no explicit live quote, the resulting Position falls back to its reconstructed weighted-average entry price, preserving the prior no-live-price behavior instead of injecting a static ticker-directory price.

### Stage 2.6 regression coverage

Added:

- `src/services/Stage26CanonicalCostBasis.test.ts`.

Updated:

- `src/components/Phase107CClosedCyclesClosure.test.ts` to preserve the visual/material contract while accepting the corrected canonical accounting source;
- secondary analytics to call the shared sell-accounting helper.

Coverage locks:

- explicit canonical method identifier;
- DCA + partial SELL allocation;
- proportional remaining open shares/cost/fees;
- Google Sheets parity with canonical reconciliation;
- removal of FIFO `lots.shift()` / first-lot consumption;
- no-live-quote weighted-average fallback;
- secondary analytics helper reuse;
- Closed Cycles traceability without source-leg repricing of realized cost.

Exact-head validation on `c12e7404`:

**Phase 10 Visual Closure #37096359624**

Passed:

- TypeScript;
- **88 / 88 Vitest files, 493 / 493 tests**;
- production Vite/PWA build;
- Cloudflare Worker dry-run;
- 12 / 12 responsive geometries at 0px page overflow;
- 16 / 16 rendered states.

**Rendered Visual Regression #37096359625** also passed on the same runtime head.

---

## Stage 2.7 — explicit cash-flow semantics

Stage 2.7 defines the economic meaning of every non-trade cash row before it enters reconciliation or performance math.

### Canonical taxonomy

```text
DEPOSIT                    external investor capital in
WITHDRAWAL                 external investor capital out

DIVIDEND                   portfolio performance income
OTHER_INCOME               portfolio performance income
FEE                        portfolio performance expense
OTHER_EXPENSE              portfolio performance expense

RECONCILIATION_ADJUSTMENT  bookkeeping correction, return-neutral
```

`CASH_ADJUSTMENT` is a legacy compatibility alias only.

Normalization converts:

```text
CASH_ADJUSTMENT → RECONCILIATION_ADJUSTMENT
```

No normal runtime writer is allowed to emit the legacy ambiguous type.

### Capital rule

Only `DEPOSIT` and `WITHDRAWAL` redefine contributed capital.

Dividends, fees, other income/expense and reconciliation corrections change cash without changing contributed capital.

### Performance rule

Cash performance is:

```text
+ DIVIDEND
+ OTHER_INCOME
- FEE
- OTHER_EXPENSE
```

This cash performance is included in realized performance composition and in the equity bridge.

A bookkeeping reconciliation is not performance.

### Return-neutral reconciliation rule

A reconciliation correction changes ledger equity mechanically. To prevent that book repair from being interpreted as return, TWR/MWRR treat its signed amount as a return-neutral portfolio flow.

That does **not** make it investor capital:

- return calculations neutralize it;
- `netDeposits` excludes it;
- contributed capital excludes it;
- equity bridge reports it separately as bookkeeping reconciliation.

Legacy synthetic opening capital remains synthesized when required even if reconciliation rows already exist.

### Import and direction rule

Cash-row BUY/SELL shape is derived from signed economic impact:

- positive cash event → BUY-shaped CASH row;
- negative cash event → SELL-shaped CASH row.

For reconciliation imports, signed amount precedence is:

1. explicit `cashFlowAmount`;
2. signed generic `amount`;
3. BUY/SELL direction applied to absolute total amount.

### Google Sheets rule

The Transaction Logger now preserves:

- `Cash Flow Type`;
- `Cash Flow Amount`.

Old logger sheets that lack those columns are extended when the app writes to them.

Import remains tolerant of older rows with no semantic columns. New semantic rows round-trip without degrading into ordinary trades.

### Stage 2.7 validation

Primary regression file:

- `src/services/Stage27CashAdjustmentSemantics.test.ts`.

Exact-head verification on `899bb4fa`:

**Phase 10 Visual Closure #37099343374**

Passed:

- TypeScript;
- **89 / 89 Vitest files, 504 / 504 tests**;
- production Vite/PWA build;
- Cloudflare Worker dry-run;
- 12 / 12 responsive geometries at 0px page overflow;
- 16 / 16 rendered states.

**Rendered Visual Regression #37099343371** also passed on the same exact runtime head.

---

## Stage 2.8 — financial acceptance and exit contract

Stage 2.8 validates the combined behavior of the Stage 2 architecture rather than introducing another financial path.

### Acceptance coverage

`src/services/Stage28FinancialAcceptance.test.ts` covers:

- DCA through repeated partial exits;
- proportional remaining cost and fee ownership;
- full close and reopen;
- correction of a source BUY after partial realization;
- duplicate OCR suppression;
- deposit/withdrawal, dividend, fee and reconciliation semantics in performance;
- exact same-day round trips;
- persistence failure across the full mutation family;
- canonical Stage 2 source guards;
- fresh quote precedence during accounting reconstruction.

`src/services/supabaseStorage.test.ts` additionally verifies that a stale device performing an accounting edit reloads the latest remote quote before persisting the canonical snapshot.

### Persistence failure acceptance

For every tested mutation family:

```text
prepare succeeds
validation succeeds
authoritative persist fails
→ apply is not called
→ persisted = false
→ previous local snapshot remains unchanged
```

The matrix includes:

- BUY;
- SELL;
- transaction edit;
- transaction delete;
- cash event;
- cash-entry edit;
- cash reconciliation;
- ledger reconciliation;
- OCR batch;
- portfolio restore;
- snapshot restore.

### Stage 2 exit contract

The stage is closed only while all of these remain true:

1. financial mutation order is prepare → validate → persist → apply;
2. Position / Closed Cycle cannot independently own accounting truth;
3. the single cost-basis method is `WEIGHTED_AVERAGE_PROPORTIONAL`;
4. BUY/SELL cannot bypass broker-cash impact with hidden toggles;
5. capital, performance cash and bookkeeping reconciliation are distinct;
6. persistence failure cannot leave the UI claiming unpersisted money or shares;
7. stale quote interaction cannot roll a fresher remote quote backward in the tested storage mutation path.

### Stage 2.8 validation

Exact-head verification on `70ad1148`:

**Phase 10 Visual Closure #37121788769**

Passed:

- TypeScript;
- **90 / 90 Vitest files, 513 / 513 tests**;
- production Vite/PWA build;
- Cloudflare Worker dry-run;
- 12 / 12 responsive geometries at 0px page overflow;
- 16 / 16 rendered states.

**Rendered Visual Regression #37121788757** also passed on the same exact runtime head.

Stage 2 is complete. Further accounting changes must preserve this contract or deliberately reopen the relevant stage invariant.

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
