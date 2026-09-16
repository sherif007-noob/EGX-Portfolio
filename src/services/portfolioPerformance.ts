import { ClosedTrade, Position, TradeTransaction, EGXTicker } from '../types';
import { ACCOUNTING_EPSILON, calculatePortfolioValue, calculatePositionUnrealizedPnl } from './portfolioAccounting';

export interface EquityBridge { netCapitalContributed: number; realizedPnl: number; unrealizedPnl: number; endingEquity: number; reconciliationDelta: number; }
export function calculateEquityBridge(netCapitalContributed: number, closedTrades: ClosedTrade[], positions: Position[], cashBalance: number): EquityBridge {
  const capital = Number.isFinite(netCapitalContributed) ? netCapitalContributed : 0;
  const realizedPnl = closedTrades.reduce((sum, trade) => sum + (Number.isFinite(trade.realizedPnlEgp) ? trade.realizedPnlEgp : 0), 0);
  const unrealizedPnl = positions.reduce((sum, position) => sum + calculatePositionUnrealizedPnl(position), 0);
  const endingEquity = calculatePortfolioValue(cashBalance, positions);
  return { netCapitalContributed: capital, realizedPnl, unrealizedPnl, endingEquity, reconciliationDelta: endingEquity - (capital + realizedPnl + unrealizedPnl) };
}
export function isEquityBridgeBalanced(bridge: EquityBridge, tolerance = 0.01): boolean { return Number.isFinite(bridge.reconciliationDelta) && Math.abs(bridge.reconciliationDelta) <= Math.max(tolerance, ACCOUNTING_EPSILON); }
export interface DrawdownPoint { equity: number; }
export interface DrawdownResult { maxDrawdownEgp: number; maxDrawdownPercent: number; peakEquity: number; troughEquity: number; }
export function calculateMaxDrawdown(points: DrawdownPoint[]): DrawdownResult {
  let peak = Number.NEGATIVE_INFINITY, maxDrawdownEgp = 0, maxDrawdownPercent = 0, peakEquity = 0, troughEquity = 0;
  for (const point of points) {
    if (!Number.isFinite(point.equity)) continue;
    if (point.equity > peak) peak = point.equity;
    if (!Number.isFinite(peak) || peak <= ACCOUNTING_EPSILON) continue;
    const drawdownEgp = Math.max(0, peak - point.equity), drawdownPercent = drawdownEgp / peak * 100;
    if (drawdownEgp > maxDrawdownEgp) { maxDrawdownEgp = drawdownEgp; maxDrawdownPercent = drawdownPercent; peakEquity = peak; troughEquity = point.equity; }
  }
  return { maxDrawdownEgp, maxDrawdownPercent, peakEquity, troughEquity };
}

export interface HistoricalPricePoint { date: string; close: number; }
export type HistoricalPriceSeries = Record<string, HistoricalPricePoint[]>;
export interface PortfolioValuationPoint { date: string; equity: number; cash: number; marketValue: number; }
export interface MWRRCashFlow { date: string; amount: number; }
export interface MWRRPoint extends PortfolioValuationPoint { mwrrPercent: number; }

function dayKey(date: string): string { return date.slice(0, 10); }
function dateMs(date: string): number { const n = new Date(date).getTime(); return Number.isFinite(n) ? n : NaN; }
function closeAtOrBefore(series: HistoricalPricePoint[] | undefined, date: string): number | undefined {
  if (!series?.length) return undefined;
  const target = dayKey(date); let value: number | undefined;
  for (const p of series) { if (dayKey(p.date) > target) break; if (Number.isFinite(p.close) && p.close > 0) value = p.close; }
  return value;
}

/** Reconstructs end-of-day equity from the ledger and daily closes. */
export function buildHistoricalEquityCurve(transactions: TradeTransaction[], historicalPrices: HistoricalPriceSeries, startDate?: string, endDate = new Date().toISOString().slice(0, 10)): PortfolioValuationPoint[] {
  const txs = [...transactions].sort((a, b) => dateMs(a.date) - dateMs(b.date));
  const first = startDate || txs[0]?.date?.slice(0, 10); if (!first) return [];
  const dates = new Set<string>([first, endDate]);
  for (const tx of txs) { const d = dayKey(tx.date); if (d >= first && d <= endDate) dates.add(d); }
  for (const series of Object.values(historicalPrices)) for (const p of series) { const d = dayKey(p.date); if (d >= first && d <= endDate) dates.add(d); }
  const holdings: Record<string, number> = {}; let cash = 0; let i = 0; const result: PortfolioValuationPoint[] = [];
  for (const date of [...dates].sort()) {
    while (i < txs.length && dayKey(txs[i].date) <= date) {
      const tx = txs[i++]; const ticker = tx.ticker.trim().toUpperCase();
      if (ticker === 'CASH') { cash += tx.type === 'BUY' ? Math.abs(tx.totalAmount) : -Math.abs(tx.totalAmount); continue; }
      const gross = Number.isFinite(tx.grossTradeValue) ? tx.grossTradeValue : tx.shares * tx.price;
      const fees = Number.isFinite(tx.fees) ? tx.fees : 0;
      if (tx.type === 'BUY') { holdings[ticker] = (holdings[ticker] || 0) + tx.shares; cash -= gross + fees; }
      else if (tx.type === 'SELL') { holdings[ticker] = Math.max(0, (holdings[ticker] || 0) - tx.shares); cash += gross - fees; }
    }
    let marketValue = 0; let complete = true;
    for (const [ticker, shares] of Object.entries(holdings)) { if (shares <= ACCOUNTING_EPSILON) continue; const close = closeAtOrBefore(historicalPrices[ticker], date); if (close === undefined) { complete = false; break; } marketValue += shares * close; }
    if (complete) result.push({ date, equity: cash + marketValue, cash, marketValue });
  }
  return result;
}

export function buildExternalCashFlows(transactions: TradeTransaction[]): MWRRCashFlow[] {
  return transactions.filter(tx => tx.ticker.trim().toUpperCase() === 'CASH').map(tx => ({ date: tx.date, amount: tx.type === 'BUY' ? -Math.abs(tx.totalAmount) : Math.abs(tx.totalAmount) })).filter(x => Number.isFinite(x.amount) && x.amount !== 0).sort((a, b) => dateMs(a.date) - dateMs(b.date));
}

export function calculateMWRR(cashFlows: MWRRCashFlow[], endingValue: number, endingDate: string): number | null {
  if (!Number.isFinite(endingValue) || endingValue <= 0 || cashFlows.length === 0) return null;
  const flows = [...cashFlows, { date: endingDate, amount: endingValue }].sort((a, b) => dateMs(a.date) - dateMs(b.date));
  const origin = dateMs(flows[0].date), times = flows.map(f => (dateMs(f.date) - origin) / 86400000 / 365), amounts = flows.map(f => f.amount);
  const npv = (r: number) => amounts.reduce((s, a, j) => s + a / Math.pow(1 + r, times[j]), 0);
  const derivative = (r: number) => amounts.reduce((s, a, j) => j === 0 ? s : s - times[j] * a / Math.pow(1 + r, times[j] + 1), 0);
  let r = 0.1;
  for (let j = 0; j < 50; j++) { const v = npv(r); if (Math.abs(v) < 0.005) return r * 100; const d = derivative(r); if (!Number.isFinite(d) || Math.abs(d) < 1e-12) break; const next = r - v / d; if (!Number.isFinite(next) || next <= -0.999999 || next > 1e6) break; r = next; }
  let lo = -0.9999, hi = 10, flo = npv(lo), fhi = npv(hi); for (let j = 0; j < 30 && flo * fhi > 0; j++) { hi *= 2; fhi = npv(hi); }
  if (flo * fhi > 0) return null;
  for (let j = 0; j < 100; j++) { const mid = (lo + hi) / 2, fm = npv(mid); if (Math.abs(fm) < 0.005) return mid * 100; if (flo * fm <= 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; } }
  return ((lo + hi) / 2) * 100;
}
export function buildMWRRSeries(valuations: PortfolioValuationPoint[], externalCashFlows: MWRRCashFlow[]): MWRRPoint[] {
  return valuations.map(p => ({ ...p, mwrrPercent: calculateMWRR(externalCashFlows.filter(f => dateMs(f.date) <= dateMs(p.date)), p.equity, p.date) ?? 0 }));
}
