import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

const read = (relativePath: string) =>
  readFileSync(join(projectRoot, relativePath), 'utf8');

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(root)) {
    const full = join(root, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name) || /\.test\.(ts|tsx)$/.test(name)) continue;
    out.push(full);
  }
  return out;
}

describe('Stage 4.3.5 portfolio facade regression closure', () => {
  it('owns the public facade inside the portfolio feature and leaves the legacy hook as a shim', () => {
    const featureFacade = read('src/features/portfolio/usePortfolioState.ts');
    const featureIndex = read('src/features/portfolio/index.ts');
    const legacyShim = read('src/hooks/usePortfolioState.ts');

    expect(featureFacade).toContain('export function usePortfolioState()');
    expect(featureFacade).toContain('export type PortfolioStateFacade');
    expect(featureIndex).toContain("from './usePortfolioState'");
    expect(legacyShim).toContain("from '../features/portfolio/usePortfolioState'");
    expect(legacyShim).not.toContain('usePortfolioLocalState()');
    expect(legacyShim).not.toContain('usePortfolioHydration(');
    expect(legacyShim).not.toContain('usePortfolioLedgerMutations(');
    expect(legacyShim).not.toContain('usePortfolioRepositoryActions(');
  });

  it('does not expose raw financial state setters through the application facade', () => {
    const facade = read('src/features/portfolio/usePortfolioState.ts');

    for (const rawSetter of [
      'setPositions:',
      'setClosedTrades:',
      'setTransactions:',
      'setCashBalance:',
      'setTickers:',
      'setCapitalDeposits:',
    ]) {
      expect(facade).not.toContain(rawSetter);
    }

    expect(facade).toContain('updateMarketPositions');
    expect(facade).toContain('updateTickers: repository.updateTickers');
    expect(facade).toContain('updateCashBalance: ledger.updateCashBalance');
  });

  it('keeps market projection updates explicit instead of handing App the React setter', () => {
    const app = read('src/App.tsx');
    const facade = read('src/features/portfolio/usePortfolioState.ts');

    expect(app).toContain('updateMarketPositions');
    expect(app).toContain('useMarketData(positions, tickers, updateMarketPositions');
    expect(app).not.toContain('useMarketData(positions, tickers, setPositions');

    expect(facade).toContain('const updateMarketPositions = useCallback((positions: Position[]) =>');
    expect(facade).toContain('state.setPositions(positions)');
  });

  it('keeps application code on the feature entry point rather than the legacy hook path', () => {
    const offenders = sourceFiles(join(projectRoot, 'src'))
      .filter((file) => !file.endsWith(join('hooks', 'usePortfolioState.ts')))
      .filter((file) => {
        const content = readFileSync(file, 'utf8');
        return /from\s+['"][^'"]*hooks\/usePortfolioState['"]/.test(content);
      })
      .map((file) => relative(projectRoot, file));

    expect(offenders).toEqual([]);
    expect(read('src/App.tsx')).toContain("from './features/portfolio'");
  });

  it('retains explicit ledger and repository operations on the facade', () => {
    const facade = read('src/features/portfolio/usePortfolioState.ts');

    for (const delegation of [
      'addTrade: ledger.addTrade',
      'sellPosition: ledger.sellPosition',
      'editPosition: repository.editPosition',
      'editTransaction: ledger.editTransaction',
      'deleteTransaction: ledger.deleteTransaction',
      'addCashTransaction: ledger.addCashTransaction',
      'editCashTransaction: ledger.editCashTransaction',
      'deleteCashTransaction: ledger.deleteCashTransaction',
      'reconcileLedger: ledger.reconcileLedger',
      'importBackup: ledger.importBackup',
      'importOcrBatch: ledger.importOcrBatch',
      'restoreLedgerSnapshot: ledger.restoreLedgerSnapshot',
      'restoreInitialState: ledger.restoreInitialState',
      'forceSync: repository.forceSync',
    ]) {
      expect(facade).toContain(delegation);
    }
  });
});
