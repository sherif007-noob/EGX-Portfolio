import { getIntradayPrices, type IntradayPriceSeries } from './intradayPriceStore';
import { aggregateIntradayBars } from './intradayAggregation';
import { INTRADAY_POLICY } from './intradayPolicy';
import { selectBestIntradayResolution } from './intradayResolution';

export function cairoSessionUtcBounds(sessionDate: string): {
  startTimestamp: string;
  endTimestamp: string;
} {
  const dateKey = sessionDate.slice(0, 10);
  const middayUtc = new Date(`${dateKey}T12:00:00.000Z`);
  if (Number.isNaN(middayUtc.getTime())) throw new Error('A valid EGX session date is required.');

  // Determine Cairo's UTC offset for this calendar date with Intl so DST is
  // respected. Using local midnight converted to UTC keeps a Cairo session
  // date from being queried as an arbitrary UTC calendar day.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: INTRADAY_POLICY.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(middayUtc);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const asUtc = Date.UTC(
    Number(read('year')),
    Number(read('month')) - 1,
    Number(read('day')),
    Number(read('hour')),
    Number(read('minute')),
    Number(read('second')),
  );
  const offsetMs = asUtc - middayUtc.getTime();
  const localMidnightAsUtc = Date.parse(`${dateKey}T00:00:00.000Z`);
  const startMs = localMidnightAsUtc - offsetMs;

  // Query the complete Cairo calendar day. The resolution/session selector
  // still enforces that only bars whose Cairo date equals sessionDate count.
  return {
    startTimestamp: new Date(startMs).toISOString(),
    endTimestamp: new Date(startMs + 86_400_000 - 1).toISOString(),
  };
}

export async function loadTodayIntraday(
  tickers: string[], sessionDate: string, resolution: 'AUTO' | number,
  load = getIntradayPrices,
) {
  // 15m and 1h are display resolutions, not authoritative storage contracts.
  // Build them from the finest healthy same-session source (1m -> 5m -> legacy
  // 15m) so missing persisted coarse candles never produce an empty chart.
  const intervals = resolution === 'AUTO' || (typeof resolution === 'number' && resolution >= 15)
    ? [...INTRADAY_POLICY.readIntervals]
    : [resolution];
  const { startTimestamp, endTimestamp } = cairoSessionUtcBounds(sessionDate);
  const results = await Promise.allSettled(intervals.map(async intervalMinutes => ({
    intervalMinutes,
    series: await load(tickers, startTimestamp, endTimestamp, intervalMinutes),
  })));
  const candidates = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  const selected = selectBestIntradayResolution(candidates, tickers, sessionDate);
  // One failed resolution must not hide a healthy fallback. If nothing is
  // usable, surface the failure instead of calling it an empty market day.
  if (!selected) {
    const failure = results.find(result => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
    return null;
  }

  if (typeof resolution === 'number' && resolution >= 15 && selected.intervalMinutes < resolution) {
    const aggregated: IntradayPriceSeries = Object.fromEntries(
      Object.entries(selected.series).map(([ticker, bars]) => [
        ticker,
        aggregateIntradayBars(bars, resolution),
      ]),
    );

    return {
      ...selected,
      intervalMinutes: resolution,
      series: aggregated,
    };
  }

  return selected;
}
