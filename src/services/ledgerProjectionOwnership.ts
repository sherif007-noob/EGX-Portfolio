import type { ClosedTrade, TradeTransaction } from '../types';
import { sortTransactions } from './portfolioReconciliation';

const EPSILON = 0.000001;

function normalizeTicker(value: string): string {
  return String(value || '').trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
}

/**
 * Returns the source executions that form the currently active trade cycle for
 * a ticker. This deliberately tracks aggregate running shares, not FIFO lots.
 *
 * In the canonical proportional/weighted-average model:
 * BUY 100 @ 10 + BUY 100 @ 20 + SELL 100
 * still has one open 100-share position whose current cycle depends on all
 * three source executions.
 */
export function getActivePositionLedgerTransactionIds(
  transactions: TradeTransaction[],
  ticker: string,
): string[] {
  const targetTicker = normalizeTicker(ticker);
  if (!targetTicker) return [];

  let runningShares = 0;
  let activeCycleIds: string[] = [];

  for (const transaction of sortTransactions(transactions)) {
    if (normalizeTicker(transaction.ticker) !== targetTicker) continue;
    if (transaction.cashFlowType || normalizeTicker(transaction.ticker) === 'CASH') continue;

    if (transaction.type === 'BONUS_SHARES') {
      if (runningShares <= EPSILON) continue;
      runningShares += transaction.shares;
      activeCycleIds.push(transaction.id);
      continue;
    }

    if (transaction.type === 'BUY') {
      if (runningShares <= EPSILON) activeCycleIds = [];
      runningShares += transaction.shares;
      activeCycleIds.push(transaction.id);
      continue;
    }

    if (transaction.type === 'SELL') {
      if (runningShares <= EPSILON) continue;
      activeCycleIds.push(transaction.id);
      runningShares -= transaction.shares;

      if (runningShares <= EPSILON) {
        runningShares = 0;
        activeCycleIds = [];
      }
    }
  }

  return runningShares > EPSILON ? activeCycleIds : [];
}

/**
 * Closed cycles are projections. Their stored source transaction IDs are the
 * canonical correction/navigation link back to the ledger.
 */
export function getClosedCycleLedgerTransactionIds(closedTrade: ClosedTrade): string[] {
  return [...new Set([
    ...(closedTrade.buyTransactionIds || []),
    ...(closedTrade.sellTransactionIds || []),
  ].filter((id): id is string => typeof id === 'string' && id.trim().length > 0))];
}
