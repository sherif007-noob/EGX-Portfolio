// @vitest-environment jsdom
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { useDismissibleChartTooltip } from './useDismissibleChartTooltip';

function Fixture() {
  const { mainChartRef, comparisonChartRef, dismissed, onChartInteraction } = useDismissibleChartTooltip();
  return <div>
    <div data-testid="main" ref={mainChartRef}
      onPointerEnter={onChartInteraction} onPointerDownCapture={onChartInteraction}>
      <span data-testid="plot-point">Return chart</span>
    </div>
    <div data-testid="nav" ref={comparisonChartRef}
      onPointerEnter={onChartInteraction} onPointerDownCapture={onChartInteraction}>
      NAV chart
    </div>
    <button data-testid="outside">Other UI</button>
    <output data-testid="dismissed">{String(dismissed)}</output>
  </div>;
}

let host: HTMLDivElement | null = null;
let root: Root | null = null;

function setup() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root?.render(<Fixture/>));
  const get = (name: string) => {
    const node = host?.querySelector(`[data-testid="${name}"]`);
    if (!node) throw new Error(`Missing test node: ${name}`);
    return node;
  };
  const down = (target: EventTarget) => act(() => {
    target.dispatchEvent(new Event('pointerdown', { bubbles:true }));
  });
  return { get, down };
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?:boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe('chart tooltip outside-tap dismissal', () => {
  it('dismisses on a tap outside either chart and reopens on a chart touch', () => {
    const { get, down } = setup();
    expect(get('dismissed').textContent).toBe('false');
    down(get('outside'));
    expect(get('dismissed').textContent).toBe('true');
    down(get('plot-point'));
    expect(get('dismissed').textContent).toBe('false');
  });

  it('does not dismiss while tapping within either synchronized chart', () => {
    const { get, down } = setup();
    down(get('main'));
    expect(get('dismissed').textContent).toBe('false');
    down(get('nav'));
    expect(get('dismissed').textContent).toBe('false');
    down(document.body);
    expect(get('dismissed').textContent).toBe('true');
    down(get('nav'));
    expect(get('dismissed').textContent).toBe('false');
  });

  it('dismisses with Escape and allows the next chart interaction', () => {
    const { get, down } = setup();
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape',bubbles:true })));
    expect(get('dismissed').textContent).toBe('true');
    down(get('main'));
    expect(get('dismissed').textContent).toBe('false');
  });
});
