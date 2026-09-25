import { describe, expect, it } from 'vitest';
import {
  createWeeklyAreaInterpolator,
  createWeeklyLineInterpolator,
  matchWeeklyPointByDate,
} from './weeklyTransitionInterpolation';

const point = (x: number, y: number, date: string) => ({
  x,
  y,
  payload: { date },
});

describe('weekly transition interpolation', () => {
  it('matches chart points by calendar date when a date exists', () => {
    expect(matchWeeklyPointByDate({ payload: { date: '2026-09-24' } }, 3))
      .toBe('2026-09-24');
    expect(matchWeeklyPointByDate({ payload: {} }, 3)).toBe('fallback-3');
  });

  it('preserves the full outgoing geometry when morphing into a sparse 1W profile', () => {
    const previous = Array.from({ length: 32 }, (_, index) =>
      point(index * 10, Math.sin(index / 4) * 40 + index, `old-${index}`)
    );
    const next = [
      point(0, 10, '2026-09-20'),
      point(100, 25, '2026-09-21'),
      point(200, 15, '2026-09-22'),
      point(310, 40, '2026-09-23'),
    ];

    const matchedIndexes = new Set([0, 8, 16, 24]);
    const items = [
      ...next.map((nextPoint, index) => {
        const previousIndex = [0, 8, 16, 24][index] ?? 0;
        return {
          status: 'matched' as const,
          prev: previous[previousIndex],
          next: nextPoint,
        };
      }),
      ...previous
        .filter((_, index) => !matchedIndexes.has(index))
        .map((prev) => ({
          status: 'removed' as const,
          prev,
        })),
    ];

    const interpolate = createWeeklyLineInterpolator('cardinal', 'cardinal');
    const frame = interpolate(items as any, 0, {} as any) as readonly { x?: number; y?: number }[];

    expect(frame.length).toBeGreaterThanOrEqual(previous.length);
    expect(frame[0]?.x).toBeCloseTo(0, 8);
    expect(frame.at(-1)?.x).toBeCloseTo(310, 8);
    expect(frame[0]?.y).toBeCloseTo(previous[0].y, 8);
    expect(frame.at(-1)?.y).toBeDefined();

    // Regression guard for the historical 1W bug: the first animation frame
    // must span the whole plot instead of appearing only in the last quarter.
    const halfway = frame[Math.floor(frame.length / 2)];
    expect(halfway?.x).toBeGreaterThan(120);
    expect(halfway?.x).toBeLessThan(190);
  });

  it('returns the exact target geometry at the end of the morph', () => {
    const items = [
      {
        status: 'matched' as const,
        prev: point(0, 5, '2026-09-20'),
        next: point(0, 15, '2026-09-20'),
      },
      {
        status: 'matched' as const,
        prev: point(100, 20, '2026-09-21'),
        next: point(120, 35, '2026-09-21'),
      },
      {
        status: 'matched' as const,
        prev: point(220, 10, '2026-09-22'),
        next: point(260, 25, '2026-09-22'),
      },
    ];

    const line = createWeeklyLineInterpolator('linear', 'cardinal');
    const area = createWeeklyAreaInterpolator('linear', 'cardinal');

    expect(line(items as any, 1, {} as any)).toEqual(items.map((item) => item.next));
    expect(area(items as any, 1, {} as any)).toEqual(items.map((item) => item.next));
  });
});
