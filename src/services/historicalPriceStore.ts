import { loadHistoricalPricesFromSupabase } from './supabasePersistence';

export interface HistoricalPricePoint {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
  source?: 'tradingview' | 'yahoo' | 'other';
  retrievedAt?: string;
}

export type HistoricalPriceSeries = Record<string, HistoricalPricePoint[]>;

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
}

export async function getHistoricalPrices(tickers: string[], startDate?: string, endDate?: string): Promise<HistoricalPriceSeries> {
  const unique = [...new Set(tickers.map(normalizeTicker).filter(Boolean))];
  const result: HistoricalPriceSeries = {};
  if (!unique.length) return result;

  const rows = await loadHistoricalPricesFromSupabase(unique, startDate, endDate);
  for (const ticker of unique) result[ticker] = [];
  for (const row of rows) {
    const ticker = normalizeTicker(String(row.ticker || ''));
    const date = String(row.trading_date || '').slice(0, 10);
    const close = Number(row.close);
    if (!ticker || !date || !Number.isFinite(close) || close <= 0 || !result[ticker]) continue;
    result[ticker].push({
      date,
      open: row.open == null ? undefined : Number(row.open),
      high: row.high == null ? undefined : Number(row.high),
      low: row.low == null ? undefined : Number(row.low),
      close,
      volume: row.volume == null ? undefined : Number(row.volume),
      source: row.source === 'tradingview' || row.source === 'yahoo' || row.source === 'other' ? row.source : undefined,
      retrievedAt: row.retrieved_at ?? undefined,
    });
  }
  for (const ticker of unique) result[ticker].sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

export async function getHistoricalPricesForTransactions(transactions: Array<{ ticker: string; date: string }>, endDate = new Date().toISOString().slice(0, 10)) {
  const tickers = transactions.filter((tx) => normalizeTicker(tx.ticker) !== 'CASH').map((tx) => tx.ticker);
  const dates = transactions.map((tx) => String(tx.date).slice(0, 10)).filter(Boolean).sort();
  return getHistoricalPrices(tickers, dates[0], endDate);
}