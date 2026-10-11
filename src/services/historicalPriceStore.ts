import { loadHistoricalPricesFromSupabase } from './supabasePersistence';
import { getSupabaseBrowserClient } from './supabaseBrowser';
import { API_ROUTES } from '../api/contracts';
import { PORTFOLIO_BENCHMARKS } from './portfolioBenchmarks';
import { canonicalizeEGXSymbol } from '../data/egxTickers';
import { requiresListedMarketHistory } from './historicalCoverage';

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

/** Resolve renamed EGX tickers at the market-data boundary, not in the
 * transaction ledger. E.g. AIH trades must read the AIHC/ISIN price history. */
export function historyStorageTickers(requested: string[]): string[] {
  const symbols = requested.map(normalizeTicker).filter(Boolean);
  return [...new Set(symbols.flatMap(ticker => [ticker, canonicalizeEGXSymbol(ticker)]))];
}

type StoredDailyPriceRow = {
  ticker: string;
  trading_date: string;
  close: number | string;
  open?: number | string | null;
  high?: number | string | null;
  low?: number | string | null;
  volume?: number | string | null;
  source?: string | null;
  retrieved_at?: string | null;
};

/** Pure projection; alias rows are *read* under the ledger symbol without
 * duplicating historical OHLC data or modifying any transaction identity. */
export function projectHistoricalPriceRows(
  requestedTickers: string[],
  rows: StoredDailyPriceRow[],
): HistoricalPriceSeries {
  const requested = [...new Set(requestedTickers.map(normalizeTicker).filter(Boolean))];
  const stored: HistoricalPriceSeries = {};
  for (const ticker of historyStorageTickers(requested)) stored[ticker] = [];

  for (const row of rows) {
    const ticker = normalizeTicker(String(row.ticker || ''));
    const date = String(row.trading_date || '').slice(0, 10);
    const close = Number(row.close);
    if (!ticker || !date || !Number.isFinite(close) || close <= 0 || !stored[ticker]) continue;
    stored[ticker].push({
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
  const result: HistoricalPriceSeries = {};
  for (const ticker of requested) {
    const canonical = canonicalizeEGXSymbol(ticker);
    // Keep historical observations stored under the old symbol while
    // preferring canonical quotes on overlapping trading dates.
    const byDate = new Map<string, HistoricalPricePoint>();
    for (const point of stored[ticker] ?? []) byDate.set(point.date, point);
    for (const point of stored[canonical] ?? []) byDate.set(point.date, point);
    result[ticker] = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
  return result;
}

export async function getHistoricalPrices(tickers: string[], startDate?: string, endDate?: string): Promise<HistoricalPriceSeries> {
  const requested = [...new Set(tickers.map(normalizeTicker).filter(Boolean))];
  if (!requested.length) return {};
  const rows = await loadHistoricalPricesFromSupabase(historyStorageTickers(requested), startDate, endDate);
  return projectHistoricalPriceRows(requested, rows);
}

export async function getHistoricalPricesForTransactions(transactions: Array<{ ticker: string; date: string; type?: string }>, endDate = new Date().toISOString().slice(0, 10)) {
  const traded = transactions.filter(tx =>
    normalizeTicker(tx.ticker) !== 'CASH' &&
    String(tx.type || '').toUpperCase() !== 'IPO_SUBSCRIPTION',
  );
  const tickers = [
    ...traded.map(tx => tx.ticker),
    ...PORTFOLIO_BENCHMARKS.map(benchmark => benchmark.ticker),
  ];
  const dates = traded.map(tx => String(tx.date).slice(0, 10)).filter(Boolean).sort();
  return getHistoricalPrices(tickers, dates[0], endDate);
}

export interface HistoricalBackfillTarget {
  ticker: string;
  startDate?: string;
}

export interface HistoricalBackfillResult {
  requestedTickers: string[];
  backfilledTickers: string[];
  writtenRows: number;
  failures: Array<{ ticker: string; error: string }>;
}

export async function ensureHistoricalPriceCoverage(
  targets: HistoricalBackfillTarget[],
): Promise<HistoricalBackfillResult> {
  const uniqueTargets = [...new Map(
    targets
      .map((target) => ({
        ticker: normalizeTicker(target.ticker),
        startDate: String(target.startDate || '').slice(0, 10) || undefined,
      }))
      .filter((target) => target.ticker && target.ticker !== 'CASH')
      .map((target) => [target.ticker, target]),
  ).values()];

  if (!uniqueTargets.length) {
    return { requestedTickers: [], backfilledTickers: [], writtenRows: 0, failures: [] };
  }

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Historical backfill requires an authenticated Supabase session.');

  const response = await fetch(API_ROUTES.supabasePriceHistoryEnsure, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ targets: uniqueTargets }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || `Historical backfill request failed with HTTP ${response.status}.`);
  return payload?.data ?? {
    requestedTickers: uniqueTargets.map((target) => target.ticker),
    backfilledTickers: [],
    writtenRows: 0,
    failures: [],
  };
}
