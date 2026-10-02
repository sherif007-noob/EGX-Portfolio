import { describe, expect, it } from 'vitest';
import type { TradeTransaction } from '../types';
import type { CanonicalLedgerSnapshot } from './ledgerMutationService';
import { prepareOcrBatchMutation } from './ocrLedgerMutations';
import { reconcilePortfolioFromLedger } from './portfolioReconciliation';

const baseBuy: TradeTransaction = {
  id: 'buy-base', type: 'BUY', ticker: 'TEST', companyName: 'Test', sector: 'Other',
  shares: 10, price: 10, fees: 0, totalAmount: 100, grossTradeValue: 100,
  netCashImpact: -100, date: '2026-01-01', executedAt: '2026-01-01T10:00:00',
};

const current = (): CanonicalLedgerSnapshot => {
  const report = reconcilePortfolioFromLedger([baseBuy], [], 1000);
  return {
    transactions: [baseBuy],
    positions: report.reconciledPositions,
    closedTrades: report.reconciledClosedTrades,
    cashBalance: report.reconciledCashBalance,
    capitalDeposits: 1000,
    tickers: [],
  };
};

describe('OCR batch canonical mutation preparation', () => {
  it('processes a dependent BUY before a same-batch SELL and produces one candidate ledger', () => {
    let seq = 0;
    const prepared = prepareOcrBatchMutation(current(), [
      { ticker: 'NEW', companyName: 'New', sector: 'Other', type: 'SELL', shares: 5, price: 12, fees: 0, date: '2026-01-02' },
      { ticker: 'NEW', companyName: 'New', sector: 'Other', type: 'BUY', shares: 10, price: 10, fees: 0, date: '2026-01-02' },
    ], () => `ocr-${++seq}`);

    expect(prepared.value).toMatchObject({ processedCount: 2, skippedCount: 0, duplicateCount: 0 });
    const report = reconcilePortfolioFromLedger(
      prepared.transactions,
      [],
      1000,
      current().positions,
    );
    expect(report.discrepanciesFound).toHaveLength(0);
    expect(report.reconciledPositions.find((position) => position.ticker === 'NEW')?.shares).toBe(5);
  });

  it('blocks duplicate executions without duplicating the ledger row', () => {
    const prepared = prepareOcrBatchMutation(current(), [
      { ticker: 'TEST', companyName: 'Test', sector: 'Other', type: 'BUY', shares: 10, price: 10, fees: 0, date: '2026-01-01', executedAt: '2026-01-01T10:00:00' },
    ], () => 'should-not-be-used');

    expect(prepared.value).toMatchObject({ processedCount: 0, duplicateCount: 1 });
    expect(prepared.transactions).toHaveLength(1);
  });

  it('skips an unreconcilable SELL without creating an orphan sale', () => {
    const prepared = prepareOcrBatchMutation(current(), [
      { ticker: 'MISSING', companyName: 'Missing', sector: 'Other', type: 'SELL', shares: 5, price: 12, fees: 0, date: '2026-01-02' },
    ], () => 'orphan');

    expect(prepared.value).toMatchObject({ processedCount: 0, skippedCount: 1 });
    expect(prepared.transactions.some((transaction) => transaction.id === 'orphan')).toBe(false);
  });
});
