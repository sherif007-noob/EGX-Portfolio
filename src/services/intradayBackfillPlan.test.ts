import { describe, expect, it } from 'vitest';
import {
  buildIntradayOneMinuteBackfillPlan,
  splitIntradayFetchRanges,
} from './intradayBackfillPlan';

describe('1-minute intraday backfill planning', () => {
  it('uses a full 90-day backfill when no derived 5-minute coverage exists', () => {
    const now = new Date('2026-09-24T03:00:00.000Z');
    const plan = buildIntradayOneMinuteBackfillPlan({ now });

    expect(plan.mode).toBe('full-derived-backfill');
    expect(plan.fromMs).toBe(now.getTime() - 90 * 86_400_000);
    expect(plan.ranges.length).toBeGreaterThan(10);
    expect(plan.ranges[0].fromMs).toBe(plan.fromMs);
    expect(plan.ranges.at(-1)?.toMs).toBe(now.getTime());
  });

  it('backfills only the raw 30-day tier when derived coverage already exists but 1m does not', () => {
    const now = new Date('2026-09-24T03:00:00.000Z');
    const plan = buildIntradayOneMinuteBackfillPlan({
      now,
      earliestDerivedTimestamp: '2026-07-01T07:00:00.000Z',
      latestRawTimestamp: null,
    });

    expect(plan.mode).toBe('raw-backfill');
    expect(plan.fromMs).toBe(now.getTime() - 30 * 86_400_000);
  });

  it('uses a two-day overlap for incremental repair without exceeding raw retention', () => {
    const now = new Date('2026-09-24T03:00:00.000Z');
    const latest = new Date('2026-09-23T11:29:00.000Z');
    const plan = buildIntradayOneMinuteBackfillPlan({
      now,
      earliestDerivedTimestamp: '2026-07-01T07:00:00.000Z',
      latestRawTimestamp: latest.toISOString(),
    });

    expect(plan.mode).toBe('incremental');
    expect(plan.fromMs).toBe(latest.getTime() - 2 * 86_400_000);
  });

  it('splits retrieval into bounded seven-day ranges', () => {
    const start = Date.parse('2026-09-01T00:00:00.000Z');
    const end = Date.parse('2026-09-20T00:00:00.000Z');
    const ranges = splitIntradayFetchRanges(start, end, 7);

    expect(ranges).toHaveLength(3);
    expect(ranges[0]).toEqual({ fromMs: start, toMs: start + 7 * 86_400_000 });
    expect(ranges.at(-1)?.toMs).toBe(end);
  });
});
