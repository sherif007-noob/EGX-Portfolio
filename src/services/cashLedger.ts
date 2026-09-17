import { EGXTicker, Position, TradeTransaction, CashFlowType, CashTransaction } from '../types';
import { normalizeTransaction } from '../utils/portfolioMetrics';
import { reconcilePortfolioFromLedger, sortTransactions } from './portfolioReconciliation';

interface CashLedgerState {
  transactions: TradeTransaction[];
  positions: Position[];
  tickers: EGXTicker[];
  capitalDeposits: number;
}

function validateCashDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))
    || new Date(date).toISOString().slice(0, 10) !== date) {
    throw new Error('Please select a valid date.');
  }
}

/** Apply a cash event and rebuild every projection from the resulting ledger. */
export function applyCashLedgerEvent(
  state: CashLedgerState,
  kind: Extract<CashFlowType, 'DEPOSIT' | 'WITHDRAWAL' | 'DIVIDEND' | 'CASH_ADJUSTMENT'>,
  amount: number,
  notes = '',
  date = new Date().toISOString().slice(0, 10),
) {
  validateCashDate(date);
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


function externalKind(tx: TradeTransaction): 'DEPOSIT' | 'WITHDRAWAL' | undefined {
  if (tx.cashFlowType === 'DEPOSIT' || tx.cashFlowType === 'WITHDRAWAL') return tx.cashFlowType;
  if (tx.ticker === 'CASH' && !tx.cashFlowType) return tx.type === 'BUY' ? 'DEPOSIT' : 'WITHDRAWAL';
}

function capitalContribution(tx: TradeTransaction): number {
  const kind = externalKind(tx);
  return kind === 'DEPOSIT' ? tx.totalAmount : kind === 'WITHDRAWAL' ? -tx.totalAmount : 0;
}

// A display/edit bridge for legacy opening capital, never a second local ledger.
function withOpeningCapital(state: CashLedgerState): TradeTransaction[] {
  const transactions = state.transactions.map(normalizeTransaction);
  if (!transactions.some(externalKind) && state.capitalDeposits > 0) {
    transactions.push({
      id: 'legacy-opening-capital', type: 'BUY', ticker: 'CASH', companyName: 'Cash Balance',
      sector: 'Liquid Buying Power', shares: state.capitalDeposits, price: 1, fees: 0,
      totalAmount: state.capitalDeposits, cashFlowType: 'DEPOSIT', cashFlowAmount: state.capitalDeposits,
      date: transactions.reduce((date, tx) => tx.date.slice(0, 10) < date ? tx.date.slice(0, 10) : date, new Date().toISOString().slice(0, 10)),
      notes: 'Opening capital carried forward from legacy balance',
    });
  }
  return transactions;
}

export function rebuildAfterLedgerChange(state: CashLedgerState, transactions: TradeTransaction[]) {
  const before = state.transactions.map(normalizeTransaction);
  const normalized = transactions.map(normalizeTransaction);
  // Deleting the last external flow must not resurrect it as implicit capital.
  const capitalDeposits = before.some(externalKind) || normalized.some(externalKind)
    ? Number(normalized.reduce((sum, tx) => sum + capitalContribution(tx), 0).toFixed(2))
    : state.capitalDeposits;
  const report = reconcilePortfolioFromLedger(normalized, state.tickers, capitalDeposits, state.positions);
  return {
    transactions: normalized, capitalDeposits, tickers: state.tickers,
    positions: report.reconciledPositions, closedTrades: report.reconciledClosedTrades,
    cashBalance: report.reconciledCashBalance,
  };
}

export function changeCashLedgerEntry(state: CashLedgerState, id: string, changes: Pick<CashTransaction, 'type' | 'amount' | 'date' | 'notes'> | null) {
  const transactions = withOpeningCapital(state);
  const existing = transactions.find((tx) => tx.id === id);
  if (!existing || !externalKind(existing)) throw new Error('Cash ledger entry was not found. Reload and try again.');
  if (changes && (!Number.isFinite(changes.amount) || Number(changes.amount.toFixed(2)) <= 0)) {
    throw new Error('Cash amount must be at least 0.01 EGP.');
  }
  if (changes) validateCashDate(changes.date);
  const amount = changes ? Number(changes.amount.toFixed(2)) : 0;
  const updated = changes ? transactions.map((tx) => tx.id === id ? {
    ...tx, type: changes.type === 'DEPOSIT' ? 'BUY' as const : 'SELL' as const,
    shares: amount, price: 1, fees: 0, totalAmount: amount, cashFlowAmount: amount,
    cashFlowType: changes.type, date: changes.date,
    executedAt: changes.date === tx.date ? tx.executedAt : undefined,
    notes: changes.notes,
  } : tx) : transactions.filter((tx) => tx.id !== id);
  return rebuildAfterLedgerChange({ ...state, transactions }, updated);
}

/** Existing deposit/withdrawal history is a read-only projection of the ledger. */
export function buildCashHistory(state: CashLedgerState): CashTransaction[] {
  const ordered = sortTransactions(withOpeningCapital(state));
  return ordered.flatMap((tx, index) => {
    const type = externalKind(tx);
    if (!type) return [];
    const report = reconcilePortfolioFromLedger(ordered.slice(0, index + 1), [], 0);
    return [{ id: tx.id, type, amount: tx.totalAmount, date: tx.date, notes: tx.notes, balanceAfter: report.reconciledCashBalance }];
  }).reverse();
}
