import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_ALLOCATION_PALETTE,
  ANALYTICS_CHART_THEME,
  analyticsActiveDotProps,
  formatAnalyticsCompactEgp,
  formatAnalyticsEgp,
  formatAnalyticsPercent,
  formatAnalyticsPercentAxis,
  getAnalyticsToneColor,
  getAnalyticsTradeMarkerStyle,
} from './AnalyticsChartTheme';

describe('analytics chart formatters', () => {
  it('formats EGP values consistently', () => {
    expect(formatAnalyticsEgp(69154.76)).toBe('69,154.76 EGP');
    expect(formatAnalyticsEgp(372.55, true)).toBe('+372.55 EGP');
    expect(formatAnalyticsEgp(-89, true)).toBe('-89.00 EGP');
  });

  it('formats percentage values consistently', () => {
    expect(formatAnalyticsPercent(1.234)).toBe('1.23%');
    expect(formatAnalyticsPercent(0.54, true)).toBe('+0.54%');
    expect(formatAnalyticsPercent(-2.5, true)).toBe('-2.50%');
  });

  it('formats compact axis values without losing sign', () => {
    expect(formatAnalyticsCompactEgp(1250)).toBe('+1.3k');
    expect(formatAnalyticsCompactEgp(-2500000)).toBe('-2.5m');
    expect(formatAnalyticsCompactEgp(0)).toBe('0');
  });

  it('formats percentage axis labels with explicit precision', () => {
    expect(formatAnalyticsPercentAxis(1.234, 1)).toBe('1.2%');
    expect(formatAnalyticsPercentAxis(-0.4567, 2)).toBe('-0.46%');
  });
});

describe('analytics chart visual contracts', () => {
  it('maps semantic tones to stable chart colors', () => {
    expect(getAnalyticsToneColor('live')).toBe(ANALYTICS_CHART_THEME.cyan);
    expect(getAnalyticsToneColor('comparison')).toBe(ANALYTICS_CHART_THEME.purple);
    expect(getAnalyticsToneColor('positive')).toBe(ANALYTICS_CHART_THEME.emerald);
    expect(getAnalyticsToneColor('negative')).toBe(ANALYTICS_CHART_THEME.rose);
    expect(getAnalyticsToneColor('cost')).toBe(ANALYTICS_CHART_THEME.amber);
  });

  it('uses the shared active-point separation ring', () => {
    expect(analyticsActiveDotProps('negative')).toMatchObject({
      fill: ANALYTICS_CHART_THEME.rose,
      stroke: ANALYTICS_CHART_THEME.tooltipBackground,
      strokeWidth: 2,
      r: 4.5,
    });
  });

  it('keeps every trajectory outcome visually distinct', () => {
    const start = getAnalyticsTradeMarkerStyle('START');
    const win = getAnalyticsTradeMarkerStyle('WIN');
    const loss = getAnalyticsTradeMarkerStyle('LOSS');
    const breakeven = getAnalyticsTradeMarkerStyle('BREAKEVEN');

    expect(start.fill).toBe(ANALYTICS_CHART_THEME.neutral);
    expect(win.fill).toBe(ANALYTICS_CHART_THEME.emerald);
    expect(loss.fill).toBe(ANALYTICS_CHART_THEME.rose);
    expect(breakeven.fill).toBe(ANALYTICS_CHART_THEME.amber);
    expect(new Set([start.fill, win.fill, loss.fill, breakeven.fill]).size).toBe(4);

    for (const marker of [start, win, loss, breakeven]) {
      expect(marker.radius).toBeGreaterThanOrEqual(4);
      expect(marker.activeRadius).toBeGreaterThan(marker.radius);
      expect(marker.strokeWidth).toBe(2);
    }
  });

  it('provides enough stable allocation colors for dense portfolios', () => {
    expect(ANALYTICS_ALLOCATION_PALETTE.length).toBeGreaterThanOrEqual(10);
    expect(new Set(ANALYTICS_ALLOCATION_PALETTE).size).toBe(ANALYTICS_ALLOCATION_PALETTE.length);
  });
});
