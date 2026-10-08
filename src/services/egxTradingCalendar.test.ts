import { describe, expect, it } from 'vitest';
import { egxHolidayOn, isEgxTradingDay, previousEgxTradingDate, nextEgxTradingDate, cairoDateKey } from './egxTradingCalendar';
import { egxSessionPresentation } from './egxSessionPresentation';
import { getLatestEgxSessionDate, resolveAnalyticsWindow } from './analyticsTimeframes';
import { getEGXSessionStatus } from './marketPriceSync';

describe('EGX exchange holiday calendar: observed Armed Forces Day, 2026', () => {
  const holiday = new Date('2026-10-08T08:00:00Z'); // 11am Cairo, summer time
  it('uses verified actual closure, not the nominal annual holiday', () => {
    expect(isEgxTradingDay('2026-10-06')).toBe(true);
    expect(isEgxTradingDay('2026-10-07')).toBe(true);
    expect(isEgxTradingDay('2026-10-08')).toBe(false);
    expect(egxHolidayOn('2026-10-08')?.name).toContain('Armed Forces');
    expect(egxHolidayOn('2026-10-06')).toBeNull();
  });

  it('never treats Oct 8 or the following weekend as an active EGX session', () => {
    for (const date of ['2026-10-08','2026-10-09','2026-10-10']) {
      expect(isEgxTradingDay(date)).toBe(false);
      expect(previousEgxTradingDate(date)).toBe('2026-10-07');
    }
    expect(nextEgxTradingDate('2026-10-07')).toBe('2026-10-11');
  });

  it('resolves all analytical charts to the last real session throughout the holiday', () => {
    expect(cairoDateKey(holiday)).toBe('2026-10-08');
    expect(getLatestEgxSessionDate(holiday)).toBe('2026-10-07');
    expect(resolveAnalyticsWindow('TODAY',{ now:holiday }).endDate).toBe('2026-10-07');
    expect(resolveAnalyticsWindow('1W',{ now:holiday }).endDate).toBe('2026-10-07');
  });

  it('keeps Oct 7 through the closed weekend and Sunday pre-open, then rolls to Oct 11 at 10 Cairo', () => {
    expect(getLatestEgxSessionDate(new Date('2026-10-08T22:30:00Z'))).toBe('2026-10-07');
    expect(getLatestEgxSessionDate(new Date('2026-10-10T12:00:00Z'))).toBe('2026-10-07');
    expect(getLatestEgxSessionDate(new Date('2026-10-11T06:59:00Z'))).toBe('2026-10-07');
    expect(getLatestEgxSessionDate(new Date('2026-10-11T07:00:00Z'))).toBe('2026-10-11');
  });

  it('labels a holiday as closed, with the previous session, not +P&L today', () => {
    const display=egxSessionPresentation(holiday);
    expect(display.isHoliday).toBe(true);
    expect(display.isCurrentSessionDay).toBe(false);
    expect(display.description).toContain('EGX holiday');
    expect(display.sessionCaption).toContain('7 Oct');
    expect(egxSessionPresentation(new Date('2026-10-07T08:00:00Z')).isCurrentSessionDay).toBe(true);
    expect(egxSessionPresentation(new Date('2026-10-11T06:59:00Z')).isCurrentSessionDay).toBe(false);
  });

  it('prevents live-price scheduling on the holiday and points to the next open day', () => {
    const status=getEGXSessionStatus(holiday);
    expect(status.isSessionActive).toBe(false);
    expect(status.nextTickLabel).toBe('09:30');
    expect(getEGXSessionStatus(new Date('2026-10-07T08:00:00Z')).isSessionActive).toBe(true);
  });

  it('rejects invalid calendar keys, does not guess other years holidays', () => {
    expect(isEgxTradingDay('2026-02-30')).toBe(false);
    expect(isEgxTradingDay('not-a-date')).toBe(false);
    expect(egxHolidayOn('2027-10-08')).toBeNull();
  });
});
