import { describe, expect, it } from 'vitest';
import { computeDropdownViewportGeometry } from './dropdownGeometry';

const mobileViewport = {
  left: 0,
  top: 0,
  width: 390,
  height: 844,
  layoutHeight: 844,
};

describe('computeDropdownViewportGeometry', () => {
  it('clamps a wide menu opened from the right side of a phone inside the viewport', () => {
    const result = computeDropdownViewportGeometry(
      { left: 250, right: 370, top: 520, bottom: 564, width: 120 },
      mobileViewport,
      {
        matchAnchorWidth: false,
        preferredWidth: 320,
        align: 'auto',
        offset: 6,
        gutter: 12,
      },
    );

    expect(result.width).toBe(320);
    expect(result.left).toBeGreaterThanOrEqual(12);
    expect(result.left + result.width).toBeLessThanOrEqual(378);
    expect(result.left + result.width).toBe(370);
  });

  it('keeps a left-side phone menu inside the left gutter', () => {
    const result = computeDropdownViewportGeometry(
      { left: 4, right: 204, top: 420, bottom: 464, width: 200 },
      mobileViewport,
      {
        matchAnchorWidth: false,
        preferredWidth: 320,
        align: 'left',
        offset: 6,
        gutter: 12,
      },
    );

    expect(result.left).toBe(12);
    expect(result.left + result.width).toBeLessThanOrEqual(378);
  });

  it('clamps a desktop menu opened near the right edge', () => {
    const result = computeDropdownViewportGeometry(
      { left: 1320, right: 1420, top: 180, bottom: 224, width: 100 },
      { left: 0, top: 0, width: 1440, height: 900, layoutHeight: 900 },
      {
        matchAnchorWidth: false,
        preferredWidth: 320,
        align: 'auto',
        offset: 6,
        gutter: 12,
      },
    );

    expect(result.width).toBe(320);
    expect(result.left).toBeGreaterThanOrEqual(12);
    expect(result.left + result.width).toBeLessThanOrEqual(1428);
    expect(result.left + result.width).toBe(1420);
  });

  it('opens upward and limits height when there is not enough room below', () => {
    const result = computeDropdownViewportGeometry(
      { left: 210, right: 370, top: 760, bottom: 804, width: 160 },
      mobileViewport,
      {
        matchAnchorWidth: false,
        preferredWidth: 320,
        align: 'auto',
        offset: 6,
        gutter: 12,
      },
    );

    expect(result.placement).toBe('above');
    expect(result.top).toBe('auto');
    expect(result.bottom).toBe(90);
    expect(result.maxHeight).toBe(742);
  });

  it('never allows preferred width to exceed the safe viewport width', () => {
    const result = computeDropdownViewportGeometry(
      { left: 10, right: 380, top: 120, bottom: 164, width: 370 },
      mobileViewport,
      {
        matchAnchorWidth: false,
        preferredWidth: 640,
        align: 'auto',
        offset: 6,
        gutter: 12,
      },
    );

    expect(result.width).toBe(366);
    expect(result.left).toBe(12);
    expect(result.left + result.width).toBe(378);
  });
});
