import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.3.2 remote hydration ownership', () => {
  it('keeps authoritative load, retry, subscription and cleanup in the hydration owner', () => {
    const hydration = read('src/features/portfolio/hydration/usePortfolioHydration.ts');

    expect(hydration).toContain('portfolioRepository.load()');
    expect(hydration).toContain('setTimeout(initializeRemotePortfolio, 30_000)');
    expect(hydration).toContain('portfolioRepository.flushPendingWrites()');
    expect(hydration).toContain('portfolioRepository.subscribe((remoteData) =>');
    expect(hydration).toContain('if (activeUnsubscribe) activeUnsubscribe()');
    expect(hydration).toContain('if (VISUAL_REGRESSION_MODE) return');
  });

  it('keeps long-lived subscription fallbacks current without restarting hydration', () => {
    const hydration = read('src/features/portfolio/hydration/usePortfolioHydration.ts');

    expect(hydration).toContain('const latestStateRef = useRef(state)');
    expect(hydration).toContain('latestStateRef.current = state');
    expect(hydration).toContain('const latestState = latestStateRef.current');
    expect(hydration).toContain('latestState.tickers');
    expect(hydration).toContain('latestState.capitalDeposits');
    expect(hydration).toContain('}, []);');
  });

  it('surfaces both synchronous subscription setup and asynchronous poll failures', () => {
    const hydration = read('src/features/portfolio/hydration/usePortfolioHydration.ts');
    const storage = read('src/services/supabaseStorage.ts');

    expect(storage).toContain('onError?: (err: any) => void');
    expect(storage).toContain('onError?.(error)');
    expect(hydration).toContain('Supabase portfolio subscription poll failed:');
    expect(hydration).toContain('Supabase portfolio subscription setup failed:');
  });

  it('preserves fresher local quote precedence while applying remote accounting state', () => {
    const hydration = read('src/features/portfolio/hydration/usePortfolioHydration.ts');

    expect(hydration).toContain('selectPositionQuote(');
    expect(hydration).toContain('Date.parse(local.priceUpdatedAt');
    expect(hydration).toContain('state.setClosedTrades(loadedClosed)');
    expect(hydration).toContain('state.setTransactions(loadedTransactions)');
    expect(hydration).toContain('state.setCashBalance(remoteData.cashBalance)');
    expect(hydration).toContain('state.setCapitalDeposits(remoteData.capitalDeposits)');
  });

  it('does not let hydration own local cache or financial mutation implementation', () => {
    const hydration = read('src/features/portfolio/hydration/usePortfolioHydration.ts');
    const facade = read('src/features/portfolio/usePortfolioState.ts');

    for (const forbidden of [
      'localStorage.',
      'createLedgerMutationExecutor',
      'prepareBuyTradeMutation',
      'prepareSellTradeMutation',
      'prepareCashEventMutation',
      'saveSnapshot(',
      'updatePositions(',
    ]) {
      expect(hydration).not.toContain(forbidden);
    }

    expect(facade).toContain('usePortfolioHydration(state)');
    expect(facade).not.toContain('portfolioRepository.load');
    expect(facade).not.toContain('portfolioRepository.subscribe');
  });
});
