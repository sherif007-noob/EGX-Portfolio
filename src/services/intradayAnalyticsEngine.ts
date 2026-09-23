import { TradeTransaction } from '../types';
import type { HistoricalPriceSeries } from './historicalPriceStore';
import type { IntradayPricePoint, IntradayPriceSeries } from './intradayPriceStore';
import { cairoDateKey, normalizeIntradayTicker } from './intradayPriceStore';
import { resolveAnalyticsWindow } from './analyticsTimeframes';
import {
  buildExternalCashFlows,
  sortPerformanceTransactions,
  type MWRRCashFlow,
} from './portfolioPerformance';
import {
  calculatePeriodMWR,
  type UnifiedAnalyticsPoint,
  type UnifiedAnalyticsResult,
} from './unifiedAnalyticsEngine';

const EPSILON = 1e-8;

function dayKey(value: string): string {
  return String(value || '').slice(0, 10);
}

function parseMs(value: string | undefined): number {
  if (!value) return Number.NaN;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function cashFlowKind(tx: TradeTransaction): string | undefined {
  return typeof tx.cashFlowType === 'string' ? tx.cashFlowType.trim().toUpperCase() : undefined;
}

function hasExplicitCapitalFlow(transactions: TradeTransaction[]): boolean {
  return transactions.some((tx) => {
    if (normalizeIntradayTicker(tx.ticker) !== 'CASH') return false;
    const kind = cashFlowKind(tx);
    return kind === 'DEPOSIT' || kind === 'WITHDRAWAL' || (!kind && (tx.type === 'BUY' || tx.type === 'SELL'));
  });
}

function applyTransaction(
  tx: TradeTransaction,
  state: { cash: number; shares: Map<string, number>; executionPrices: Map<string, number> },
) {
  const ticker = normalizeIntradayTicker(tx.ticker);

  if (ticker === 'CASH') {
    const kind = cashFlowKind(tx);
    const amount = Math.abs(Number(tx.cashFlowAmount ?? tx.totalAmount));
    if (!Number.isFinite(amount)) return;

    if (kind === 'DIVIDEND' || kind === 'DEPOSIT' || (!kind && tx.type === 'BUY')) state.cash += amount;
    else if (kind === 'FEE' || kind === 'WITHDRAWAL' || (!kind && tx.type === 'SELL')) state.cash -= amount;
    else if (kind === 'CASH_ADJUSTMENT') {
      const signed = Number(tx.cashFlowAmount ?? tx.totalAmount);
      if (Number.isFinite(signed)) state.cash += signed;
    }
    return;
  }

  const shares = Number(tx.shares);
  const price = Number(tx.price);
  const fees = Number.isFinite(tx.fees) ? Number(tx.fees) : 0;
  const gross = Number.isFinite(tx.grossTradeValue)
    ? Number(tx.grossTradeValue)
    : shares * price;

  if (!Number.isFinite(shares) || shares <= 0 || !Number.isFinite(price) || price <= 0) return;

  if (tx.type === 'BUY') {
    state.cash -= Number.isFinite(tx.totalAmount) && tx.totalAmount > 0
      ? Number(tx.totalAmount)
      : gross + fees;
    state.shares.set(ticker, (state.shares.get(ticker) || 0) + shares);
    state.executionPrices.set(ticker, price);
  } else {
    state.cash += Number.isFinite(tx.totalAmount) && tx.totalAmount > 0
      ? Number(tx.totalAmount)
      : Number.isFinite(tx.netCashImpact)
        ? Number(tx.netCashImpact)
        : gross - fees;
    state.shares.set(ticker, Math.max(0, (state.shares.get(ticker) || 0) - shares));
    state.executionPrices.set(ticker, price);
  }
}

function previousClose(
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

function barValuationMs(bar: IntradayPricePoint, asOfMs: number): number {
  const start = parseMs(bar.timestamp);
  if (!Number.isFinite(start) || start > asOfMs) return Number.NaN;
  const end = start + Math.max(1, bar.intervalMinutes) * 60_000;
  return Math.min(end, asOfMs);
}

function sessionBars(
  intradayPrices: IntradayPriceSeries,
  sessionDate: string,
  asOfMs: number,
): Map<string, Array<{ start: number; at: number; close: number }>> {
  const result = new Map<string, Array<{ start: number; at: number; close: number }>>();

  for (const [rawTicker, bars] of Object.entries(intradayPrices)) {
    const ticker = normalizeIntradayTicker(rawTicker);
    const clean = bars
      .filter((bar) => cairoDateKey(bar.timestamp) === sessionDate)
      .map((bar) => ({ start: parseMs(bar.timestamp), at: barValuationMs(bar, asOfMs), close: Number(bar.close) }))
      .filter((bar) => Number.isFinite(bar.start) && Number.isFinite(bar.at) && Number.isFinite(bar.close) && bar.close > 0 && bar.at <= asOfMs)
      .sort((a, b) => a.at - b.at);

    if (clean.length) result.set(ticker, clean);
  }

  return result;
}

function latestPriceAt(
  bars: Array<{ start: number; at: number; close: number }> | undefined,
  at: number,
): number | undefined {
  if (!bars?.length) return undefined;
  let value: number | undefined;
  for (const bar of bars) {
    if (bar.at > at) break;
    value = bar.close;
  }
  return value;
}

function portfolioExternalFlow(flow: MWRRCashFlow): number {
  return -flow.amount;
}

function formatIso(ms: number): string {
  return new Date(ms).toISOString();
}

export function buildIntradayAnalyticsResult(
  transactions: TradeTransaction[],
  historicalPrices: HistoricalPriceSeries,
  intradayPrices: IntradayPriceSeries,
  options: {
    sessionDate: string;
    openingCapital?: number;
    asOf?: string | Date;
    livePrices?: Record<string, number>;
  },
): UnifiedAnalyticsResult {
  const sessionDate = options.sessionDate.slice(0, 10);
  const asOfDate = options.asOf instanceof Date ? options.asOf : new Date(options.asOf || Date.now());
  const asOfMs = asOfDate.getTime();
  const window = resolveAnalyticsWindow('TODAY', { latestSessionDate: sessionDate });
  const ordered = sortPerformanceTransactions(transactions);
  const openingCapital = Number.isFinite(options.openingCapital) ? Number(options.openingCapital) : 0;

  const barsByTicker = sessionBars(intradayPrices, sessionDate, asOfMs);
  const allBarTimes = [...new Set([...barsByTicker.values()].flatMap((bars) => bars.map((bar) => bar.at)))]
    .filter((at) => Number.isFinite(at) && at <= asOfMs)
    .sort((a, b) => a - b);

  if (!allBarTimes.length) {
    return {
      timeframe: 'TODAY',
      window,
      points: [],
      summary: {
        startDate: null,
        endDate: null,
        startEquity: null,
        endEquity: null,
        pnlEgp: null,
        netExternalFlow: 0,
        twrPercent: null,
        mwrrPercent: null,
        annualizedMwrrPercent: null,
        maxDrawdownPercent: null,
        maxEquityDrawdownEgp: null,
      },
      dataQuality: {
        valuationDays: 0,
        completeDays: 0,
        incompleteDays: 0,
        missingTickers: [],
        hasUsableRange: false,
        requiresIntraday: true,
      },
    };
  }

  const baselineMs = Math.min(
    ...[...barsByTicker.values()].flatMap((bars) => bars.map((bar) => bar.start)),
  );
  const state = {
    cash: hasExplicitCapitalFlow(ordered) ? 0 : openingCapital,
    shares: new Map<string, number>(),
    executionPrices: new Map<string, number>(),
  };

  const sessionTransactions: TradeTransaction[] = [];
  const missingTimestampIds: string[] = [];

  for (const tx of ordered) {
    const txDay = dayKey(tx.date);
    if (txDay < sessionDate) {
      applyTransaction(tx, state);
      continue;
    }
    if (txDay > sessionDate) continue;

    const executed = parseMs(tx.executedAt);
    if (!Number.isFinite(executed)) {
      missingTimestampIds.push(tx.id);
      continue;
    }
    if (executed < baselineMs) applyTransaction(tx, state);
    else sessionTransactions.push(tx);
  }

  const previousCloses = new Map<string, number>();
  for (const [ticker, shares] of state.shares.entries()) {
    if (shares <= EPSILON) continue;
    const close = previousClose(historicalPrices, ticker, sessionDate);
    if (close !== undefined) previousCloses.set(ticker, close);
  }

  const allExternalFlows = buildExternalCashFlows(
    ordered,
    openingCapital,
    ordered.map((tx) => dayKey(tx.date)).filter(Boolean).sort()[0],
  );
  const openingNetDeposits = allExternalFlows
    .filter((flow) => parseMs(flow.date) < baselineMs)
    .reduce((sum, flow) => sum + portfolioExternalFlow(flow), 0);
  const sessionExternalFlows = allExternalFlows
    .filter((flow) => {
      const at = parseMs(flow.date);
      return Number.isFinite(at) && at >= baselineMs && at <= asOfMs;
    })
    .sort((a, b) => parseMs(a.date) - parseMs(b.date));

  const transactionsByTime = [...sessionTransactions].sort(
    (a, b) => parseMs(a.executedAt) - parseMs(b.executedAt),
  );
  let txIndex = 0;

  const currentPrices = new Map<string, number>();
  for (const [ticker, close] of previousCloses) currentPrices.set(ticker, close);

  const missingAtBaseline: string[] = [];
  let baselineMarketValue = 0;
  for (const [ticker, shares] of state.shares.entries()) {
    if (shares <= EPSILON) continue;
    const price = currentPrices.get(ticker);
    if (price === undefined) {
      missingAtBaseline.push(ticker);
      continue;
    }
    baselineMarketValue += shares * price;
  }

  const baselineComplete = missingAtBaseline.length === 0 && missingTimestampIds.length === 0;
  const baselineEquity = state.cash + baselineMarketValue;
  const missingTickerSet = new Set<string>(missingAtBaseline);

  const points: UnifiedAnalyticsPoint[] = [
    {
      date: formatIso(baselineMs),
      equity: baselineEquity,
      cash: state.cash,
      marketValue: baselineMarketValue,
      netDeposits: openingNetDeposits,
      externalFlow: 0,
      twrPercent: 0,
      mwrrPercent: 0,
      annualizedMwrrPercent: null,
      performanceIndex: 100,
      drawdownPercent: 0,
      equityDrawdownEgp: 0,
      complete: baselineComplete,
    },
  ];

  let twrFactor = 1;
  let performancePeak = 100;
  let equityPeak = baselineEquity;
  let previousEquity = baselineEquity;

  for (const at of allBarTimes) {
    while (
      txIndex < transactionsByTime.length &&
      parseMs(transactionsByTime[txIndex].executedAt) <= at
    ) {
      applyTransaction(transactionsByTime[txIndex], state);
      txIndex += 1;
    }

    for (const [ticker, bars] of barsByTicker) {
      const value = latestPriceAt(bars, at);
      if (value !== undefined) currentPrices.set(ticker, value);
    }

    let marketValue = 0;
    const missingTickers: string[] = [];
    for (const [ticker, shares] of state.shares.entries()) {
      if (shares <= EPSILON) continue;
      const price =
        currentPrices.get(ticker) ??
        state.executionPrices.get(ticker) ??
        previousCloses.get(ticker);
      if (price === undefined) {
        missingTickers.push(ticker);
        missingTickerSet.add(ticker);
        continue;
      }
      marketValue += shares * price;
    }

    const equity = state.cash + marketValue;
    const intervalExternalFlows = sessionExternalFlows.filter((flow) => {
      const flowMs = parseMs(flow.date);
      const previousPointMs = parseMs(points.at(-1)?.date);
      return flowMs > previousPointMs && flowMs <= at;
    });
    const externalFlow = intervalExternalFlows.reduce(
      (sum, flow) => sum + portfolioExternalFlow(flow),
      0,
    );

    if (previousEquity > EPSILON) {
      const subperiodReturn = (equity - externalFlow) / previousEquity - 1;
      if (Number.isFinite(subperiodReturn) && subperiodReturn > -1) {
        twrFactor *= 1 + subperiodReturn;
      }
    }

    const twrPercent = (twrFactor - 1) * 100;
    const performanceIndex = 100 * twrFactor;
    performancePeak = Math.max(performancePeak, performanceIndex);
    const drawdownPercent = performancePeak > 0
      ? ((performanceIndex - performancePeak) / performancePeak) * 100
      : null;

    equityPeak = Math.max(equityPeak, equity);
    const equityDrawdownEgp = Math.max(0, equityPeak - equity);
    const timestamp = formatIso(at);
    const mwrrPercent = calculatePeriodMWR(
      baselineEquity,
      formatIso(baselineMs),
      sessionExternalFlows,
      equity,
      timestamp,
    );
    const netDeposits = openingNetDeposits + sessionExternalFlows
      .filter((flow) => parseMs(flow.date) <= at)
      .reduce((sum, flow) => sum + portfolioExternalFlow(flow), 0);

    points.push({
      date: timestamp,
      equity,
      cash: state.cash,
      marketValue,
      netDeposits,
      externalFlow,
      twrPercent,
      mwrrPercent,
      annualizedMwrrPercent: null,
      performanceIndex,
      drawdownPercent,
      equityDrawdownEgp,
      complete: missingTickers.length === 0 && missingTimestampIds.length === 0,
    });
    previousEquity = equity;
  }

  const completePoints = points.filter((point) => point.complete);

  // The 15-minute store reconstructs the path, but the live quote snapshot is
  // the authoritative endpoint for the current active session. Append one
  // as-of point only when every currently held ticker has a trustworthy live
  // quote; never mix a partial live snapshot with stale bar closes.
  if (options.livePrices && completePoints.length && sessionDate <= cairoDateKey(asOfDate.toISOString())) {
    while (
      txIndex < transactionsByTime.length &&
      parseMs(transactionsByTime[txIndex].executedAt) <= asOfMs
    ) {
      applyTransaction(transactionsByTime[txIndex], state);
      txIndex += 1;
    }

    const normalizedLivePrices = new Map<string, number>();
    for (const [rawTicker, rawPrice] of Object.entries(options.livePrices)) {
      const ticker = normalizeIntradayTicker(rawTicker);
      const price = Number(rawPrice);
      if (ticker && Number.isFinite(price) && price > 0) normalizedLivePrices.set(ticker, price);
    }

    const missingLiveTickers: string[] = [];
    let liveMarketValue = 0;
    for (const [ticker, shares] of state.shares.entries()) {
      if (shares <= EPSILON) continue;
      const price = normalizedLivePrices.get(ticker);
      if (price === undefined) {
        missingLiveTickers.push(ticker);
        continue;
      }
      liveMarketValue += shares * price;
    }

    if (!missingLiveTickers.length) {
      const lastPoint = completePoints.at(-1)!;
      const lastPointMs = parseMs(lastPoint.date);
      if (asOfMs > lastPointMs) {
        const liveEquity = state.cash + liveMarketValue;
        const intervalExternalFlows = sessionExternalFlows.filter((flow) => {
          const flowMs = parseMs(flow.date);
          return flowMs > lastPointMs && flowMs <= asOfMs;
        });
        const externalFlow = intervalExternalFlows.reduce(
          (sum, flow) => sum + portfolioExternalFlow(flow),
          0,
        );

        if (previousEquity > EPSILON) {
          const subperiodReturn = (liveEquity - externalFlow) / previousEquity - 1;
          if (Number.isFinite(subperiodReturn) && subperiodReturn > -1) {
            twrFactor *= 1 + subperiodReturn;
          }
        }

        const twrPercent = (twrFactor - 1) * 100;
        const performanceIndex = 100 * twrFactor;
        performancePeak = Math.max(performancePeak, performanceIndex);
        const drawdownPercent = performancePeak > 0
          ? ((performanceIndex - performancePeak) / performancePeak) * 100
          : null;
        equityPeak = Math.max(equityPeak, liveEquity);

        // A quote sync after midnight can still represent the latest completed
        // EGX session. Keep that authoritative close attached to the session
        // itself instead of timestamping it on the following calendar day.
        const endpointMs =
          sessionDate === cairoDateKey(asOfDate.toISOString())
            ? asOfMs
            : lastPointMs + 1;
        const timestamp = formatIso(endpointMs);
        const netDeposits = openingNetDeposits + sessionExternalFlows
          .filter((flow) => parseMs(flow.date) <= asOfMs)
          .reduce((sum, flow) => sum + portfolioExternalFlow(flow), 0);

        completePoints.push({
          date: timestamp,
          equity: liveEquity,
          cash: state.cash,
          marketValue: liveMarketValue,
          netDeposits,
          externalFlow,
          twrPercent,
          mwrrPercent: calculatePeriodMWR(
            baselineEquity,
            formatIso(baselineMs),
            sessionExternalFlows,
            liveEquity,
            timestamp,
          ),
          annualizedMwrrPercent: null,
          performanceIndex,
          drawdownPercent,
          equityDrawdownEgp: Math.max(0, equityPeak - liveEquity),
          complete: true,
        });
      }
    }
  }

  const first = completePoints[0];
  const last = completePoints.at(-1);
  const netExternalFlow = first && last
    ? sessionExternalFlows
        .filter((flow) => parseMs(flow.date) > parseMs(first.date) && parseMs(flow.date) <= parseMs(last.date))
        .reduce((sum, flow) => sum + portfolioExternalFlow(flow), 0)
    : 0;
  const maxDrawdownPercent = completePoints.length
    ? Math.min(...completePoints.map((point) => point.drawdownPercent ?? 0))
    : null;
  const maxEquityDrawdownEgp = completePoints.length
    ? Math.max(...completePoints.map((point) => point.equityDrawdownEgp))
    : null;

  return {
    timeframe: 'TODAY',
    window,
    points: completePoints,
    summary: {
      startDate: first?.date ?? null,
      endDate: last?.date ?? null,
      startEquity: first?.equity ?? null,
      endEquity: last?.equity ?? null,
      pnlEgp: first && last ? last.equity - first.equity - netExternalFlow : null,
      netExternalFlow,
      twrPercent: last?.twrPercent ?? null,
      mwrrPercent: last?.mwrrPercent ?? null,
      annualizedMwrrPercent: null,
      maxDrawdownPercent,
      maxEquityDrawdownEgp,
    },
    dataQuality: {
      valuationDays: points.length,
      completeDays: completePoints.length,
      incompleteDays: points.length - completePoints.length,
      missingTickers: [...missingTickerSet],
      hasUsableRange: completePoints.length >= 2,
      requiresIntraday: true,
    },
  };
}
