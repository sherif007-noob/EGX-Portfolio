import { getIntradayPrices, type IntradayPriceSeries } from './intradayPriceStore';
import { aggregateIntradayBars } from './intradayAggregation';
import { INTRADAY_POLICY } from './intradayPolicy';
import { selectBestIntradayResolution } from './intradayResolution';

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
  const results = await Promise.allSettled(intervals.map(async intervalMinutes => ({
    intervalMinutes,
    series: await load(tickers, `${sessionDate}T00:00:00.000Z`, `${sessionDate}T23:59:59.999Z`, intervalMinutes),
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
