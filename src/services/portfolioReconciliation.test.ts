import { describe, expect, it } from 'vitest';
import { TradeTransaction } from '../types';
import { reconcilePortfolioFromLedger } from './portfolioReconciliation';

const tx = (overrides: Partial<TradeTransaction>): TradeTransaction => ({
  id: overrides.id || `tx-${Math.random()}`,
  type: 'BUY', ticker: 'TEST', companyName: 'Test', sector: 'Other', shares: 10, price: 10,
  date: '2026-01-01T10:00:00Z', fees: 0, totalAmount: 100, ...overrides,
});

describe('portfolio reconciliation', () => {
  it('preserves zero starting capital instead of replacing it with the seed capital', () => {
    const report = reconcilePortfolioFromLedger([], [], 0);
    expect(report.reconciledCashBalance).toBe(0);
  });

  it('derives realized P&L from the ledger instead of stored transaction snapshots', () => {
    const report = reconcilePortfolioFromLedger([
      tx({ id: 'buy-1', shares: 10, price: 10, totalAmount: 100, fees: 2 }),
      tx({ id: 'sell-1', type: 'SELL', shares: 5, price: 12, totalAmount: 60, fees: 1, date: '2026-01-03T10:00:00Z', realizedPnlEgp: 999999, realizedPnlPercent: 999999 }),
    ], [], 1000);
    expect(report.reconciledClosedTrades).toHaveLength(1);
    expect(report.reconciledClosedTrades[0].realizedPnlEgp).toBe(8);
    expect(report.reconciledClosedTrades[0].holdingDays).toBe(2);
    expect(report.reconciledClosedTrades[0].buyTransactionIds).toEqual(['buy-1']);
    expect(report.reconciledClosedTrades[0].sellTransactionIds).toEqual(['sell-1']);
    expect(report.reconciledPositions[0].shares).toBe(5);
    expect(report.reconciledCashBalance).toBe(957);
  });

  it('starts a new trade cycle after a ticker is fully closed', () => {
    const report = reconcilePortfolioFromLedger([
      tx({ id: 'buy-1', shares: 10, price: 10, totalAmount: 100, date: '2026-01-01T10:00:00Z' }),
      tx({ id: 'sell-1', type: 'SELL', shares: 10, price: 11, totalAmount: 110, date: '2026-01-03T10:00:00Z' }),
      tx({ id: 'buy-2', shares: 10, price: 20, totalAmount: 200, date: '2026-02-01T10:00:00Z' }),
      tx({ id: 'sell-2', type: 'SELL', shares: 10, price: 22, totalAmount: 220, date: '2026-02-04T10:00:00Z' }),
    ], [], 1000);
    expect(report.reconciledClosedTrades).toHaveLength(2);
    const [latest, first] = report.reconciledClosedTrades;
    expect(latest.buyDate).toBe('2026-02-01T10:00:00Z');
    expect(latest.sellDate).toBe('2026-02-04T10:00:00Z');
    expect(latest.holdingDays).toBe(3);
    expect(first.buyDate).toBe('2026-01-01T10:00:00Z');
    expect(first.holdingDays).toBe(2);
    expect(report.reconciledPositions).toHaveLength(0);
  });

  it('keeps partial-sell cycle holding period anchored to the currently open lots', () => {
    const report = reconcilePortfolioFromLedger([
      tx({ id: 'buy-old', shares: 10, price: 10, totalAmount: 100, date: '2026-01-01T10:00:00Z' }),
      tx({ id: 'sell-partial', type: 'SELL', shares: 5, price: 12, totalAmount: 60, date: '2026-01-05T10:00:00Z' }),
      tx({ id: 'buy-new', shares: 5, price: 20, totalAmount: 100, date: '2026-01-10T10:00:00Z' }),
      tx({ id: 'sell-final', type: 'SELL', shares: 10, price: 21, totalAmount: 210, date: '2026-01-12T10:00:00Z' }),
    ], [], 1000);
    expect(report.reconciledClosedTrades).toHaveLength(1);
    expect(report.reconciledClosedTrades[0].buyDate).toBe('2026-01-01T10:00:00Z');
    expect(report.reconciledClosedTrades[0].holdingDays).toBe(11);
    expect(report.reconciledClosedTrades[0].buyTransactionIds).toEqual(['buy-old', 'buy-new']);
    expect(report.reconciledClosedTrades[0].sellTransactionIds).toEqual(['sell-partial', 'sell-final']);
  });

  it('uses exact execution timestamps when both transactions provide them', () => {
    const report = reconcilePortfolioFromLedger([
      tx({ id: 'sell-early', type: 'SELL', shares: 10, price: 12, totalAmount: 120, date: '2026-01-05', executedAt: '2026-01-05T09:30:00' }),
      tx({ id: 'buy-later', type: 'BUY', shares: 10, price: 10, totalAmount: 100, date: '2026-01-05', executedAt: '2026-01-05T10:00:00' }),
    ], [], 1000);
    expect(report.reconciledPositions[0].shares).toBe(10);
    expect(report.reconciledClosedTrades).toHaveLength(0);
    expect(report.discrepanciesFound[0]).toContain('SELL sell-early');
  });

  it('keeps fractional shares without rounding them away', () => {
    const report = reconcilePortfolioFromLedger([tx({ id: 'buy-fractional', shares: 10.125, price: 10, totalAmount: 101.25 })], [], 1000);
    expect(report.reconciledPositions[0].shares).toBe(10.125);
  });

  it('does not double-count explicit deposit and withdrawal ledger flows against capitalDeposits', () => {
    const report = reconcilePortfolioFromLedger([
      tx({ id: 'deposit', type: 'DEPOSIT' as TradeTransaction['type'], ticker: 'CASH', shares: 500, price: 1, totalAmount: 500, cashFlowType: 'DEPOSIT' }),
      tx({ id: 'withdraw', type: 'WITHDRAWAL' as TradeTransaction['type'], ticker: 'CASH', shares: 200, price: 1, totalAmount: 200, cashFlowType: 'WITHDRAWAL' }),
    ], [], 1500);
    expect(report.reconciledCashBalance).toBe(300);
    expect(report.discrepanciesFound).toHaveLength(0);
  });

  it('treats dividends as cash inflows without creating an equity position', () => {
    const report = reconcilePortfolioFromLedger([tx({ id: 'dividend', type: 'DIVIDEND' as TradeTransaction['type'], ticker: 'ABC', shares: 1, price: 5, totalAmount: 5 })], [], 1000);
    expect(report.reconciledCashBalance).toBe(1005);
    expect(report.reconciledPositions).toHaveLength(0);
  });

  it('price update must not resurrect a deleted ledger transaction', () => {
    const buy: TradeTransaction = { id: 'buy-1', type: 'BUY', ticker: 'COMI', companyName: 'COMI', sector: 'Banking', shares: 100, price: 50, fees: 0, date: '2026-09-01', totalAmount: 5000 };
    const sell: TradeTransaction = { id: 'sell-1', type: 'SELL', ticker: 'COMI', companyName: 'COMI', sector: 'Banking', shares: 40, price: 60, fees: 0, date: '2026-09-02', totalAmount: 2400 };
    const withSell = reconcilePortfolioFromLedger([buy, sell], [], 5000);
    expect(withSell.reconciledPositions[0].shares).toBe(60);
    const afterDelete = reconcilePortfolioFromLedger([buy], [], 5000);
    expect(afterDelete.reconciledPositions[0].shares).toBe(100);
    expect(afterDelete.reconciledClosedTrades).toHaveLength(0);
  });
});
