import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createChart, createSeries, createSession } from '@ch99q/twc';
import { resolveTradingViewInstrument } from '../src/services/tradingViewSymbolResolver';
import { INTRADAY_POLICY } from '../src/services/intradayPolicy';

type HistoryBar = [number, number, number, number, number, number?];

const INTERVAL_MINUTES = INTRADAY_POLICY.derivedIntervalMinutes;
const DEFAULT_RETENTION_DAYS = INTRADAY_POLICY.derivedRetentionDays;
const DEFAULT_INCREMENTAL_BARS = 120;
const MAX_INITIAL_BARS = 7500;
const ESTIMATED_BARS_PER_SESSION = 66;

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
}

function readPositiveInt(name: string, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.trunc(parsed), max);
}

function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url) throw new Error('Missing SUPABASE_URL.');
  if (!key?.startsWith('sb_secret_')) {
    throw new Error('Missing or invalid SUPABASE_SECRET_KEY; expected an sb_secret_ server key.');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function resolvePortfolioId(sb: ReturnType<typeof supabase>): Promise<string> {
  const explicitPortfolioId = process.env.EGX_PORTFOLIO_ID?.trim();
  if (explicitPortfolioId) {
    const { data, error } = await sb.from('portfolios').select('id').eq('id', explicitPortfolioId).maybeSingle();
    if (error) throw new Error(`Supabase portfolio lookup failed: ${error.message}`);
    if (!data) throw new Error(`Supabase portfolio ${explicitPortfolioId} does not exist.`);
    return String(data.id);
  }

  const { data, error } = await sb.from('portfolios').select('id').order('created_at', { ascending: true }).limit(2);
  if (error) throw new Error(`Supabase portfolio discovery failed: ${error.message}`);
  if (!data?.length) throw new Error('No Supabase portfolio exists.');
  if (data.length > 1) {
    throw new Error('Multiple portfolios exist. Set EGX_PORTFOLIO_ID explicitly for intraday sync.');
  }
  return String(data[0].id);
}

function retentionCutoffIso(now: Date, retentionDays: number): string {
  return new Date(now.getTime() - retentionDays * 86_400_000).toISOString();
}

async function resolveTickerUniverse(
  sb: ReturnType<typeof supabase>,
  portfolioId: string,
  cutoffDate: string,
): Promise<string[]> {
  const explicit = process.env.EGX_INTRADAY_TICKERS
    ?.split(',')
    .map(normalizeTicker)
    .filter(Boolean);
  if (explicit?.length) return [...new Set(explicit)];

  const [{ data: transactions, error: txError }, { data: positions, error: positionError }] = await Promise.all([
    sb
      .from('transactions')
      .select('ticker,transaction_date')
      .eq('portfolio_id', portfolioId)
      .gte('transaction_date', cutoffDate),
    sb.from('positions').select('ticker').eq('portfolio_id', portfolioId),
  ]);

  if (txError) throw new Error(`Supabase transaction lookup failed: ${txError.message}`);
  if (positionError) throw new Error(`Supabase position lookup failed: ${positionError.message}`);

  return [
    ...new Set(
      [...(transactions ?? []), ...(positions ?? [])]
        .map((row: any) => normalizeTicker(String(row.ticker || '')))
        .filter((ticker) => ticker && ticker !== 'CASH'),
    ),
  ].sort();
}

async function loadTickerMetadata(
  sb: ReturnType<typeof supabase>,
  ticker: string,
): Promise<{ isin?: string; tradingviewSymbol?: string }> {
  // ticker metadata is global market data; the tickers table is not
  // portfolio-scoped. Portfolio scoping belongs to transactions/positions.
  const { data, error } = await sb.from('tickers').select('isin').eq('ticker', ticker).maybeSingle();
  if (error) throw new Error(`Ticker metadata read failed for ${ticker}: ${error.message}`);
  return {
    isin: String(data?.isin || '').trim().toUpperCase() || undefined,
    tradingviewSymbol: undefined,
  };
}

async function latestStoredTimestamp(
  sb: ReturnType<typeof supabase>,
  ticker: string,
): Promise<string | null> {
  const { data, error } = await sb
    .from('intraday_price_history')
    .select('bar_timestamp')
    .eq('ticker', ticker)
    .eq('interval_minutes', INTERVAL_MINUTES)
    .order('bar_timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Latest intraday timestamp read failed for ${ticker}: ${error.message}`);
  return data?.bar_timestamp ? String(data.bar_timestamp) : null;
}

function barsToRequest(latestTimestamp: string | null, now: Date, retentionDays: number): number {
  const override = readPositiveInt('EGX_INTRADAY_BAR_COUNT', 0, MAX_INITIAL_BARS);
  if (override > 0) return override;

  if (!latestTimestamp) {
    const estimatedSessions = Math.ceil((retentionDays * 5) / 7) + 5;
    return Math.min(MAX_INITIAL_BARS, Math.max(256, estimatedSessions * ESTIMATED_BARS_PER_SESSION));
  }

  const latestMs = new Date(latestTimestamp).getTime();
  const elapsedDays = Number.isFinite(latestMs)
    ? Math.max(0, Math.ceil((now.getTime() - latestMs) / 86_400_000))
    : retentionDays;

  return Math.min(
    MAX_INITIAL_BARS,
    Math.max(DEFAULT_INCREMENTAL_BARS, elapsedDays * ESTIMATED_BARS_PER_SESSION + DEFAULT_INCREMENTAL_BARS),
  );
}

function mapBar(ticker: string, bar: HistoryBar, retrievedAt: string) {
  const timestamp = Number(bar[0]);
  const open = Number(bar[1]);
  const high = Number(bar[2]);
  const low = Number(bar[3]);
  const close = Number(bar[4]);
  const volume = Number(bar[5]);

  if (
    !Number.isFinite(timestamp) ||
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close) ||
    open <= 0 ||
    high <= 0 ||
    low <= 0 ||
    close <= 0 ||
    high < Math.max(open, close, low) ||
    low > Math.min(open, close, high)
  ) {
    return null;
  }

  return {
    ticker,
    interval_minutes: INTERVAL_MINUTES,
    bar_timestamp: new Date(timestamp * 1000).toISOString(),
    open,
    high,
    low,
    close,
    volume: Number.isFinite(volume) && volume >= 0 ? volume : null,
    source: 'tradingview',
    retrieved_at: retrievedAt,
  };
}

async function writeBars(
  sb: ReturnType<typeof supabase>,
  ticker: string,
  bars: HistoryBar[],
  cutoffIso: string,
  nowIso: string,
) {
  const retrievedAt = new Date().toISOString();
  const byTimestamp = new Map<string, ReturnType<typeof mapBar>>();

  for (const rawBar of bars) {
    const row = mapBar(ticker, rawBar, retrievedAt);
    if (!row) continue;
    if (row.bar_timestamp < cutoffIso || row.bar_timestamp > nowIso) continue;
    byTimestamp.set(row.bar_timestamp, row);
  }

  const rows = [...byTimestamp.values()].filter((row): row is NonNullable<typeof row> => !!row);
  if (!rows.length) return 0;

  const { data: existing, error: existingError } = await sb
    .from('intraday_price_history')
    .select('bar_timestamp')
    .eq('ticker', ticker)
    .eq('interval_minutes', INTERVAL_MINUTES)
    .gte('bar_timestamp', rows[0].bar_timestamp)
    .lte('bar_timestamp', rows[rows.length - 1].bar_timestamp);
  if (existingError) throw new Error(`Existing intraday history read failed for ${ticker}: ${existingError.message}`);

  const existingTimestamps = new Set((existing ?? []).map((row: any) => String(row.bar_timestamp)));
  const missingRows = rows.filter((row) => !existingTimestamps.has(row.bar_timestamp));

  for (let offset = 0; offset < missingRows.length; offset += 500) {
    const { error } = await sb
      .from('intraday_price_history')
      .insert(missingRows.slice(offset, offset + 500));

    if (error) throw new Error(`Intraday history write failed for ${ticker}: ${error.message}`);
  }

  return missingRows.length;
}

async function pruneExpiredRows(
  sb: ReturnType<typeof supabase>,
  cutoffIso: string,
): Promise<number> {
  const { count, error } = await sb
    .from('intraday_price_history')
    .delete({ count: 'exact' })
    .lt('bar_timestamp', cutoffIso);

  if (error) throw new Error(`Intraday retention cleanup failed: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const now = new Date();
  const retentionDays = readPositiveInt('EGX_INTRADAY_RETENTION_DAYS', DEFAULT_RETENTION_DAYS, 365);
  const cutoffIso = retentionCutoffIso(now, retentionDays);
  const cutoffDate = cutoffIso.slice(0, 10);
  const nowIso = now.toISOString();

  const sb = supabase();
  const portfolioId = await resolvePortfolioId(sb);
  const tickers = await resolveTickerUniverse(sb, portfolioId, cutoffDate);

  if (!tickers.length) {
    console.log('No portfolio-relevant security tickers found for intraday sync.');
    return;
  }

  console.log(
    `Intraday sync starting: ${tickers.length} tickers, ${INTERVAL_MINUTES}-minute bars, ${retentionDays}-day retention.`,
  );

  const session = await createSession();
  let failures = 0;
  let totalRows = 0;

  try {
    const chart = await createChart(session);

    for (const ticker of tickers) {
      try {
        const latest = await latestStoredTimestamp(sb, ticker);
        const requestedBars = barsToRequest(latest, now, retentionDays);
        const tickerMeta = await loadTickerMetadata(sb, ticker);
        const resolution = await resolveTradingViewInstrument(chart, {
          ticker,
          isin: tickerMeta.isin,
          tradingviewSymbol: tickerMeta.tradingviewSymbol,
        });
        const series = await createSeries(session, chart, resolution.resolved, '5', requestedBars);

        try {
          const written = await writeBars(
            sb,
            ticker,
            (series.history || []) as HistoryBar[],
            cutoffIso,
            nowIso,
          );
          totalRows += written;
          console.log(
            `${ticker}: inserted ${written} missing intraday observations from ${requestedBars} requested bars${latest ? `; latest stored ${latest}` : '; initial backfill'}.`,
          );
        } finally {
          await series.close();
        }
      } catch (error) {
        failures += 1;
        console.error(`${ticker}: intraday sync failed`, error);
      }
    }

    const pruned = await pruneExpiredRows(sb, cutoffIso);
    console.log(
      `Intraday sync complete: ${totalRows} missing observations inserted, ${pruned} expired observations pruned, ${failures} ticker failures.`,
    );

    if (failures > 0) process.exitCode = 1;
  } finally {
    await session.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
