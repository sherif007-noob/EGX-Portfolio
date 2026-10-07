import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function readRelative(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
}

describe('Stage 6.1 broker reconciliation ownership', () => {
  it('keeps broker reconciliation diagnostic and routes corrections to canonical surfaces', () => {
    const workspace = readRelative('../components/BrokerReconciliationWorkspace.tsx');
    const backup = readRelative('../components/PortfolioBackupModal.tsx');
    const navigation = readRelative('../features/app-shell/usePortfolioNavigation.ts');
    const app = readRelative('../App.tsx');

    expect(workspace).toContain('Compare Broker vs App');
    expect(workspace).toContain('This workspace is read-only');
    expect(workspace).toContain('Open Source Ledger');
    expect(workspace).toContain('Open Cash Ledger');
    expect(workspace).not.toContain('setPositions(');
    expect(workspace).not.toContain('setCashBalance(');

    expect(backup).toContain('<BrokerReconciliationWorkspace');
    expect(navigation).toContain("source: 'BROKER_RECONCILIATION'");
    expect(navigation).toContain("handleTabChange('journal')");
    expect(app).toContain("handleTabChange('cash')");
  });

  it('documents App minus Broker as the frozen difference convention', () => {
    const engine = readRelative('./brokerReconciliation.ts');
    expect(engine).toContain('const differenceShares = appShares - brokerShares');
    expect(engine).toContain('const differenceCash = appCash - brokerCash');
    expect(engine).toContain('resolveTickerFromDirectory');
  });
});
