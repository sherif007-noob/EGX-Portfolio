import { ClosedTrade, Position, TradeTransaction } from '../types';
import { ACCOUNTING_EPSILON, calculatePortfolioValue, calculatePositionUnrealizedPnl } from './portfolioAccounting';
import { cashFlowPerformancePnl, cashFlowReturnNeutralPortfolioFlow, cashFlowSignedImpact, isCapitalCashFlowType, isReconciliationCashFlowType, normalizeCashFlowType } from './cashFlowSemantics';
import { isBonusSharesTransaction } from './corporateActions';
import {
  isIpoSubscriptionTransaction,
  pendingIpoSubscriptionValue,
} from './ipoSubscriptions';

export interface EquityBridge {
  netCapitalContributed: number;
  tradingRealizedPnl: number;
  cashPerformancePnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  reconciliationAdjustments: number;
  endingEquity: number;
  reconciliationDelta: number;
}

export function calculateEquityBridge(
  netCapitalContributed: number,
  closedTrades: ClosedTrade[],
  positions: Position[],
  cashBalance: number,
  transactions: TradeTransaction[] = [],
): EquityBridge {
  const capital = Number.isFinite(netCapitalContributed) ? netCapitalContributed : 0;
  const tradingRealizedPnl = closedTrades.reduce(
    (sum, trade) => sum + (Number.isFinite(trade.realizedPnlEgp) ? trade.realizedPnlEgp : 0),
    0,
  );
  const cashPerformancePnl = transactions
    .filter((tx) => normalizePerformanceTicker(tx.ticker) === 'CASH')
    .reduce((sum, tx) => sum + cashFlowPerformancePnl(tx.cashFlowType, tx.cashFlowAmount ?? tx.totalAmount), 0);
  const reconciliationAdjustments = transactions
    .filter((tx) => normalizePerformanceTicker(tx.ticker) === 'CASH' && isReconciliationCashFlowType(tx.cashFlowType))
    .reduce((sum, tx) => sum + (cashFlowSignedImpact(tx.cashFlowType, tx.cashFlowAmount ?? tx.totalAmount) ?? 0), 0);
  const realizedPnl = tradingRealizedPnl + cashPerformancePnl;
  const unrealizedPnl = positions.reduce((sum, position) => sum + calculatePositionUnrealizedPnl(position), 0);
  const endingEquity =
    calculatePortfolioValue(cashBalance, positions)
    + pendingIpoSubscriptionValue(transactions);
  const reconciliationDelta = endingEquity - (
    capital + realizedPnl + unrealizedPnl + reconciliationAdjustments
  );
  return {
    netCapitalContributed: capital,
    tradingRealizedPnl,
    cashPerformancePnl,
    realizedPnl,
    unrealizedPnl,
    reconciliationAdjustments,
    endingEquity,
    reconciliationDelta,
  };
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
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  source?: string;
  retrievedAt?: string;
}

export type HistoricalPriceSeries = Record<string, HistoricalPricePoint[]>;

export interface PortfolioValuationPoint {
  date: string;
  equity: number;
  cash: number;
  marketValue: number;
  complete: boolean;
  missingTickers?: string[];
}

export interface MWRRCashFlow { date: string; amount: number; type?: 'DEPOSIT' | 'WITHDRAWAL' | 'RECONCILIATION_ADJUSTMENT'; }
export interface MWRRPoint extends PortfolioValuationPoint { mwrrPercent: number | null; }
export interface PerformanceSnapshot extends MWRRPoint {
  externalCashFlow: number;
  netCapital: number;
  realizedPnl: number;
  unrealizedPnl: number;
  drawdownEgp: number;
  drawdownPercent: number;
}

function dayKey(date: string): string { return String(date || '').slice(0, 10); }
function dateMs(date: string): number { const n = new Date(date).getTime(); return Number.isFinite(n) ? n : NaN; }
function normalizePerformanceTicker(ticker: string): string { return String(ticker || '').trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, ''); }
function cashFlowKind(tx: TradeTransaction) {
  return normalizeCashFlowType(tx.cashFlowType);
}
function hasExplicitCapitalFlow(transactions: TradeTransaction[]): boolean {
  return transactions.some((tx) => {
    if (normalizePerformanceTicker(tx.ticker) !== 'CASH') return false;
    const kind = cashFlowKind(tx);
    return kind === 'DEPOSIT' || kind === 'WITHDRAWAL' || (!kind && (tx.type === 'BUY' || tx.type === 'SELL'));
  });
}

function closeAtOrBefore(series: HistoricalPricePoint[] | undefined, date: string): number | undefined {
  if (!series?.length) return undefined;
  const target = dayKey(date);
  let value: number | undefined;
  for (const point of series) {
    const pointDate = dayKey(point.date);
    if (pointDate > target) break;
    if (Number.isFinite(point.close) && point.close > 0) value = point.close;
  }
  return value;
}

function transactionTime(tx: TradeTransaction): number {
  if (tx.executedAt) {
    const executed = dateMs(tx.executedAt);
    if (Number.isFinite(executed)) return executed;
  }
  const date = dateMs(tx.date);
  return Number.isFinite(date) ? date : Number.POSITIVE_INFINITY;
}

export function sortPerformanceTransactions(transactions: TradeTransaction[]): TradeTransaction[] {
  return [...transactions].sort((a, b) => {
    const ta = transactionTime(a);
    const tb = transactionTime(b);
    if (ta !== tb) return ta - tb;
    const tradeA = Number(a.tradeId);
    const tradeB = Number(b.tradeId);
    if (Number.isFinite(tradeA) && Number.isFinite(tradeB) && tradeA !== tradeB) return tradeA - tradeB;
    if (a.type === 'CORPORATE_ACTION' && b.type !== 'CORPORATE_ACTION') return -1;
    if (b.type === 'CORPORATE_ACTION' && a.type !== 'CORPORATE_ACTION') return 1;
    if (a.type === 'BUY' && b.type === 'SELL') return -1;
    if (a.type === 'SELL' && b.type === 'BUY') return 1;
    return a.id.localeCompare(b.id);
  });
}

export function buildHistoricalEquityCurve(
  transactions: TradeTransaction[],
  historicalPrices: HistoricalPriceSeries,
  startDate?: string,
  endDate = new Date().toISOString().slice(0, 10),
  openingCapital = 0,
): PortfolioValuationPoint[] {
  const txs = sortPerformanceTransactions(transactions);
  const first = startDate || txs.map((tx) => dayKey(tx.date)).filter(Boolean).sort()[0];
  if (!first) return [];

  const dates = new Set<string>([first, endDate]);
  for (const tx of txs) {
    const date = dayKey(tx.date);
    if (date >= first && date <= endDate) dates.add(date);
    if (isIpoSubscriptionTransaction(tx) && tx.ipoSubscription) {
      const subscriptionDate = dayKey(tx.ipoSubscription.subscriptionDate);
      const allocationDate = dayKey(tx.ipoSubscription.allocationDate || '');
      const cancellationDate = dayKey(tx.ipoSubscription.cancellationDate || '');
      if (subscriptionDate >= first && subscriptionDate <= endDate) dates.add(subscriptionDate);
      if (allocationDate >= first && allocationDate <= endDate) dates.add(allocationDate);
      if (cancellationDate >= first && cancellationDate <= endDate) dates.add(cancellationDate);
    }
  }
  for (const series of Object.values(historicalPrices)) for (const point of series) { const date = dayKey(point.date); if (date >= first && date <= endDate) dates.add(date); }

  const holdings: Record<string, number> = {};
  const legacyOpeningCapital = Number.isFinite(openingCapital) && openingCapital > 0 ? openingCapital : 0;
  let cash = hasExplicitCapitalFlow(txs) ? 0 : legacyOpeningCapital;
  let pendingIpoValue = 0;
  let txIndex = 0;
  const result: PortfolioValuationPoint[] = [];
  const ipoSubscriptions = txs.filter(isIpoSubscriptionTransaction);
  const ipoSubmitted = new Set<string>();
  const ipoSettled = new Set<string>();

  for (const date of [...dates].sort()) {
    for (const tx of ipoSubscriptions) {
      const ipo = tx.ipoSubscription;
      if (!ipo) continue;
      const subscriptionDate = dayKey(ipo.subscriptionDate || tx.date);
      if (!ipoSubmitted.has(tx.id) && subscriptionDate <= date) {
        cash -= ipo.requestedAmount;
        pendingIpoValue += ipo.requestedAmount;
        ipoSubmitted.add(tx.id);
      }

      if (
        ipo.status === 'ALLOCATED'
        && ipo.allocationDate
        && !ipoSettled.has(tx.id)
        && dayKey(ipo.allocationDate) <= date
      ) {
        pendingIpoValue -= ipo.requestedAmount;
        cash += Number(ipo.refundAmount || 0);
        holdings[normalizePerformanceTicker(tx.ticker)] =
          (holdings[normalizePerformanceTicker(tx.ticker)] || 0) + Number(ipo.allocatedShares || 0);
        ipoSettled.add(tx.id);
      } else if (
        ipo.status === 'CANCELLED'
        && ipo.cancellationDate
        && !ipoSettled.has(tx.id)
        && dayKey(ipo.cancellationDate) <= date
      ) {
        pendingIpoValue -= ipo.requestedAmount;
        cash += ipo.requestedAmount;
        ipoSettled.add(tx.id);
      }
    }
    while (txIndex < txs.length && dayKey(txs[txIndex].date) <= date) {
      const tx = txs[txIndex++];
      const ticker = normalizePerformanceTicker(tx.ticker);
      if (ticker === 'CASH') {
        const kind = cashFlowKind(tx);
        if (kind) {
          const impact = cashFlowSignedImpact(kind, tx.cashFlowAmount ?? tx.totalAmount);
          if (impact !== null) cash += impact;
        } else {
          const amount = Math.abs(Number(tx.cashFlowAmount ?? tx.totalAmount));
          if (!Number.isFinite(amount)) continue;
          cash += tx.type === 'BUY' ? amount : -amount;
        }
        continue;
      }
      if (isBonusSharesTransaction(tx)) {
        holdings[ticker] = (holdings[ticker] || 0) + tx.shares;
        continue;
      }
      if (isIpoSubscriptionTransaction(tx)) continue;

      const gross = Number.isFinite(tx.grossTradeValue) ? Number(tx.grossTradeValue) : tx.shares * tx.price;
      const fees = Number.isFinite(tx.fees) ? tx.fees : 0;
      if (tx.type === 'BUY') {
        holdings[ticker] = (holdings[ticker] || 0) + tx.shares;
        cash -= gross + fees;
      } else if (tx.type === 'SELL') {
        holdings[ticker] = Math.max(0, (holdings[ticker] || 0) - tx.shares);
        cash += Number.isFinite(tx.netCashImpact) ? tx.netCashImpact : gross - fees;
      }
    }

    let marketValue = 0;
    const missingTickers: string[] = [];
    for (const [ticker, shares] of Object.entries(holdings)) {
      if (shares <= ACCOUNTING_EPSILON) continue;
      const close = closeAtOrBefore(historicalPrices[ticker], date);
      if (close === undefined) { missingTickers.push(ticker); continue; }
      marketValue += shares * close;
    }
    const complete = missingTickers.length === 0;
    const equity = cash + marketValue + pendingIpoValue;
    if (complete) result.push({ date, equity, cash, marketValue, complete });
    else result.push({ date, equity, cash, marketValue, complete, missingTickers });
  }
  return result;
}

export function buildExternalCashFlows(
  transactions: TradeTransaction[],
  openingCapital = 0,
  openingDate?: string,
): MWRRCashFlow[] {
  const ordered = sortPerformanceTransactions(transactions);
  const flows = ordered
    .filter((tx) => normalizePerformanceTicker(tx.ticker) === 'CASH')
    .map((tx) => {
      const rawType = cashFlowKind(tx);
      if (rawType) {
        const portfolioFlow = cashFlowReturnNeutralPortfolioFlow(
          rawType,
          tx.cashFlowAmount ?? tx.totalAmount,
        );
        if (!Number.isFinite(portfolioFlow) || Math.abs(portfolioFlow) <= ACCOUNTING_EPSILON) return null;
        if (!isCapitalCashFlowType(rawType) && !isReconciliationCashFlowType(rawType)) return null;
        const type = isReconciliationCashFlowType(rawType)
          ? 'RECONCILIATION_ADJUSTMENT'
          : rawType;
        return {
          date: tx.executedAt || tx.date,
          amount: -portfolioFlow,
          type,
        } as MWRRCashFlow;
      }

      const amount = Math.abs(Number(tx.cashFlowAmount ?? tx.totalAmount));
      if (!Number.isFinite(amount) || amount === 0) return null;
      const type = tx.type === 'SELL' ? 'WITHDRAWAL' : 'DEPOSIT';
      return { date: tx.executedAt || tx.date, amount: type === 'DEPOSIT' ? -amount : amount, type } as MWRRCashFlow;
    })
    .filter((flow): flow is MWRRCashFlow => !!flow);

  const hasExplicitInvestorCapitalFlow = flows.some(
    (flow) => flow.type === 'DEPOSIT' || flow.type === 'WITHDRAWAL',
  );
  if (hasExplicitInvestorCapitalFlow) return flows;

  const legacyOpeningCapital = Number.isFinite(openingCapital) && openingCapital > 0 ? openingCapital : 0;
  const fallbackDate = dayKey(openingDate || ordered[0]?.date || '');
  if (legacyOpeningCapital <= 0 || !fallbackDate) return flows;

  return [
    { date: fallbackDate, amount: -legacyOpeningCapital, type: 'DEPOSIT' as const },
    ...flows,
  ].sort((a, b) => dateMs(a.date) - dateMs(b.date));
}

function xnpv(rate: number, flows: MWRRCashFlow[]): number {
  if (rate <= -1) return Number.POSITIVE_INFINITY;
  const origin = dateMs(flows[0].date);
  return flows.reduce((sum, flow) => {
    const time = (dateMs(flow.date) - origin) / 86400000 / 365;
    return sum + flow.amount / Math.pow(1 + rate, time);
  }, 0);
}

function xnpvDerivative(rate: number, flows: MWRRCashFlow[]): number {
  if (rate <= -1) return Number.POSITIVE_INFINITY;
  const origin = dateMs(flows[0].date);
  return flows.reduce((sum, flow) => {
    const time = (dateMs(flow.date) - origin) / 86400000 / 365;
    if (time === 0) return sum;
    return sum - (time * flow.amount) / Math.pow(1 + rate, time + 1);
  }, 0);
}

function findXirrRoot(flows: MWRRCashFlow[]): number | null {
  const hasPositive = flows.some((flow) => flow.amount > 0);
  const hasNegative = flows.some((flow) => flow.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  let rate = 0.1;
  for (let i = 0; i < 60; i++) {
    const value = xnpv(rate, flows);
    if (Math.abs(value) < 0.005) return rate;
    const derivative = xnpvDerivative(rate, flows);
    if (!Number.isFinite(derivative) || Math.abs(derivative) < 1e-12) break;
    const next = rate - value / derivative;
    if (!Number.isFinite(next) || next <= -0.999999 || next > 1e8) break;
    rate = next;
  }

  const candidates = [-0.9999, -0.99, -0.9, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100, 250, 1000, 10000, 100000, 1000000];
  let previousRate = candidates[0];
  let previousValue = xnpv(previousRate, flows);
  for (const candidate of candidates.slice(1)) {
    const value = xnpv(candidate, flows);
    if (previousValue === 0) return previousRate;
    if (previousValue * value < 0) {
      let lo = previousRate;
      let hi = candidate;
      let flo = previousValue;
      for (let i = 0; i < 120; i++) {
        const mid = (lo + hi) / 2;
        const fm = xnpv(mid, flows);
        if (Math.abs(fm) < 0.005) return mid;
        if (flo * fm <= 0) { hi = mid; } else { lo = mid; flo = fm; }
      }
      return (lo + hi) / 2;
    }
    previousRate = candidate;
    previousValue = value;
  }
  return null;
}

export function calculateMWRR(cashFlows: MWRRCashFlow[], endingValue: number, endingDate: string): number | null {
  if (!Number.isFinite(endingValue) || endingValue < 0 || cashFlows.length === 0) return null;
  const flows = [...cashFlows, { date: endingDate, amount: endingValue }].filter((flow) => Number.isFinite(flow.amount) && Number.isFinite(dateMs(flow.date))).sort((a, b) => dateMs(a.date) - dateMs(b.date));
  const root = findXirrRoot(flows);
  return root === null ? null : root * 100;
}

export function buildMWRRSeries(valuations: PortfolioValuationPoint[], externalCashFlows: MWRRCashFlow[]): MWRRPoint[] {
  return valuations.map((point) => ({ ...point, mwrrPercent: point.complete ? calculateMWRR(externalCashFlows.filter((flow) => dateMs(flow.date) <= dateMs(point.date)), point.equity, point.date) : null }));
}

export function buildPerformanceSeries(valuations: PortfolioValuationPoint[], externalCashFlows: MWRRCashFlow[]): PerformanceSnapshot[] {
  const series = buildMWRRSeries(valuations, externalCashFlows);
  let peak = Number.NEGATIVE_INFINITY;
  let netCapital = 0;
  let flowIndex = 0;
  const orderedFlows = [...externalCashFlows].sort((a, b) => dateMs(a.date) - dateMs(b.date));
  return series.map((point) => {
    while (flowIndex < orderedFlows.length && dayKey(orderedFlows[flowIndex].date) <= point.date) {
      const flow = orderedFlows[flowIndex++];
      netCapital += flow.type === 'WITHDRAWAL' ? -flow.amount : -flow.amount;
    }
    if (point.equity > peak) peak = point.equity;
    const drawdownEgp = Number.isFinite(peak) ? Math.max(0, peak - point.equity) : 0;
    const drawdownPercent = peak > ACCOUNTING_EPSILON ? (drawdownEgp / peak) * 100 : 0;
    return { ...point, externalCashFlow: orderedFlows.filter((flow) => dayKey(flow.date) === point.date).reduce((sum, flow) => sum + flow.amount, 0), netCapital, realizedPnl: 0, unrealizedPnl: 0, drawdownEgp, drawdownPercent };
  });
}
