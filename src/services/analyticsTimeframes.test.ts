import { describe, expect, it } from 'vitest';
import { getLatestEgxSessionDate, resolveAnalyticsWindow } from './analyticsTimeframes';

describe('analytics timeframe semantics', () => {
  it('uses the current EGX session after market open', () => {
    const now = new Date('2026-09-17T07:00:00Z'); // 10:00 Cairo
    expect(getLatestEgxSessionDate(now)).toBe('2026-09-17');
  });

  it('uses the prior EGX session before market open', () => {
    const now = new Date('2026-09-17T05:30:00Z'); // 08:30 Cairo
    expect(getLatestEgxSessionDate(now)).toBe('2026-09-16');
  });

  it('defines Today as 15-minute intraday analytics', () => {
    expect(resolveAnalyticsWindow('TODAY', { latestSessionDate: '2026-09-17' })).toEqual({
      timeframe: 'TODAY',
      label: 'Today',
      startDate: '2026-09-17',
      endDate: '2026-09-17',
      resolution: '15m',
      requiresIntraday: true,
    });
  });

  it('defines rolling and calendar windows consistently', () => {
    expect(resolveAnalyticsWindow('1W', { latestSessionDate: '2026-09-17' }).startDate).toBe('2026-09-10');
    expect(resolveAnalyticsWindow('1M', { latestSessionDate: '2026-03-31' }).startDate).toBe('2026-02-28');
    expect(resolveAnalyticsWindow('90D', { latestSessionDate: '2026-09-17' }).startDate).toBe('2026-06-19');
    expect(resolveAnalyticsWindow('YTD', { latestSessionDate: '2026-09-17' }).startDate).toBe('2026-01-01');
    expect(resolveAnalyticsWindow('ALL', {
      latestSessionDate: '2026-09-17',
      firstPortfolioDate: '2026-09-02',
    }).startDate).toBe('2026-09-02');
  });
});
