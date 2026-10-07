import { describe, expect, it, vi } from 'vitest';
import { cairoSessionUtcBounds, loadTodayIntraday } from './todayIntraday';
import type { IntradayPriceSeries } from './intradayPriceStore';
const bars = (date: string, intervalMinutes = 1): IntradayPriceSeries => ({ TEST: [{
  timestamp: `${date}T07:00:00Z`, intervalMinutes, open: 10, high: 10, low: 10, close: 10,
}] });

describe('Today reader', () => {
  it('queries the Cairo calendar day during DST instead of the UTC calendar day', () => {
    expect(cairoSessionUtcBounds('2026-10-06')).toEqual({
      startTimestamp: '2026-10-05T21:00:00.000Z',
      endTimestamp: '2026-10-06T20:59:59.999Z',
    });
  });
  it('queries the Cairo calendar day after DST ends', () => {
    expect(cairoSessionUtcBounds('2026-11-01')).toEqual({
      startTimestamp: '2026-10-31T22:00:00.000Z',
      endTimestamp: '2026-11-01T21:59:59.999Z',
    });
  });
  it('uses Cairo session bounds when loading the retained previous session after midnight', async () => {
    const read = vi.fn(async (_t, _s, _e, interval) => bars('2026-10-06', interval));
    const result = await loadTodayIntraday(['TEST'], '2026-10-06', 'AUTO', read);
    expect(result?.sessionDate).toBe('2026-10-06');
    expect(read).toHaveBeenCalledWith(
      ['TEST'],
      '2026-10-05T21:00:00.000Z',
      '2026-10-06T20:59:59.999Z',
      1,
    );
  });
  it('never shows Thursday candles for missing Sunday ingestion, including manual 1m', async () => {
    for (const resolution of ['AUTO', 1, 5, 15, 60] as const) {
      const read = vi.fn(async () => bars('2026-09-24'));
      expect(await loadTodayIntraday(['TEST'], '2026-09-27', resolution, read)).toBeNull();
      expect(read.mock.calls.length).toBe(
        resolution === 'AUTO' || (typeof resolution === 'number' && resolution >= 15) ? 3 : 1,
      );
    }
  });
  it('retains 1m after close when the requested session has 1m', async () => {
    const result = await loadTodayIntraday(['TEST'], '2026-09-27', 'AUTO', async (_t, _s, _e, interval) => bars('2026-09-27', interval));
    expect(result?.intervalMinutes).toBe(1);
  });
  it('uses a healthy same-session fallback when a resolution request fails', async () => {
    const result = await loadTodayIntraday(['TEST'], '2026-09-27', 'AUTO', async (_t, _s, _e, interval) => {
      if (interval === 1) throw new Error('network');
      return bars('2026-09-27', interval);
    });
    expect(result?.intervalMinutes).toBe(5);
  });
  it.each([15, 60] as const)('derives manual %im from the finest healthy same-session source', async (resolution) => {
    const read = vi.fn(async (_t, _s, _e, interval) => bars('2026-09-27', interval));
    const result = await loadTodayIntraday(['TEST'], '2026-09-27', resolution, read);

    expect(read).toHaveBeenCalledTimes(3);
    expect(result?.intervalMinutes).toBe(resolution);
    expect(result?.series.TEST).toHaveLength(1);
    expect(result?.series.TEST[0].intervalMinutes).toBe(resolution);
    expect(result?.series.TEST[0].source).toBe('derived-1m');
  });

  it('falls back to 5m as the source for a derived coarse resolution when 1m fails', async () => {
    const result = await loadTodayIntraday(['TEST'], '2026-09-27', 15, async (_t, _s, _e, interval) => {
      if (interval === 1) throw new Error('network');
      return bars('2026-09-27', interval);
    });

    expect(result?.intervalMinutes).toBe(15);
    expect(result?.series.TEST[0].intervalMinutes).toBe(15);
  });

  it('surfaces a failed manual fine-resolution request instead of silently switching resolution', async () => {
    await expect(loadTodayIntraday(['TEST'], '2026-09-27', 1, async () => { throw new Error('network'); })).rejects.toThrow('network');
  });
});
