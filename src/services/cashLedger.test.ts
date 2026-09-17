import { describe, expect, it } from 'vitest';
import { applyCashLedgerEvent, changeCashLedgerEntry, buildCashHistory, rebuildAfterLedgerChange } from './cashLedger';
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


describe('cash history editing and deletion', () => {
  const deposited = () => applyCashLedgerEvent(legacy(), 'DEPOSIT', 200, 'Bank', '2026-01-05');

  it('uses ledger IDs and selected dates in the history', () => {
    const state = deposited();
    const history = buildCashHistory(state);
    expect(history[0]).toMatchObject({ id: state.transaction.id, date: '2026-01-05', amount: 200, balanceAfter: 999 });
    expect(history).toHaveLength(2);
  });

  it('edits the original row and recalculates capital and cash without an adjustment', () => {
    const state = deposited();
    const next = changeCashLedgerEntry(state, state.transaction.id, { type: 'DEPOSIT', amount: 300, date: '2026-01-06', notes: 'Corrected' });
    expect(next.transactions).toHaveLength(state.transactions.length);
    expect(next.transactions.find(tx => tx.id === state.transaction.id)).toMatchObject({ totalAmount: 300, date: '2026-01-06', notes: 'Corrected' });
    expect(next.transactions.some(tx => tx.cashFlowType === 'CASH_ADJUSTMENT')).toBe(false);
    expect(next.capitalDeposits).toBe(1300);
    expect(next.cashBalance).toBe(1099);
    expectReloadStable({ ...next, transaction: next.transactions[0] });
  });

  it('changes a deposit into a withdrawal using the correct signed capital delta', () => {
    const state = deposited();
    const next = changeCashLedgerEntry(state, state.transaction.id, { type: 'WITHDRAWAL', amount: 100, date: '2026-01-05' });
    expect(next.capitalDeposits).toBe(900);
    expect(next.cashBalance).toBe(699);
    expect(buildCashHistory(next)[0].type).toBe('WITHDRAWAL');
  });

  it('deletes the actual deposit and retains trades and opening capital', () => {
    const state = deposited();
    const next = changeCashLedgerEntry(state, state.transaction.id, null);
    expect(next.transactions.some(tx => tx.id === state.transaction.id)).toBe(false);
    expect(next.capitalDeposits).toBe(1000);
    expect(next.cashBalance).toBe(799);
    expect(next.positions[0].shares).toBe(10);
    expectReloadStable({ ...next, transaction: next.transactions[0] });
  });

  it('never restores the last deleted deposit as implicit capital', () => {
    const state = applyCashLedgerEvent({ ...legacy(), transactions: [], capitalDeposits: 0 }, 'DEPOSIT', 1000);
    const next = changeCashLedgerEntry(state, state.transaction.id, null);
    expect(next.transactions).toEqual([]);
    expect(next.capitalDeposits).toBe(0);
    expect(next.cashBalance).toBe(0);
    expect(buildCashHistory(next)).toEqual([]);
  });

  it('supports edits and deletion of legacy opening capital without fabricating a new balance correction', () => {
    const state = legacy();
    const opening = buildCashHistory(state)[0];
    const edited = changeCashLedgerEntry(state, opening.id, { ...opening, amount: 800 });
    expect(edited.capitalDeposits).toBe(800);
    expect(edited.cashBalance).toBe(599);
    const deleted = changeCashLedgerEntry(state, opening.id, null);
    expect(deleted.cashBalance).toBe(-201);
    expect(deleted.capitalDeposits).toBe(0);
    expect(buildCashHistory(deleted)).toEqual([]);
    expectReloadStable({ ...deleted, transaction: buy });
  });

  it('keeps capital correct when a cash row is deleted through the general journal', () => {
    const state = deposited();
    const next = rebuildAfterLedgerChange(state, state.transactions.filter(tx => tx.id !== state.transaction.id));
    expect(next.capitalDeposits).toBe(1000);
    expect(next.cashBalance).toBe(799);
  });

  it('rejects stale IDs and invalid calendar dates without changing inputs', () => {
    const state = deposited();
    const original = JSON.stringify(state);
    expect(() => changeCashLedgerEntry(state, 'missing', null)).toThrow('not found');
    expect(() => changeCashLedgerEntry(state, state.transaction.id, { type: 'DEPOSIT', amount: 200, date: '2026-02-30' })).toThrow('valid date');
    expect(JSON.stringify(state)).toBe(original);
  });
});
