import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { TradeTransaction } from '../types';
import { normalizeTransaction } from '../utils/portfolioMetrics';
import { reconcilePortfolioFromLedger } from './portfolioReconciliation';
import {
  buildExternalCashFlows,
  buildHistoricalEquityCurve,
  calculateEquityBridge,
  isEquityBridgeBalanced,
} from './portfolioPerformance';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const cashTx = (
  id: string,
  cashFlowType: TradeTransaction['cashFlowType'],
  amount: number,
  date: string,
): TradeTransaction => ({
  id,
  type: amount < 0 ? 'SELL' : 'BUY',
  ticker: 'CASH',
  companyName: 'Cash',
  sector: 'Liquid Buying Power',
  shares: Math.abs(amount),
  price: 1,
  date,
  fees: 0,
  totalAmount: Math.abs(amount),
  cashFlowType,
  cashFlowAmount: amount,
});

describe('Stage 2.7 explicit cash-flow semantics', () => {
  const ledger: TradeTransaction[] = [
    cashTx('dep', 'DEPOSIT', 1000, '2026-01-01'),
    cashTx('div', 'DIVIDEND', 50, '2026-01-02'),
    cashTx('income', 'OTHER_INCOME', 25, '2026-01-03'),
    cashTx('fee', 'FEE', 10, '2026-01-04'),
    cashTx('expense', 'OTHER_EXPENSE', 15, '2026-01-05'),
    cashTx('recon', 'RECONCILIATION_ADJUSTMENT', 100, '2026-01-06'),
  ];

  it('keeps capital, portfolio performance, and bookkeeping reconciliation separate', () => {
    const report = reconcilePortfolioFromLedger(ledger, [], 0);

    expect(report.reconciledCashBalance).toBe(1150);

    const bridge = calculateEquityBridge(
      1000,
      [],
      [],
      report.reconciledCashBalance,
      ledger,
    );

    expect(bridge.tradingRealizedPnl).toBe(0);
    expect(bridge.cashPerformancePnl).toBe(50);
    expect(bridge.realizedPnl).toBe(50);
    expect(bridge.reconciliationAdjustments).toBe(100);
    expect(bridge.reconciliationDelta).toBe(0);
    expect(isEquityBridgeBalanced(bridge)).toBe(true);
  });

  it('neutralizes reconciliation adjustments in returns without counting them as investor capital', () => {
    expect(buildExternalCashFlows(ledger)).toEqual([
      { date: '2026-01-01', amount: -1000, type: 'DEPOSIT' },
      { date: '2026-01-06', amount: -100, type: 'RECONCILIATION_ADJUSTMENT' },
    ]);

    const curve = buildHistoricalEquityCurve(
      ledger,
      {},
      '2026-01-01',
      '2026-01-06',
      0,
    );
    expect(curve.at(-1)?.cash).toBe(1150);
    expect(curve.at(-1)?.equity).toBe(1150);
  });

  it('keeps synthetic legacy opening capital when reconciliation is the only explicit neutral flow', () => {
    const reconciliationOnly = [
      cashTx('recon-only', 'RECONCILIATION_ADJUSTMENT', 100, '2026-01-02'),
    ];

    expect(buildExternalCashFlows(reconciliationOnly, 1000, '2026-01-01')).toEqual([
      { date: '2026-01-01', amount: -1000, type: 'DEPOSIT' },
      { date: '2026-01-02', amount: -100, type: 'RECONCILIATION_ADJUSTMENT' },
    ]);
  });

  it('migrates legacy CASH_ADJUSTMENT rows to reconciliation semantics on normalization', () => {
    const legacy = normalizeTransaction({
      ...cashTx('legacy', 'CASH_ADJUSTMENT', -75, '2026-01-07'),
      cashFlowType: 'CASH_ADJUSTMENT',
    });

    expect(legacy.cashFlowType).toBe('RECONCILIATION_ADJUSTMENT');
    expect(legacy.cashFlowAmount).toBe(-75);

    const report = reconcilePortfolioFromLedger([legacy], [], 1000);
    expect(report.reconciledCashBalance).toBe(925);
  });

  it('prevents new runtime writers from emitting the legacy ambiguous type', () => {
    const runtime = [
      readRelative('./cashLedger.ts'),
      readRelative('./ledgerWorkflowMutations.ts'),
      readRelative('../hooks/usePortfolioState.ts'),
      readRelative('./supabaseStorage.ts'),
    ].join('\n');

    expect(runtime).not.toContain("'CASH_ADJUSTMENT'");
    expect(runtime).toContain("'RECONCILIATION_ADJUSTMENT'");
    expect(readRelative('../types.ts')).toContain(
      "export type CashFlowType = CanonicalCashFlowType | 'CASH_ADJUSTMENT';",
    );
    expect(readRelative('./cashFlowSemantics.ts')).toContain(
      "if (raw === 'CASH_ADJUSTMENT') return 'RECONCILIATION_ADJUSTMENT';",
    );
  });

  it('keeps OTHER_INCOME and OTHER_EXPENSE out of external investor flows', () => {
    const flows = buildExternalCashFlows([
      cashTx('income-only', 'OTHER_INCOME', 250, '2026-02-01'),
      cashTx('expense-only', 'OTHER_EXPENSE', 80, '2026-02-02'),
    ]);
    expect(flows).toEqual([]);
  });
});
