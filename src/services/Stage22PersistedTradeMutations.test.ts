import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Stage 2.2 persisted BUY/SELL contract', () => {
  it('routes BUY and SELL through the canonical ledger mutation executor', () => {
    const ledger = readRelative('../features/portfolio/ledger/usePortfolioLedgerMutations.ts');

    expect(ledger).toContain('createLedgerMutationExecutor()');
    expect(ledger).toContain("'BUY'");
    expect(ledger).toContain("'SELL'");
    expect(ledger).toContain('prepareBuyTradeMutation(current');
    expect(ledger).toContain('prepareSellTradeMutation(current');
    expect(ledger).toContain('apply: (snapshot) => applyLedgerSnapshot(snapshot)');
    expect(ledger).not.toContain("savePortfolioToFirestore({ positions: updatedPositions");
  });

  it('makes both app handlers await authoritative portfolio persistence before Sheets or success UI', () => {
    const workflows = readRelative('../features/app-shell/usePortfolioWorkflows.ts');

    expect(workflows).toContain('const result = await portfolio.addTrade({');
    expect(workflows).toContain('const result = await portfolio.sellPosition({');
    expect(workflows).toContain('appendPersistedTransactionToSheet(transaction)');
    expect(workflows.indexOf('await portfolio.addTrade({'))
      .toBeLessThan(workflows.indexOf('appendPersistedTransactionToSheet(transaction)'));
    expect(workflows).toContain('Nothing was changed.');
  });

  it('keeps Add Trade open and submit-disabled while the persisted BUY is unresolved', () => {
    const modal = readRelative('../components/AddTradeModal.tsx');

    expect(modal).toContain('const [isSubmitting, setIsSubmitting] = useState(false)');
    expect(modal).toContain('const shouldClose = await onAddPosition(');
    expect(modal).toContain('if (shouldClose) runVisualTransition');
    expect(modal).toContain('disabled={isSubmitting}');
    expect(modal).toContain("isSubmitting ? 'Saving…'");
  });

  it('keeps Sell open and submit-disabled while the persisted SELL is unresolved', () => {
    const modal = readRelative('../components/SellPositionModal.tsx');

    expect(modal).toContain('const [isSubmitting, setIsSubmitting] = useState(false)');
    expect(modal).toContain('const shouldClose = await onConfirmSell(');
    expect(modal).toContain('if (shouldClose) runVisualTransition');
    expect(modal).toContain('disabled={isSubmitting}');
    expect(modal).toContain("isSubmitting ? 'Saving Sale…'");
  });

  it('preserves position-authored metadata during canonical BUY reconciliation', () => {
    const reconciliation = readRelative('./portfolioReconciliation.ts');

    expect(reconciliation).toContain('targetPrice: existing?.targetPrice ?? sample.targetPrice ?? quote?.targetPrice');
    expect(reconciliation).toContain('stopLoss: existing?.stopLoss ?? sample.stopLoss ?? quote?.stopLoss');
    expect(reconciliation).toContain('notes: existing?.notes ?? sample.notes');
  });

  it('keeps canonical BUY/SELL preparation free of hidden cash-bypass branches after Stage 2.5', () => {
    const preparation = readRelative('./tradeLedgerMutations.ts');

    expect(preparation).not.toContain('deductFromCash');
    expect(preparation).not.toContain('addToCash');
    expect(preparation).toContain('netCashImpact: -cashOutflow');
    expect(preparation).toContain('netCashImpact: accounting.netProceeds');
  });
});
