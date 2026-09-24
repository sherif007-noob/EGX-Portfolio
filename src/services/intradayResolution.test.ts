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
});
