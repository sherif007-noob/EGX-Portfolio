import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from './firestoreStorage';

export interface HistoricalPricePoint {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
  source: 'tradingview' | 'yahoo' | 'other';
  retrievedAt: string;
}

export type HistoricalPriceSeries = Record<string, HistoricalPricePoint[]>;

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
}

export async function getHistoricalPrices(tickers: string[], startDate?: string, endDate?: string): Promise<HistoricalPriceSeries> {
  const unique = [...new Set(tickers.map(normalizeTicker).filter(Boolean))];
  const result: HistoricalPriceSeries = {};
  await Promise.all(unique.map(async (ticker) => {
    const ref = collection(db, 'historicalPrices', ticker, 'daily');
    const snapshot = await getDocs(query(ref, orderBy('date', 'asc')));
    const points = snapshot.docs.map((doc) => doc.data() as HistoricalPricePoint).filter((point) => {
      const date = String(point.date || '').slice(0, 10);
      return !!date && (!startDate || date >= startDate) && (!endDate || date <= endDate) && Number.isFinite(Number(point.close)) && Number(point.close) > 0;
    }).map((point) => ({ ...point, date: String(point.date).slice(0, 10), close: Number(point.close) }));
    result[ticker] = points;
  }));
  return result;
}

export async function getHistoricalPricesForTransactions(transactions: Array<{ ticker: string; date: string }>, endDate = new Date().toISOString().slice(0, 10)) {
  const tickers = transactions.filter((tx) => normalizeTicker(tx.ticker) !== 'CASH').map((tx) => tx.ticker);
  const dates = transactions.map((tx) => String(tx.date).slice(0, 10)).filter(Boolean).sort();
  return getHistoricalPrices(tickers, dates[0], endDate);
}
