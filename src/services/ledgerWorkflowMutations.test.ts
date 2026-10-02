import { describe, expect, it } from 'vitest';
import type { CashTransaction, TradeTransaction } from '../types';
import type { CanonicalLedgerSnapshot } from './ledgerMutationService';
import {
  prepareCashEntryMutation,
  prepareCashEventMutation,
  preparePortfolioRestoreMutation,
  prepareTransactionDeleteMutation,
  prepareTransactionEditMutation,
} from './ledgerWorkflowMutations';
import { reconcilePortfolioFromLedger } from './portfolioReconciliation';

const buy = (overrides: Partial<TradeTransaction> = {}): TradeTransaction => ({
  id: 'buy-1',
  type: 'BUY',
  ticker: 'TEST',
  companyName: 'Test',
  sector: 'Other',
  shares: 10,
  price: 10,
  fees: 1,
  totalAmount: 101,
  grossTradeValue: 100,
  netCashImpact: -101,
  date: '2026-01-02',
  ...overrides,
});

const snapshot = (transactions: TradeTransaction[] = [buy()]): CanonicalLedgerSnapshot => {
  const capitalDeposits = 1000;
  const report = reconcilePortfolioFromLedger(transactions, [], capitalDeposits);
  return {
    transactions,
    positions: report.reconciledPositions,
    closedTrades: report.reconciledClosedTrades,
    cashBalance: report.reconciledCashBalance,
    capitalDeposits,
    tickers: [],
  };
};

describe('Stage 2.3 ledger workflow preparation', () => {
  it('recomputes BUY cash fields during transaction edit instead of retaining stale net cash', () => {
    const current = snapshot();
    const prepared = prepareTransactionEditMutation(current, {
      ...current.transactions[0],
      shares: 20,
      price: 12,
      fees: 2,
      totalAmount: 101,
      grossTradeValue: 100,
      netCashImpact: -101,
    });
    const edited = prepared.value!;
    expect(edited.totalAmount).toBe(242);
    expect(edited.grossTradeValue).toBe(240);
    expect(edited.netCashImpact).toBe(-242);
  });

  it('recomputes SELL proceeds and clears stale derived P&L fields during edit', () => {
    const sell: TradeTransaction = {
      id: 'sell-1', type: 'SELL', ticker: 'TEST', companyName: 'Test', sector: 'Other',
      shares: 5, price: 12, fees: 1, totalAmount: 59, grossTradeValue: 60, netCashImpact: 59,
      realizedPnlEgp: 999, realizedPnlPercent: 999, outcome: 'WIN', holdingDays: 99,
      date: '2026-01-03',
    };
    const current = snapshot([buy(), sell]);
    const prepared = prepareTransactionEditMutation(current, {
      ...sell, shares: 4, price: 15, fees: 2,
    });
    expect(prepared.value).toMatchObject({
      totalAmount: 58,
      grossTradeValue: 60,
      netCashImpact: 58,
    });
    expect(prepared.value?.realizedPnlEgp).toBeUndefined();
    expect(prepared.value?.outcome).toBeUndefined();
  });

  it('updates contributed capital when a cash transaction is deleted through the general journal', () => {
    const deposit: TradeTransaction = {
      id: 'dep', type: 'BUY', ticker: 'CASH', companyName: 'Cash Balance',
      sector: 'Liquid Buying Power', shares: 1000, price: 1, fees: 0, totalAmount: 1000,
      cashFlowType: 'DEPOSIT', cashFlowAmount: 1000, date: '2026-01-01',
    };
    const current = snapshot([deposit, buy()]);
    const prepared = prepareTransactionDeleteMutation(
      { ...current, capitalDeposits: 1000 },
      'dep',
    );
    expect(prepared.capitalDeposits).toBe(0);
    expect(prepared.transactions.some((transaction) => transaction.id === 'dep')).toBe(false);
  });

  it('prepares cash add/edit through the same candidate-ledger shape', () => {
    const current = snapshot();
    const added = prepareCashEventMutation(current, 'DEPOSIT', 200, 'Bank', '2026-01-05');
    expect(added.value?.cashFlowType).toBe('DEPOSIT');
    expect(added.capitalDeposits).toBe(1200);

    const cashRow = added.value!;
    const nextSnapshot = {
      ...current,
      transactions: added.transactions,
      capitalDeposits: added.capitalDeposits!,
      positions: reconcilePortfolioFromLedger(added.transactions, [], added.capitalDeposits!, current.positions).reconciledPositions,
    };
    const edit: CashTransaction = {
      id: cashRow.id,
      type: 'WITHDRAWAL',
      amount: 50,
      date: '2026-01-06',
      notes: 'corrected',
      balanceAfter: 0,
    };
    const changed = prepareCashEntryMutation(nextSnapshot, cashRow.id, edit);
    expect(changed.capitalDeposits).toBe(950);
  });

  it('restores ledger authority and rejects projection-only backups', () => {
    const current = snapshot();
    const prepared = preparePortfolioRestoreMutation(current, {
      transactions: [buy({ id: 'restored', shares: 2, price: 20, totalAmount: 40 })],
      capitalDeposits: 500,
      positions: [],
      closedTrades: [],
      cashBalance: 123,
    });
    expect(prepared.transactions[0].id).toBe('restored');
    expect(prepared.capitalDeposits).toBe(500);

    expect(() => preparePortfolioRestoreMutation(current, {
      transactions: [],
      positions: current.positions,
      cashBalance: current.cashBalance,
    })).toThrow('no transaction ledger');
  });
});
