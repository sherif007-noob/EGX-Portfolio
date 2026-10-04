import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.3 portfolio state ownership split', () => {
  it('keeps usePortfolioState as a compatibility facade', () => {
    const hook = read('src/hooks/usePortfolioState.ts');

    expect(hook).toContain('usePortfolioLocalState()');
    expect(hook).toContain('usePortfolioHydration(state)');
    expect(hook).toContain('usePortfolioLedgerMutations(state)');
    expect(hook).toContain('usePortfolioRepositoryActions(state)');

    expect(hook).not.toContain('localStorage.');
    expect(hook).not.toContain('createLedgerMutationExecutor');
    expect(hook).not.toContain('subscribeToPortfolioFromFirestore');
    expect(hook).not.toContain('forceFullSyncToFirestore');
    expect(hook).not.toContain('prepareBuyTradeMutation');
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

  it('preserves the application-facing compatibility API while internals migrate', () => {
    const hook = read('src/hooks/usePortfolioState.ts');

    for (const name of [
      'positions',
      'closedTrades',
      'transactions',
      'cashBalance',
      'tickers',
      'capitalDeposits',
      'isInitialized',
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
  });
});
