import type { TradeTransaction } from '../types';
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
  /** Compounded subperiod percentage from the canonical TWR series. */
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
  const twr=Number(current.twrPercent);
  const priorTwr=Number(previous?.twrPercent);
  const intervalPercent = !hasPrevious || !Number.isFinite(twr) || !Number.isFinite(priorTwr) || 1+priorTwr/100<=0
    ? null
    : ((1+twr/100)/(1+priorTwr/100)-1)*100;
  return {
    cumulativeReturn,intervalReturn,intervalPercent,
    nav:current.equity,
    hasPrevious,
  };
}
