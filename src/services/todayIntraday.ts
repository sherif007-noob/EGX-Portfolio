import { getIntradayPrices } from './intradayPriceStore';
import { INTRADAY_POLICY } from './intradayPolicy';
import { selectBestIntradayResolution } from './intradayResolution';

export async function loadTodayIntraday(
  tickers: string[], sessionDate: string, resolution: 'AUTO' | number,
  load = getIntradayPrices,
) {
  const intervals = resolution === 'AUTO' || resolution === 60
    ? [...INTRADAY_POLICY.readIntervals] : [resolution];
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
  }
  return selected;
}
