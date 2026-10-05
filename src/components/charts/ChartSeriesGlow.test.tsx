// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ChartAreaGlow, ChartLineGlow, useChartResourceId } from './ChartSeriesGlow';

function svg(markup: React.ReactNode) {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(<svg>{markup}</svg>);
  return host;
}
const points = [{ x: 10, y: 70 }, { x: 40, y: 15 }, { x: 80, y: 45 }];

describe('chart series painting', () => {
  it.each([0, 0.4, 1])('keeps area halos on the same curve at animation progress %s', progress => {
    const host = svg(<ChartAreaGlow points={points} baseLine={100} stroke="#10b981" fill="#10b981" type="monotone" strokeWidth={2.5} isEntrance isAnimating={progress < 1} animationElapsedTime={progress} />);
    const curves = [...host.querySelectorAll('path.recharts-area-curve')];
    expect(curves).toHaveLength(3);
    expect(new Set(curves.map(path => path.getAttribute('d'))).size).toBe(1);
    expect(host.querySelector('filter, [filter]')).toBeNull();
    const clips = [...host.querySelectorAll('clipPath')];
    expect(new Set(clips.map(clip => clip.id)).size).toBe(clips.length);
    // Stroke width changes vertical padding, but every layer must reveal the same x range.
    const bounds = clips.map(clip => {
      const rect = clip.querySelector('rect');
      return [rect?.getAttribute('x'), rect?.getAttribute('width')].join(':');
    });
    expect(new Set(bounds).size).toBeLessThanOrEqual(1);
    for (const fill of host.querySelectorAll('[data-chart-halo] .recharts-area-area')) {
      expect(fill.getAttribute('fill')).toBe('none');
    }
    expect(host.querySelector('[data-chart-halo]')?.getAttribute('pointer-events')).toBe('none');
  });
  it('keeps dashed line halos aligned without adding a second data series', () => {
    const host = svg(<ChartLineGlow pathRef={React.createRef<SVGPathElement>()} points={points} type="linear" stroke="#f43f5e" strokeWidth={2} strokeDasharray="6 4" animationElapsedTime={1} />);
    const curves = [...host.querySelectorAll('path')];
    expect(curves).toHaveLength(3);
    expect(new Set(curves.map(path => path.getAttribute('d'))).size).toBe(1);
    expect(new Set(curves.map(path => path.getAttribute('stroke-dasharray')))).toEqual(new Set(['6 4']));
    expect(host.querySelector('filter, [filter]')).toBeNull();
  });
  it('isolates SVG resources across concurrently mounted chart instances', () => {
    function Instance() {
      const id = useChartResourceId('chart-fill');
      return <g><defs><linearGradient id={id} /></defs><path fill={`url(#${id})`} /></g>;
    }
    const host = svg(<><Instance /><Instance /></>);
    const ids = [...host.querySelectorAll('linearGradient')].map(node => node.id);
    expect(new Set(ids).size).toBe(2);
    expect([...host.querySelectorAll('path')].map(node => node.getAttribute('fill'))).toEqual(ids.map(id => `url(#${id})`));
  });
  it('does not raster-filter the whole animated series or its filled area', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/features/charts.css'), 'utf8');
    for (const selector of ['premium-secondary-chart-series', 'premium-trajectory-semantic-curve']) {
      const rule = css.match(new RegExp(`\\.${selector}\\s*\\{([^}]+)\\}`))?.[1];
      expect(rule).toContain('filter: none');
      expect(rule).not.toContain('drop-shadow');
    }
  });
});
