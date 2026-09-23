import {
  interpolate,
  type AnimationInterpolateFn,
  type AnimationItem,
  type AreaPointItem,
  type CartesianLayout,
  type LinePointItem,
} from 'recharts';

export type WeeklyTransitionCurve = 'linear' | 'cardinal';

type CartesianPoint = {
  x?: number;
  y?: number;
  payload?: unknown;
};

export const matchWeeklyPointByDate = (
  item: { payload?: any },
  index: number,
): string | number | null => {
  const date = item?.payload?.date;
  return date == null ? `fallback-${index}` : String(date);
};

function uniqueSorted<T extends CartesianPoint>(points: T[]): T[] {
  const seen = new Set<T>();
  return points
    .filter((point) => {
      if (seen.has(point)) return false;
      seen.add(point);
      return true;
    })
    .sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
}

function collectProfiles<T extends CartesianPoint>(
  items: ReadonlyArray<AnimationItem<T>>,
): { previous: T[]; next: T[] } {
  const previous: T[] = [];
  const next: T[] = [];

  for (const item of items) {
    if (item.status === 'matched') {
      previous.push(item.prev);
      next.push(item.next);
    } else if (item.status === 'removed') {
      previous.push(item.prev);
    } else {
      next.push(item.next);
    }
  }

  return {
    previous: uniqueSorted(previous),
    next: uniqueSorted(next),
  };
}

function linearSample(values: ReadonlyArray<number>, u: number): number {
  if (values.length <= 1) return values[0] ?? 0;

  const position = Math.min(1, Math.max(0, u)) * (values.length - 1);
  const i = Math.floor(position);
  const j = Math.min(values.length - 1, i + 1);
  const t = position - i;
  return interpolate(values[i] ?? 0, values[j] ?? values[i] ?? 0, t);
}

function cardinalSample(
  values: ReadonlyArray<number>,
  u: number,
  tension = 0.55,
): number {
  if (values.length < 3) return linearSample(values, u);

  const position = Math.min(1, Math.max(0, u)) * (values.length - 1);
  const i = Math.min(values.length - 2, Math.floor(position));
  const t = position - i;

  const p0 = values[Math.max(0, i - 1)] ?? values[i] ?? 0;
  const p1 = values[i] ?? p0;
  const p2 = values[Math.min(values.length - 1, i + 1)] ?? p1;
  const p3 = values[Math.min(values.length - 1, i + 2)] ?? p2;

  const tangentScale = (1 - tension) / 2;
  const m1 = tangentScale * (p2 - p0);
  const m2 = tangentScale * (p3 - p1);

  const t2 = t * t;
  const t3 = t2 * t;

  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  return h00 * p1 + h10 * m1 + h01 * p2 + h11 * m2;
}

function sampleProfileY<T extends CartesianPoint>(
  profile: ReadonlyArray<T>,
  u: number,
  curve: WeeklyTransitionCurve,
): number | undefined {
  const values = profile
    .map((point) => point.y)
    .filter((value): value is number => value != null && Number.isFinite(value));

  if (!values.length) return undefined;
  return curve === 'linear'
    ? linearSample(values, u)
    : cardinalSample(values, u);
}

function createFullProfileInterpolator<T extends CartesianPoint>(
  sourceCurve: WeeklyTransitionCurve,
  targetCurve: WeeklyTransitionCurve,
): AnimationInterpolateFn<T, CartesianLayout> {
  return (items, progress) => {
    if (items == null) return [];

    const { previous, next } = collectProfiles(items);
    if (!next.length) return [];

    if (progress === 1 || !previous.length) {
      return next;
    }

    /*
     * Preserve enough geometry to keep the outgoing curve recognizable.
     * This is the key difference from Recharts' default index matcher when
     * the target is 1W: it no longer reduces Today/1M to ~5-6 source samples
     * before the first visible animation frame.
     */
    const sampleCount = Math.min(
      96,
      Math.max(24, previous.length, next.length),
    );

    const firstX = next[0]?.x ?? 0;
    const lastX = next.at(-1)?.x ?? firstX;
    const result: T[] = [];

    for (let index = 0; index < sampleCount; index += 1) {
      const u = sampleCount <= 1 ? 0 : index / (sampleCount - 1);
      const sourceY = sampleProfileY(previous, u, sourceCurve);
      const targetY = sampleProfileY(next, u, targetCurve);

      const nearestTargetIndex =
        next.length <= 1
          ? 0
          : Math.min(
              next.length - 1,
              Math.round(u * (next.length - 1)),
            );
      const template = next[nearestTargetIndex] ?? next[0];

      result.push({
        ...template,
        x: interpolate(firstX, lastX, u),
        y:
          sourceY == null
            ? targetY
            : targetY == null
              ? sourceY
              : interpolate(sourceY, targetY, progress),
      });
    }

    return result;
  };
}

export function createWeeklyAreaInterpolator(
  sourceCurve: WeeklyTransitionCurve,
  targetCurve: WeeklyTransitionCurve,
): AnimationInterpolateFn<AreaPointItem, CartesianLayout> {
  return createFullProfileInterpolator(sourceCurve, targetCurve);
}

export function createWeeklyLineInterpolator(
  sourceCurve: WeeklyTransitionCurve,
  targetCurve: WeeklyTransitionCurve,
): AnimationInterpolateFn<LinePointItem, CartesianLayout> {
  return createFullProfileInterpolator(sourceCurve, targetCurve);
}
