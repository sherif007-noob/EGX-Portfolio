import { describe, expect, it } from 'vitest';
import {
  formatAnalyticsCompactEgp,
  formatAnalyticsEgp,
  formatAnalyticsPercent,
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
});
