import {
  interpolate,
  type AnimationInterpolateFn,
  type AreaPointItem,
  type CartesianLayout,
  type LinePointItem,
} from 'recharts';

function interpolateCoordinate(
  previous: number | undefined,
  next: number | undefined,
  progress: number,
): number | undefined {
  if (next == null) return undefined;
  if (previous == null) return next;
  return interpolate(previous, next, progress);
}

/**
 * Recharts' default matchByIndex pairs the short 1W series against evenly
 * sampled points from the previous series, which is exactly what we want.
 *
 * The visible artifact comes from also interpolating X across two very
 * different categorical domains. For 1W transitions we keep every target
 * point at its final full-width X coordinate from the first frame and morph
 * only Y. That preserves Recharts' native data update lifecycle while
 * preventing the weekly curve from appearing in the right-hand quarter first.
 */
export const interpolateWeeklyAreaFullWidth: AnimationInterpolateFn<
  AreaPointItem,
  CartesianLayout
> = (items, progress) => {
  if (items == null) return [];

  if (progress === 1) {
    return items.flatMap((item) => (item.status === 'removed' ? [] : [item.next]));
  }

  return items.flatMap((item) => {
    if (item.status === 'matched') {
      return [{
        ...item.next,
        x: item.next.x,
        y: interpolateCoordinate(item.prev.y, item.next.y, progress),
      }];
    }

    if (item.status === 'added') {
      return [item.next];
    }

    return [];
  });
};

export const interpolateWeeklyLineFullWidth: AnimationInterpolateFn<
  LinePointItem,
  CartesianLayout
> = (items, progress) => {
  if (items == null) return [];

  if (progress === 1) {
    return items.flatMap((item) => (item.status === 'removed' ? [] : [item.next]));
  }

  return items.flatMap((item) => {
    if (item.status === 'matched') {
      return [{
        ...item.next,
        x: item.next.x,
        y: interpolateCoordinate(item.prev.y, item.next.y, progress),
      }];
    }

    if (item.status === 'added') {
      return [item.next];
    }

    return [];
  });
};
