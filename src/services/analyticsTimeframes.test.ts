import { describe, expect, it } from 'vitest';
import { getLatestEgxSessionDate, resolveAnalyticsWindow } from './analyticsTimeframes';

describe('analytics timeframe semantics', () => {
  it('uses the current EGX session after market open', () => {
    const now = new Date('2026-09-17T07:00:00Z'); // 10:00 Cairo
    expect(getLatestEgxSessionDate(now)).toBe('2026-09-17');
  });

  it('does not start Monday-Thursday analytics before the 10:00 Cairo open', () => {
    const mondayBeforeOpen = new Date('2026-09-14T06:45:00Z'); // 09:45 Cairo
    const mondayAtOpen = new Date('2026-09-14T07:00:00Z'); // 10:00 Cairo

    expect(getLatestEgxSessionDate(mondayBeforeOpen)).toBe('2026-09-13');
    expect(getLatestEgxSessionDate(mondayAtOpen)).toBe('2026-09-14');
  });

  it('treats Sunday 09:30 as pre-market and starts the session at 10:00 Cairo', () => {
    const sundayPreMarket = new Date('2026-09-13T06:30:00Z'); // 09:30 Cairo
    const sundayAtOpen = new Date('2026-09-13T07:00:00Z'); // 10:00 Cairo

    expect(getLatestEgxSessionDate(sundayPreMarket)).toBe('2026-09-10');
    expect(getLatestEgxSessionDate(sundayAtOpen)).toBe('2026-09-13');
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
    expect(resolveAnalyticsWindow('1W', { latestSessionDate: '2026-09-17' }).startDate).toBe('2026-09-11');
    expect(resolveAnalyticsWindow('1M', { latestSessionDate: '2026-03-31' }).startDate).toBe('2026-02-28');
    expect(resolveAnalyticsWindow('90D', { latestSessionDate: '2026-09-17' }).startDate).toBe('2026-06-19');
    expect(resolveAnalyticsWindow('YTD', { latestSessionDate: '2026-09-17' }).startDate).toBe('2026-01-01');
    expect(resolveAnalyticsWindow('ALL', {
      latestSessionDate: '2026-09-17',
      firstPortfolioDate: '2026-09-02',
    }).startDate).toBe('2026-09-02');
  });
});
