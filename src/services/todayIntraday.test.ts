import { describe, expect, it, vi } from 'vitest';
import { loadTodayIntraday } from './todayIntraday';
import type { IntradayPriceSeries } from './intradayPriceStore';
const bars = (date: string, intervalMinutes = 1): IntradayPriceSeries => ({ TEST: [{
  timestamp: `${date}T07:00:00Z`, intervalMinutes, open: 10, high: 10, low: 10, close: 10,
}] });

describe('Today reader', () => {
  it('never shows Thursday candles for missing Sunday ingestion, including manual 1m', async () => {
    for (const resolution of ['AUTO', 1, 5, 15, 60] as const) {
      const read = vi.fn(async () => bars('2026-09-24'));
      expect(await loadTodayIntraday(['TEST'], '2026-09-27', resolution, read)).toBeNull();
      expect(read.mock.calls.length).toBe(resolution === 'AUTO' || resolution === 60 ? 3 : 1);
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
  it('surfaces a failed manual request instead of silently switching resolution', async () => {
    await expect(loadTodayIntraday(['TEST'], '2026-09-27', 1, async () => { throw new Error('network'); })).rejects.toThrow('network');
  });
});
