import { describe, expect, it } from 'vitest';
import type { TradeTransaction } from '../types';
import { validateAccountingInvariants } from './portfolioAccounting';
import { buildHistoricalEquityCurve } from './portfolioPerformance';
import { reconcilePortfolioFromLedger } from './portfolioReconciliation';
import { prepareBonusSharesMutation } from './ledgerWorkflowMutations';
import type { CanonicalLedgerSnapshot } from './ledgerMutationService';

const buy = (
  id: string,
  shares: number,
  price: number,
  date: string,
  fees = 0,
): TradeTransaction => ({
  id,
  type: 'BUY',
  ticker: 'TEST',
  companyName: 'Test Co',
  sector: 'Other',
  shares,
  price,
  date,
  fees,
  totalAmount: shares * price + fees,
  grossTradeValue: shares * price,
  netCashImpact: -(shares * price + fees),
});

const bonus = (
  sourceShares: number,
  bonusShares: number,
  ratio: number,
  date: string,
): TradeTransaction => ({
  id: 'bonus-1',
  type: 'CORPORATE_ACTION',
  corporateActionType: 'BONUS_SHARES',
  corporateActionRatio: ratio,
  corporateActionSourceShares: sourceShares,
  corporateActionReference: 'TEST-DISCLOSURE',
  ticker: 'TEST',
  companyName: 'Test Co',
  sector: 'Other',
  shares: bonusShares,
  price: 0,
  date,
  fees: 0,
  totalAmount: 0,
  netCashImpact: 0,
});

function snapshot(transactions: TradeTransaction[], capitalDeposits = 10000): CanonicalLedgerSnapshot {
  const report = reconcilePortfolioFromLedger(transactions, [], capitalDeposits);
  return {
    transactions,
    positions: report.reconciledPositions,
    closedTrades: report.reconciledClosedTrades,
    cashBalance: report.reconciledCashBalance,
    capitalDeposits,
    tickers: [],
  };
}

describe('bonus-share corporate action accounting', () => {
  it('adds units with zero cash and zero added cost basis', () => {
    const transactions = [
      buy('buy-1', 100, 20, '2026-09-01', 10),
      bonus(100, 100, 1, '2026-10-01'),
    ];
    const report = reconcilePortfolioFromLedger(transactions, [], 5000);

    expect(report.discrepanciesFound).toEqual([]);
    expect(report.reconciledCashBalance).toBe(2990);
    expect(report.reconciledPositions).toHaveLength(1);
    expect(report.reconciledPositions[0]).toMatchObject({
      shares: 200,
      avgBuyPrice: 10,
      totalFees: 10,
    });

    expect(validateAccountingInvariants(
      transactions,
      report.reconciledPositions,
      report.reconciledClosedTrades,
      report.reconciledCashBalance,
    ).sharesBalanced).toBe(true);
  });

  it('preserves weighted cost basis through a post-action partial sell', () => {
    const transactions: TradeTransaction[] = [
      buy('buy-1', 100, 20, '2026-09-01', 10),
      bonus(100, 100, 1, '2026-10-01'),
      {
        id: 'sell-1',
        type: 'SELL',
        ticker: 'TEST',
        companyName: 'Test Co',
        sector: 'Other',
        shares: 50,
        price: 12,
        date: '2026-10-02',
        fees: 0,
        totalAmount: 600,
        grossTradeValue: 600,
        netCashImpact: 600,
      },
    ];

    const report = reconcilePortfolioFromLedger(transactions, [], 5000);
    expect(report.discrepanciesFound).toEqual([]);
    expect(report.reconciledPositions[0]).toMatchObject({
      shares: 150,
      avgBuyPrice: 10,
      totalFees: 7.5,
    });
    expect(report.reconciledClosedTrades[0].realizedPnlEgp).toBe(97.5);
  });

  it('rejects stale source-share metadata instead of silently changing quantity', () => {
    const report = reconcilePortfolioFromLedger([
      buy('buy-1', 100, 20, '2026-09-01'),
      bonus(90, 100, 1, '2026-10-01'),
    ], [], 5000);

    expect(report.discrepanciesFound.join(' ')).toContain('expected 90.0000 source shares');
    expect(report.reconciledPositions[0].shares).toBe(100);
  });

  it('keeps historical equity neutral when price adjusts for the extra shares', () => {
    const curve = buildHistoricalEquityCurve(
      [
        buy('buy-1', 100, 20, '2026-09-29'),
        bonus(100, 100, 1, '2026-10-01'),
      ],
      {
        TEST: [
          { date: '2026-09-29', close: 20 },
          { date: '2026-09-30', close: 20 },
          { date: '2026-10-01', close: 10 },
        ],
      },
      '2026-09-29',
      '2026-10-01',
      5000,
    );

    const before = curve.find((point) => point.date === '2026-09-30');
    const after = curve.find((point) => point.date === '2026-10-01');
    expect(before?.equity).toBe(5000);
    expect(after?.equity).toBe(5000);
    expect(after?.cash).toBe(before?.cash);
  });

  it('derives entitlement shares from the ledger before the effective date', () => {
    const current = snapshot([
      buy('buy-early', 100, 20, '2026-09-01'),
      buy('buy-later', 50, 30, '2026-10-05'),
    ]);

    const prepared = prepareBonusSharesMutation(current, {
      transactionId: 'corp-historical',
      ticker: 'TEST',
      bonusShares: 100,
      officialRatio: 1,
      effectiveDate: '2026-10-01',
      reference: 'TEST-DISCLOSURE',
    });

    expect(prepared.value?.corporateActionSourceShares).toBe(100);
    const report = reconcilePortfolioFromLedger(
      prepared.transactions,
      current.tickers,
      current.capitalDeposits,
      current.positions,
    );
    expect(report.discrepanciesFound).toEqual([]);
    expect(report.reconciledPositions[0].shares).toBe(250);
  });
});
