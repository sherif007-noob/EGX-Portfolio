import { describe, expect, it } from 'vitest';
import { aggregateIntradayBars } from './intradayAggregation';
import type { IntradayPricePoint } from './intradayPriceStore';

function bar(minute: number, values: Partial<IntradayPricePoint> = {}): IntradayPricePoint {
  return {
    timestamp: `2026-09-24T07:${String(minute).padStart(2, '0')}:00.000Z`,
    intervalMinutes: 1,
    open: 10,
    high: 10,
    low: 10,
    close: 10,
    volume: 100,
    source: 'tradingview',
    ...values,
  };
}

describe('intraday aggregation', () => {
  it('derives deterministic 5-minute OHLCV from 1-minute bars', () => {
    const result = aggregateIntradayBars([
      bar(0, { open: 10, high: 11, low: 9.5, close: 10.5, volume: 100 }),
      bar(1, { open: 10.5, high: 12, low: 10, close: 11.5, volume: 200 }),
      bar(4, { open: 11.5, high: 11.8, low: 10.8, close: 11, volume: 50 }),
    ], 5);

    expect(result).toEqual([
      expect.objectContaining({
        timestamp: '2026-09-24T07:00:00.000Z',
        intervalMinutes: 5,
        open: 10,
        high: 12,
        low: 9.5,
        close: 11,
        volume: 350,
        source: 'derived-1m',
      }),
    ]);
  });

  it('does not synthesize missing minutes inside an illiquid bucket', () => {
    const result = aggregateIntradayBars([
      bar(1, { open: 20, high: 21, low: 20, close: 20.5, volume: 10 }),
      bar(4, { open: 20.5, high: 22, low: 20.5, close: 21.5, volume: 15 }),
    ], 5);

    expect(result).toHaveLength(1);
    expect(result[0].open).toBe(20);
    expect(result[0].close).toBe(21.5);
    expect(result[0].volume).toBe(25);
  });

  it('skips bars whose source interval is coarser than the target interval', () => {
    const result = aggregateIntradayBars([
      { ...bar(0), intervalMinutes: 15 },
    ], 5);
    expect(result).toEqual([]);
  });
});
