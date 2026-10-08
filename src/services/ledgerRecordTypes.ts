import type { TradeTransaction } from '../types';
import { normalizeCashFlowType } from './cashFlowSemantics';

/**
 * Persisted legacy cash events are BUY/SELL records for ticker CASH with
 * pseudo-shares = EGP and price = 1. That is a ledger storage contract,
 * NOT an equity execution. Keep storage stable; isolate reporting domains.
 */
export function isCashLedgerRecord(tx: TradeTransaction): boolean {
  const ticker = String(tx.ticker ?? '').trim().toUpperCase().replace(/^EGX:/,'').replace(/\.CA$/,'');
  return ticker === 'CASH' || normalizeCashFlowType(tx.cashFlowType) !== undefined;
}
export function isSecurityTrade(tx: TradeTransaction): boolean {
  return !isCashLedgerRecord(tx) && (tx.type === 'BUY' || tx.type === 'SELL');
}
export function filterInvestmentActivity(transactions: TradeTransaction[]): TradeTransaction[] {
  return transactions.filter(tx => !isCashLedgerRecord(tx));
}
export function filterExecutions(transactions: TradeTransaction[]): TradeTransaction[] {
  return transactions.filter(isSecurityTrade);
}
