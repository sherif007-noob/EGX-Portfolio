import { describe, expect, it } from 'vitest';
import {
  cairoDateKey,
  latestIntradaySessionDate,
  normalizeIntradayTicker,
  rowsToIntradayPriceSeries,
} from './intradayPriceStore';

describe('intraday price store', () => {
  it('normalizes EGX ticker variants', () => {
    expect(normalizeIntradayTicker('egx:oras')).toBe('ORAS');
    expect(normalizeIntradayTicker('oras.ca')).toBe('ORAS');
  });

  it('groups and sorts 15-minute rows by ticker and timestamp', () => {
    const result = rowsToIntradayPriceSeries(['ORAS'], [
      {
        ticker: 'ORAS',
        interval_minutes: 15,
        bar_timestamp: '2026-09-17T10:15:00.000Z',
        open: 850,
        high: 860,
        low: 849,
        close: 858,
        volume: 200,
        source: 'tradingview',
      },
      {
        ticker: 'ORAS',
        interval_minutes: 15,
        bar_timestamp: '2026-09-17T10:00:00.000Z',
        open: 845,
        high: 852,
        low: 842,
        close: 850,
        volume: 100,
        source: 'tradingview',
      },
    ]);

    expect(result.ORAS).toHaveLength(2);
    expect(result.ORAS[0].timestamp).toBe('2026-09-17T10:00:00.000Z');
    expect(result.ORAS[1].close).toBe(858);
  });

  it('keeps UTC storage timestamps while deriving the Cairo trading date', () => {
    // Egypt is UTC+3 in September, so 21:30 UTC belongs to the next Cairo date.
    expect(cairoDateKey('2026-09-17T21:30:00.000Z')).toBe('2026-09-18');
  });

  it('resolves the latest actual market session from stored bars', () => {
    const series = {
      ORAS: [
        { timestamp: '2026-09-16T07:00:00.000Z', intervalMinutes: 15, open: 800, high: 810, low: 795, close: 808 },
        { timestamp: '2026-09-17T07:00:00.000Z', intervalMinutes: 15, open: 820, high: 830, low: 818, close: 829 },
      ],
      TALM: [
        { timestamp: '2026-09-17T08:00:00.000Z', intervalMinutes: 15, open: 24, high: 25, low: 24, close: 24.8 },
      ],
    };

    expect(latestIntradaySessionDate(series, '2026-09-18')).toBe('2026-09-17');
    expect(latestIntradaySessionDate(series, '2026-09-16')).toBe('2026-09-16');
    expect(latestIntradaySessionDate({}, '2026-09-18')).toBeNull();
  });

  it('ignores malformed market rows rather than fabricating prices', () => {
    const result = rowsToIntradayPriceSeries(['ORAS'], [
      {
        ticker: 'ORAS',
        interval_minutes: 15,
        bar_timestamp: 'not-a-date',
        open: 850,
        high: 860,
        low: 849,
        close: 858,
      },
      {
        ticker: 'ORAS',
        interval_minutes: 15,
        bar_timestamp: '2026-09-17T10:00:00.000Z',
        open: 850,
        high: 860,
        low: 849,
        close: 0,
      },
    ]);

    expect(result.ORAS).toEqual([]);
  });
});
