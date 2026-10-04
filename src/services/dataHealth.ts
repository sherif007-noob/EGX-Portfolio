import { getSupabaseBrowserClient } from './supabaseBrowser';
import { egxCairoSessionClock } from './egxTradingSession';
import { INTRADAY_POLICY } from './intradayPolicy';
import { cairoDateKey, normalizeIntradayTicker } from './intradayPriceStore';

export type DataHealthStatus = 'healthy' | 'warning' | 'error' | 'unknown';

export interface DataHealthItem {
  id:
    | 'live_quotes'
    | 'selected_session'
    | 'raw_1m'
    | 'derived_5m'
    | 'daily_history'
    | 'ticker_resolution'
    | 'portfolio_sync'
    | 'last_ingestion'
    | 'app_build';
  label: string;
  status: DataHealthStatus;
  value: string;
  detail?: string;
  affectedTickers?: string[];
  timestamp?: string;
}

export interface DataHealthSnapshot {
  checkedAt: string;
  expectedSessionDate: string;
  selectedSessionDate: string | null;
  overallStatus: DataHealthStatus;
  items: DataHealthItem[];
}

export interface DataHealthSourceRows {
  portfolio?: {
    updated_at?: string | null;
    last_price_write_at?: string | null;
  } | null;
  quotes: Array<{
    ticker: string;
    last_price?: number | string | null;
    price_updated_at?: string | null;
  }>;
  raw1m: Array<{
    ticker: string;
    bar_timestamp: string;
    retrieved_at?: string | null;
  }>;
  derived5m: Array<{
    ticker: string;
    bar_timestamp: string;
    retrieved_at?: string | null;
  }>;
  daily: Array<{
    ticker: string;
    trading_date: string;
    retrieved_at?: string | null;
  }>;
  registry: Array<{
    ticker: string;
    status?: string | null;
    scanner_symbol?: string | null;
    history_symbol?: string | null;
    verification_error?: string | null;
  }>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeTicker(value: string): string {
  return normalizeIntradayTicker(value);
}

function latestIso(values: Array<string | null | undefined>): string | null {
  const valid = values
    .filter((value): value is string => Boolean(value))
    .filter((value) => Number.isFinite(new Date(value).getTime()))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  return valid.at(-1) ?? null;
}

function latestDate(values: Array<string | null | undefined>): string | null {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

function statusRank(status: DataHealthStatus): number {
  if (status === 'error') return 3;
  if (status === 'warning') return 2;
  if (status === 'unknown') return 1;
  return 0;
}

function combineStatus(items: DataHealthItem[]): DataHealthStatus {
  return items.reduce<DataHealthStatus>(
    (worst, item) => (statusRank(item.status) > statusRank(worst) ? item.status : worst),
    'healthy',
  );
}

function floorToFiveMinutes(timestamp: string): number {
  const ms = new Date(timestamp).getTime();
  if (!Number.isFinite(ms)) return Number.NaN;
  return Math.floor(ms / (5 * 60_000)) * (5 * 60_000);
}

function ageLabel(timestamp: string | null, now: Date): string {
  if (!timestamp) return 'unknown';
  const ageMs = Math.max(0, now.getTime() - new Date(timestamp).getTime());
  if (ageMs < 60_000) return 'just now';
  if (ageMs < 60 * 60_000) return `${Math.floor(ageMs / 60_000)}m ago`;
  if (ageMs < DAY_MS) return `${Math.floor(ageMs / (60 * 60_000))}h ago`;
  return `${Math.floor(ageMs / DAY_MS)}d ago`;
}

export function getExpectedEgxSessionDate(now = new Date()): string {
  const current = egxCairoSessionClock(now);
  if (current.isTradingWeekday && current.minuteOfDay >= INTRADAY_POLICY.sessionStartMinutes) {
    return current.dateKey;
  }

  for (let daysBack = 1; daysBack <= 7; daysBack += 1) {
    const candidate = egxCairoSessionClock(new Date(now.getTime() - daysBack * DAY_MS));
    if (candidate.isTradingWeekday) return candidate.dateKey;
  }

  return current.dateKey;
}

export function buildDataHealthSnapshot(
  heldTickersInput: string[],
  rows: DataHealthSourceRows,
  now = new Date(),
  buildCommit = String((import.meta as any).env?.VITE_BUILD_COMMIT || 'unknown'),
): DataHealthSnapshot {
  const heldTickers = [...new Set(heldTickersInput.map(normalizeTicker).filter(Boolean))].sort();
  const heldSet = new Set(heldTickers);
  const expectedSessionDate = getExpectedEgxSessionDate(now);
  const schedule = egxCairoSessionClock(now);

  const quoteMap = new Map(
    rows.quotes
      .map((row) => [normalizeTicker(row.ticker), row] as const)
      .filter(([ticker]) => heldSet.has(ticker)),
  );
  const rawMap = new Map(
    rows.raw1m
      .map((row) => [normalizeTicker(row.ticker), row] as const)
      .filter(([ticker]) => heldSet.has(ticker)),
  );
  const derivedMap = new Map(
    rows.derived5m
      .map((row) => [normalizeTicker(row.ticker), row] as const)
      .filter(([ticker]) => heldSet.has(ticker)),
  );
  const dailyMap = new Map(
    rows.daily
      .map((row) => [normalizeTicker(row.ticker), row] as const)
      .filter(([ticker]) => heldSet.has(ticker)),
  );
  const registryMap = new Map(
    rows.registry
      .map((row) => [normalizeTicker(row.ticker), row] as const)
      .filter(([ticker]) => heldSet.has(ticker)),
  );

  const selectedSessionTimestamp = latestIso(
    heldTickers.map((ticker) => rawMap.get(ticker)?.bar_timestamp),
  );
  const selectedSessionDate = selectedSessionTimestamp
    ? cairoDateKey(selectedSessionTimestamp)
    : null;

  const quoteFreshnessMs = schedule.isRegularSession ? 20 * 60_000 : DAY_MS;
  const healthyQuotes = heldTickers.filter((ticker) => {
    const row = quoteMap.get(ticker);
    const price = Number(row?.last_price ?? 0);
    const updatedAt = row?.price_updated_at ?? null;
    if (!(price > 0) || !updatedAt) return false;
    const updatedMs = new Date(updatedAt).getTime();
    return Number.isFinite(updatedMs) && now.getTime() - updatedMs <= quoteFreshnessMs;
  });
  const quoteMissing = heldTickers.filter((ticker) => !healthyQuotes.includes(ticker));
  const latestQuoteAt = latestIso(heldTickers.map((ticker) => quoteMap.get(ticker)?.price_updated_at));

  const selectedSessionCurrent = selectedSessionDate === expectedSessionDate;
  const rawCovered = heldTickers.filter((ticker) => {
    const row = rawMap.get(ticker);
    return Boolean(row && selectedSessionDate && cairoDateKey(row.bar_timestamp) === selectedSessionDate);
  });
  const rawMissing = heldTickers.filter((ticker) => !rawCovered.includes(ticker));
  const latestRawAt = latestIso(rawCovered.map((ticker) => rawMap.get(ticker)?.bar_timestamp));

  const derivedComplete = rawCovered.filter((ticker) => {
    const raw = rawMap.get(ticker);
    const derived = derivedMap.get(ticker);
    if (!raw || !derived || !selectedSessionDate) return false;
    if (cairoDateKey(derived.bar_timestamp) !== selectedSessionDate) return false;
    return new Date(derived.bar_timestamp).getTime() >= floorToFiveMinutes(raw.bar_timestamp);
  });
  const derivedMissing = heldTickers.filter((ticker) => !derivedComplete.includes(ticker));

  const newestDailyDate = latestDate(heldTickers.map((ticker) => dailyMap.get(ticker)?.trading_date));
  const dailyCovered = heldTickers.filter(
    (ticker) => Boolean(newestDailyDate && dailyMap.get(ticker)?.trading_date === newestDailyDate),
  );
  const dailyMissing = heldTickers.filter((ticker) => !dailyCovered.includes(ticker));
  const dailyShouldHaveAdvanced =
    schedule.isTradingWeekday &&
    schedule.minuteOfDay > INTRADAY_POLICY.scheduledIngestionEndMinutes;
  const dailySessionStale =
    dailyShouldHaveAdvanced &&
    newestDailyDate !== expectedSessionDate;

  const resolvedTickers = heldTickers.filter((ticker) => {
    const row = registryMap.get(ticker);
    if (!row) return false;
    const status = String(row.status ?? '').toLowerCase();
    return (
      status !== 'inactive' &&
      status !== 'retired' &&
      Boolean(row.scanner_symbol) &&
      Boolean(row.history_symbol) &&
      !row.verification_error
    );
  });
  const unresolvedTickers = heldTickers.filter((ticker) => !resolvedTickers.includes(ticker));

  const portfolioUpdatedAt = rows.portfolio?.updated_at ?? null;
  const lastPriceWriteAt = rows.portfolio?.last_price_write_at ?? null;
  const latestIngestionAt = latestIso(rawCovered.map((ticker) => rawMap.get(ticker)?.retrieved_at));

  const total = heldTickers.length;
  const nothingHeld = total === 0;
  const items: DataHealthItem[] = [
    {
      id: 'live_quotes',
      label: 'Live quotes',
      status: nothingHeld
        ? 'unknown'
        : healthyQuotes.length === total
          ? 'healthy'
          : healthyQuotes.length > 0
            ? 'warning'
            : 'error',
      value: nothingHeld ? 'No open holdings' : `${healthyQuotes.length} / ${total} healthy`,
      detail: latestQuoteAt
        ? `Newest quote write ${ageLabel(latestQuoteAt, now)}.`
        : 'No persisted held-ticker quote timestamp is available.',
      affectedTickers: quoteMissing,
      timestamp: latestQuoteAt ?? undefined,
    },
    {
      id: 'selected_session',
      label: 'Selected EGX session',
      status: !selectedSessionDate
        ? 'error'
        : selectedSessionCurrent
          ? 'healthy'
          : 'warning',
      value: selectedSessionDate ?? 'Unavailable',
      detail: selectedSessionCurrent
        ? `Matches expected session ${expectedSessionDate}.`
        : `Expected ${expectedSessionDate}; latest raw 1m session is ${selectedSessionDate ?? 'missing'}.`,
    },
    {
      id: 'raw_1m',
      label: 'Raw 1m',
      status: nothingHeld
        ? 'unknown'
        : rawCovered.length === total && selectedSessionCurrent
          ? 'healthy'
          : rawCovered.length > 0
            ? 'warning'
            : 'error',
      value: nothingHeld
        ? 'No open holdings'
        : `${rawCovered.length} / ${total} covered`,
      detail: latestRawAt
        ? `Latest raw bar ${latestRawAt}.`
        : 'No raw 1m held-ticker bars are available.',
      affectedTickers: rawMissing,
      timestamp: latestRawAt ?? undefined,
    },
    {
      id: 'derived_5m',
      label: 'Derived 5m',
      status: nothingHeld
        ? 'unknown'
        : rawCovered.length === 0
          ? 'error'
          : derivedComplete.length === total && selectedSessionCurrent
            ? 'healthy'
            : derivedComplete.length > 0
              ? 'warning'
              : 'error',
      value: nothingHeld
        ? 'No open holdings'
        : `${derivedComplete.length} / ${total} aligned`,
      detail: 'Each held ticker must have a 5m tail at or beyond the latest raw 1m five-minute bucket.',
      affectedTickers: derivedMissing,
    },
    {
      id: 'daily_history',
      label: 'Daily history',
      status: nothingHeld
        ? 'unknown'
        : dailyCovered.length === total && !dailySessionStale
          ? 'healthy'
          : dailyCovered.length > 0
            ? 'warning'
            : 'error',
      value: newestDailyDate
        ? `${dailyCovered.length} / ${total} through ${newestDailyDate}`
        : 'Unavailable',
      detail: dailySessionStale
        ? `Post-grace daily history has not advanced to expected session ${expectedSessionDate}.`
        : 'Latest daily-history date is consistent across the held universe.',
      affectedTickers: dailyMissing,
    },
    {
      id: 'ticker_resolution',
      label: 'Ticker resolution',
      status: nothingHeld
        ? 'unknown'
        : resolvedTickers.length === total
          ? 'healthy'
          : resolvedTickers.length > 0
            ? 'warning'
            : 'error',
      value: nothingHeld
        ? 'No open holdings'
        : `${resolvedTickers.length} / ${total} resolved`,
      detail: 'Requires active registry identity plus scanner and historical symbols with no verification error.',
      affectedTickers: unresolvedTickers,
    },
    {
      id: 'portfolio_sync',
      label: 'Portfolio sync',
      status: portfolioUpdatedAt ? 'healthy' : 'error',
      value: portfolioUpdatedAt ? `Supabase • ${ageLabel(portfolioUpdatedAt, now)}` : 'Unavailable',
      detail: lastPriceWriteAt
        ? `Last price persistence ${ageLabel(lastPriceWriteAt, now)}.`
        : 'No persisted portfolio price-write timestamp is available.',
      timestamp: portfolioUpdatedAt ?? undefined,
    },
    {
      id: 'last_ingestion',
      label: 'Last ingestion',
      status: !latestIngestionAt
        ? 'error'
        : selectedSessionCurrent && rawCovered.length === total
          ? 'healthy'
          : 'warning',
      value: latestIngestionAt ? `${ageLabel(latestIngestionAt, now)}` : 'Unavailable',
      detail: !latestIngestionAt
        ? 'No held-ticker raw 1m ingestion timestamp is available.'
        : selectedSessionCurrent
          ? 'Latest raw 1m ingestion covers the expected session.'
          : `Latest ingestion belongs to stale session ${selectedSessionDate ?? 'unknown'}; expected ${expectedSessionDate}.`,
      affectedTickers: rawMissing,
      timestamp: latestIngestionAt ?? undefined,
    },
    {
      id: 'app_build',
      label: 'App build',
      status: buildCommit && buildCommit !== 'unknown' ? 'healthy' : 'unknown',
      value: buildCommit && buildCommit !== 'unknown' ? buildCommit.slice(0, 8) : 'unknown',
      detail: 'Build-time Git commit embedded into the Vite bundle.',
    },
  ];

  return {
    checkedAt: now.toISOString(),
    expectedSessionDate,
    selectedSessionDate,
    overallStatus: combineStatus(items),
    items,
  };
}

async function latestIntradayForTicker(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  ticker: string,
  intervalMinutes: number,
) {
  const { data, error } = await supabase
    .from('intraday_price_history')
    .select('ticker,bar_timestamp,retrieved_at')
    .eq('ticker', ticker)
    .eq('interval_minutes', intervalMinutes)
    .order('bar_timestamp', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

async function latestDailyForTicker(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  ticker: string,
) {
  const { data, error } = await supabase
    .from('price_history')
    .select('ticker,trading_date,retrieved_at')
    .eq('ticker', ticker)
    .order('trading_date', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function loadDataHealthSnapshot(
  heldTickersInput: string[],
  now = new Date(),
): Promise<DataHealthSnapshot> {
  const heldTickers = [...new Set(heldTickersInput.map(normalizeTicker).filter(Boolean))].sort();
  const supabase = getSupabaseBrowserClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('No authenticated Supabase user.');

  const portfolioPromise = supabase
    .from('portfolios')
    .select('updated_at,last_price_write_at')
    .eq('owner_key', userData.user.id)
    .maybeSingle();

  const quotesPromise = heldTickers.length
    ? supabase
        .from('tickers')
        .select('ticker,last_price,price_updated_at')
        .in('ticker', heldTickers)
    : Promise.resolve({ data: [], error: null });

  const registryPromise = heldTickers.length
    ? supabase
        .from('ticker_registry')
        .select('ticker,status,scanner_symbol,history_symbol,verification_error')
        .in('ticker', heldTickers)
    : Promise.resolve({ data: [], error: null });

  const [portfolioResult, quoteResult, registryResult, perTicker] = await Promise.all([
    portfolioPromise,
    quotesPromise,
    registryPromise,
    Promise.all(
      heldTickers.map(async (ticker) => {
        const [raw1m, derived5m, daily] = await Promise.all([
          latestIntradayForTicker(supabase, ticker, 1),
          latestIntradayForTicker(supabase, ticker, 5),
          latestDailyForTicker(supabase, ticker),
        ]);
        return { raw1m, derived5m, daily };
      }),
    ),
  ]);

  if (portfolioResult.error) throw portfolioResult.error;
  if (quoteResult.error) throw quoteResult.error;
  if (registryResult.error) throw registryResult.error;

  return buildDataHealthSnapshot(
    heldTickers,
    {
      portfolio: portfolioResult.data,
      quotes: quoteResult.data ?? [],
      registry: registryResult.data ?? [],
      raw1m: perTicker.flatMap((row) => (row.raw1m ? [row.raw1m] : [])),
      derived5m: perTicker.flatMap((row) => (row.derived5m ? [row.derived5m] : [])),
      daily: perTicker.flatMap((row) => (row.daily ? [row.daily] : [])),
    },
    now,
  );
}
