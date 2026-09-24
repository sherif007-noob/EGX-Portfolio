import { describe, expect, it } from 'vitest';
import { egxCairoSessionClock } from './egxTradingSession';

describe('EGX Cairo trading session clock', () => {
  it('recognizes the summer/DST session using Africa/Cairo rather than a fixed UTC offset', () => {
    const clock = egxCairoSessionClock(new Date('2026-09-24T07:00:00.000Z'));
    expect(clock.dateKey).toBe('2026-09-24');
    expect(clock.weekday).toBe('Thu');
    expect(clock.minuteOfDay).toBe(10 * 60);
    expect(clock.isRegularSession).toBe(true);
    expect(clock.isScheduledIngestionWindow).toBe(true);
  });

  it('recognizes the winter session after Cairo falls back to UTC+2', () => {
    const clock = egxCairoSessionClock(new Date('2026-11-01T08:00:00.000Z'));
    expect(clock.dateKey).toBe('2026-11-01');
    expect(clock.weekday).toBe('Sun');
    expect(clock.minuteOfDay).toBe(10 * 60);
    expect(clock.isRegularSession).toBe(true);
  });

  it('rejects the Friday weekend even when the local clock is inside market hours', () => {
    const clock = egxCairoSessionClock(new Date('2026-10-30T08:00:00.000Z'));
    expect(clock.weekday).toBe('Fri');
    expect(clock.isTradingWeekday).toBe(false);
    expect(clock.isScheduledIngestionWindow).toBe(false);
  });

  it('allows a short post-close ingestion grace window for the final completed bars', () => {
    const inGrace = egxCairoSessionClock(new Date('2026-09-24T11:35:00.000Z'));
    const afterGrace = egxCairoSessionClock(new Date('2026-09-24T11:45:00.000Z'));
    expect(inGrace.isRegularSession).toBe(false);
    expect(inGrace.isScheduledIngestionWindow).toBe(true);
    expect(afterGrace.isScheduledIngestionWindow).toBe(false);
  });
});
