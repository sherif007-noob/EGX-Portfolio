import { ClosedTrade, Position, TradeTransaction, EGXTicker } from '../types';
import { ACCOUNTING_EPSILON, calculatePortfolioValue, calculatePositionUnrealizedPnl } from './portfolioAccounting';

export interface EquityBridge {
  netCapitalContributed: number;
  realizedPnl: number;
  unrealizedPnl: number;
  endingEquity: number;
  reconciliationDelta: number;
}

export function calculateEquityBridge(
  netCapitalContributed: number,
  closedTrades: ClosedTrade[],
  positions: Position[],
  cashBalance: number,
): EquityBridge {
  const capital = Number.isFinite(netCapitalContributed) ? netCapitalContributed : 0;
  const realizedPnl = closedTrades.reduce((sum, trade) => sum + (Number.isFinite(trade.realizedPnlEgp) ? trade.realizedPnlEgp : 0), 0);
  const unrealizedPnl = positions.reduce((sum, position) => sum + calculatePositionUnrealizedPnl(position), 0);
  const endingEquity = calculatePortfolioValue(cashBalance, positions);
  const expectedEquity = capital + realizedPnl + unrealizedPnl;
  return { netCapitalContributed: capital, realizedPnl, unrealizedPnl, endingEquity, reconciliationDelta: endingEquity - expectedEquity };
}

export function isEquityBridgeBalanced(bridge: EquityBridge, tolerance = 0.01): boolean {
  return Number.isFinite(bridge.reconciliationDelta) && Math.abs(bridge.reconciliationDelta) <= Math.max(tolerance, ACCOUNTING_EPSILON);
}

export interface DrawdownPoint { equity: number; }
export interface DrawdownResult { maxDrawdownEgp: number; maxDrawdownPercent: number; peakEquity: number; troughEquity: number; }

export function calculateMaxDrawdown(points: DrawdownPoint[]): DrawdownResult {
  let peak = Number.NEGATIVE_INFINITY;
  let maxDrawdownEgp = 0;
  let maxDrawdownPercent = 0;
  let peakEquity = 0;
  let troughEquity = 0;
  for (const point of points) {
    if (!Number.isFinite(point.equity)) continue;
    if (point.equity > peak) peak = point.equity;
    if (!Number.isFinite(peak) || peak <= ACCOUNTING_EPSILON) continue;
    const drawdownEgp = Math.max(0, peak - point.equity);
    const drawdownPercent = (drawdownEgp / peak) * 100;
    if (drawdownEgp > maxDrawdownEgp) {
      maxDrawdownEgp = drawdownEgp;
      maxDrawdownPercent = drawdownPercent;
      peakEquity = peak;
      troughEquity = point.equity;
    }
  }
  return { maxDrawdownEgp, maxDrawdownPercent, peakEquity, troughEquity };
}

export interface HistoricalPricePoint {
  date: string;
  close: number;
}

export type HistoricalPriceSeries = Record<string, HistoricalPricePoint[]>;

export interface PortfolioValuationPoint {
  date: string;
  equity: number;
  cash: number;
  marketValue: number;
}

export interface MWRRCashFlow {
  date: string;
  amount: number;
}

export interface MWRRPoint extends PortfolioValuationPoint {
  mwrrPercent: number;
}

function dayKey(date: string): string {
  return date.slice(0, 10);
}

function parseDateMs(date: string): number {
  const value = new Date(date).getTime();
  return Number.isFinite(value) ? value : NaN;
}

function findClose(series: HistoricalPricePoint[] | undefined, date: string): number | undefined {
  if (!series?.length) return undefined;
  const target = dayKey(date);
  let latest: HistoricalPricePoint | undefined;
  for (const point of series) {
    if (dayKey(point.date) > target) break;
    if (Number.isFinite(point.close) && point.close > 0) latest = point;
  }
  return latest?.close;
}

/**
 * Reconstructs end-of-day portfolio equity from the transaction ledger and
 * daily closing prices. No historical valuation is invented when a held
 * ticker has no price for a required date.
 */
export function buildHistoricalEquityCurve(
  transactions: TradeTransaction[],
  tickers: EGXTicker[],
  historicalPrices: HistoricalPriceSeries,
  startDate?: string,
  endDate = new Date().toISOString().slice(0, 10),
): PortfolioValuationPoint[] {
  const normalized = [...transactions].sort((a, b) => parseDateMs(a.date) - parseDateMs(b.date));
  const firstDate = startDate || normalized[0]?.date?.slice(0, 10);
  if (!firstDate) return [];

  const dates = new Set<string>([firstDate, endDate]);
  for (const tx of normalized) {
    const d = dayKey(tx.date);
    if (d >= firstDate && d <= endDate) dates.add(d);
  }
  for (const series of Object.values(historicalPrices)) {
    for (const point of series) {
      const d = dayKey(point.date);
      if (d >= firstDate && d <= endDate) dates.add(d);
    }
  }

  const orderedDates = [...dates].sort();
  const holdings: Record<string, number> = {};
  let cash = 0;
  let txIndex = 0;
  const result: PortfolioValuationPoint[] = [];

  for (const date of orderedDates) {
    while (txIndex < normalized.length && dayKey(normalized[txIndex].date) <= date) {
      const tx = normalized[txIndex++];
      const ticker = tx.ticker.trim().toUpperCase();
      const amount = Number.isFinite(tx.totalAmount) ? tx.totalAmount : tx.shares * tx.price + tx.fees;
      if (ticker === 'CASH') {
        if (tx.type === 'BUY') cash += amount;
        else if (tx.type === 'SELL') cash -= amount;
      } else if (tx.type === 'BUY') {
        holdings[ticker] = (holdings[ticker] || 0) + tx.shares;
        cash -= amount;
      } else if (tx.type === 'SELL') {
        holdings[ticker] = Math.max(0, (holdings[ticker] || 0) - tx.shares);
        cash += Math.max(0, amount - 2 * tx.fees);
      }
    }

    let marketValue = 0;
    let complete = true;
    for (const [ticker, shares] of Object.entries(holdings)) {
      if (shares <= ACCOUNTING_EPSILON) continue;
      const close = findClose(historicalPrices[ticker], date);
      if (close === undefined) {
        complete = false;
        break;
      }
      marketValue += shares * close;
    }
    if (!complete) continue;

    // If there are no external cash transactions before the first ledger date,
    // this curve intentionally starts at reconstructed cash, not an invented initial value.
    result.push({ date, equity: cash + marketValue, cash, marketValue });
  }
  return result;
}

export function buildExternalCashFlows(transactions: TradeTransaction[]): MWRRCashFlow[] {
  return transactions
    .filter(tx => tx.ticker.trim().toUpperCase() === 'CASH')
    .map(tx => ({ date: tx.date, amount: tx.type === 'BUY' ? -Math.abs(tx.totalAmount) : Math.abs(tx.totalAmount) }))
    .filter(flow => Number.isFinite(flow.amount) && flow.amount !== 0)
    .sort((a, b) => parseDateMs(a.date) - parseDateMs(b.date));
}

/**
 * Solves the money-weighted return (XIRR-style annualized return) for dated
 * external cash flows and an ending portfolio value. Newton-Raphson is used
 * with a bisection fallback for robustness around unusual cash-flow patterns.
 */
export function calculateMWRR(
  cashFlows: MWRRCashFlow[],
  endingValue: number,
  endingDate: string,
): number | null {
  if (!Number.isFinite(endingValue) || endingValue <= 0 || cashFlows.length === 0) return null;
  const flows = [...cashFlows, { date: endingDate, amount: endingValue }].sort((a, b) => parseDateMs(a.date) - parseDateMs(b.date));
  const origin = parseDateMs(flows[0].date);
  const yearFractions = flows.map(flow => (parseDateMs(flow.date) - origin) / 86400000 / 365);
  const amounts = flows.map(flow => flow.amount);
  const npv = (rate: number) => amounts.reduce((sum, amount, i) => sum + amount / Math.pow(1 + rate, yearFractions[i]), 0);
  const derivative = (rate: number) => amounts.reduce((sum, amount, i) => i === 0 ? sum : sum - yearFractions[i] * amount / Math.pow(1 + rate, yearFractions[i] + 1), 0);

  let rate = 0.1;
  for (let i = 0; i < 50; i++) {
    if (rate <= -0.999999) rate = -0.9;
    const value = npv(rate);
    if (Math.abs(value) < 0.005) return rate * 100;
    const slope = derivative(rate);
    if (!Number.isFinite(slope) || Math.abs(slope) < 1e-12) break;
    const next = rate - value / slope;
    if (!Number.isFinite(next) || next <= -0.999999 || next > 1e6) break;
    rate = next;
  }

  let low = -0.9999;
  let high = 10;
  let lowValue = npv(low);
  let highValue = npv(high);
  for (let i = 0; i < 30 && lowValue * highValue > 0; i++) {
    high *= 2;
    highValue = npv(high);
  }
  if (lowValue * highValue > 0) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    const value = npv(mid);
    if (Math.abs(value) < 0.005) return mid * 100;
    if (lowValue * value <= 0) { high = mid; highValue = value; }
    else { low = mid; lowValue = value; }
  }
  return ((low + high) / 2) * 100;
}

export function buildMWRRSeries(
  valuations: PortfolioValuationPoint[],
  externalCashFlows: MWRRCashFlow[],
): MWRRPoint[] {
  return valuations.map(point => {
    const flows = externalCashFlows.filter(flow => parseDateMs(flow.date) <= parseDateMs(point.date));
    const mwrrPercent = calculateMWRR(flows, point.equity, point.date);
    return { ...point, mwrrPercent: mwrrPercent ?? 0 };
  });
}
