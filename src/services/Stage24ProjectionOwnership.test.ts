import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Stage 2.4 projection ownership contract', () => {
  it('removes the FIFO open-buy deletion helper and Position delete mutation', () => {
    const reconciliation = readRelative('./portfolioReconciliation.ts');
    const hook = readRelative('../hooks/usePortfolioState.ts');

    expect(reconciliation).not.toContain('getOpenBuyTransactionIdsForTicker');
    expect(hook).not.toContain('const deletePosition');
    expect(hook).not.toContain('deletePosition,');
    expect(hook).not.toContain('updateFirestoreTransactions(');
  });

  it('turns Position deletion into source-ledger correction navigation', () => {
    const positions = readRelative('../components/PositionsTable.tsx');

    expect(positions).toContain('onCorrectLedger: (position: Position) => void');
    expect(positions).toContain('Review source ledger transactions');
    expect(positions).not.toContain('Delete Position Record');
    expect(positions).not.toContain('Confirm Delete Position Modal');
    expect(positions).not.toContain('setPositionToDelete');
  });

  it('turns Closed Cycle deletion into linked source-ledger correction navigation', () => {
    const closed = readRelative('../components/ClosedCyclesView.tsx');

    expect(closed).toContain('onCorrectLedger: (cycle: ClosedTrade, transactionIds: string[]) => void');
    expect(closed).toContain('explicitBuyIds');
    expect(closed).toContain('explicitSellIds');
    expect(closed).toContain('Review source ledger transactions');
    expect(closed).not.toContain('onDeleteTrade');
    expect(closed).not.toContain('Delete this closed cycle');
  });

  it('scopes the Journal to source transaction IDs and removes derived delete callbacks', () => {
    const journal = readRelative('../components/TradingJournal.tsx');

    expect(journal).toContain('export interface JournalLedgerFocus');
    expect(journal).toContain('ledgerFocusIds.has(tx.id)');
    expect(journal).toContain('Ledger correction scope');
    expect(journal).not.toContain('onDeleteTrade?:');
    expect(journal).not.toContain('onDeletePosition?:');
  });

  it('routes both projection correction actions to the Journal', () => {
    const app = readRelative('../App.tsx');

    expect(app).toContain('getActivePositionLedgerTransactionIds');
    expect(app).toContain('getClosedCycleLedgerTransactionIds');
    expect(app).toContain("handleTabChange('journal')");
    expect(app).toContain('ledgerFocus={ledgerCorrectionFocus}');
    expect(app).not.toContain('handleDeletePosition');
    expect(app).not.toContain('handleDeleteTrade');
  });
});
