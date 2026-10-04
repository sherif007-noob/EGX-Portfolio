import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.3.1 local state and compatibility ownership', () => {
  it('keeps localStorage compatibility behind one owned module', () => {
    const facade = read('src/features/portfolio/usePortfolioState.ts');
    const localState = read('src/features/portfolio/state/usePortfolioLocalState.ts');
    const compatibility = read('src/features/portfolio/state/portfolioCompatibility.ts');

    expect(facade).not.toContain('localStorage.');
    expect(localState).not.toContain('localStorage.');
    expect(compatibility).toContain('localStorage.getItem');
    expect(compatibility).toContain('localStorage.setItem');

    for (const key of [
      'egx_pwa_positions_v3_reconciled',
      'egx_pwa_closed_trades_v3_reconciled',
      'egx_pwa_cash_balance_v3_reconciled',
      'egx_pwa_tickers_directory_v3_reconciled',
      'egx_pwa_transactions_v3_reconciled',
      'egx_pwa_capital_deposits_v1',
    ]) {
      expect(compatibility).toContain(key);
    }
  });

  it('keeps local presentation state free of remote persistence and ledger mutation concerns', () => {
    const localState = read('src/features/portfolio/state/usePortfolioLocalState.ts');
    const compatibility = read('src/features/portfolio/state/portfolioCompatibility.ts');
    const runtime = `${localState}\n${compatibility}`;

    for (const forbidden of [
      'loadPortfolioFromFirestore',
      'subscribeToPortfolioFromFirestore',
      'forceFullSyncToFirestore',
      'createLedgerMutationExecutor',
      'prepareBuyTradeMutation',
      'prepareSellTradeMutation',
      'prepareCashEventMutation',
      'getSupabaseBrowserClient',
    ]) {
      expect(runtime).not.toContain(forbidden);
    }
  });

  it('preserves startup compatibility, visual fixtures, and ticker metadata rehydration', () => {
    const localState = read('src/features/portfolio/state/usePortfolioLocalState.ts');
    const compatibility = read('src/features/portfolio/state/portfolioCompatibility.ts');

    expect(localState).toContain('initialTickers');
    expect(localState).toContain('initialCapitalDeposits');
    expect(localState).toContain('initialTransactions(tickers)');
    expect(localState).toContain('initialPositions');
    expect(localState).toContain('initialClosedTrades');
    expect(localState).toContain('initialCashBalance');
    expect(localState).toContain('persistPortfolioCompatibilityCache');

    expect(compatibility).toContain('VISUAL_REGRESSION_TICKERS');
    expect(compatibility).toContain('VISUAL_REGRESSION_TRANSACTIONS');
    expect(compatibility).toContain('VISUAL_REGRESSION_POSITIONS');
    expect(compatibility).toContain('VISUAL_REGRESSION_CLOSED_TRADES');
    expect(compatibility).toContain('VISUAL_REGRESSION_CASH_BALANCE');
    expect(compatibility).toContain('VISUAL_REGRESSION_CAPITAL_DEPOSITS');

    expect(compatibility).toContain('rehydrateTransactionMetadata');
    expect(compatibility).toContain('rehydrateClosedTradeMetadata');
    expect(compatibility).toContain('rehydratePositionsWithTickers');
    expect(compatibility).toContain('resolveTickerFromDirectory');
    expect(compatibility).toContain('selectPositionQuote');
  });
});
