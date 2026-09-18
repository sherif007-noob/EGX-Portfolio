import type { TradeTransaction } from '../types';
import type { HistoricalPriceSeries } from './historicalPriceStore';
import type { IntradayPriceSeries } from './intradayPriceStore';
import { normalizeIntradayTicker } from './intradayPriceStore';
import { sortPerformanceTransactions } from './portfolioPerformance';
import type { UnifiedAnalyticsResult } from './unifiedAnalyticsEngine';

const EPSILON = 1e-8;

interface OpenCostState {
  shares: number;
  grossCost: number;
  buyFees: number;
  lastExecutionPrice?: number;
}

export interface SecondaryAnalyticsPoint {
  date: string;
  drawdownPercent: number | null;
  equityDrawdownEgp: number;
  realizedPnlEgp: number;
  unrealizedPnlEgp: number;
  cumulativeFeesEgp: number;
  complete: boolean;
}

export interface SecondaryAnalyticsSummary {
  maxDrawdownPercent: number | null;
  maxEquityDrawdownEgp: number | null;
  realizedPnlEgp: number | null;
  unrealizedPnlEgp: number | null;
  feesInPeriodEgp: number;
}

function dayKey(value: string): string {
  return String(value || '').slice(0, 10);
}

function txTime(tx: TradeTransaction): number {
  if (tx.executedAt) {
    const value = new Date(tx.executedAt).getTime();
    if (Number.isFinite(value)) return value;
  }
  const value = new Date(tx.date).getTime();
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function feeAmount(tx: TradeTransaction): number {
  const ticker = normalizeIntradayTicker(tx.ticker);
  const kind = typeof tx.cashFlowType === 'string' ? tx.cashFlowType.trim().toUpperCase() : '';

  if (ticker === 'CASH' && kind === 'FEE') {
    const amount = Math.abs(Number(tx.cashFlowAmount ?? tx.totalAmount ?? tx.fees ?? 0));
    return Number.isFinite(amount) ? amount : 0;
  }

  if (ticker === 'CASH') return 0;
  const fees = Number(tx.fees);
  return Number.isFinite(fees) && fees > 0 ? fees : 0;
}

function applyTrade(
  tx: TradeTransaction,
  states: Map<string, OpenCostState>,
): number {
  const ticker = normalizeIntradayTicker(tx.ticker);
  if (!ticker || ticker === 'CASH') return 0;

  const shares = Number(tx.shares);
  const price = Number(tx.price);
  const fees = Number.isFinite(tx.fees) ? Math.max(0, Number(tx.fees)) : 0;
  if (!Number.isFinite(shares) || shares <= 0 || !Number.isFinite(price) || price <= 0) return 0;

  const state = states.get(ticker) ?? {
    shares: 0,
    grossCost: 0,
    buyFees: 0,
  };

  if (tx.type === 'BUY') {
    state.shares += shares;
    state.grossCost += shares * price;
    state.buyFees += fees;
    state.lastExecutionPrice = price;
    states.set(ticker, state);
    return 0;
  }

  if (tx.type !== 'SELL' || state.shares <= EPSILON || shares > state.shares + EPSILON) {
    return 0;
  }

  const sellShares = Math.min(shares, state.shares);
  const ratio = sellShares / state.shares;
  const allocatedGrossCost = state.grossCost * ratio;
  const allocatedBuyFees = state.buyFees * ratio;
  const netProceeds = sellShares * price - fees;
  const realized = netProceeds - allocatedGrossCost - allocatedBuyFees;

  state.shares = Math.max(0, state.shares - sellShares);
  state.grossCost = Math.max(0, state.grossCost - allocatedGrossCost);
  state.buyFees = Math.max(0, state.buyFees - allocatedBuyFees);
  state.lastExecutionPrice = price;

  if (state.shares <= EPSILON) states.delete(ticker);
  else states.set(ticker, state);

  return realized;
}

function dailyCloseAtOrBefore(
  historicalPrices: HistoricalPriceSeries,
  ticker: string,
  date: string,
): number | undefined {
  const series = historicalPrices[ticker];
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

function previousDailyClose(
  historicalPrices: HistoricalPriceSeries,
  ticker: string,
  sessionDate: string,
): number | undefined {
  const series = historicalPrices[ticker];
  if (!series?.length) return undefined;

  let value: number | undefined;
  for (const point of series) {
    if (dayKey(point.date) >= sessionDate) break;
    if (Number.isFinite(point.close) && point.close > 0) value = point.close;
  }
  return value;
}

function intradayCloseAtOrBefore(
  intradayPrices: IntradayPriceSeries,
  ticker: string,
  timestamp: string,
): number | undefined {
  const target = new Date(timestamp).getTime();
  if (!Number.isFinite(target)) return undefined;

  let value: number | undefined;
  for (const bar of intradayPrices[ticker] ?? []) {
    const time = new Date(bar.timestamp).getTime();
    if (!Number.isFinite(time)) continue;
    if (time > target) break;
    if (Number.isFinite(bar.close) && bar.close > 0) value = bar.close;
  }
  return value;
}

function pointIncludesTransaction(
  tx: TradeTransaction,
  pointDate: string,
  intraday: boolean,
  sessionDate: string,
): boolean {
  if (!intraday) return dayKey(tx.date) <= dayKey(pointDate);

  const txDay = dayKey(tx.date);
  if (txDay < sessionDate) return true;
  if (txDay > sessionDate) return false;

  const executed = tx.executedAt ? new Date(tx.executedAt).getTime() : Number.NaN;
  const point = new Date(pointDate).getTime();
  return Number.isFinite(executed) && Number.isFinite(point) && executed <= point;
}

function transactionInsideVisiblePeriod(
  tx: TradeTransaction,
  firstPointDate: string,
  pointDate: string,
  intraday: boolean,
): boolean {
  if (intraday) {
    const executed = tx.executedAt ? new Date(tx.executedAt).getTime() : Number.NaN;
    const start = new Date(firstPointDate).getTime();
    const end = new Date(pointDate).getTime();
    return Number.isFinite(executed) && Number.isFinite(start) && Number.isFinite(end)
      && executed >= start && executed <= end;
  }

  const txDay = dayKey(tx.date);
  return txDay >= dayKey(firstPointDate) && txDay <= dayKey(pointDate);
}

export function buildSecondaryAnalytics(
  transactions: TradeTransaction[],
  historicalPrices: HistoricalPriceSeries,
  intradayPrices: IntradayPriceSeries,
  result: UnifiedAnalyticsResult | null,
): { points: SecondaryAnalyticsPoint[]; summary: SecondaryAnalyticsSummary } {
  if (!result?.points.length) {
    return {
      points: [],
      summary: {
        maxDrawdownPercent: null,
        maxEquityDrawdownEgp: null,
        realizedPnlEgp: null,
        unrealizedPnlEgp: null,
        feesInPeriodEgp: 0,
      },
    };
  }

  const intraday = result.window.resolution === '15m';
  const sessionDate = result.window.endDate;
  const orderedTransactions = sortPerformanceTransactions(transactions);
  const states = new Map<string, OpenCostState>();
  let realizedPnl = 0;
  let transactionIndex = 0;
  const firstPointDate = result.points[0].date;
  const output: SecondaryAnalyticsPoint[] = [];

  for (const point of result.points) {
    while (
      transactionIndex < orderedTransactions.length &&
      pointIncludesTransaction(orderedTransactions[transactionIndex], point.date, intraday, sessionDate)
    ) {
      realizedPnl += applyTrade(orderedTransactions[transactionIndex], states);
      transactionIndex += 1;
    }

    let unrealizedPnl = 0;
    let complete = point.complete;

    for (const [ticker, state] of states.entries()) {
      if (state.shares <= EPSILON) continue;

      const marketPrice = intraday
        ? point.date === firstPointDate
          ? previousDailyClose(historicalPrices, ticker, sessionDate) ?? state.lastExecutionPrice
          : intradayCloseAtOrBefore(intradayPrices, ticker, point.date)
            ?? previousDailyClose(historicalPrices, ticker, sessionDate)
            ?? state.lastExecutionPrice
        : dailyCloseAtOrBefore(historicalPrices, ticker, point.date);

      if (marketPrice === undefined) {
        complete = false;
        continue;
      }

      unrealizedPnl += state.shares * marketPrice - state.grossCost - state.buyFees;
    }

    const cumulativeFeesEgp = orderedTransactions
      .filter((tx) => transactionInsideVisiblePeriod(tx, firstPointDate, point.date, intraday))
      .reduce((sum, tx) => sum + feeAmount(tx), 0);

    output.push({
      date: point.date,
      drawdownPercent: point.drawdownPercent,
      equityDrawdownEgp: point.equityDrawdownEgp,
      realizedPnlEgp: realizedPnl,
      unrealizedPnlEgp: unrealizedPnl,
      cumulativeFeesEgp,
      complete,
    });
  }

  const completePoints = output.filter((point) => point.complete);
  const last = completePoints.at(-1);

  return {
    points: completePoints,
    summary: {
      maxDrawdownPercent: completePoints.length
        ? Math.min(...completePoints.map((point) => point.drawdownPercent ?? 0))
        : null,
      maxEquityDrawdownEgp: completePoints.length
        ? Math.max(...completePoints.map((point) => point.equityDrawdownEgp))
        : null,
      realizedPnlEgp: last?.realizedPnlEgp ?? null,
      unrealizedPnlEgp: last?.unrealizedPnlEgp ?? null,
      feesInPeriodEgp: last?.cumulativeFeesEgp ?? 0,
    },
  };
}
