import {
  interpolate,
  type AnimationInterpolateFn,
  type AnimationItem,
  type AreaPointItem,
  type CartesianLayout,
  type LinePointItem,
} from 'recharts';

type CartesianPoint = {
  x?: number;
  y?: number;
};

function interpolateCoordinate(
  previous: number | undefined,
  next: number | undefined,
  progress: number,
): number | undefined {
  if (next == null) return undefined;
  if (previous == null) return next;
  return interpolate(previous, next, progress);
}

function uniquePreviousProfile<T extends CartesianPoint>(
  items: ReadonlyArray<AnimationItem<T>>,
): T[] {
  const profile: T[] = [];

  for (const item of items) {
    if (item.status !== 'matched') continue;

    const previous = item.prev;
    const last = profile.at(-1);

    // matchByIndex reuses the exact same previous point when expanding a
    // short series into a longer one. Collapse those repeats back to the
    // original source profile before sampling it across the new width.
    if (last === previous) continue;

    profile.push(previous);
  }

  return profile;
}

function samplePreviousY<T extends CartesianPoint>(
  profile: ReadonlyArray<T>,
  targetIndex: number,
  targetCount: number,
): number | undefined {
  if (profile.length === 0) return undefined;
  if (profile.length === 1 || targetCount <= 1) return profile[0]?.y;

  const position = (targetIndex / (targetCount - 1)) * (profile.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.min(profile.length - 1, Math.ceil(position));
  const lowerY = profile[lowerIndex]?.y;
  const upperY = profile[upperIndex]?.y;

  if (lowerY == null) return upperY;
  if (upperY == null || lowerIndex === upperIndex) return lowerY;

  return interpolate(lowerY, upperY, position - lowerIndex);
}

function interpolateFullWidth<T extends CartesianPoint>(
  items: ReadonlyArray<AnimationItem<T>> | null,
  progress: number,
): ReadonlyArray<T> {
  if (items == null) return [];

  if (progress === 1) {
    return items.flatMap((item) => (item.status === 'removed' ? [] : [item.next]));
  }

  const drawableItems = items.filter((item) => item.status !== 'removed');
  const previousProfile = uniquePreviousProfile(items);

  return drawableItems.flatMap((item, targetIndex) => {
    if (item.status === 'added') {
      return [item.next];
    }

    const sampledPreviousY = samplePreviousY(
      previousProfile,
      targetIndex,
      drawableItems.length,
    );

    return [{
      ...item.next,
      // X is in the target coordinate system from the first frame. This is the
      // important part: 1W starts across the complete plot instead of growing
      // out of the previous range's right-hand quarter.
      x: item.next.x,
      y: interpolateCoordinate(sampledPreviousY ?? item.prev.y, item.next.y, progress),
    }];
  });
}

/**
 * Used only when one side of a timeframe change is 1W.
 *
 * The final data and final coordinates are untouched. This custom interpolation
 * only controls the in-between SVG geometry that Recharts renders while moving
 * between two real datasets of very different lengths.
 */
export const interpolateWeeklyAreaFullWidth: AnimationInterpolateFn<
  AreaPointItem,
  CartesianLayout
> = (items, progress) => interpolateFullWidth(items, progress);

export const interpolateWeeklyLineFullWidth: AnimationInterpolateFn<
  LinePointItem,
  CartesianLayout
> = (items, progress) => interpolateFullWidth(items, progress);
