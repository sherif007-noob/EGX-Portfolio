import { describe, expect, it } from 'vitest';
import {
  INTRADAY_POLICY,
  isSupportedIntradayInterval,
  retentionDaysForIntradayInterval,
} from './intradayPolicy';

describe('intraday policy', () => {
  it('defines the staged 1m -> 5m -> 15m read order', () => {
    expect(INTRADAY_POLICY.readIntervals).toEqual([1, 5, 15]);
    expect(INTRADAY_POLICY.rawIntervalMinutes).toBe(1);
    expect(INTRADAY_POLICY.derivedIntervalMinutes).toBe(5);
    expect(INTRADAY_POLICY.legacyFallbackIntervalMinutes).toBe(15);
    expect(INTRADAY_POLICY.backfillChunkDays).toBe(7);
    expect(INTRADAY_POLICY.incrementalOverlapDays).toBe(2);
  });

  it('keeps raw 1-minute data shorter than derived intraday history', () => {
    expect(retentionDaysForIntradayInterval(1)).toBe(30);
    expect(retentionDaysForIntradayInterval(5)).toBe(90);
    expect(retentionDaysForIntradayInterval(15)).toBe(90);
  });

  it('rejects unsupported intervals', () => {
    expect(isSupportedIntradayInterval(1)).toBe(true);
    expect(isSupportedIntradayInterval(5)).toBe(true);
    expect(isSupportedIntradayInterval(15)).toBe(true);
    expect(isSupportedIntradayInterval(10)).toBe(false);
  });
}
