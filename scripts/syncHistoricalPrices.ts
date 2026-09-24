import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createChart, createSeries, createSession } from '@ch99q/twc';
import { canonicalizeEGXSymbol } from '../src/data/egxTickers';
import { resolveTradingViewInstrument } from '../src/services/tradingViewSymbolResolver';
import {
  buildHistoricalRepairPlans,
  type HistoryCoverageRequirement,
  type StoredHistoryDate,
} from '../src/services/historicalCoverage';

type HistoryBar = [number, number, number, number, number, number?];

type TickerMetadata = {
  ticker: string;
  isin: string;
};

function normalizeTicker(ticker: string): string {
  return canonicalizeEGXSymbol(
    ticker.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, ''),
  );
}

function toDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function cairoDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
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
    const { data, error } = await sb
      .from('portfolios')
      .select('id')
      .eq('id', explicitPortfolioId)
      .maybeSingle();
    if (error) throw new Error(`Supabase portfolio lookup failed: ${error.message}`);
    if (!data) throw new Error(`Supabase portfolio ${explicitPortfolioId} does not exist.`);
    return String(data.id);
  }

  const legacyOwnerUid = process.env.FIREBASE_ADMIN_OWNER_UID?.trim();
  if (legacyOwnerUid) {
    const { data, error } = await sb
      .from('portfolios')
      .select('id')
      .eq('owner_key', legacyOwnerUid)
      .maybeSingle();
    if (error) throw new Error(`Supabase portfolio lookup failed: ${error.message}`);
    if (!data) throw new Error('No Supabase portfolio matches FIREBASE_ADMIN_OWNER_UID.');
    return String(data.id);
  }

  const { data, error } = await sb
    .from('portfolios')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(2);
  if (error) throw new Error(`Supabase portfolio discovery failed: ${error.message}`);
  if (!data?.length) throw new Error('No Supabase portfolio exists.');
  if (data.length > 1) {
    throw new Error('Multiple portfolios exist. Set EGX_PORTFOLIO_ID explicitly for historical sync.');
  }
  return String(data[0].id);
}

function setEarliestRequirement(
  byTicker: Map<string, string>,
  tickerInput: unknown,
  dateInput: unknown,
) {
  const ticker = normalizeTicker(String(tickerInput || ''));
  const date = String(dateInput || '').slice(0, 10);
  if (!ticker || ticker === 'CASH' || !date) return;

  const current = byTicker.get(ticker);
  if (!current || date < current) byTicker.set(ticker, date);
}

async function loadCoverageRequirements(
  sb: ReturnType<typeof supabase>,
  portfolioId: string,
): Promise<HistoryCoverageRequirement[]> {
  const [{ data: transactions, error: txError }, { data: positions, error: positionError }] =
    await Promise.all([
      sb
        .from('transactions')
        .select('ticker,transaction_date')
        .eq('portfolio_id', portfolioId),
      sb
        .from('positions')
        .select('ticker,buy_date')
        .eq('portfolio_id', portfolioId),
    ]);

  if (txError) throw new Error(`Supabase transaction lookup failed: ${txError.message}`);
  if (positionError) throw new Error(`Supabase position lookup failed: ${positionError.message}`);

  const byTicker = new Map<string, string>();
  for (const row of transactions ?? []) {
    setEarliestRequirement(byTicker, row.ticker, row.transaction_date);
  }
  for (const row of positions ?? []) {
    setEarliestRequirement(byTicker, row.ticker, row.buy_date);
  }

  const explicitTickers = process.env.EGX_HISTORY_TICKERS
    ?.split(',')
    .map(normalizeTicker)
    .filter(Boolean);
  const explicitSet = explicitTickers?.length ? new Set(explicitTickers) : null;
  const startOverride = process.env.EGX_HISTORY_START?.slice(0, 10);

  return [...byTicker.entries()]
    .filter(([ticker]) => !explicitSet || explicitSet.has(ticker))
    .map(([ticker, firstRequiredDate]) => ({
      ticker,
      firstRequiredDate:
        startOverride && startOverride < firstRequiredDate ? startOverride : firstRequiredDate,
    }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
}

async function loadStoredHistoryDates(
  sb: ReturnType<typeof supabase>,
  tickers: string[],
): Promise<StoredHistoryDate[]> {
  if (!tickers.length) return [];

  const pageSize = 1000;
  const rows: any[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await sb
      .from('price_history')
      .select('ticker,trading_date')
      .in('ticker', tickers)
      .order('trading_date', { ascending: true })
      .order('ticker', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`Existing history coverage read failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  return rows.map((row: any) => ({
    ticker: normalizeTicker(String(row.ticker || '')),
    date: String(row.trading_date || '').slice(0, 10),
  }));
}

async function loadTickerMetadata(
  sb: ReturnType<typeof supabase>,
  tickers: string[],
): Promise<Map<string, TickerMetadata>> {
  const result = new Map<string, TickerMetadata>();
  if (!tickers.length) return result;

  const { data, error } = await sb
    .from('tickers')
    .select('ticker,isin')
    .in('ticker', tickers);

  if (error) throw new Error(`Ticker metadata read failed: ${error.message}`);

  for (const row of data ?? []) {
    const ticker = normalizeTicker(String(row.ticker || ''));
    if (!ticker) continue;
    result.set(ticker, {
      ticker,
      isin: String(row.isin || '').trim().toUpperCase(),
    });
  }
  return result;
}

function requestedBarsForRange(startDate: string, endDate: string): number {
  const startTimestamp = new Date(`${startDate}T00:00:00Z`).getTime();
  const endTimestamp = new Date(`${endDate}T23:59:59Z`).getTime();
  const calendarDays = Math.max(
    1,
    Math.ceil((endTimestamp - startTimestamp) / 86_400_000) + 1,
  );
  return Math.max(30, calendarDays + 30);
}

async function writeBars(
  sb: ReturnType<typeof supabase>,
  ticker: string,
  bars: HistoryBar[],
  startDate: string,
  endDate: string,
) {
  const retrievedAt = new Date().toISOString();
  const byDate = new Map<string, any>();

  for (const bar of bars) {
    const tradingDate = toDate(Number(bar[0]));
    const close = Number(bar[4]);
    if (
      !tradingDate ||
      tradingDate < startDate ||
      tradingDate > endDate ||
      !Number.isFinite(close) ||
      close <= 0
    ) {
      continue;
    }

    byDate.set(tradingDate, {
      ticker,
      trading_date: tradingDate,
      open: Number.isFinite(Number(bar[1])) ? Number(bar[1]) : null,
      high: Number.isFinite(Number(bar[2])) ? Number(bar[2]) : null,
      low: Number.isFinite(Number(bar[3])) ? Number(bar[3]) : null,
      close,
      volume: Number.isFinite(Number(bar[5])) ? Number(bar[5]) : null,
      source: 'tradingview',
      retrieved_at: retrievedAt,
    });
  }

  const rows = [...byDate.values()];
  for (let offset = 0; offset < rows.length; offset += 500) {
    const { error } = await sb
      .from('price_history')
      .upsert(rows.slice(offset, offset + 500), {
        onConflict: 'ticker,trading_date',
        ignoreDuplicates: false,
      });
    if (error) throw new Error(`History write failed for ${ticker}: ${error.message}`);
  }

  return rows;
}

async function main() {
  const endDate = process.env.EGX_HISTORY_END?.slice(0, 10) || cairoDate();
  const sb = supabase();
  const portfolioId = await resolvePortfolioId(sb);
  const requirements = await loadCoverageRequirements(sb, portfolioId);

  if (!requirements.length) {
    console.log('No portfolio security tickers require historical coverage.');
    return;
  }

  const tickers = requirements.map((item) => item.ticker);
  const [storedRows, metadata] = await Promise.all([
    loadStoredHistoryDates(sb, tickers),
    loadTickerMetadata(sb, tickers),
  ]);
  const plans = buildHistoricalRepairPlans(requirements, storedRows, endDate);

  if (!plans.length) {
    console.log(
      `Historical coverage healthy: ${tickers.length} portfolio tickers already cover their required ranges through ${endDate}.`,
    );
    return;
  }

  console.log(
    `Historical repair starting: ${plans.length}/${tickers.length} tickers need coverage repair through ${endDate}.`,
  );
  for (const plan of plans) {
    console.log(
      `${plan.ticker}: ${plan.startDate} → ${plan.endDate}; reasons=${plan.reasons.join(',')}` +
      (plan.missingReferenceDates.length
        ? `; reference gaps=${plan.missingReferenceDates.join(',')}`
        : ''),
    );
  }

  const session = await createSession();
  let failures = 0;
  let totalRows = 0;

  try {
    const chart = await createChart(session);

    for (const plan of plans) {
      try {
        const tickerMeta = metadata.get(plan.ticker);
        const resolution = await resolveTradingViewInstrument(chart, {
          ticker: plan.ticker,
          isin: tickerMeta?.isin,
        });
        const { symbol: candidate, resolved } = resolution;
        const requestedBars = requestedBarsForRange(plan.startDate, plan.endDate);
        const series = await createSeries(session, chart, resolved, '1D', requestedBars);

        try {
          const rows = await writeBars(
            sb,
            plan.ticker,
            (series.history || []) as HistoryBar[],
            plan.startDate,
            plan.endDate,
          );
          totalRows += rows.length;

          if (!rows.length && plan.reasons.some((reason) => reason !== 'stale-tail')) {
            throw new Error(
              `${plan.ticker}: TradingView resolved via ${candidate} but returned no usable daily bars for required range ${plan.startDate} → ${plan.endDate}.`,
            );
          }

          console.log(
            `${plan.ticker}: upserted ${rows.length} daily observations via ${candidate}; requested ${requestedBars} bars.`,
          );
        } finally {
          await series.close();
        }
      } catch (error) {
        failures += 1;
        console.error(`${plan.ticker}: historical repair failed`, error);
      }
    }

    console.log(
      `Historical repair complete: ${plans.length} planned tickers, ${totalRows} observations upserted, ${failures} failures.`,
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
