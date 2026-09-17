import { describe, expect, it } from 'vitest';
import { applyCashLedgerEvent } from './cashLedger';
import { reconcilePortfolioFromLedger } from './portfolioReconciliation';
import type { TradeTransaction } from '../types';

const buy: TradeTransaction = {
  id: 'buy-1', type: 'BUY', ticker: 'TEST', companyName: 'Test', sector: 'Other',
  shares: 10, price: 20, fees: 1, totalAmount: 201, date: '2026-01-02',
};
const legacy = () => ({ transactions: [buy], positions: [], tickers: [], capitalDeposits: 1000 });

function expectReloadStable(state: ReturnType<typeof applyCashLedgerEvent>) {
  const reloaded = JSON.parse(JSON.stringify(state));
  const report = reconcilePortfolioFromLedger(reloaded.transactions, reloaded.tickers, reloaded.capitalDeposits, reloaded.positions);
  expect(report.reconciledCashBalance).toBe(state.cashBalance);
  expect(report.reconciledPositions).toEqual(state.positions);
  expect(report.reconciledClosedTrades).toEqual(state.closedTrades);
}

describe('cash ledger events', () => {
  it('carries legacy opening capital into the ledger once on the first deposit', () => {
    const first = applyCashLedgerEvent(legacy(), 'DEPOSIT', 200);
    expect(first.cashBalance).toBe(999);
    expect(first.capitalDeposits).toBe(1200);
    expect(first.transactions.filter((tx) => tx.cashFlowType === 'DEPOSIT')).toHaveLength(2);
    const second = applyCashLedgerEvent(first, 'DEPOSIT', 50);
    expect(second.cashBalance).toBe(1049);
    expect(second.capitalDeposits).toBe(1250);
    expect(second.transactions.filter((tx) => tx.notes?.startsWith('Opening capital'))).toHaveLength(1);
    expectReloadStable(second);
  });

  it('records withdrawals and preserves negative derived cash', () => {
    const next = applyCashLedgerEvent(legacy(), 'WITHDRAWAL', 900);
    expect(next.transaction.cashFlowType).toBe('WITHDRAWAL');
    expect(next.cashBalance).toBe(-101);
    expect(next.capitalDeposits).toBe(100);
    expect(next.positions[0].shares).toBe(10);
    expectReloadStable(next);
  });

  it('does not seed opening capital again when explicit flows already exist', () => {
    const initial = applyCashLedgerEvent({ ...legacy(), transactions: [], capitalDeposits: 0 }, 'DEPOSIT', 1000);
    const next = applyCashLedgerEvent(initial, 'WITHDRAWAL', 250);
    expect(next.transactions).toHaveLength(2);
    expect(next.cashBalance).toBe(750);
    expect(next.capitalDeposits).toBe(750);
    expectReloadStable(next);
  });

  it('persists a dividend without notes without changing contributed capital', () => {
    const next = applyCashLedgerEvent(legacy(), 'DIVIDEND', 50);
    expect(next.transaction.cashFlowType).toBe('DIVIDEND');
    expect(next.cashBalance).toBe(849);
    expect(next.capitalDeposits).toBe(1000);
    expect(next.transactions).toHaveLength(2);
    expect(next.positions.map((position) => position.ticker)).toEqual(['TEST']);
    expectReloadStable(next);
  });

  it('retains adjustments across later deposits and reconciliation', () => {
    const adjusted = applyCashLedgerEvent(legacy(), 'CASH_ADJUSTMENT', -100);
    expect(adjusted.cashBalance).toBe(699);
    expect(adjusted.capitalDeposits).toBe(1000);
    const deposited = applyCashLedgerEvent(adjusted, 'DEPOSIT', 200);
    expect(deposited.cashBalance).toBe(899);
    expect(deposited.capitalDeposits).toBe(1200);
    expect(deposited.transactions.find((tx) => tx.cashFlowType === 'CASH_ADJUSTMENT')?.cashFlowAmount).toBe(-100);
    expectReloadStable(deposited);
  });

  it('allows a dividend in an otherwise empty portfolio', () => {
    const next = applyCashLedgerEvent({ ...legacy(), transactions: [], capitalDeposits: 0 }, 'DIVIDEND', 20);
    expect(next.cashBalance).toBe(20);
    expect(next.capitalDeposits).toBe(0);
    expect(next.positions).toEqual([]);
    expectReloadStable(next);
  });

  it.each([NaN, Infinity, -10, 0, 0.001])('rejects invalid deposit amount %s', (amount) => {
    expect(() => applyCashLedgerEvent(legacy(), 'DEPOSIT', amount)).toThrow();
  });
});
