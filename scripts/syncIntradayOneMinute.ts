import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createChart, createSeries, createSession } from '@ch99q/twc';
import {
  aggregateIntradayBars,
  mergeIntradayBarsByTimestamp,
} from '../src/services/intradayAggregation';
import {
  buildIntradayOneMinuteBackfillPlan,
  retentionCutoffStartOfUtcDay,
} from '../src/services/intradayBackfillPlan';
import { INTRADAY_POLICY } from '../src/services/intradayPolicy';
import type { IntradayPricePoint } from '../src/services/intradayPriceStore';
import { resolveTradingViewInstrument } from '../src/services/tradingViewSymbolResolver';

type HistoryBar = [number, number, number, number, number, number?];
type SupabaseClient = ReturnType<typeof createSupabaseClient>;

const MORE_DATA_TIMEOUT_MS = 20_000;

function normalizeTicker(value: string): string {
  return value.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
}

function readBoolean(name: string): boolean {
  return /^(1|true|yes|on)$/i.test(String(process.env[name] || '').trim());
}

function createSupabaseClient() {
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

async function resolvePortfolioId(sb: SupabaseClient): Promise<string> {
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

  const { data, error } = await sb
    .from('portfolios')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(2);
  if (error) throw new Error(`Supabase portfolio discovery failed: ${error.message}`);
  if (!data?.length) throw new Error('No Supabase portfolio exists.');
  if (data.length > 1) {
    throw new Error('Multiple portfolios exist. Set EGX_PORTFOLIO_ID explicitly for intraday sync.');
  }
  return String(data[0].id);
}

function cairoDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: INTRADAY_POLICY.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${read('year')}-${read('month')}-${read('day')}`;
}

async function resolveTickerUniverse(
  sb: SupabaseClient,
  portfolioId: string,
  sessionDate: string,
): Promise<string[]> {
  const explicit = process.env.EGX_INTRADAY_TICKERS
    ?.split(',')
    .map(normalizeTicker)
    .filter(Boolean);
  if (explicit?.length) return [...new Set(explicit)].sort();

  const [{ data: transactions, error: txError }, { data: positions, error: positionError }] =
    await Promise.all([
      sb
        .from('transactions')
        .select('ticker,transaction_date')
        .eq('portfolio_id', portfolioId)
        .eq('transaction_date', sessionDate),
      sb
        .from('positions')
        .select('ticker')
        .eq('portfolio_id', portfolioId),
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
  sb: SupabaseClient,
  ticker: string,
): Promise<{ isin?: string }> {
  const { data, error } = await sb
    .from('tickers')
    .select('isin')
    .eq('ticker', ticker)
    .maybeSingle();

  if (error) throw new Error(`Ticker metadata read failed for ${ticker}: ${error.message}`);
  return { isin: String(data?.isin || '').trim().toUpperCase() || undefined };
}

async function coverageTimestamp(
  sb: SupabaseClient,
  ticker: string,
  intervalMinutes: number,
  direction: 'earliest' | 'latest',
  source?: string,
): Promise<string | null> {
  const ascending = direction === 'earliest';
  let query = sb
    .from('intraday_price_history')
    .select('bar_timestamp')
    .eq('ticker', ticker)
    .eq('interval_minutes', intervalMinutes);

  if (source) query = query.eq('source', source);

  const { data, error } = await query
    .order('bar_timestamp', { ascending })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`${direction} intraday coverage read failed for ${ticker}: ${error.message}`);
  }
  return data?.bar_timestamp ? String(data.bar_timestamp) : null;
}

async function countLegacyFiveMinuteRows(
  sb: SupabaseClient,
  ticker: string,
  cutoffIso: string,
  fromIso?: string,
): Promise<number> {
  let query = sb
    .from('intraday_price_history')
    .select('bar_timestamp', { head: true, count: 'exact' })
    .eq('ticker', ticker)
    .eq('interval_minutes', INTRADAY_POLICY.derivedIntervalMinutes)
    .neq('source', 'derived-1m')
    .gte('bar_timestamp', cutoffIso);

  if (fromIso) query = query.gte('bar_timestamp', fromIso);

  const { count, error } = await query;

  if (error) throw new Error(`Legacy 5-minute coverage read failed for ${ticker}: ${error.message}`);
  return count ?? 0;
}

function rawPointFromHistoryBar(
  bar: HistoryBar,
  retrievedAt: string,
  derivedCutoffMs: number,
  nowMs: number,
): IntradayPricePoint | null {
  const timestampSeconds = Number(bar[0]);
  const open = Number(bar[1]);
  const high = Number(bar[2]);
  const low = Number(bar[3]);
  const close = Number(bar[4]);
  const volume = Number(bar[5]);
  const timestampMs = timestampSeconds * 1000;

  if (
    !Number.isFinite(timestampSeconds) ||
    !Number.isFinite(timestampMs) ||
    timestampMs < derivedCutoffMs ||
    timestampMs + 60_000 > nowMs ||
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
    timestamp: new Date(timestampMs).toISOString(),
    intervalMinutes: INTRADAY_POLICY.rawIntervalMinutes,
    open,
    high,
    low,
    close,
    volume: Number.isFinite(volume) && volume >= 0 ? volume : undefined,
    source: 'tradingview',
    retrievedAt,
  };
}

function rawDbRow(ticker: string, point: IntradayPricePoint) {
  return {
    ticker,
    interval_minutes: INTRADAY_POLICY.rawIntervalMinutes,
    bar_timestamp: point.timestamp,
    open: point.open,
    high: point.high,
    low: point.low,
    close: point.close,
    volume: point.volume ?? null,
    source: 'tradingview',
    retrieved_at: point.retrievedAt || new Date().toISOString(),
  };
}

function derivedDbRow(ticker: string, point: IntradayPricePoint) {
  return {
    ticker,
    interval_minutes: INTRADAY_POLICY.derivedIntervalMinutes,
    bar_timestamp: point.timestamp,
    open: point.open,
    high: point.high,
    low: point.low,
    close: point.close,
    volume: point.volume ?? null,
    source: 'derived-1m',
    retrieved_at: point.retrievedAt || new Date().toISOString(),
  };
}

function timestampIdentity(value: string): string {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? String(ms) : value;
}

async function loadExistingTimestamps(
  sb: SupabaseClient,
  ticker: string,
  intervalMinutes: number,
  fromTimestamp: string,
  toTimestamp: string,
): Promise<Set<string>> {
  const pageSize = 1000;
  const timestamps = new Set<string>();

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await sb
      .from('intraday_price_history')
      .select('bar_timestamp')
      .eq('ticker', ticker)
      .eq('interval_minutes', intervalMinutes)
      .gte('bar_timestamp', fromTimestamp)
      .lte('bar_timestamp', toTimestamp)
      .order('bar_timestamp', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Existing intraday timestamps read failed for ${ticker}: ${error.message}`);
    }

    for (const row of data ?? []) {
      timestamps.add(timestampIdentity(String(row.bar_timestamp)));
    }
    if (!data || data.length < pageSize) break;
  }

  return timestamps;
}

async function loadPersistedRawPoints(
  sb: SupabaseClient,
  ticker: string,
  fromTimestamp: string,
  toTimestamp: string,
): Promise<IntradayPricePoint[]> {
  const pageSize = 1000;
  const points: IntradayPricePoint[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await sb
      .from('intraday_price_history')
      .select('bar_timestamp,open,high,low,close,volume,retrieved_at')
      .eq('ticker', ticker)
      .eq('interval_minutes', INTRADAY_POLICY.rawIntervalMinutes)
      .gte('bar_timestamp', fromTimestamp)
      .lte('bar_timestamp', toTimestamp)
      .order('bar_timestamp', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Persisted 1-minute source read failed for ${ticker}: ${error.message}`);
    }

    for (const row of data ?? []) {
      const timestamp = String(row.bar_timestamp ?? '');
      const open = Number(row.open);
      const high = Number(row.high);
      const low = Number(row.low);
      const close = Number(row.close);
      const volume = row.volume == null ? undefined : Number(row.volume);
      if (
        !timestamp ||
        !Number.isFinite(new Date(timestamp).getTime()) ||
        !Number.isFinite(open) ||
        !Number.isFinite(high) ||
        !Number.isFinite(low) ||
        !Number.isFinite(close) ||
        open <= 0 || high <= 0 || low <= 0 || close <= 0
      ) {
        continue;
      }

      points.push({
        timestamp,
        intervalMinutes: INTRADAY_POLICY.rawIntervalMinutes,
        open,
        high,
        low,
        close,
        volume: Number.isFinite(volume) ? volume : undefined,
        source: 'tradingview',
        retrievedAt: row.retrieved_at == null ? undefined : String(row.retrieved_at),
      });
    }

    if (!data || data.length < pageSize) break;
  }

  return points;
}

async function insertMissingRawRows(
  sb: SupabaseClient,
  ticker: string,
  points: IntradayPricePoint[],
): Promise<number> {
  if (!points.length) return 0;
  const sorted = [...points].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const existing = await loadExistingTimestamps(
    sb,
    ticker,
    INTRADAY_POLICY.rawIntervalMinutes,
    sorted[0].timestamp,
    sorted[sorted.length - 1].timestamp,
  );

  const missingRows = sorted
    .filter((point) => !existing.has(timestampIdentity(point.timestamp)))
    .map((point) => rawDbRow(ticker, point));

  for (let offset = 0; offset < missingRows.length; offset += 500) {
    const { error } = await sb
      .from('intraday_price_history')
      .insert(missingRows.slice(offset, offset + 500));
    if (error) throw new Error(`1-minute history write failed for ${ticker}: ${error.message}`);
  }

  return missingRows.length;
}

async function upsertDerivedRows(
  sb: SupabaseClient,
  ticker: string,
  points: IntradayPricePoint[],
): Promise<number> {
  if (!points.length) return 0;
  const rows = points.map((point) => derivedDbRow(ticker, point));

  for (let offset = 0; offset < rows.length; offset += 500) {
    const { error } = await sb
      .from('intraday_price_history')
      .upsert(rows.slice(offset, offset + 500), {
        onConflict: 'ticker,interval_minutes,bar_timestamp',
        ignoreDuplicates: false,
      });
    if (error) throw new Error(`Derived 5-minute history write failed for ${ticker}: ${error.message}`);
  }

  return rows.length;
}

async function pruneInterval(
  sb: SupabaseClient,
  intervalMinutes: number,
  cutoffIso: string,
): Promise<number> {
  const { count, error } = await sb
    .from('intraday_price_history')
    .delete({ count: 'exact' })
    .eq('interval_minutes', intervalMinutes)
    .lt('bar_timestamp', cutoffIso);

  if (error) {
    throw new Error(`${intervalMinutes}-minute retention cleanup failed: ${error.message}`);
  }
  return count ?? 0;
}

function earliestUsableHistoryTimestampMs(history: HistoryBar[]): number {
  let earliest = Number.POSITIVE_INFINITY;
  for (const bar of history) {
    const seconds = Number(bar?.[0]);
    const open = Number(bar?.[1]);
    const high = Number(bar?.[2]);
    const low = Number(bar?.[3]);
    const close = Number(bar?.[4]);
    if (
      !Number.isFinite(seconds) ||
      seconds <= 0 ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close) ||
      open <= 0 ||
      high <= 0 ||
      low <= 0 ||
      close <= 0
    ) {
      continue;
    }
    earliest = Math.min(earliest, seconds * 1000);
  }
  return earliest;
}

async function requestMoreOneMinuteData(
  session: Awaited<ReturnType<typeof createSession>>,
  chart: Awaited<ReturnType<typeof createChart>>,
  series: Awaited<ReturnType<typeof createSeries>>,
  count: number,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeout);
      session.removeListener('series_completed', onCompleted);
      session.removeListener('error', onError);
    };

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };

    const onCompleted = (payload: unknown[]) => {
      if (!Array.isArray(payload) || payload[0] !== chart.id || payload[1] !== series.id) return;
      finish();
    };

    const onError = (...args: unknown[]) => {
      const [event, payload] = args;
      if (
        event === 'series_error' &&
        Array.isArray(payload) &&
        payload[0] === chart.id &&
        payload[1] === series.id
      ) {
        finish(new Error(`TradingView request_more_data failed: ${String(payload[2] || 'series_error')}`));
      }
    };

    const timeout = setTimeout(
      () => finish(new Error(`TradingView request_more_data timed out after ${MORE_DATA_TIMEOUT_MS}ms.`)),
      MORE_DATA_TIMEOUT_MS,
    );

    session.on('series_completed', onCompleted);
    session.on('error', onError);

    session
      .send('request_more_data', [chart.id, series.id, count])
      .catch((error) =>
        finish(error instanceof Error ? error : new Error(String(error))),
      );
  });
}

async function fetchOneMinuteHistoryPaged(
  session: Awaited<ReturnType<typeof createSession>>,
  chart: Awaited<ReturnType<typeof createChart>>,
  resolved: Parameters<typeof createSeries>[2],
  targetStartMs: number,
  mode: 'full-derived-backfill' | 'raw-backfill' | 'incremental',
): Promise<{
  history: HistoryBar[];
  additionalBatches: number;
  sourceExhausted: boolean;
}> {
  const initialCount =
    mode === 'incremental'
      ? INTRADAY_POLICY.incrementalBars
      : INTRADAY_POLICY.initialBackfillBars;
  const series = await createSeries(session, chart, resolved, '1', initialCount);

  try {
    let additionalBatches = 0;
    let sourceExhausted = false;

    while (
      earliestUsableHistoryTimestampMs((series.history || []) as HistoryBar[]) > targetStartMs &&
      additionalBatches < INTRADAY_POLICY.maxBackfillBatches
    ) {
      const beforeLength = series.history.length;
      const beforeFirst = earliestUsableHistoryTimestampMs((series.history || []) as HistoryBar[]);

      await requestMoreOneMinuteData(
        session,
        chart,
        series,
        INTRADAY_POLICY.backfillBatchBars,
      );
      additionalBatches += 1;

      const afterLength = series.history.length;
      const afterFirst = earliestUsableHistoryTimestampMs((series.history || []) as HistoryBar[]);

      if (afterLength <= beforeLength || afterFirst >= beforeFirst) {
        sourceExhausted = true;
        break;
      }
    }

    const earliestMs = earliestUsableHistoryTimestampMs((series.history || []) as HistoryBar[]);
    if (
      Number.isFinite(earliestMs) &&
      earliestMs > targetStartMs &&
      !sourceExhausted &&
      additionalBatches >= INTRADAY_POLICY.maxBackfillBatches
    ) {
      throw new Error(
        `1-minute pagination limit reached before target coverage: earliest=${new Date(earliestMs).toISOString()} target=${new Date(targetStartMs).toISOString()}`,
      );
    }

    return {
      history: [...((series.history || []) as HistoryBar[])],
      additionalBatches,
      sourceExhausted,
    };
  } finally {
    await series.close();
  }
}

async function main() {
  const now = new Date();
  const nowMs = now.getTime();
  const rawCutoffMs = retentionCutoffStartOfUtcDay(
    nowMs,
    INTRADAY_POLICY.rawRetentionDays,
  );
  const derivedCutoffMs = retentionCutoffStartOfUtcDay(
    nowMs,
    INTRADAY_POLICY.derivedRetentionDays,
  );
  const rawCutoffIso = new Date(rawCutoffMs).toISOString();
  const derivedCutoffIso = new Date(derivedCutoffMs).toISOString();
  const forceFullRepair = readBoolean('EGX_INTRADAY_FULL_REPAIR');

  const sb = createSupabaseClient();
  const portfolioId = await resolvePortfolioId(sb);
  const sessionDate = cairoDateKey(now);
  const tickers = await resolveTickerUniverse(sb, portfolioId, sessionDate);

  if (!tickers.length) {
    console.log('No portfolio-relevant security tickers found for 1-minute intraday sync.');
    return;
  }

  console.log(
    `1m intraday sync starting: ${tickers.length} session-relevant tickers for ${sessionDate}; raw retention=${INTRADAY_POLICY.rawRetentionDays}d; derived 5m retention=${INTRADAY_POLICY.derivedRetentionDays}d; initialBars=${INTRADAY_POLICY.initialBackfillBars}; batchBars=${INTRADAY_POLICY.backfillBatchBars}; maxBatches=${INTRADAY_POLICY.maxBackfillBatches}; forceFullRepair=${forceFullRepair}.`,
  );

  const session = await createSession();
  let failures = 0;
  let totalFetched = 0;
  let totalRawInserted = 0;
  let totalDerivedUpserted = 0;
  let totalAdditionalBatches = 0;

  try {
    const chart = await createChart(session);

    for (const ticker of tickers) {
      try {
        const [
          earliestDerivedTimestamp,
          earliestFiveMinuteTimestamp,
          latestRawTimestamp,
          metadata,
          legacyBefore,
        ] = await Promise.all([
          coverageTimestamp(
            sb,
            ticker,
            INTRADAY_POLICY.derivedIntervalMinutes,
            'earliest',
            'derived-1m',
          ),
          coverageTimestamp(
            sb,
            ticker,
            INTRADAY_POLICY.derivedIntervalMinutes,
            'earliest',
          ),
          coverageTimestamp(
            sb,
            ticker,
            INTRADAY_POLICY.rawIntervalMinutes,
            'latest',
          ),
          loadTickerMetadata(sb, ticker),
          countLegacyFiveMinuteRows(sb, ticker, derivedCutoffIso),
        ]);

        const plan = buildIntradayOneMinuteBackfillPlan({
          now,
          earliestDerivedTimestamp,
          earliestFiveMinuteTimestamp,
          latestRawTimestamp,
          forceFullRepair,
        });

        const resolution = await resolveTradingViewInstrument(chart, {
          ticker,
          isin: metadata.isin,
        });

        const paged = await fetchOneMinuteHistoryPaged(
          session,
          chart,
          resolution.resolved,
          plan.fromMs,
          plan.mode,
        );
        totalAdditionalBatches += paged.additionalBatches;

        const byTimestamp = new Map<string, IntradayPricePoint>();
        const retrievedAt = new Date().toISOString();
        for (const rawBar of paged.history) {
          const point = rawPointFromHistoryBar(rawBar, retrievedAt, derivedCutoffMs, nowMs);
          if (!point) continue;
          const pointMs = new Date(point.timestamp).getTime();
          if (pointMs < plan.fromMs || pointMs > plan.toMs) continue;
          byTimestamp.set(point.timestamp, point);
        }

        const fetchedPoints = [...byTimestamp.values()].sort((a, b) =>
          a.timestamp.localeCompare(b.timestamp),
        );

        if (!fetchedPoints.length) {
          throw new Error(
            `TradingView returned no usable 1-minute bars for requested ${plan.mode} window.`,
          );
        }

        totalFetched += fetchedPoints.length;

        const rawPoints = fetchedPoints.filter(
          (point) => new Date(point.timestamp).getTime() >= rawCutoffMs,
        );
        const rawInserted = await insertMissingRawRows(sb, ticker, rawPoints);
        totalRawInserted += rawInserted;

        const persistedRawPoints = rawPoints.length
          ? await loadPersistedRawPoints(
              sb,
              ticker,
              rawPoints[0].timestamp,
              rawPoints.at(-1)!.timestamp,
            )
          : [];
        const canonicalDerivedSource = mergeIntradayBarsByTimestamp(
          fetchedPoints,
          persistedRawPoints,
        );

        const derivedPoints = aggregateIntradayBars(
          canonicalDerivedSource,
          INTRADAY_POLICY.derivedIntervalMinutes,
        ).filter((point) => {
          const startMs = new Date(point.timestamp).getTime();
          return (
            Number.isFinite(startMs) &&
            startMs >= derivedCutoffMs &&
            startMs + INTRADAY_POLICY.derivedIntervalMinutes * 60_000 <= nowMs
          );
        });

        const derivedUpserted = await upsertDerivedRows(sb, ticker, derivedPoints);
        totalDerivedUpserted += derivedUpserted;

        const earliestFetchedMs = new Date(fetchedPoints[0].timestamp).getTime();
        const earliestDerivedBucketMs =
          Math.floor(
            earliestFetchedMs /
              (INTRADAY_POLICY.derivedIntervalMinutes * 60_000),
          ) *
          INTRADAY_POLICY.derivedIntervalMinutes *
          60_000;
        const earliestDerivedBucketIso = new Date(earliestDerivedBucketMs).toISOString();

        const [legacyAfter, legacyInsideReconstructibleWindow] = await Promise.all([
          countLegacyFiveMinuteRows(sb, ticker, derivedCutoffIso),
          countLegacyFiveMinuteRows(
            sb,
            ticker,
            derivedCutoffIso,
            earliestDerivedBucketIso,
          ),
        ]);

        if (legacyInsideReconstructibleWindow > 0) {
          throw new Error(
            `Derived replacement incomplete: ${legacyInsideReconstructibleWindow} legacy 5-minute rows remain inside reconstructible 1-minute coverage starting ${earliestDerivedBucketIso}.`,
          );
        }

        const bootstrapLimitedByTradingView =
          plan.mode === 'full-derived-backfill' &&
          paged.sourceExhausted &&
          earliestFetchedMs > derivedCutoffMs;

        if (
          plan.mode === 'full-derived-backfill' &&
          legacyAfter > 0 &&
          !bootstrapLimitedByTradingView
        ) {
          throw new Error(
            `Full derived rebuild incomplete: ${legacyAfter} legacy TradingView 5-minute rows remain even though 1-minute source pagination did not report exhaustion.`,
          );
        }

        console.log(JSON.stringify({
          ticker,
          resolutionMethod: resolution.method,
          resolvedSymbol: resolution.symbol,
          resolutionAttempts: resolution.attempts,
          mode: plan.mode,
          initialBars:
            plan.mode === 'incremental'
              ? INTRADAY_POLICY.incrementalBars
              : INTRADAY_POLICY.initialBackfillBars,
          additionalBatches: paged.additionalBatches,
          sourceExhausted: paged.sourceExhausted,
          fetched1m: fetchedPoints.length,
          inserted1m: rawInserted,
          persistedRawForDerivation: persistedRawPoints.length,
          upserted5m: derivedUpserted,
          legacy5mBefore: legacyBefore,
          legacy5mAfter: legacyAfter,
          legacy5mInsideReconstructibleWindow: legacyInsideReconstructibleWindow,
          bootstrapLimitedByTradingView,
          earliestFetched: fetchedPoints[0]?.timestamp ?? null,
          latestFetched: fetchedPoints.at(-1)?.timestamp ?? null,
          previousEarliestDerived5m: earliestDerivedTimestamp,
          previousEarliestAny5m: earliestFiveMinuteTimestamp,
          previousLatest1m: latestRawTimestamp,
        }));
      } catch (error) {
        failures += 1;
        process.exitCode = 1;
        console.error(
          `${ticker}: 1-minute intraday sync failed`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    const [prunedRaw, prunedDerived] = await Promise.all([
      pruneInterval(sb, INTRADAY_POLICY.rawIntervalMinutes, rawCutoffIso),
      pruneInterval(sb, INTRADAY_POLICY.derivedIntervalMinutes, derivedCutoffIso),
    ]);

    console.log(
      `1m intraday sync complete: additionalBatches=${totalAdditionalBatches}, fetched=${totalFetched}, inserted1m=${totalRawInserted}, upserted5m=${totalDerivedUpserted}, pruned1m=${prunedRaw}, pruned5m=${prunedDerived}, failures=${failures}.`,
    );
  } finally {
    await session.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
