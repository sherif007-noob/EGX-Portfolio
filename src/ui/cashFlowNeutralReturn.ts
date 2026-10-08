import type { UnifiedAnalyticsPoint } from '../services/unifiedAnalyticsEngine';

/**
 * Build a cumulative EGP trading result from valuation changes, subtracting
 * external investor transfers AND audited reconciliation adjustments.
 *
 * This is not a percentage return or a TWR. It measures change in portfolio
 * equity after neutralizing externally added/removed capital and accounting
 * corrections between consecutive verified valuation observations.
 */
export function cashFlowNeutralReturn(points: ReadonlyArray<Pick<UnifiedAnalyticsPoint,'date'|'equity'|'externalFlow'>>):
  Array<{date:string;value:number}> {
  if (!points.length) return [];
  let runningPnl=0;
  const result: Array<{date:string;value:number}> = [];
  let previousEquity:number|null=null;
  for (const point of points) {
    if (!Number.isFinite(point.equity)) continue;
    if (previousEquity !== null) {
      const flow=point.externalFlow;
      if (!Number.isFinite(flow)) {
        previousEquity=point.equity;
        continue;
      }
      runningPnl+=point.equity-previousEquity-flow;
    }
    result.push({date:point.date,value:runningPnl});
    previousEquity=point.equity;
  }
  return result;
}
