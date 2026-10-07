import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.3.3 canonical ledger mutation ownership', () => {
  it('keeps every financial mutation family behind one portfolio ledger owner', () => {
    const ledger = read('src/features/portfolio/ledger/usePortfolioLedgerMutations.ts');

    for (const preparation of [
      'prepareBuyTradeMutation',
      'prepareSellTradeMutation',
      'prepareBonusSharesMutation',
      'prepareIpoSubscriptionMutation',
      'prepareIpoAllocationMutation',
      'prepareIpoCancellationMutation',
      'prepareTransactionEditMutation',
      'prepareTransactionDeleteMutation',
      'prepareCashEventMutation',
      'prepareCashEntryMutation',
      'prepareCashBalanceAdjustmentMutation',
      'prepareLedgerReconciliationMutation',
      'preparePortfolioRestoreMutation',
      'prepareLedgerSnapshotRestoreMutation',
      'prepareOcrBatchMutation',
    ]) {
      expect(ledger).toContain(preparation);
    }

    for (const kind of [
      "'BUY'",
      "'SELL'",
      "'CORPORATE_ACTION_BONUS_SHARES'",
      "'IPO_SUBSCRIPTION_SUBMIT'",
      "'IPO_SUBSCRIPTION_ALLOCATE'",
      "'IPO_SUBSCRIPTION_CANCEL'",
      "'EDIT_TRANSACTION'",
      "'DELETE_TRANSACTION'",
      "'EDIT_CASH_TRANSACTION'",
      "'DELETE_CASH_TRANSACTION'",
      "'RECONCILE_LEDGER'",
      "'RESTORE_PORTFOLIO'",
      "'OCR_BATCH_IMPORT'",
      "'RESTORE_LEDGER_SNAPSHOT'",
      "'RECONCILIATION_ADJUSTMENT'",
    ]) {
      expect(ledger).toContain(kind);
    }
  });

  it('keeps persistence-before-apply ordering in the canonical executor', () => {
    const executor = read('src/services/ledgerMutationService.ts');

    const persistIndex = executor.indexOf('persisted = await persist(candidate.snapshot)');
    const applyIndex = executor.indexOf('request.apply(candidate.snapshot, candidate.value)');

    expect(persistIndex).toBeGreaterThan(-1);
    expect(applyIndex).toBeGreaterThan(persistIndex);
    expect(executor).toContain("'BUSY'");
    expect(executor).toContain("'busy'");
    expect(executor).toContain('inFlightKind = kind');
    expect(executor).toContain('inFlightKind = null');
  });

  it('advances the mutation snapshot synchronously before React state setters run', () => {
    const ledger = read('src/features/portfolio/ledger/usePortfolioLedgerMutations.ts');

    expect(ledger).toContain('const latestLedgerSnapshotRef = useRef<CanonicalLedgerSnapshot>(renderedSnapshot)');
    expect(ledger).toContain('latestLedgerSnapshotRef.current = renderedSnapshot');
    expect(ledger).toContain('(): CanonicalLedgerSnapshot => latestLedgerSnapshotRef.current');

    const advanceIndex = ledger.indexOf('latestLedgerSnapshotRef.current = next');
    const transactionSetterIndex = ledger.indexOf('state.setTransactions(next.transactions)');

    expect(advanceIndex).toBeGreaterThan(-1);
    expect(transactionSetterIndex).toBeGreaterThan(advanceIndex);
  });

  it('uses collision-resistant IDs for newly authored BUY, SELL, and corporate-action entries', () => {
    const ledger = read('src/features/portfolio/ledger/usePortfolioLedgerMutations.ts');

    expect(ledger.match(/transactionId: `tx-\$\{crypto\.randomUUID\(\)\}`/g)?.length).toBe(4);
    expect(ledger).not.toContain('Math.random()');
  });

  it('keeps storage, hydration, Sheets and local cache mechanics out of the ledger owner', () => {
    const ledger = read('src/features/portfolio/ledger/usePortfolioLedgerMutations.ts');

    for (const forbidden of [
      'localStorage.',
      'portfolioRepository.',
      'loadPortfolioFromFirestore',
      'subscribeToPortfolioFromFirestore',
      'forceFullSyncToFirestore',
      'appendTransactionToSheet',
      'syncTransactionsLedgerToSheet',
      'getSupabaseBrowserClient',
    ]) {
      expect(ledger).not.toContain(forbidden);
    }
  });

  it('keeps the public compatibility facade delegating financial writes to the ledger owner', () => {
    const facade = read('src/features/portfolio/usePortfolioState.ts');

    expect(facade).toContain('const ledger = usePortfolioLedgerMutations(state)');
    for (const delegation of [
      'addTrade: ledger.addTrade',
      'sellPosition: ledger.sellPosition',
      'addBonusShares: ledger.addBonusShares',
      'addIpoSubscription: ledger.addIpoSubscription',
      'allocateIpoSubscription: ledger.allocateIpoSubscription',
      'cancelIpoSubscription: ledger.cancelIpoSubscription',
      'editTransaction: ledger.editTransaction',
      'deleteTransaction: ledger.deleteTransaction',
      'addCashTransaction: ledger.addCashTransaction',
      'editCashTransaction: ledger.editCashTransaction',
      'deleteCashTransaction: ledger.deleteCashTransaction',
      'reconcileLedger: ledger.reconcileLedger',
      'importBackup: ledger.importBackup',
      'importOcrBatch: ledger.importOcrBatch',
      'restoreLedgerSnapshot: ledger.restoreLedgerSnapshot',
      'updateCashBalance: ledger.updateCashBalance',
    ]) {
      expect(facade).toContain(delegation);
    }
  });
});
