import type { ClosedTrade, Position } from '../types';
import { calculatePositionUnrealizedPnl } from '../services/portfolioAccounting';
import { dmyToIso } from '../utils/dateUtils';

const validNonNegative = (x: number) => Number.isFinite(x) && x >= 0;
const positive = (x: number) => Number.isFinite(x) && x > 0;
const fraction = (value: number, denominator: number): number | null =>
  positive(denominator) ? (value / denominator) * 100 : null;

export type StopStatus = 'covered' | 'missing' | 'breached' | 'invalid' | 'unpriced';
export interface PersonalRiskHolding {
  id: string;
  ticker: string;
  sector: string;
  marketValue: number | null;
  portfolioSharePercent: number | null;
  holdingsSharePercent: number | null;
  stopPrice: number | null;
  stopStatus: StopStatus;
  capitalLossAtStop: number | null;
  quoteToStopDownside: number | null;
}

export interface PersonalRiskSnapshot {
  nav: number;
  cash: number;
  cashAllocationPercent: number | null;
  investedMarketValue: number;
  pricedCount: number;
  unpricedCount: number;
  pendingIpoValue: number;
  largestPosition: PersonalRiskHolding | null;
  topThreeHoldingsPercent: number | null;
  sectors: Array<{ name: string; marketValue: number; holdingsPercent: number }>;
  largestSector: { name: string; marketValue: number; holdingsPercent: number } | null;
  holdings: PersonalRiskHolding[];
  stopCoverageCount: number;
  stopCoverageValue: number;
  stopCoveragePercent: number | null;
  missingStopCount: number;
  breachedStopCount: number;
  invalidStopCount: number;
  uncoveredMarketValue: number;
  capitalLossAtStops: number;
  currentDownsideToStops: number;
  currentDownsideToStopsNavPercent: number | null;
  underwaterHoldingsValue: number;
  underwaterHoldingsLoss: number;
  underwaterHoldingsCount: number;
  realizedPeakToTrough: number | null;
  realizedWorstFromDate: string | null;
  realizedWorstToDate: string | null;
}

export interface RealizedDrawdown {
  amount: number | null;
  fromDate: string | null;
  toDate: string | null;
}

/**
 * A realized-trade P&L drawdown, NOT a NAV drawdown.
 * Aggregate exits by day so arbitrary same-day ledger ordering cannot
 * manufacture extra peaks/troughs. Baseline is zero cumulative realized P&L.
 * Fees are already included in closed-cycle realized P&L.
 */
export function realizedTradeDrawdown(closedTrades: ClosedTrade[]): RealizedDrawdown {
  if (closedTrades.length === 0) return { amount: null, fromDate: null, toDate: null };
  const daily = new Map<string, number>();
  for (const cycle of closedTrades) {
    const raw = String(cycle.sellDate ?? '').trim();
    // Accept the canonical ISO format and legacy DD/MM/YYYY only; do not let
    // the date utility's fallback-to-today create phantom execution dates.
    const recognized = /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:T|$)/.test(raw) ||
      /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(raw);
    if (!recognized || !Number.isFinite(cycle.realizedPnlEgp)) continue;
    const date = dmyToIso(raw);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`))) continue;
    daily.set(date, (daily.get(date) ?? 0) + cycle.realizedPnlEgp);
  }
  if (!daily.size) return { amount: null, fromDate: null, toDate: null };

  let equity = 0;
  let peak = 0;
  let peakDate: string | null = null;
  let maxDrawdown = 0;
  let worstFromDate: string | null = null;
  let worstToDate: string | null = null;
  for (const [date, pnl] of [...daily].sort(([a],[b]) => a.localeCompare(b))) {
    equity += pnl;
    if (equity > peak) {
      peak = equity;
      peakDate = date;
    }
    const drawdown = peak - equity;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      worstFromDate = peakDate;
      worstToDate = date;
    }
  }
  return { amount: maxDrawdown, fromDate: worstFromDate, toDate: worstToDate };
}

/**
 * Read-only current exposure and stop scenarios from existing reconciled
 * position projections. No simulated fills, no sell fees, no new data store.
 */
export function calculatePersonalRisk(
  positions: Position[],
  cashBalance: number,
  portfolioNav: number,
  closedTrades: ClosedTrade[] = [],
  pendingIpoValue = 0,
): PersonalRiskSnapshot {
  const nav = Number.isFinite(portfolioNav) ? portfolioNav : 0;
  const investedMarketValue = positions.reduce((sum, p) =>
    sum + (positive(p.shares) && positive(p.currentPrice) ? p.shares * p.currentPrice : 0), 0);

  const holdings: PersonalRiskHolding[] = positions.map(p => {
    const priced = positive(p.shares) && positive(p.currentPrice);
    const marketValue = priced ? p.shares * p.currentPrice : null;
    const cost = validNonNegative(p.avgBuyPrice) && validNonNegative(p.totalFees ?? 0)
      ? p.shares * p.avgBuyPrice + (p.totalFees ?? 0) : null;
    const stop = p.stopLoss;
    const hasStop = typeof stop === 'number';
    const validStop = hasStop && positive(stop);
    const status: StopStatus = !priced ? 'unpriced'
      : !hasStop ? 'missing'
      : !validStop ? 'invalid'
      : stop! >= p.currentPrice ? 'breached'
      : cost === null ? 'invalid'
      : 'covered';
    const covered = status === 'covered' && marketValue !== null && cost !== null;
    const stopValue = covered ? p.shares * stop! : null;
    return {
      id:p.id, ticker:p.ticker, sector:p.sector,
      marketValue,
      portfolioSharePercent:marketValue === null ? null : fraction(marketValue,nav),
      holdingsSharePercent:marketValue === null ? null : fraction(marketValue,investedMarketValue),
      stopPrice:hasStop ? stop! : null,
      stopStatus:status,
      // Purchase cost at stop, net of existing buy fees, but excludes future exit fees.
      capitalLossAtStop: covered ? Math.max(0,cost! - stopValue!) : null,
      quoteToStopDownside: covered ? Math.max(0,marketValue! - stopValue!) : null,
    };
  });

  const priced = holdings.filter(h => h.marketValue !== null);
  const ranked = [...priced].sort((a,b) => (b.marketValue ?? 0)-(a.marketValue ?? 0));
  const sectorsMap = new Map<string,number>();
  for (const holding of priced) sectorsMap.set(
    holding.sector, (sectorsMap.get(holding.sector) ?? 0)+(holding.marketValue ?? 0),
  );
  const sectors = [...sectorsMap.entries()].map(([name,marketValue]) => ({
    name,marketValue,holdingsPercent:fraction(marketValue,investedMarketValue) ?? 0,
  })).sort((a,b) => b.marketValue-a.marketValue);
  const covered = holdings.filter(h => h.stopStatus === 'covered');
  const stopCoverageValue = covered.reduce((s,h) => s+(h.marketValue ?? 0),0);
  const underwater = positions.filter(p =>
    positive(p.shares) && positive(p.currentPrice) && validNonNegative(p.avgBuyPrice) &&
    calculatePositionUnrealizedPnl(p) < -0.01);
  const realized = realizedTradeDrawdown(closedTrades);
  return {
    nav, cash:Number.isFinite(cashBalance) ? cashBalance : 0,
    cashAllocationPercent: Number.isFinite(cashBalance) ? fraction(cashBalance,nav) : null,
    investedMarketValue,
    pricedCount:priced.length,
    unpricedCount:positions.length-priced.length,
    pendingIpoValue:positive(pendingIpoValue) ? pendingIpoValue : 0,
    largestPosition:ranked[0] ?? null,
    topThreeHoldingsPercent:fraction(
      ranked.slice(0,3).reduce((s,h)=>s+(h.marketValue ?? 0),0),investedMarketValue),
    sectors, largestSector:sectors[0] ?? null, holdings,
    stopCoverageCount:covered.length,
    stopCoverageValue,
    stopCoveragePercent:fraction(stopCoverageValue,investedMarketValue),
    missingStopCount:holdings.filter(h=>h.stopStatus==='missing').length,
    breachedStopCount:holdings.filter(h=>h.stopStatus==='breached').length,
    invalidStopCount:holdings.filter(h=>h.stopStatus==='invalid').length,
    uncoveredMarketValue:priced.filter(h=>h.stopStatus!=='covered')
      .reduce((s,h)=>s+(h.marketValue ?? 0),0),
    capitalLossAtStops:covered.reduce((s,h)=>s+(h.capitalLossAtStop ?? 0),0),
    currentDownsideToStops:covered.reduce((s,h)=>s+(h.quoteToStopDownside ?? 0),0),
    currentDownsideToStopsNavPercent:fraction(
      covered.reduce((s,h)=>s+(h.quoteToStopDownside ?? 0),0),nav),
    underwaterHoldingsValue:underwater.reduce((s,p)=>s+p.shares*p.currentPrice,0),
    underwaterHoldingsLoss:underwater.reduce((s,p)=>s - calculatePositionUnrealizedPnl(p),0),
    underwaterHoldingsCount:underwater.length,
    realizedPeakToTrough:realized.amount,
    realizedWorstFromDate:realized.fromDate,
    realizedWorstToDate:realized.toDate,
  };
}
