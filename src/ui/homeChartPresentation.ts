import type { TradeTransaction } from '../types';
import { sessionChangePercent } from '../services/sessionReturnPresentation';
import type { UnifiedAnalyticsPoint } from '../services/unifiedAnalyticsEngine';
import { normalizeCashFlowType } from '../services/cashFlowSemantics';

/** Cash added/removed by the investor, not investment income or IPO holds. */
export interface ChartCapitalEvent {
  date: string;
  deposited: number;
  withdrawn: number;
  netFlow: number;
}
export function chartCapitalEvents(
  transactions: ReadonlyArray<TradeTransaction>,
): ChartCapitalEvent[] {
  const byDate = new Map<string,ChartCapitalEvent>();
  for(const tx of transactions) {
    if (tx.ticker.trim().toUpperCase() !== 'CASH') continue;
    const type = normalizeCashFlowType(tx.cashFlowType);
    const kind = type === 'DEPOSIT' || type === 'WITHDRAWAL'
      ? type
      : !type && tx.type === 'BUY' ? 'DEPOSIT'
      : !type && tx.type === 'SELL' ? 'WITHDRAWAL' : null;
    if (!kind) continue; // Not cash dividends, fees, adjustments or IPO holds.
    const amount = Math.abs(Number(tx.cashFlowAmount ?? tx.totalAmount));
    if(!Number.isFinite(amount) || amount<=0) continue;
    const date = String(tx.date).slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
    const current=byDate.get(date)??{date,deposited:0,withdrawn:0,netFlow:0};
    if(kind==='DEPOSIT')current.deposited+=amount;
    else current.withdrawn+=amount;
    current.netFlow=current.deposited-current.withdrawn;
    byDate.set(date,current);
  }
  return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
}

export interface ReturnTooltipMetrics {
  /** Profit after neutralizing flows, from start of visible chart range. */
  cumulativeReturn: number|null;
  /** Profit between the current and previous plotted, complete observation. */
  intervalReturn: number|null;
  /** Broker-style session percentage, same denominator as the Home hero. */
  intervalPercent: number|null;
  nav: number;
  /** The observation is a baseline, not a false 0-EGP daily return. */
  hasPrevious: boolean;
}

type ChartPoint = Pick<UnifiedAnalyticsPoint, 'equity'|'externalFlow'|'twrPercent'|'date'> & {
  returnEgp?: number;
};

export function chartReturnTooltipMetrics(
  current: ChartPoint,
  previous?: ChartPoint,
): ReturnTooltipMetrics {
  const currentProfit=Number(current.returnEgp);
  const priorProfit=Number(previous?.returnEgp);
  const cumulativeReturn=Number.isFinite(currentProfit)?currentProfit:null;
  const hasPrevious=!!previous && Number.isFinite(previous.equity);
  const intervalReturn = !hasPrevious ? null
    : Number.isFinite(currentProfit)&&Number.isFinite(priorProfit)
      ? currentProfit-priorProfit
      : current.equity-previous!.equity-(Number(current.externalFlow)||0);
  // Keep the EGP and percentage displays mathematically consistent, even
  // when a large cash deposit changed NAV on this observation.
  const intervalPercent = intervalReturn == null
    ? null : sessionChangePercent(intervalReturn,current.equity);
  return {
    cumulativeReturn,intervalReturn,intervalPercent,
    nav:current.equity,
    hasPrevious,
  };
}

/**
 * SVG stroke/fill gradient threshold measured from the highest positive return
 * (top) to the lowest negative return (bottom). This is presentation only:
 * no valuation, transaction, or return calculations change.
 */
export function pnlSignGradientOffset(values: ReadonlyArray<number>): number {
  let min = 0, max = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  if (max === 0) return 0; // all losses
  if (min === 0) return 100; // all gains
  return 100 * max / (max - min);
}
