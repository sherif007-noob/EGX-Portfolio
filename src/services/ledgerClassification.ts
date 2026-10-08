import type { TradeTransaction } from '../types';

/**
 * Cash movements (deposits, withdrawals, adjustments) live in the same ledger
 * as executions, stored as CASH rows. They are not trades and must not be
 * counted, filtered or labelled as buys and sells.
 */
export function isCashFlowTransaction(tx: Pick<TradeTransaction, 'ticker' | 'type' | 'cashFlowType'>): boolean {
  if (tx.cashFlowType) return true;
  return tx.ticker.trim().toUpperCase() === 'CASH' && (tx.type === 'BUY' || tx.type === 'SELL');
}

export type CashRowKind = 'DEPOSIT' | 'WITHDRAWAL' | 'ADJUSTMENT';

export function cashRowKind(tx: Pick<TradeTransaction, 'type' | 'cashFlowType'>): CashRowKind {
  if (tx.cashFlowType === 'DEPOSIT') return 'DEPOSIT';
  if (tx.cashFlowType === 'WITHDRAWAL') return 'WITHDRAWAL';
  if (tx.cashFlowType) return 'ADJUSTMENT';
  // Legacy rows: a CASH buy added money, a CASH sell took it out.
  return tx.type === 'SELL' ? 'WITHDRAWAL' : 'DEPOSIT';
}

/** Signed effect of a cash row on the cash balance. */
export function cashRowAmount(
  tx: Pick<TradeTransaction, 'type' | 'cashFlowType' | 'cashFlowAmount' | 'totalAmount' | 'shares' | 'price' | 'netCashImpact'>,
): number {
  const magnitude = Math.abs(
    Number.isFinite(tx.cashFlowAmount) && tx.cashFlowAmount !== undefined
      ? tx.cashFlowAmount
      : tx.totalAmount || tx.shares * tx.price,
  );
  const kind = cashRowKind(tx);
  if (kind === 'DEPOSIT') return magnitude;
  if (kind === 'WITHDRAWAL') return -magnitude;
  const net = tx.netCashImpact;
  if (net !== undefined && Number.isFinite(net) && net !== 0) return net;
  return Number.isFinite(tx.cashFlowAmount) && tx.cashFlowAmount !== undefined ? tx.cashFlowAmount : magnitude;
}

export const CASH_ROW_LABELS: Record<CashRowKind, string> = {
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
  ADJUSTMENT: 'Cash adjustment',
};
