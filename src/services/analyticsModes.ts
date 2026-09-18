import type { UnifiedAnalyticsPoint, UnifiedAnalyticsResult } from './unifiedAnalyticsEngine';

export type AnalyticsChartMode =
  | 'PORTFOLIO_RETURN'
  | 'PORTFOLIO_DEPOSITS'
  | 'TWR'
  | 'MWR';

export interface AnalyticsModeDefinition {
  mode: AnalyticsChartMode;
  label: string;
  description: string;
  valueKind: 'egp' | 'percent';
  primaryKey: 'equity' | 'twrPercent' | 'mwrrPercent';
  secondaryKey?: 'netDeposits';
  primaryLabel: string;
  secondaryLabel?: string;
}

export interface AnalyticsModeSummary {
  primaryValue: number | null;
  changeEgp: number | null;
  changePercent: number | null;
  secondaryValue: number | null;
}

export const ANALYTICS_MODES: AnalyticsModeDefinition[] = [
  {
    mode: 'PORTFOLIO_RETURN',
    label: 'Portfolio vs Return',
    description: 'Portfolio value with selected-period profit or loss.',
    valueKind: 'egp',
    primaryKey: 'equity',
    primaryLabel: 'Portfolio',
  },
  {
    mode: 'PORTFOLIO_DEPOSITS',
    label: 'Portfolio vs Net Deposits',
    description: 'Portfolio value compared with cumulative contributed capital.',
    valueKind: 'egp',
    primaryKey: 'equity',
    secondaryKey: 'netDeposits',
    primaryLabel: 'Portfolio',
    secondaryLabel: 'Net Deposits',
  },
  {
    mode: 'TWR',
    label: 'Performance (TWR)',
    description: 'Time-weighted return with external deposits and withdrawals neutralized.',
    valueKind: 'percent',
    primaryKey: 'twrPercent',
    primaryLabel: 'TWR',
  },
  {
    mode: 'MWR',
    label: 'Performance (MWR)',
    description: 'Money-weighted return reflecting the timing of your contributed capital.',
    valueKind: 'percent',
    primaryKey: 'mwrrPercent',
    primaryLabel: 'MWR',
  },
];

export function getAnalyticsModeDefinition(mode: AnalyticsChartMode): AnalyticsModeDefinition {
  return ANALYTICS_MODES.find((item) => item.mode === mode) ?? ANALYTICS_MODES[0];
}

export function analyticsModePoints(
  result: UnifiedAnalyticsResult | null,
  mode: AnalyticsChartMode,
): UnifiedAnalyticsPoint[] {
  if (!result) return [];
  const definition = getAnalyticsModeDefinition(mode);

  return result.points.filter((point) => {
    const primary = Number(point[definition.primaryKey]);
    if (!Number.isFinite(primary)) return false;
    if (!definition.secondaryKey) return true;
    return Number.isFinite(Number(point[definition.secondaryKey]));
  });
}

export function analyticsModeSummary(
  result: UnifiedAnalyticsResult | null,
  mode: AnalyticsChartMode,
): AnalyticsModeSummary {
  if (!result) {
    return {
      primaryValue: null,
      changeEgp: null,
      changePercent: null,
      secondaryValue: null,
    };
  }

  const points = analyticsModePoints(result, mode);
  const first = points[0];
  const last = points.at(-1);

  if (mode === 'PORTFOLIO_RETURN') {
    const changeEgp = result.summary.pnlEgp;
    const changePercent =
      first && Number.isFinite(first.equity) && first.equity > 0 && changeEgp != null
        ? (changeEgp / first.equity) * 100
        : null;

    return {
      primaryValue: last?.equity ?? result.summary.endEquity,
      changeEgp,
      changePercent,
      secondaryValue: null,
    };
  }

  if (mode === 'PORTFOLIO_DEPOSITS') {
    return {
      primaryValue: last?.equity ?? result.summary.endEquity,
      changeEgp: result.summary.pnlEgp,
      changePercent: null,
      secondaryValue: last?.netDeposits ?? null,
    };
  }

  if (mode === 'TWR') {
    return {
      primaryValue: result.summary.twrPercent,
      changeEgp: null,
      changePercent: result.summary.twrPercent,
      secondaryValue: null,
    };
  }

  return {
    primaryValue: result.summary.mwrrPercent,
    changeEgp: null,
    changePercent: result.summary.mwrrPercent,
    secondaryValue: null,
  };
}
