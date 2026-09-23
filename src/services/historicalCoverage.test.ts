import { describe, expect, it } from 'vitest';
import { buildHistoricalRepairPlans, isEgxTradingWeekday } from './historicalCoverage';

describe('historical coverage repair planning', () => {
  it('plans an initial backfill for a newly added ticker with zero rows', () => {
    const plans = buildHistoricalRepairPlans(
      [
        { ticker: 'ACTF', firstRequiredDate: '2026-09-20' },
        { ticker: 'ORHD', firstRequiredDate: '2026-09-10' },
      ],
      [
        { ticker: 'ORHD', date: '2026-09-20' },
        { ticker: 'ORHD', date: '2026-09-21' },
        { ticker: 'ORHD', date: '2026-09-22' },
        { ticker: 'ORHD', date: '2026-09-23' },
      ],
      '2026-09-23',
    );

    const actf = plans.find((plan) => plan.ticker === 'ACTF');
    expect(actf).toEqual({
      ticker: 'ACTF',
      startDate: '2026-09-20',
      endDate: '2026-09-23',
      reasons: ['no-history'],
      missingReferenceDates: ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23'],
    });
  });

  it('repairs a backdated transaction that predates stored history', () => {
    const plans = buildHistoricalRepairPlans(
      [{ ticker: 'TALM', firstRequiredDate: '2026-09-01' }],
      [
        { ticker: 'TALM', date: '2026-09-10' },
        { ticker: 'TALM', date: '2026-09-11' },
      ],
      '2026-09-11',
    );

    expect(plans[0]?.ticker).toBe('TALM');
    expect(plans[0]?.startDate).toBe('2026-09-01');
    expect(plans[0]?.reasons).toContain('missing-head');
  });

  it('detects an internal market-day gap using other portfolio history as reference', () => {
    const plans = buildHistoricalRepairPlans(
      [
        { ticker: 'ETEL', firstRequiredDate: '2026-09-20' },
        { ticker: 'ORHD', firstRequiredDate: '2026-09-20' },
      ],
      [
        { ticker: 'ETEL', date: '2026-09-20' },
        { ticker: 'ETEL', date: '2026-09-22' },
        { ticker: 'ORHD', date: '2026-09-20' },
        { ticker: 'ORHD', date: '2026-09-21' },
        { ticker: 'ORHD', date: '2026-09-22' },
      ],
      '2026-09-22',
    );

    const etel = plans.find((plan) => plan.ticker === 'ETEL');
    expect(etel?.reasons).toContain('internal-gap');
    expect(etel?.missingReferenceDates).toContain('2026-09-21');
  });

  it('does not invent a stale-tail repair for Friday or Saturday', () => {
    expect(isEgxTradingWeekday('2026-09-25')).toBe(false);
    expect(isEgxTradingWeekday('2026-09-26')).toBe(false);

    const plans = buildHistoricalRepairPlans(
      [{ ticker: 'ORHD', firstRequiredDate: '2026-09-20' }],
      [
        { ticker: 'ORHD', date: '2026-09-23' },
        { ticker: 'ORHD', date: '2026-09-24' },
      ],
      '2026-09-25',
    );

    expect(plans).toEqual([]);
  });

  it('skips a ticker whose coverage is already current', () => {
    const plans = buildHistoricalRepairPlans(
      [{ ticker: 'ORHD', firstRequiredDate: '2026-09-20' }],
      [
        { ticker: 'ORHD', date: '2026-09-20' },
        { ticker: 'ORHD', date: '2026-09-21' },
        { ticker: 'ORHD', date: '2026-09-22' },
        { ticker: 'ORHD', date: '2026-09-23' },
      ],
      '2026-09-23',
    );

    expect(plans).toEqual([]);
  });
});
