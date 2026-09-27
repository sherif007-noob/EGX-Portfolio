import React from 'react';
import { AreaRevealShape, LineDrawShape, type AreaRevealShapeProps, type LineDrawShapeProps } from 'recharts';

/**
 * Paint the halo from the same geometry and animation progress as the series.
 * Filtering the whole animated Area group also rasterizes its fill/clip edges;
 * desktop compositors can retain displaced strips of that offscreen surface.
 * These faint, concentric strokes need no offscreen filter surface.
 */
export function ChartAreaGlow({ id, ...props }: AreaRevealShapeProps) {
  const width = Number(props.strokeWidth) || 2;
  return (
    <g data-chart-series-paint="area">
      <g aria-hidden="true" pointerEvents="none" data-chart-halo="true">
        <AreaRevealShape {...props} fill="none" fillOpacity={0} strokeWidth={width + 8} strokeOpacity={0.055} />
        <AreaRevealShape {...props} fill="none" fillOpacity={0} strokeWidth={width + 4} strokeOpacity={0.12} />
      </g>
      <AreaRevealShape {...props} id={id} />
    </g>
  );
}

export function ChartLineGlow({ id, ...props }: LineDrawShapeProps) {
  const width = Number(props.strokeWidth) || 2;
  return (
    <g data-chart-series-paint="line">
      <g aria-hidden="true" pointerEvents="none" data-chart-halo="true">
        <LineDrawShape {...props} strokeWidth={width + 8} strokeOpacity={0.055} />
        <LineDrawShape {...props} strokeWidth={width + 4} strokeOpacity={0.12} />
      </g>
      <LineDrawShape {...props} id={id} />
    </g>
  );
}

/** SVG fragment IDs are document-wide, including overlapping tab exits. */
export function useChartResourceId(prefix: string) {
  const id = React.useId();
  return `${prefix}-${id.replace(/:/g, '')}`;
}
