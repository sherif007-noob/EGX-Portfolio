import { describe, expect, it } from 'vitest';
import type { UnifiedAnalyticsResult } from './unifiedAnalyticsEngine';
import {
  analyticsModePoints,
  analyticsModeSummary,
  getAnalyticsModeDefinition,
} from './analyticsModes';

const result: UnifiedAnalyticsResult = {
  timeframe: '1M',
  window: {
    timeframe: '1M',
    label: 'Past month',
    startDate: '2026-08-17',
    endDate: '2026-09-17',
    resolution: '1d',
    requiresIntraday: false,
  },
  points: [
    {
      date: '2026-08-17',
      equity: 1000,
      cash: 100,
      marketValue: 900,
      netDeposits: 1000,
      externalFlow: 0,
      twrPercent: 0,
      mwrrPercent: 0,
      annualizedMwrrPercent: 0,
      performanceIndex: 100,
      drawdownPercent: 0,
      equityDrawdownEgp: 0,
      complete: true,
    },
    {
      date: '2026-09-17',
      equity: 1120,
      cash: 120,
      marketValue: 1000,
      netDeposits: 1050,
      externalFlow: 50,
      twrPercent: 7,
      mwrrPercent: 6.8,
      annualizedMwrrPercent: 110,
      performanceIndex: 107,
      drawdownPercent: 0,
      equityDrawdownEgp: 0,
      complete: true,
    },
  ],
  summary: {
    startDate: '2026-08-17',
    endDate: '2026-09-17',
    startEquity: 1000,
    endEquity: 1120,
    pnlEgp: 70,
    netExternalFlow: 50,
    twrPercent: 7,
    mwrrPercent: 6.8,
    annualizedMwrrPercent: 110,
    maxDrawdownPercent: 0,
    maxEquityDrawdownEgp: 0,
  },
  dataQuality: {
    valuationDays: 2,
    completeDays: 2,
    incompleteDays: 0,
    missingTickers: [],
    hasUsableRange: true,
    requiresIntraday: false,
  },
};

describe('analytics modes', () => {
  it('defines the four agreed chart modes', () => {
    expect(getAnalyticsModeDefinition('PORTFOLIO_RETURN').valueKind).toBe('egp');
    expect(getAnalyticsModeDefinition('PORTFOLIO_DEPOSITS').secondaryKey).toBe('netDeposits');
    expect(getAnalyticsModeDefinition('TWR').primaryKey).toBe('twrPercent');
    expect(getAnalyticsModeDefinition('MWR').primaryKey).toBe('mwrrPercent');
  });

  it('summarizes portfolio value and selected-period return without counting deposits as profit', () => {
    const summary = analyticsModeSummary(result, 'PORTFOLIO_RETURN');
    expect(summary.primaryValue).toBe(1120);
    expect(summary.changeEgp).toBe(70);
    expect(summary.changePercent).toBeCloseTo(7, 8);
  });

  it('exposes portfolio and cumulative net deposits on the same EGP scale', () => {
    const summary = analyticsModeSummary(result, 'PORTFOLIO_DEPOSITS');
    expect(summary.primaryValue).toBe(1120);
    expect(summary.secondaryValue).toBe(1050);
    expect(analyticsModePoints(result, 'PORTFOLIO_DEPOSITS')).toHaveLength(2);
  });

  it('uses the engine TWR and MWR summaries directly', () => {
    expect(analyticsModeSummary(result, 'TWR').primaryValue).toBe(7);
    expect(analyticsModeSummary(result, 'MWR').primaryValue).toBe(6.8);
  });
});
