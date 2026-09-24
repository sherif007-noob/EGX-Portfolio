import type { IntradayPricePoint } from './intradayPriceStore';

function floorBucketStart(timestamp: string, bucketMinutes: number): number {
  const ms = new Date(timestamp).getTime();
  if (!Number.isFinite(ms)) return Number.NaN;
  const bucketMs = bucketMinutes * 60_000;
  return Math.floor(ms / bucketMs) * bucketMs;
}

export function mergeIntradayBarsByTimestamp(
  baseBars: IntradayPricePoint[],
  preferredBars: IntradayPricePoint[],
): IntradayPricePoint[] {
  const byTimestamp = new Map<string, IntradayPricePoint>();

  const apply = (bars: IntradayPricePoint[]) => {
    for (const bar of bars) {
      const ms = new Date(bar.timestamp).getTime();
      if (!Number.isFinite(ms)) continue;
      byTimestamp.set(String(ms), bar);
    }
  };

  apply(baseBars);
  apply(preferredBars);

  return [...byTimestamp.values()].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

export function aggregateIntradayBars(
  bars: IntradayPricePoint[],
  targetIntervalMinutes: number,
): IntradayPricePoint[] {
  if (!Number.isFinite(targetIntervalMinutes) || targetIntervalMinutes <= 0) {
    throw new Error('targetIntervalMinutes must be a positive number.');
  }

  const buckets = new Map<number, IntradayPricePoint[]>();
  for (const bar of bars) {
    const sourceInterval = Number(bar.intervalMinutes);
    if (!Number.isFinite(sourceInterval) || sourceInterval <= 0 || targetIntervalMinutes < sourceInterval) {
      continue;
    }
    const bucketStart = floorBucketStart(bar.timestamp, targetIntervalMinutes);
    if (!Number.isFinite(bucketStart)) continue;
    const list = buckets.get(bucketStart) ?? [];
    list.push(bar);
    buckets.set(bucketStart, list);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bucketStart, bucketBars]) => {
      const sorted = [...bucketBars].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const volumeValues = sorted
        .map((bar) => bar.volume)
        .filter((value): value is number => Number.isFinite(value));

      return {
        timestamp: new Date(bucketStart).toISOString(),
        intervalMinutes: targetIntervalMinutes,
        open: first.open,
        high: Math.max(...sorted.map((bar) => bar.high)),
        low: Math.min(...sorted.map((bar) => bar.low)),
        close: last.close,
        volume: volumeValues.length ? volumeValues.reduce((sum, value) => sum + value, 0) : undefined,
        source: 'derived-1m' as const,
        retrievedAt: last.retrievedAt,
      };
    });
}
