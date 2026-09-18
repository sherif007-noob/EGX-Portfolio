import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createChart, createSeries, createSession } from '@ch99q/twc';

type HistoryBar = [number, number, number, number, number, number?];
const TICKER_ALIASES: Record<string, string> = { QNBA: 'QNBF', MNHD: 'MASR', AUTO: 'GBCO', OTMT: 'OIH', UBEG: 'UBEE' };

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
}

function toDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url) throw new Error('Missing SUPABASE_URL.');
  if (!key?.startsWith('sb_secret_')) throw new Error('Missing or invalid SUPABASE_SECRET_KEY; expected an sb_secret_ server key.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

async function resolvePortfolioId(sb: ReturnType<typeof supabase>): Promise<string> {
  const explicitPortfolioId = process.env.EGX_PORTFOLIO_ID?.trim();
  if (explicitPortfolioId) {
    const { data, error } = await sb.from('portfolios').select('id').eq('id', explicitPortfolioId).maybeSingle();
    if (error) throw new Error(`Supabase portfolio lookup failed: ${error.message}`);
    if (!data) throw new Error(`Supabase portfolio ${explicitPortfolioId} does not exist.`);
    return String(data.id);
  }

  const legacyOwnerUid = process.env.FIREBASE_ADMIN_OWNER_UID?.trim();
  if (legacyOwnerUid) {
    const { data, error } = await sb.from('portfolios').select('id').eq('owner_key', legacyOwnerUid).maybeSingle();
    if (error) throw new Error(`Supabase portfolio lookup failed: ${error.message}`);
    if (!data) throw new Error('No Supabase portfolio matches FIREBASE_ADMIN_OWNER_UID.');
    return String(data.id);
  }

  const { data, error } = await sb.from('portfolios').select('id').order('created_at', { ascending: true }).limit(2);
  if (error) throw new Error(`Supabase portfolio discovery failed: ${error.message}`);
  if (!data?.length) throw new Error('No Supabase portfolio exists.');
  if (data.length > 1) {
    throw new Error('Multiple portfolios exist. Set EGX_PORTFOLIO_ID explicitly for historical sync.');
  }
  return String(data[0].id);
}

async function writeBars(sb: ReturnType<typeof supabase>, ticker: string, bars: HistoryBar[], startDate: string, endDate: string) {
  const retrievedAt = new Date().toISOString();
  const { data: existingRows, error: readError } = await sb.from('price_history').select('trading_date').eq('ticker', ticker);
  if (readError) throw new Error(`Existing history read failed: ${readError.message}`);
  const existingDates = new Set((existingRows ?? []).map((r: any) => String(r.trading_date).slice(0, 10)));
  const filtered = bars.map((bar) => ({
    ticker,
    trading_date: toDate(Number(bar[0])),
    open: Number(bar[1]),
    high: Number(bar[2]),
    low: Number(bar[3]),
    close: Number(bar[4]),
    volume: Number.isFinite(Number(bar[5])) ? Number(bar[5]) : null,
    source: 'tradingview',
    retrieved_at: retrievedAt,
  })).filter((bar) =>
    bar.trading_date >= startDate &&
    bar.trading_date <= endDate &&
    Number.isFinite(bar.close) &&
    bar.close > 0 &&
    !existingDates.has(bar.trading_date)
  );

  for (let offset = 0; offset < filtered.length; offset += 500) {
    const { error } = await sb.from('price_history').upsert(filtered.slice(offset, offset + 500), {
      onConflict: 'ticker,trading_date',
      ignoreDuplicates: true,
    });
    if (error) throw new Error(`History write failed: ${error.message}`);
  }
  return { written: filtered.length, existing: existingDates.size };
}

async function main() {
  const startOverride = process.env.EGX_HISTORY_START?.slice(0, 10);
  const endDate = process.env.EGX_HISTORY_END?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const sb = supabase();
  const portfolioId = await resolvePortfolioId(sb);

  const { data: transactions, error: txError } = await sb
    .from('transactions')
    .select('ticker,transaction_date')
    .eq('portfolio_id', portfolioId);
  if (txError) throw new Error(`Supabase transaction lookup failed: ${txError.message}`);

  const tickers = [...new Set(
    (transactions ?? [])
      .map((tx: any) => normalizeTicker(String(tx.ticker || '')))
      .filter((ticker) => ticker && ticker !== 'CASH')
  )];
  const firstTransactionDate = (transactions ?? [])
    .map((tx: any) => String(tx.transaction_date || '').slice(0, 10))
    .filter(Boolean)
    .sort()[0];
  const startDate = startOverride || firstTransactionDate || endDate;

  if (!tickers.length) {
    console.log('No security tickers found in the portfolio ledger. Nothing to sync.');
    return;
  }

  const startTimestamp = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000);
  const endTimestamp = Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000);
  if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp) || startTimestamp > endTimestamp) {
    throw new Error(`Invalid historical range: ${startDate} → ${endDate}`);
  }

  // TradingView currently rejects the library's explicit [start, end] range form
  // for daily series. Request enough recent bars to cover the calendar span,
  // then let writeBars enforce the exact date boundaries.
  const calendarDays = Math.max(1, Math.ceil((endTimestamp - startTimestamp) / 86_400) + 1);
  const requestedBars = Math.max(30, calendarDays + 30);

  const session = await createSession();
  let failures = 0;
  try {
    const chart = await createChart(session);
    let totalRows = 0;
    let totalExisting = 0;

    for (const ticker of tickers) {
      try {
        const resolved = await chart.resolve(TICKER_ALIASES[ticker] || ticker, 'EGX');
        const series = await createSeries(session, chart, resolved, '1D', requestedBars);
        try {
          const result = await writeBars(sb, ticker, ((series.history || []) as HistoryBar[]), startDate, endDate);
          totalRows += result.written;
          totalExisting += result.existing;
          console.log(`${ticker}: ${result.written} new daily observations saved; ${result.existing} existing observations retained.`);
        } finally {
          await series.close();
        }
      } catch (error) {
        failures += 1;
        console.error(`${ticker}: historical sync failed`, error);
      }
    }

    console.log(`Historical sync complete: ${tickers.length} tickers, ${totalRows} new observations written, ${totalExisting} existing observations checked, ${failures} failures.`);
    if (failures > 0) process.exitCode = 1;
  } finally {
    await session.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
