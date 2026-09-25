import type { ClosedTrade } from '../types';
import { resolveAnalyticsWindow, type AnalyticsTimeframe } from './analyticsTimeframes';

export type RealizedTrajectoryTimeframe = 'ALL' | '1D' | '1W' | '1M' | '90D' | 'YTD';

export const REALIZED_TRAJECTORY_TIMEFRAMES: ReadonlyArray<{
  value: RealizedTrajectoryTimeframe;
  label: string;
}> = [
  { value: 'ALL', label: 'All' },
  { value: '1D', label: '1D' },
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '90D', label: '90D' },
  { value: 'YTD', label: 'YTD' },
];

const TO_ANALYTICS_TIMEFRAME: Record<
  Exclude<RealizedTrajectoryTimeframe, 'ALL'>,
  AnalyticsTimeframe
> = {
  '1D': 'TODAY',
  '1W': '1W',
  '1M': '1M',
  '90D': '90D',
  'YTD': 'YTD',
};

export interface RealizedTrajectoryFilterOptions {
  now?: Date;
  latestSessionDate?: string;
}

export function filterRealizedTrajectoryTrades(
  trades: readonly ClosedTrade[],
  timeframe: RealizedTrajectoryTimeframe,
  options: RealizedTrajectoryFilterOptions = {},
): ClosedTrade[] {
  if (timeframe === 'ALL') return [...trades];

  const window = resolveAnalyticsWindow(TO_ANALYTICS_TIMEFRAME[timeframe], {
    now: options.now,
    latestSessionDate: options.latestSessionDate,
  });

  return trades.filter((trade) => {
    const sellDate = String(trade.sellDate || '').slice(0, 10);
    if (!sellDate) return false;
    return sellDate >= window.startDate && sellDate <= window.endDate;
  });
}
