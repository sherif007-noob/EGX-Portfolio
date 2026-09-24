import { INTRADAY_POLICY } from './intradayPolicy';
import { loadIntradayPricesFromSupabase } from './supabasePersistence';

export interface IntradayPricePoint {
  timestamp: string;
  intervalMinutes: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  source?: 'tradingview' | 'derived-1m' | 'yahoo' | 'other';
  retrievedAt?: string;
}

export type IntradayPriceSeries = Record<string, IntradayPricePoint[]>;

export function normalizeIntradayTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
}

export function cairoDateKey(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: INTRADAY_POLICY.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const year = read('year');
  const month = read('month');
  const day = read('day');
  return year && month && day ? `${year}-${month}-${day}` : '';
}

export function latestIntradaySessionDate(
  series: IntradayPriceSeries,
  notAfterDate?: string,
): string | null {
  let latest = '';

  for (const bars of Object.values(series)) {
    for (const bar of bars) {
      const date = cairoDateKey(bar.timestamp);
      if (!date) continue;
      if (notAfterDate && date > notAfterDate.slice(0, 10)) continue;
      if (date > latest) latest = date;
    }
  }

  return latest || null;
}

export function rowsToIntradayPriceSeries(
  tickers: string[],
  rows: Array<Record<string, unknown>>,
): IntradayPriceSeries {
  const normalized = [...new Set(tickers.map(normalizeIntradayTicker).filter(Boolean))];
  const result: IntradayPriceSeries = Object.fromEntries(normalized.map((ticker) => [ticker, []]));

  for (const row of rows) {
    const ticker = normalizeIntradayTicker(String(row.ticker ?? ''));
    const timestamp = String(row.bar_timestamp ?? '');
    const intervalMinutes = Number(row.interval_minutes);
    const open = Number(row.open);
    const high = Number(row.high);
    const low = Number(row.low);
    const close = Number(row.close);
    const volume = row.volume == null ? undefined : Number(row.volume);

    if (
      !result[ticker] ||
      !timestamp ||
      Number.isNaN(new Date(timestamp).getTime()) ||
      !Number.isFinite(intervalMinutes) ||
      intervalMinutes <= 0 ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close) ||
      close <= 0
    ) {
      continue;
    }

    result[ticker].push({
      timestamp,
      intervalMinutes,
      open,
      high,
      low,
      close,
      volume: Number.isFinite(volume) ? volume : undefined,
      source:
        row.source === 'tradingview' || row.source === 'derived-1m' || row.source === 'yahoo' || row.source === 'other'
          ? row.source
          : undefined,
      retrievedAt: row.retrieved_at == null ? undefined : String(row.retrieved_at),
    });
  }

  for (const ticker of normalized) {
    result[ticker].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  return result;
}

export async function getIntradayPrices(
  tickers: string[],
  startTimestamp: string,
  endTimestamp: string,
  intervalMinutes = 15,
): Promise<IntradayPriceSeries> {
  const normalized = [...new Set(tickers.map(normalizeIntradayTicker).filter(Boolean))];
  if (!normalized.length) return {};

  const rows = await loadIntradayPricesFromSupabase(
    normalized,
    startTimestamp,
    endTimestamp,
    intervalMinutes,
  );

  return rowsToIntradayPriceSeries(normalized, rows);
}
