import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import type { Position, Sector, TradeTransaction } from '../src/types';
import { egxCairoSessionClock } from '../src/services/egxTradingSession';
import { INTRADAY_POLICY } from '../src/services/intradayPolicy';
import {
  cairoDateKey,
  normalizeIntradayTicker,
  rowsToIntradayPriceSeries,
  type IntradayPricePoint,
  type IntradayPriceSeries,
} from '../src/services/intradayPriceStore';
import { aggregateIntradayBars } from '../src/services/intradayAggregation';
import { selectBestIntradayResolution } from '../src/services/intradayResolution';
import { resolveIntradaySessionTickers } from '../src/services/intradayTickerUniverse';
import { reconcilePortfolioFromLedger } from '../src/services/portfolioReconciliation';
import { calculatePortfolioValue } from '../src/services/portfolioAccounting';
import { applyLivePricesToPortfolio, fetchTradingViewEGXPrices } from '../src/services/marketPriceSync';
import { buildIntradayAnalyticsResult } from '../src/services/intradayAnalyticsEngine';
import type { HistoricalPriceSeries } from '../src/services/historicalPriceStore';

const EPSILON = 0.0001;
const PAGE_SIZE = 1000;
const OUTPUT_PATH = process.env.EGX_LIVE_SOAK_OUTPUT || 'live-session-soak.json';
const PRODUCTION_URL = (process.env.EGX_PRODUCTION_URL || 'https://egx-portfolio.sherif-nader07.workers.dev').replace(/\/$/, '');

type SoakPhase = 'PREOPEN' | 'LIVE' | 'GRACE' | 'POSTCLOSE' | 'NONTRADING';

function num(value: unknown): number {
  return Number(value ?? 0);
}

function normalizeDate(value: unknown): string {
  return String(value ?? '').slice(0, 10);
}

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url) throw new Error('Missing SUPABASE_URL.');
  if (!key?.startsWith('sb_secret_')) throw new Error('Missing or invalid SUPABASE_SECRET_KEY.');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function phaseFor(clock: ReturnType<typeof egxCairoSessionClock>): SoakPhase {
  if (!clock.isTradingWeekday) return 'NONTRADING';
  if (clock.minuteOfDay < INTRADAY_POLICY.sessionStartMinutes) return 'PREOPEN';
  if (clock.minuteOfDay < INTRADAY_POLICY.sessionEndMinutes) return 'LIVE';
  if (clock.minuteOfDay <= INTRADAY_POLICY.scheduledIngestionEndMinutes) return 'GRACE';
  return 'POSTCLOSE';
}

function cairoMinuteOfDay(timestamp: string): number | null {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: INTRADAY_POLICY.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? Number.NaN);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? Number.NaN);
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function resolvePortfolioId(sb: ReturnType<typeof client>): Promise<string> {
  const explicit = process.env.EGX_PORTFOLIO_ID?.trim();
  if (explicit) return explicit;
  const { data, error } = await sb
    .from('portfolios')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(2);
  if (error) throw new Error(`Portfolio discovery failed: ${error.message}`);
  if (!data?.length) throw new Error('No portfolio exists.');
  if (data.length > 1) throw new Error('Multiple portfolios exist; set EGX_PORTFOLIO_ID.');
  return String(data[0].id);
}

function mapPosition(row: any): Position {
  return {
    id: String(row.id),
    ticker: String(row.ticker ?? ''),
    companyName: row.company_name ?? '',
    sector: (row.sector ?? 'Other') as Sector,
    shares: num(row.shares),
    avgBuyPrice: num(row.avg_buy_price),
    currentPrice: num(row.current_price),
    dayChange: row.day_change == null ? undefined : num(row.day_change),
    dayChangePercent: row.day_change_percent == null ? undefined : num(row.day_change_percent),
    buyDate: String(row.buy_date ?? ''),
    totalFees: num(row.total_fees),
    targetPrice: row.target_price == null ? undefined : num(row.target_price),
    stopLoss: row.stop_loss == null ? undefined : num(row.stop_loss),
    notes: row.notes ?? undefined,
    priceUpdatedAt: row.price_updated_at ?? undefined,
  };
}

function mapTransaction(row: any): TradeTransaction {
  return {
    id: String(row.id),
    type: row.transaction_type === 'BONUS_SHARES' ? 'BONUS_SHARES' : row.transaction_type === 'SELL' ? 'SELL' : 'BUY',
    ticker: String(row.ticker ?? ''),
    companyName: row.company_name ?? '',
    sector: (row.sector ?? 'Other') as Sector,
    shares: num(row.shares),
    price: num(row.price),
    date: String(row.transaction_date ?? ''),
    executedAt: row.executed_at ?? undefined,
    fees: num(row.fees),
    totalAmount: num(row.total_amount),
    cashFlowType: row.cash_flow_type ?? undefined,
    cashFlowAmount: row.cash_flow_amount == null ? undefined : num(row.cash_flow_amount),
    notes: row.notes ?? undefined,
    tradeId: row.trade_id ?? undefined,
    tradeCycle: row.trade_cycle == null ? undefined : num(row.trade_cycle),
    cycleTag: row.cycle_tag ?? undefined,
    runningShares: row.running_shares == null ? undefined : num(row.running_shares),
    grossTradeValue: row.gross_trade_value == null ? undefined : num(row.gross_trade_value),
    netCashImpact: row.net_cash_impact == null ? undefined : num(row.net_cash_impact),
    realizedPnlEgp: row.realized_pnl_egp == null ? undefined : num(row.realized_pnl_egp),
    realizedPnlPercent: row.realized_pnl_percent == null ? undefined : num(row.realized_pnl_percent),
    holdingDays: row.holding_days == null ? undefined : num(row.holding_days),
    positionId: row.position_id ?? undefined,
  } as TradeTransaction;
}

function openingTickers(transactions: TradeTransaction[], sessionDate: string): string[] {
  const shares = new Map<string, number>();
  for (const tx of transactions) {
    const ticker = normalizeIntradayTicker(tx.ticker);
    if (!ticker || ticker === 'CASH' || normalizeDate(tx.date) >= sessionDate) continue;
    const quantity = Number(tx.shares);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const signed = tx.type === 'SELL' ? -quantity : quantity;
    shares.set(ticker, (shares.get(ticker) ?? 0) + signed);
  }
  return [...shares.entries()]
    .filter(([, quantity]) => quantity > EPSILON)
    .map(([ticker]) => ticker)
    .sort();
}

async function loadIntradayRows(
  sb: ReturnType<typeof client>,
  tickers: string[],
  sessionDate: string,
): Promise<Array<Record<string, unknown>>> {
  if (!tickers.length) return [];
  const start = `${sessionDate}T00:00:00.000Z`;
  const end = `${addDays(sessionDate, 1)}T00:00:00.000Z`;
  const rows: Array<Record<string, unknown>> = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await sb
      .from('intraday_price_history')
      .select('ticker,interval_minutes,bar_timestamp,open,high,low,close,volume,source,retrieved_at')
      .in('ticker', tickers)
      .in('interval_minutes', [1, 5, 15])
      .gte('bar_timestamp', start)
      .lt('bar_timestamp', end)
      .order('bar_timestamp', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Intraday soak read failed: ${error.message}`);
    const page = (data ?? []) as Array<Record<string, unknown>>;
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows.filter((row) => cairoDateKey(String(row.bar_timestamp ?? '')) === sessionDate);
}

async function loadHistoricalSeries(
  sb: ReturnType<typeof client>,
  tickers: string[],
  sessionDate: string,
): Promise<{ series: HistoricalPriceSeries; latestDate: string | null; sessionCoveredTickers: string[] }> {
  const series: HistoricalPriceSeries = Object.fromEntries(tickers.map((ticker) => [ticker, []]));
  if (!tickers.length) return { series, latestDate: null, sessionCoveredTickers: [] };

  const startDate = addDays(sessionDate, -45);
  const { data, error } = await sb
    .from('price_history')
    .select('ticker,trading_date,open,high,low,close,volume,source,retrieved_at')
    .in('ticker', tickers)
    .gte('trading_date', startDate)
    .lte('trading_date', sessionDate)
    .order('trading_date', { ascending: true });
  if (error) throw new Error(`Daily-history soak read failed: ${error.message}`);

  let latestDate = '';
  const covered = new Set<string>();
  for (const row of data ?? []) {
    const ticker = normalizeIntradayTicker(String(row.ticker ?? ''));
    const date = normalizeDate(row.trading_date);
    const close = num(row.close);
    if (!ticker || !series[ticker] || !date || !Number.isFinite(close) || close <= 0) continue;
    series[ticker].push({
      date,
      open: row.open == null ? undefined : num(row.open),
      high: row.high == null ? undefined : num(row.high),
      low: row.low == null ? undefined : num(row.low),
      close,
      volume: row.volume == null ? undefined : num(row.volume),
      source: row.source === 'tradingview' || row.source === 'yahoo' || row.source === 'other'
        ? row.source
        : undefined,
      retrievedAt: row.retrieved_at ?? undefined,
    });
    if (date > latestDate) latestDate = date;
    if (date === sessionDate) covered.add(ticker);
  }

  return {
    series,
    latestDate: latestDate || null,
    sessionCoveredTickers: [...covered].sort(),
  };
}

function seriesForInterval(
  tickers: string[],
  rows: Array<Record<string, unknown>>,
  intervalMinutes: number,
): IntradayPriceSeries {
  return rowsToIntradayPriceSeries(
    tickers,
    rows.filter((row) => Number(row.interval_minutes) === intervalMinutes),
  );
}

function duplicateTimestamps(series: IntradayPriceSeries): string[] {
  const duplicates: string[] = [];
  for (const [ticker, bars] of Object.entries(series)) {
    const seen = new Set<string>();
    for (const bar of bars) {
      const key = new Date(bar.timestamp).toISOString();
      if (seen.has(key)) duplicates.push(`${ticker}@${key}`);
      seen.add(key);
    }
  }
  return duplicates;
}

function barMismatch(a: IntradayPricePoint, b: IntradayPricePoint): boolean {
  const closeEnough = (x: number | undefined, y: number | undefined) => {
    if (x == null && y == null) return true;
    if (x == null || y == null) return false;
    return Math.abs(x - y) <= EPSILON;
  };
  return !(
    closeEnough(a.open, b.open) &&
    closeEnough(a.high, b.high) &&
    closeEnough(a.low, b.low) &&
    closeEnough(a.close, b.close) &&
    closeEnough(a.volume, b.volume)
  );
}

function compareDerivedFiveMinute(
  tickers: string[],
  raw: IntradayPriceSeries,
  five: IntradayPriceSeries,
  strictFinal: boolean,
) {
  const mismatches: string[] = [];
  const missing: string[] = [];
  const legacyDirect: string[] = [];

  for (const ticker of tickers) {
    const expected = aggregateIntradayBars(raw[ticker] ?? [], 5);
    const persistedDerived = (five[ticker] ?? []).filter((bar) => bar.source === 'derived-1m');
    const direct = (five[ticker] ?? []).filter((bar) => bar.source !== 'derived-1m');
    legacyDirect.push(...direct.map((bar) => `${ticker}@${bar.timestamp}:${bar.source ?? 'unknown'}`));

    const byTimestamp = new Map(persistedDerived.map((bar) => [bar.timestamp, bar]));
    const maxPersistedMs = persistedDerived.length
      ? Math.max(...persistedDerived.map((bar) => new Date(bar.timestamp).getTime()))
      : Number.NaN;

    for (const aggregate of expected) {
      const persisted = byTimestamp.get(aggregate.timestamp);
      if (!persisted) {
        const aggregateMs = new Date(aggregate.timestamp).getTime();
        if (strictFinal || (Number.isFinite(maxPersistedMs) && aggregateMs <= maxPersistedMs)) {
          missing.push(`${ticker}@${aggregate.timestamp}`);
        }
        continue;
      }
      if (barMismatch(aggregate, persisted)) mismatches.push(`${ticker}@${aggregate.timestamp}`);
    }
  }

  return { mismatches, missing, legacyDirect };
}

function coverageSummary(
  tickers: string[],
  raw: IntradayPriceSeries,
  five: IntradayPriceSeries,
  fifteen: IntradayPriceSeries,
) {
  return Object.fromEntries(tickers.map((ticker) => {
    const rawBars = raw[ticker] ?? [];
    const fiveBars = five[ticker] ?? [];
    const fifteenBars = fifteen[ticker] ?? [];
    return [ticker, {
      raw1mBars: rawBars.length,
      raw1mFirst: rawBars[0]?.timestamp ?? null,
      raw1mLast: rawBars.at(-1)?.timestamp ?? null,
      raw1mFirstCairoMinute: rawBars[0] ? cairoMinuteOfDay(rawBars[0].timestamp) : null,
      raw1mLastCairoMinute: rawBars.length ? cairoMinuteOfDay(rawBars.at(-1)!.timestamp) : null,
      derived5mBars: fiveBars.filter((bar) => bar.source === 'derived-1m').length,
      direct5mBars: fiveBars.filter((bar) => bar.source !== 'derived-1m').length,
      fallback15mBars: fifteenBars.length,
    }];
  }));
}

async function fetchScannerThroughProductionProxy() {
  const nativeFetch = globalThis.fetch;
  let proxyAttempts = 0;
  let proxySuccess = false;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/')) {
      proxyAttempts += 1;
      const response = await nativeFetch(`${PRODUCTION_URL}${input}`, init);
      if (response.ok) proxySuccess = true;
      return response;
    }
    return nativeFetch(input, init);
  }) as typeof fetch;

  try {
    const scan = await fetchTradingViewEGXPrices([]);
    return { ...scan, proxyAttempts, proxySuccess };
  } finally {
    globalThis.fetch = nativeFetch;
  }
}

async function main() {
  const now = process.env.EGX_LIVE_SOAK_NOW ? new Date(process.env.EGX_LIVE_SOAK_NOW) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error('EGX_LIVE_SOAK_NOW must be a valid timestamp.');

  const clock = egxCairoSessionClock(now);
  const targetDate = (process.env.EGX_LIVE_SOAK_DATE || clock.dateKey).slice(0, 10);
  const phase = phaseFor(clock);
  const strictFinal = phase === 'POSTCLOSE';
  const issues: string[] = [];
  const observations: string[] = [];

  if (clock.dateKey !== targetDate) {
    const skipped = {
      targetDate,
      observedAt: now.toISOString(),
      cairoDate: clock.dateKey,
      phase,
      skipped: true,
      reason: 'Scheduled soak target date does not match the current Cairo date.',
      passed: true,
    };
    writeFileSync(OUTPUT_PATH, JSON.stringify(skipped, null, 2));
    console.log(JSON.stringify(skipped, null, 2));
    return;
  }

  if (!clock.isTradingWeekday) {
    const skipped = {
      targetDate,
      observedAt: now.toISOString(),
      cairoDate: clock.dateKey,
      phase,
      skipped: true,
      reason: 'Target date is not an EGX trading weekday.',
      passed: true,
    };
    writeFileSync(OUTPUT_PATH, JSON.stringify(skipped, null, 2));
    console.log(JSON.stringify(skipped, null, 2));
    return;
  }

  const sb = client();
  const portfolioId = await resolvePortfolioId(sb);
  const [
    { data: portfolio, error: portfolioError },
    { data: positionRows, error: positionsError },
    { data: transactionRows, error: transactionsError },
  ] = await Promise.all([
    sb.from('portfolios').select('id,cash_balance,capital_deposits').eq('id', portfolioId).single(),
    sb.from('positions')
      .select('id,ticker,company_name,sector,shares,avg_buy_price,current_price,day_change,day_change_percent,buy_date,total_fees,target_price,stop_loss,notes,price_updated_at')
      .eq('portfolio_id', portfolioId),
    sb.from('transactions').select('*').eq('portfolio_id', portfolioId),
  ]);
  if (portfolioError) throw new Error(`Portfolio soak read failed: ${portfolioError.message}`);
  if (positionsError) throw new Error(`Position soak read failed: ${positionsError.message}`);
  if (transactionsError) throw new Error(`Transaction soak read failed: ${transactionsError.message}`);

  const positions = (positionRows ?? []).map(mapPosition).filter((position) => position.shares > EPSILON);
  const transactions = (transactionRows ?? []).map(mapTransaction);
  const cashBalance = num(portfolio.cash_balance);
  const capitalDeposits = num(portfolio.capital_deposits);

  const currentHeld = [...new Set(positions.map((position) => normalizeIntradayTicker(position.ticker)).filter(Boolean))].sort();
  const sessionUniverse = resolveIntradaySessionTickers(transactions, targetDate);
  const expectedTickers = [...new Set([...sessionUniverse, ...currentHeld])].sort();
  const opening = openingTickers(transactions, targetDate);
  const tradedToday = [...new Set(
    transactions
      .filter((tx) => normalizeDate(tx.date) === targetDate)
      .map((tx) => normalizeIntradayTicker(tx.ticker))
      .filter((ticker) => ticker && ticker !== 'CASH'),
  )].sort();

  const reconciliation = reconcilePortfolioFromLedger(transactions, [], capitalDeposits, positions);
  const storedByTicker = new Map(positions.map((position) => [normalizeIntradayTicker(position.ticker), position.shares]));
  const rebuiltByTicker = new Map(
    reconciliation.reconciledPositions.map((position) => [normalizeIntradayTicker(position.ticker), position.shares]),
  );
  for (const ticker of new Set([...storedByTicker.keys(), ...rebuiltByTicker.keys()])) {
    const stored = storedByTicker.get(ticker) ?? 0;
    const rebuilt = rebuiltByTicker.get(ticker) ?? 0;
    if (Math.abs(stored - rebuilt) > EPSILON) {
      issues.push(`Position drift ${ticker}: stored=${stored}, ledger=${rebuilt}.`);
    }
  }
  if (Math.abs(cashBalance - reconciliation.reconciledCashBalance) > 0.01) {
    issues.push(
      `Cash drift: stored=${cashBalance.toFixed(2)}, ledger=${reconciliation.reconciledCashBalance.toFixed(2)}.`,
    );
  }

  const intradayRows = await loadIntradayRows(sb, expectedTickers, targetDate);
  const raw1m = seriesForInterval(expectedTickers, intradayRows, 1);
  const derived5m = seriesForInterval(expectedTickers, intradayRows, 5);
  const fallback15m = seriesForInterval(expectedTickers, intradayRows, 15);
  const coverage = coverageSummary(expectedTickers, raw1m, derived5m, fallback15m);

  const duplicate1m = duplicateTimestamps(raw1m);
  const duplicate5m = duplicateTimestamps(derived5m);
  if (duplicate1m.length) issues.push(`Duplicate 1m timestamps: ${duplicate1m.join(', ')}`);
  if (duplicate5m.length) issues.push(`Duplicate 5m timestamps: ${duplicate5m.join(', ')}`);

  const derivedCheck = compareDerivedFiveMinute(expectedTickers, raw1m, derived5m, strictFinal);
  if (derivedCheck.mismatches.length) {
    issues.push(`Derived 5m OHLCV mismatch: ${derivedCheck.mismatches.join(', ')}`);
  }
  if (derivedCheck.missing.length) {
    issues.push(`Missing reconstructible derived 5m buckets: ${derivedCheck.missing.join(', ')}`);
  }
  if (strictFinal && derivedCheck.legacyDirect.length) {
    issues.push(`Competing direct 5m rows found in target session: ${derivedCheck.legacyDirect.join(', ')}`);
  }

  const candidates = [
    { intervalMinutes: 1, series: raw1m },
    { intervalMinutes: 5, series: derived5m },
    { intervalMinutes: 15, series: fallback15m },
  ];
  const autoSelection = selectBestIntradayResolution(candidates, expectedTickers, targetDate);
  const manualOneMinute = selectBestIntradayResolution(
    [{ intervalMinutes: 1, series: raw1m }],
    expectedTickers,
    targetDate,
  );

  if (phase !== 'PREOPEN') {
    if (!autoSelection) issues.push('Auto resolution has no usable target-session intraday dataset.');
    else if (autoSelection.sessionDate !== targetDate) {
      issues.push(`Auto resolution substituted session ${autoSelection.sessionDate} for ${targetDate}.`);
    }

    const latestExpectedMinute = Math.min(
      Math.max(INTRADAY_POLICY.sessionStartMinutes, clock.minuteOfDay - 25),
      INTRADAY_POLICY.sessionEndMinutes - 1,
    );
    for (const ticker of currentHeld) {
      const lastMinute = (coverage[ticker] as any)?.raw1mLastCairoMinute as number | null;
      if (lastMinute == null || lastMinute < latestExpectedMinute) {
        issues.push(
          `Raw 1m is stale for held ${ticker}: last=${lastMinute ?? 'none'} expected>=${latestExpectedMinute} Cairo minute.`,
        );
      }
    }
  } else if (intradayRows.length) {
    issues.push('Target-session intraday rows exist before the regular EGX open.');
  }

  if (manualOneMinute && manualOneMinute.intervalMinutes !== 1) {
    issues.push(`Manual 1m selection resolved to unexpected interval ${manualOneMinute.intervalMinutes}.`);
  }
  if (manualOneMinute && manualOneMinute.sessionDate !== targetDate) {
    issues.push(`Manual 1m selection substituted session ${manualOneMinute.sessionDate}.`);
  }

  if (strictFinal) {
    for (const ticker of opening) {
      const firstMinute = (coverage[ticker] as any)?.raw1mFirstCairoMinute as number | null;
      if (firstMinute == null || firstMinute > INTRADAY_POLICY.sessionStartMinutes + 10) {
        issues.push(
          `Opening holding ${ticker} lacks near-open raw 1m coverage: first=${firstMinute ?? 'none'}.`,
        );
      }
    }
    for (const ticker of currentHeld) {
      const lastMinute = (coverage[ticker] as any)?.raw1mLastCairoMinute as number | null;
      if (lastMinute == null || lastMinute < INTRADAY_POLICY.sessionEndMinutes - 10) {
        issues.push(
          `Closing holding ${ticker} lacks near-close raw 1m coverage: last=${lastMinute ?? 'none'}.`,
        );
      }
    }
  }

  const historical = await loadHistoricalSeries(sb, expectedTickers, targetDate);
  if (strictFinal) {
    if (historical.latestDate !== targetDate) {
      issues.push(`Daily history has not advanced to ${targetDate}; latest=${historical.latestDate ?? 'none'}.`);
    }
    const missingDaily = currentHeld.filter((ticker) => !historical.sessionCoveredTickers.includes(ticker));
    if (missingDaily.length) {
      issues.push(`Held tickers missing target-session daily close: ${missingDaily.join(', ')}.`);
    }
  }

  let proxySuccess = false;
  let proxyAttempts = 0;
  let scannerMissingHeld: string[] = [];
  let storedNav = calculatePortfolioValue(cashBalance, positions);
  let referenceNav: number | null = null;
  let todayEndEquity: number | null = null;
  let todayReferenceDelta: number | null = null;
  let liveMatchCount = 0;

  try {
    const scan = await fetchScannerThroughProductionProxy();
    proxySuccess = scan.proxySuccess;
    proxyAttempts = scan.proxyAttempts;
    if (!proxySuccess) issues.push('Production /api/egx/scan proxy did not return a successful scanner response.');

    scannerMissingHeld = currentHeld.filter((ticker) => {
      const quote = scan.quotes[ticker];
      return !quote || !Number.isFinite(quote.price) || quote.price <= 0;
    });
    if (scannerMissingHeld.length) {
      issues.push(`Live scanner missing held tickers: ${scannerMissingHeld.join(', ')}.`);
    }

    const applied = applyLivePricesToPortfolio(positions, [], scan.quotes, scan.discoveredTickers);
    liveMatchCount = applied.matchCount;
    referenceNav = calculatePortfolioValue(cashBalance, applied.updatedPositions);

    if (autoSelection && !scannerMissingHeld.length) {
      const livePrices = Object.fromEntries(
        currentHeld.map((ticker) => [ticker, scan.quotes[ticker].price]),
      );
      const today = buildIntradayAnalyticsResult(
        transactions,
        historical.series,
        autoSelection.series,
        {
          sessionDate: targetDate,
          openingCapital: capitalDeposits,
          currentCashBalance: cashBalance,
          asOf: now,
          livePrices,
        },
      );
      todayEndEquity = today.summary.endEquity;
      if (todayEndEquity != null && referenceNav != null) {
        todayReferenceDelta = todayEndEquity - referenceNav;
        if (Math.abs(todayReferenceDelta) > 0.05) {
          issues.push(
            `Today endpoint does not converge on scanner NAV: today=${todayEndEquity.toFixed(2)}, reference=${referenceNav.toFixed(2)}.`,
          );
        }
      } else if (phase !== 'PREOPEN') {
        issues.push('Today endpoint did not produce a complete end-equity value.');
      }
    }
  } catch (error) {
    issues.push(`Live scanner/proxy check failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const maxRawMinute = Math.max(
    -1,
    ...expectedTickers.map((ticker) => Number((coverage[ticker] as any)?.raw1mLastCairoMinute ?? -1)),
  );
  const minRawMinute = Math.min(
    Number.POSITIVE_INFINITY,
    ...expectedTickers
      .map((ticker) => Number((coverage[ticker] as any)?.raw1mFirstCairoMinute))
      .filter(Number.isFinite),
  );

  if (phase === 'PREOPEN') {
    observations.push('Pre-open checkpoint: target-session intraday history should still be empty.');
  } else {
    observations.push(
      `Target-session raw 1m envelope: ${Number.isFinite(minRawMinute) ? minRawMinute : 'none'}..${maxRawMinute >= 0 ? maxRawMinute : 'none'} Cairo minute.`,
    );
  }
  if (autoSelection) {
    observations.push(
      `Auto selected ${autoSelection.intervalMinutes}m for ${autoSelection.sessionDate} with ${autoSelection.coveredTickers.length}/${autoSelection.referenceTickers.length} reference tickers.`,
    );
  }
  if (manualOneMinute) {
    observations.push(
      `Manual 1m remained strict on ${manualOneMinute.sessionDate}; no coarser fallback was substituted.`,
    );
  }

  const result = {
    targetDate,
    observedAt: now.toISOString(),
    cairoDate: clock.dateKey,
    cairoMinuteOfDay: clock.minuteOfDay,
    phase,
    strictFinal,
    portfolioId,
    currentHeld,
    openingTickers: opening,
    tradedToday,
    sessionUniverse,
    expectedTickers,
    accounting: {
      storedCash: cashBalance,
      rebuiltCash: reconciliation.reconciledCashBalance,
      storedPositions: positions.length,
      rebuiltPositions: reconciliation.reconciledPositions.length,
      storedNav,
    },
    coverage,
    selection: {
      auto: autoSelection
        ? {
            intervalMinutes: autoSelection.intervalMinutes,
            sessionDate: autoSelection.sessionDate,
            coveredTickers: autoSelection.coveredTickers,
            referenceTickers: autoSelection.referenceTickers,
          }
        : null,
      manual1m: manualOneMinute
        ? {
            intervalMinutes: manualOneMinute.intervalMinutes,
            sessionDate: manualOneMinute.sessionDate,
            coveredTickers: manualOneMinute.coveredTickers,
            referenceTickers: manualOneMinute.referenceTickers,
          }
        : null,
    },
    aggregation: {
      mismatches: derivedCheck.mismatches,
      missingReconstructibleBuckets: derivedCheck.missing,
      competingDirect5mRows: derivedCheck.legacyDirect,
    },
    dailyHistory: {
      latestDate: historical.latestDate,
      sessionCoveredTickers: historical.sessionCoveredTickers,
    },
    liveReference: {
      productionProxyUrl: `${PRODUCTION_URL}/api/egx/scan`,
      proxyAttempts,
      proxySuccess,
      scannerMissingHeld,
      matchedPositions: liveMatchCount,
      referenceNav,
      storedNav,
      storedVsReferenceDelta: referenceNav == null ? null : storedNav - referenceNav,
      todayEndEquity,
      todayReferenceDelta,
    },
    observations,
    issues,
    passed: issues.length === 0,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));

  if (issues.length) process.exitCode = 1;
}

main().catch((error) => {
  const failure = {
    observedAt: new Date().toISOString(),
    issues: [error instanceof Error ? error.message : String(error)],
    passed: false,
  };
  try {
    writeFileSync(OUTPUT_PATH, JSON.stringify(failure, null, 2));
  } catch {
    // Keep the original failure visible even if artifact writing also fails.
  }
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = 1;
});
