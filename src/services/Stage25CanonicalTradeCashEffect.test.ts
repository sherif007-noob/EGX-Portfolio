import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateTradeInput } from '../utils/portfolioValidation';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Stage 2.5 canonical trade cash effect', () => {
  it('has no BUY/SELL cash-bypass flags in the runtime trade path', () => {
    const files = [
      readRelative('../components/AddTradeModal.tsx'),
      readRelative('../App.tsx'),
      readRelative('../hooks/usePortfolioState.ts'),
      readRelative('./tradeLedgerMutations.ts'),
      readRelative('../utils/portfolioValidation.ts'),
    ].join('\n');

    expect(files).not.toContain('deductFromCash');
    expect(files).not.toContain('addToCash');
    expect(files).not.toContain('deductCash');
    expect(files).not.toContain('setDeductFromCash');
  });

  it('shows BUY cash effect as required information instead of a toggle', () => {
    const modal = readRelative('../components/AddTradeModal.tsx');

    expect(modal).toContain('data-trade-cash-effect="required"');
    expect(modal).toContain('Broker cash effect');
    expect(modal).toContain('This BUY will debit');
    expect(modal).not.toContain('type="checkbox"');
    expect(modal).not.toContain('premium-checkbox');
  });

  it('always validates BUY outlay against available broker cash when supplied', () => {
    const result = validateTradeInput({
      ticker: 'COMI',
      shares: 100,
      price: 10,
      fees: 5,
      type: 'BUY',
      date: '2026-10-02',
      availableCash: 100,
    });

    expect(result.warnings).toContain(
      'Trade outlay (1005.00 EGP) exceeds available cash (100.00 EGP). Cash balance will become negative.',
    );
  });

  it('keeps canonical BUY debit and SELL credit encoded in prepared ledger rows', () => {
    const preparation = readRelative('./tradeLedgerMutations.ts');

    expect(preparation).toContain('netCashImpact: -cashOutflow');
    expect(preparation).toContain('totalAmount: cashOutflow');
    expect(preparation).toContain('netCashImpact: accounting.netProceeds');
    expect(preparation).toContain('totalAmount: accounting.netProceeds');
  });

  it('keeps cash discrepancies explicit rather than as hidden trade modes', () => {
    const workflow = readRelative('./ledgerWorkflowMutations.ts');

    expect(workflow).toContain("'CASH_ADJUSTMENT'");
  });
});
