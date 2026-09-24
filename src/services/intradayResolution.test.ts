import { describe, expect, it } from 'vitest';
import type { IntradayPriceSeries } from './intradayPriceStore';
import {
  selectBestIntradayResolution,
  sessionCoveredTickers,
} from './intradayResolution';

function series(entries: Array<[string, string]>): IntradayPriceSeries {
  const result: IntradayPriceSeries = {};
  for (const [ticker, timestamp] of entries) {
    result[ticker] = [
      {
        timestamp,
        intervalMinutes: 1,
        open: 10,
        high: 10,
        low: 10,
        close: 10,
        source: 'tradingview',
      },
    ];
  }
  return result;
}

describe('intraday resolution selection', () => {
  it('does not let partial 1m coverage replace a broader 5m session', () => {
    const selected = selectBestIntradayResolution(
      [
        {
          intervalMinutes: 1,
          series: series([['ACTF', '2026-09-24T09:30:00.000Z']]),
        },
        {
          intervalMinutes: 5,
          series: series([
            ['ACTF', '2026-09-24T09:30:00.000Z'],
            ['ETEL', '2026-09-24T09:30:00.000Z'],
            ['MASR', '2026-09-24T09:30:00.000Z'],
          ]),
        },
        {
          intervalMinutes: 15,
          series: series([
            ['ACTF', '2026-09-24T09:30:00.000Z'],
            ['ETEL', '2026-09-24T09:30:00.000Z'],
            ['MASR', '2026-09-24T09:30:00.000Z'],
          ]),
        },
      ],
      ['ACTF', 'ETEL', 'MASR'],
      '2026-09-24',
    );

    expect(selected?.intervalMinutes).toBe(5);
    expect(selected?.coveredTickers).toEqual(['ACTF', 'ETEL', 'MASR']);
  });

  it('prefers 1m once it matches the available session ticker breadth', () => {
    const full = series([
      ['ACTF', '2026-09-24T09:30:00.000Z'],
      ['ETEL', '2026-09-24T09:30:00.000Z'],
    ]);

    const selected = selectBestIntradayResolution(
      [
        { intervalMinutes: 1, series: full },
        { intervalMinutes: 5, series: full },
      ],
      ['ACTF', 'ETEL'],
      '2026-09-24',
    );

    expect(selected?.intervalMinutes).toBe(1);
  });

  it('does not require a ticker that has no intraday bar at any available resolution', () => {
    const selected = selectBestIntradayResolution(
      [
        {
          intervalMinutes: 1,
          series: series([['ACTF', '2026-09-24T09:30:00.000Z']]),
        },
        {
          intervalMinutes: 5,
          series: series([['ACTF', '2026-09-24T09:30:00.000Z']]),
        },
      ],
      ['ACTF', 'ILLIQ'],
      '2026-09-24',
    );

    expect(selected?.intervalMinutes).toBe(1);
    expect(selected?.referenceTickers).toEqual(['ACTF']);
  });

  it('uses the latest session not after the requested date', () => {
    const selected = selectBestIntradayResolution(
      [
        {
          intervalMinutes: 1,
          series: series([['ACTF', '2026-09-23T09:30:00.000Z']]),
        },
        {
          intervalMinutes: 5,
          series: series([['ACTF', '2026-09-22T09:30:00.000Z']]),
        },
      ],
      ['ACTF'],
      '2026-09-24',
    );

    expect(selected?.intervalMinutes).toBe(1);
    expect(selected?.sessionDate).toBe('2026-09-23');
  });

  it('reports covered tickers using Cairo session dates', () => {
    expect(
      sessionCoveredTickers(
        series([
          ['ACTF', '2026-09-23T22:30:00.000Z'],
          ['ETEL', '2026-09-23T19:30:00.000Z'],
        ]),
        '2026-09-24',
        ['ACTF', 'ETEL'],
      ),
    ).toEqual(['ACTF']);
  });

  it('rejects a tiny 1m sample even when it contains every session ticker', () => {
    const partial1m: IntradayPriceSeries = {
      ACTF: [{ timestamp: '2026-09-24T10:30:00.000Z', intervalMinutes: 1, open: 10, high: 10, low: 10, close: 10 }],
      ETEL: [{ timestamp: '2026-09-24T10:30:00.000Z', intervalMinutes: 1, open: 20, high: 20, low: 20, close: 20 }],
    };
    const healthy5m: IntradayPriceSeries = {
      ACTF: [
        { timestamp: '2026-09-24T07:00:00.000Z', intervalMinutes: 5, open: 10, high: 10, low: 10, close: 10 },
        { timestamp: '2026-09-24T10:25:00.000Z', intervalMinutes: 5, open: 10, high: 10, low: 10, close: 10 },
      ],
      ETEL: [
        { timestamp: '2026-09-24T07:00:00.000Z', intervalMinutes: 5, open: 20, high: 20, low: 20, close: 20 },
        { timestamp: '2026-09-24T10:25:00.000Z', intervalMinutes: 5, open: 20, high: 20, low: 20, close: 20 },
      ],
    };

    const selected = selectBestIntradayResolution(
      [
        { intervalMinutes: 1, series: partial1m },
        { intervalMinutes: 5, series: healthy5m },
      ],
      ['ACTF', 'ETEL'],
      '2026-09-24',
    );

    expect(selected?.intervalMinutes).toBe(5);
  });

  it('still prefers sparse 1m observations when their session envelope matches 5m', () => {
    const sparse1m: IntradayPriceSeries = {
      ILLIQ: [
        { timestamp: '2026-09-24T07:01:00.000Z', intervalMinutes: 1, open: 10, high: 10, low: 10, close: 10 },
        { timestamp: '2026-09-24T10:29:00.000Z', intervalMinutes: 1, open: 11, high: 11, low: 11, close: 11 },
      ],
    };
    const coarse5m: IntradayPriceSeries = {
      ILLIQ: [
        { timestamp: '2026-09-24T07:00:00.000Z', intervalMinutes: 5, open: 10, high: 10, low: 10, close: 10 },
        { timestamp: '2026-09-24T10:25:00.000Z', intervalMinutes: 5, open: 11, high: 11, low: 11, close: 11 },
      ],
    };

    const selected = selectBestIntradayResolution(
      [
        { intervalMinutes: 1, series: sparse1m },
        { intervalMinutes: 5, series: coarse5m },
      ],
      ['ILLIQ'],
      '2026-09-24',
    );

    expect(selected?.intervalMinutes).toBe(1);
  });


  it('keeps the latest completed EGX session after midnight when the new calendar day has no bars', () => {
    const selected = selectBestIntradayResolution(
      [
        {
          intervalMinutes: 1,
          series: series([['ACTF', '2026-09-24T11:25:00.000Z']]),
        },
        {
          intervalMinutes: 5,
          series: series([['ACTF', '2026-09-24T11:25:00.000Z']]),
        },
      ],
      ['ACTF'],
      '2026-09-25',
    );

    expect(selected?.sessionDate).toBe('2026-09-24');
    expect(selected?.intervalMinutes).toBe(1);
  });

  it('falls back across a weekend or exchange-closed date without inventing intraday points', () => {
    const selected = selectBestIntradayResolution(
      [
        {
          intervalMinutes: 1,
          series: series([['ACTF', '2026-09-24T10:30:00.000Z']]),
        },
        {
          intervalMinutes: 5,
          series: series([['ACTF', '2026-09-24T10:30:00.000Z']]),
        },
      ],
      ['ACTF'],
      '2026-09-27',
    );

    expect(selected?.sessionDate).toBe('2026-09-24');
    expect(selected?.series.ACTF).toHaveLength(1);
  });
});
