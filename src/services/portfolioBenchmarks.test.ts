import { describe, expect, it } from 'vitest';
import {
  benchmarkRelativeReturn,
  buildDailyBenchmarkComparison,
  buildIntradayBenchmarkComparison,
} from './portfolioBenchmarks';

describe('portfolio benchmark comparison', () => {
  it('normalizes daily portfolio and benchmark paths from the selected-period start', () => {
    const rows = buildDailyBenchmarkComparison(
      [
        { date: '2026-10-01', twrPercent: 0 },
        { date: '2026-10-02', twrPercent: 2 },
        { date: '2026-10-05', twrPercent: 4 },
      ],
      {
        EGX30: [
          { date: '2026-09-30', close: 100 },
          { date: '2026-10-01', close: 101 },
          { date: '2026-10-02', close: 103 },
          { date: '2026-10-05', close: 102 },
        ],
      },
    );

    expect(rows[0].EGX30).toBeCloseTo(1);
    expect(rows[1].EGX30).toBeCloseTo(3);
    expect(rows[2].EGX30).toBeCloseTo(2);
    expect(benchmarkRelativeReturn(rows[2], 'EGX30')).toBeCloseTo(2);
  });

  it('uses no look-ahead when aligning intraday benchmark observations', () => {
    const rows = buildIntradayBenchmarkComparison(
      [
        { date: '2026-10-07T08:00:00.000Z', twrPercent: 0 },
        { date: '2026-10-07T08:06:00.000Z', twrPercent: 1.5 },
      ],
      {
        EGX70EWI: [
          { timestamp: '2026-10-07T08:00:00.000Z', intervalMinutes: 5, open: 200, high: 200, low: 200, close: 200 },
          { timestamp: '2026-10-07T08:05:00.000Z', intervalMinutes: 5, open: 202, high: 202, low: 202, close: 202 },
          { timestamp: '2026-10-07T08:10:00.000Z', intervalMinutes: 5, open: 210, high: 210, low: 210, close: 210 },
        ],
      },
    );

    expect(rows[0].EGX70EWI).toBeCloseTo(0);
    expect(rows[1].EGX70EWI).toBeCloseTo(1);
    expect(benchmarkRelativeReturn(rows[1], 'EGX70EWI')).toBeCloseTo(0.5);
  });
});
