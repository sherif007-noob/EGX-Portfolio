import { EGXTicker, Position, TradeTransaction, CashFlowType } from '../types';
import { normalizeTransaction } from '../utils/portfolioMetrics';
import { reconcilePortfolioFromLedger } from './portfolioReconciliation';

interface CashLedgerState {
  transactions: TradeTransaction[];
  positions: Position[];
  tickers: EGXTicker[];
  capitalDeposits: number;
}

/** Apply a cash event and rebuild every projection from the resulting ledger. */
export function applyCashLedgerEvent(
  state: CashLedgerState,
  kind: Extract<CashFlowType, 'DEPOSIT' | 'WITHDRAWAL' | 'DIVIDEND' | 'CASH_ADJUSTMENT'>,
  amount: number,
  notes = '',
  date = new Date().toISOString().slice(0, 10),
) {
  if (!Number.isFinite(amount) || (kind !== 'CASH_ADJUSTMENT' && amount <= 0)) {
    throw new Error('Cash amount must be finite and positive (adjustments may be signed).');
  }
  if (!Number.isFinite(state.capitalDeposits)) throw new Error('Capital must be finite.');
  const value = Number(amount.toFixed(2));
  if (value === 0) throw new Error('Cash amount must be at least 0.01 EGP.');
  const transactions = state.transactions.map(normalizeTransaction);
  const external = kind === 'DEPOSIT' || kind === 'WITHDRAWAL';
  const hasExternal = transactions.some((tx) =>
    tx.cashFlowType === 'DEPOSIT' || tx.cashFlowType === 'WITHDRAWAL'
    || (tx.ticker === 'CASH' && !tx.cashFlowType),
  );

  const cashRow = (cashKind: CashFlowType, cashAmount: number, cashDate: string, cashNotes: string): TradeTransaction => ({
    id: `tx-cash-${crypto.randomUUID()}`,
    type: cashKind === 'WITHDRAWAL' || cashAmount < 0 ? 'SELL' : 'BUY',
    ticker: 'CASH', companyName: 'Cash Balance', sector: 'Liquid Buying Power',
    shares: Math.abs(cashAmount), price: 1, fees: 0,
    date: cashDate, totalAmount: Math.abs(cashAmount),
    cashFlowType: cashKind, cashFlowAmount: cashAmount, notes: cashNotes,
  });

  // Reconciliation uses explicit capital flows once any exist. Materialize the
  // legacy opening capital once, so the first new flow cannot erase that baseline.
  if (external && !hasExternal && state.capitalDeposits > 0) {
    const openingDate = transactions.reduce((earliest, tx) =>
      tx.date.slice(0, 10) < earliest ? tx.date.slice(0, 10) : earliest, date);
    transactions.push(cashRow('DEPOSIT', state.capitalDeposits, openingDate, 'Opening capital carried forward from legacy balance'));
  }

  const transaction = cashRow(kind, value, date, notes);
  transactions.unshift(transaction);
  const capitalDeposits = Number((state.capitalDeposits
    + (kind === 'DEPOSIT' ? value : kind === 'WITHDRAWAL' ? -value : 0)).toFixed(2));
  const report = reconcilePortfolioFromLedger(transactions, state.tickers, capitalDeposits, state.positions);
  return {
    transaction, transactions, capitalDeposits, tickers: state.tickers,
    positions: report.reconciledPositions,
    closedTrades: report.reconciledClosedTrades,
    cashBalance: report.reconciledCashBalance,
  };
}
