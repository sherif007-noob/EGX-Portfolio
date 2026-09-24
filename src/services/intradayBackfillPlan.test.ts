import { describe, expect, it } from 'vitest';
import {
  buildIntradayOneMinuteBackfillPlan,
  retentionCutoffStartOfUtcDay,
} from './intradayBackfillPlan';

describe('1-minute intraday backfill planning', () => {
  it('uses the raw 30-day tier for an explicit full repair', () => {
    const now = new Date('2026-09-24T10:48:00.000Z');
    const plan = buildIntradayOneMinuteBackfillPlan({
      now,
      forceFullRepair: true,
    });

    expect(plan.mode).toBe('full-raw-backfill');
    expect(plan.fromMs).toBe(Date.parse('2026-08-25T00:00:00.000Z'));
    expect(plan.rawCutoffMs).toBe(Date.parse('2026-08-25T00:00:00.000Z'));
    expect(plan.derivedCutoffMs).toBe(Date.parse('2026-06-26T00:00:00.000Z'));
  });

  it('backfills the raw tier when no 1m coverage exists', () => {
    const now = new Date('2026-09-24T03:00:00.000Z');
    const plan = buildIntradayOneMinuteBackfillPlan({
      now,
      latestRawTimestamp: null,
    });

    expect(plan.mode).toBe('raw-backfill');
    expect(plan.fromMs).toBe(Date.parse('2026-08-25T00:00:00.000Z'));
  });

  it('uses a two-day overlap for incremental repair without exceeding raw retention', () => {
    const now = new Date('2026-09-24T03:00:00.000Z');
    const latest = new Date('2026-09-23T11:29:00.000Z');
    const plan = buildIntradayOneMinuteBackfillPlan({
      now,
      latestRawTimestamp: latest.toISOString(),
    });

    expect(plan.mode).toBe('incremental');
    expect(plan.fromMs).toBe(latest.getTime() - 2 * 86_400_000);
  });

  it('aligns retention cutoffs to the start of a UTC day', () => {
    expect(
      retentionCutoffStartOfUtcDay(
        Date.parse('2026-09-24T10:48:00.000Z'),
        30,
      ),
    ).toBe(Date.parse('2026-08-25T00:00:00.000Z'));
  });
});
