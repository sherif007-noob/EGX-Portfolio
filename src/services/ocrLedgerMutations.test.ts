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

  it('keeps source order for same-time close then reopen on the same ticker', () => {
    let seq = 0;
    const prepared = prepareOcrBatchMutation(current(), [
      {
        ticker: 'TEST', companyName: 'Test', sector: 'Other', type: 'SELL',
        shares: 10, price: 12, fees: 0, date: '2026-01-02',
        executedAt: '2026-01-02T10:16:00',
      },
      {
        ticker: 'TEST', companyName: 'Test', sector: 'Other', type: 'BUY',
        shares: 10, price: 11, fees: 0, date: '2026-01-02',
        executedAt: '2026-01-02T10:16:00',
      },
    ], () => `same-time-${++seq}`);

    expect(prepared.value).toMatchObject({ processedCount: 2, skippedCount: 0, duplicateCount: 0 });

    const report = reconcilePortfolioFromLedger(
      prepared.transactions,
      [],
      1000,
      current().positions,
    );
    expect(report.discrepanciesFound).toHaveLength(0);
    expect(report.reconciledClosedTrades).toHaveLength(1);
    expect(report.reconciledClosedTrades[0]).toMatchObject({
      ticker: 'TEST',
      shares: 10,
      buyPrice: 10,
      sellPrice: 12,
      realizedPnlEgp: 20,
    });
    expect(report.reconciledPositions.find((position) => position.ticker === 'TEST')).toMatchObject({
      shares: 10,
      avgBuyPrice: 11,
    });
  });

  it('preserves repeated same-ticker round trips as separate executions', () => {
    let seq = 0;
    const prepared = prepareOcrBatchMutation(current(), [
      {
        ticker: 'ACTF', companyName: 'Act Financial', sector: 'Other', type: 'SELL',
        shares: 3600, price: 2.67, fees: 5.8, date: '2026-10-04',
        executedAt: '2026-10-04T12:16:00',
      },
      {
        ticker: 'ACTF', companyName: 'Act Financial', sector: 'Other', type: 'BUY',
        shares: 3600, price: 2.66, fees: 8.19, date: '2026-10-04',
        executedAt: '2026-10-04T10:21:00',
      },
      {
        ticker: 'ACTF', companyName: 'Act Financial', sector: 'Other', type: 'SELL',
        shares: 3645, price: 2.66, fees: 5.84, date: '2026-10-04',
        executedAt: '2026-10-04T13:42:00',
      },
      {
        ticker: 'ACTF', companyName: 'Act Financial', sector: 'Other', type: 'BUY',
        shares: 3600, price: 2.66, fees: 8.19, date: '2026-10-04',
        executedAt: '2026-10-04T12:07:00',
      },
      {
        ticker: 'ACTF', companyName: 'Act Financial', sector: 'Other', type: 'SELL',
        shares: 3600, price: 2.67, fees: 5.8, date: '2026-10-04',
        executedAt: '2026-10-04T10:24:00',
      },
      {
        ticker: 'ACTF', companyName: 'Act Financial', sector: 'Other', type: 'BUY',
        shares: 3645, price: 2.67, fees: 8.3, date: '2026-10-04',
        executedAt: '2026-10-04T12:36:00',
      },
    ], () => `actf-${++seq}`);

    expect(prepared.value).toMatchObject({ processedCount: 6, skippedCount: 0, duplicateCount: 0 });

    const report = reconcilePortfolioFromLedger(
      prepared.transactions,
      [],
      1000,
      current().positions,
    );
    expect(report.discrepanciesFound).toHaveLength(0);
    expect(report.reconciledPositions.some((position) => position.ticker === 'ACTF')).toBe(false);
    expect(report.reconciledClosedTrades.filter((trade) => trade.ticker === 'ACTF')).toHaveLength(3);
  });

  it('does not collapse distinct same-batch rows solely because their economics and minute match', () => {
    let seq = 0;
    const prepared = prepareOcrBatchMutation(current(), [
      {
        ticker: 'SPLT', companyName: 'Split Fill', sector: 'Other', type: 'BUY',
        shares: 5, price: 10, fees: 1, date: '2026-01-02',
        executedAt: '2026-01-02T10:20:00',
      },
      {
        ticker: 'SPLT', companyName: 'Split Fill', sector: 'Other', type: 'BUY',
        shares: 5, price: 10, fees: 1, date: '2026-01-02',
        executedAt: '2026-01-02T10:20:00',
      },
    ], () => `split-${++seq}`);

    expect(prepared.value).toMatchObject({ processedCount: 2, skippedCount: 0, duplicateCount: 0 });
    const report = reconcilePortfolioFromLedger(prepared.transactions, [], 1000, current().positions);
    expect(report.reconciledPositions.find((position) => position.ticker === 'SPLT')).toMatchObject({
      shares: 10,
      avgBuyPrice: 10,
    });
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
