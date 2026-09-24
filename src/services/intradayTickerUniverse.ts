import type { TradeTransaction } from '../types';
import { normalizeIntradayTicker } from './intradayPriceStore';

const EPSILON = 1e-8;

function dayKey(value: string): string {
  return String(value || '').slice(0, 10);
}

export function resolveIntradaySessionTickers(
  transactions: TradeTransaction[],
  sessionDate: string,
): string[] {
  const date = sessionDate.slice(0, 10);
  const openingShares = new Map<string, number>();
  const tradedToday = new Set<string>();

  for (const tx of transactions) {
    const ticker = normalizeIntradayTicker(tx.ticker);
    if (!ticker || ticker === 'CASH') continue;

    const txDate = dayKey(tx.date);
    if (!txDate) continue;

    if (txDate < date) {
      const shares = Number(tx.shares);
      if (!Number.isFinite(shares) || shares <= 0) continue;
      const signedShares = tx.type === 'BUY' ? shares : -shares;
      openingShares.set(ticker, (openingShares.get(ticker) || 0) + signedShares);
      continue;
    }

    if (txDate === date) tradedToday.add(ticker);
  }

  const enteringSession = [...openingShares.entries()]
    .filter(([, shares]) => shares > EPSILON)
    .map(([ticker]) => ticker);

  return [...new Set([...enteringSession, ...tradedToday])].sort();
}
