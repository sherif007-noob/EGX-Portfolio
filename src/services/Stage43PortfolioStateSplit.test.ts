import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.3 portfolio state ownership split', () => {
  it('keeps usePortfolioState as the owned application facade', () => {
    const hook = read('src/features/portfolio/usePortfolioState.ts');
    const legacyShim = read('src/hooks/usePortfolioState.ts');

    expect(hook).toContain('usePortfolioLocalState()');
    expect(hook).toContain('usePortfolioHydration(state)');
    expect(hook).toContain('usePortfolioLedgerMutations(state)');
    expect(hook).toContain('usePortfolioRepositoryActions(state)');

    expect(hook).not.toContain('localStorage.');
    expect(hook).not.toContain('createLedgerMutationExecutor');
    expect(hook).not.toContain('subscribeToPortfolioFromFirestore');
    expect(hook).not.toContain('forceFullSyncToFirestore');
    expect(hook).not.toContain('prepareBuyTradeMutation');
    expect(legacyShim).toContain("from '../features/portfolio/usePortfolioState'");
    expect(legacyShim).not.toContain('usePortfolioLocalState()');
  });

  it('separates compatibility cache, remote hydration, persistence and ledger mutation ownership', () => {
    const compatibility = read('src/features/portfolio/state/portfolioCompatibility.ts');
    const localState = read('src/features/portfolio/state/usePortfolioLocalState.ts');
    const hydration = read('src/features/portfolio/hydration/usePortfolioHydration.ts');
    const repository = read('src/features/portfolio/persistence/portfolioRepository.ts');
    const repositoryActions = read('src/features/portfolio/persistence/usePortfolioRepositoryActions.ts');
    const ledger = read('src/features/portfolio/ledger/usePortfolioLedgerMutations.ts');

    expect(compatibility).toContain('PORTFOLIO_STORAGE_KEYS');
    expect(compatibility).toContain('persistPortfolioCompatibilityCache');
    expect(localState).toContain('rehydratePositionsWithTickers');
    expect(hydration).toContain('portfolioRepository.subscribe');
    expect(hydration).toContain('selectPositionQuote');
    expect(repository).toContain('loadPortfolioFromFirestore');
    expect(repository).toContain('forceFullSyncToFirestore');
    expect(repositoryActions).toContain('portfolioRepository.saveSnapshot');
    expect(ledger).toContain('createLedgerMutationExecutor');
    expect(ledger).toContain('prepareBuyTradeMutation');
    expect(ledger).toContain('prepareSellTradeMutation');
    expect(ledger).toContain('prepareOcrBatchMutation');
  });

  it('preserves the application-facing operation API while hiding raw financial setters', () => {
    const hook = read('src/features/portfolio/usePortfolioState.ts');

    for (const name of [
      'positions',
      'closedTrades',
      'transactions',
      'cashBalance',
      'tickers',
      'capitalDeposits',
      'isInitialized',
      'updateMarketPositions',
      'addTrade',
      'sellPosition',
      'editPosition',
      'editTransaction',
      'deleteTransaction',
      'addCashTransaction',
      'editCashTransaction',
      'deleteCashTransaction',
      'reconcileLedger',
      'importBackup',
      'importOcrBatch',
      'restoreLedgerSnapshot',
      'updateTickers',
      'forceSync',
    ]) {
      expect(hook).toContain(name);
    }

    for (const rawSetter of [
      'setClosedTrades:',
      'setTransactions:',
      'setCashBalance:',
      'setTickers:',
      'setCapitalDeposits:',
    ]) {
      expect(hook).not.toContain(rawSetter);
    }
  });
});
