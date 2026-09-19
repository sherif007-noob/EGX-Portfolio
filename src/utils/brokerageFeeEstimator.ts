import type { TradeTransaction } from '../types';

export interface BrokerageFeeEstimate {
  rate: number;
  sampleSize: number;
  source: 'buy_history' | 'market_history' | 'fallback';
}

const FALLBACK_RATE = 0.0025;
const MAX_REASONABLE_RATE = 0.02;

function usableMarketTrade(tx: TradeTransaction): boolean {
  const ticker = String(tx.ticker || '').trim().toUpperCase();
  const gross = Number(tx.shares) * Number(tx.price);
  const fees = Number(tx.fees);
  if (!ticker || ticker === 'CASH') return false;
  if (!Number.isFinite(gross) || gross <= 0) return false;
  if (!Number.isFinite(fees) || fees <= 0) return false;
  const rate = fees / gross;
  return rate > 0 && rate <= MAX_REASONABLE_RATE;
}

function weightedRate(rows: TradeTransaction[]): number {
  const totals = rows.reduce(
    (acc, tx) => {
      const gross = Number(tx.shares) * Number(tx.price);
      acc.gross += gross;
      acc.fees += Number(tx.fees);
      return acc;
    },
    { gross: 0, fees: 0 },
  );
  return totals.gross > 0 ? totals.fees / totals.gross : FALLBACK_RATE;
}

export function estimateBrokerageFeeRate(transactions: TradeTransaction[]): BrokerageFeeEstimate {
  const valid = transactions
    .filter(usableMarketTrade)
    .sort((a, b) => {
      const aTime = new Date(a.executedAt || a.date || 0).getTime() || 0;
      const bTime = new Date(b.executedAt || b.date || 0).getTime() || 0;
      return bTime - aTime;
    })
    .slice(0, 50);

  const buys = valid.filter((tx) => tx.type === 'BUY');
  const sample = buys.length >= 3 ? buys : valid;

  if (!sample.length) {
    return { rate: FALLBACK_RATE, sampleSize: 0, source: 'fallback' };
  }

  return {
    rate: weightedRate(sample),
    sampleSize: sample.length,
    source: buys.length >= 3 ? 'buy_history' : 'market_history',
  };
}

export function estimateBrokerageFee(
  grossValue: number,
  estimate: BrokerageFeeEstimate,
): number {
  if (!Number.isFinite(grossValue) || grossValue <= 0) return 0;
  return Math.round(grossValue * estimate.rate * 100) / 100;
}
