import { TradeTransaction } from '../types';
import { HistoricalPriceSeries } from './historicalPriceStore';
import {
  buildExternalCashFlows,
  buildHistoricalEquityCurve,
  calculateMWRR,
  MWRRCashFlow,
  PortfolioValuationPoint,
} from './portfolioPerformance';
import {
  AnalyticsTimeframe,
  AnalyticsWindow,
  resolveAnalyticsWindow,
} from './analyticsTimeframes';

export interface UnifiedAnalyticsPoint {
  date: string;
  equity: number;
  cash: number;
  marketValue: number;
  netDeposits: number;
  externalFlow: number;
  twrPercent: number | null;
  mwrrPercent: number | null;
  annualizedMwrrPercent: number | null;
  performanceIndex: number | null;
  drawdownPercent: number | null;
  equityDrawdownEgp: number;
  complete: boolean;
}

export interface UnifiedAnalyticsResult {
  timeframe: AnalyticsTimeframe;
  window: AnalyticsWindow;
  points: UnifiedAnalyticsPoint[];
  summary: {
    startDate: string | null;
    endDate: string | null;
    startEquity: number | null;
    endEquity: number | null;
    pnlEgp: number | null;
    netExternalFlow: number;
    twrPercent: number | null;
    mwrrPercent: number | null;
    annualizedMwrrPercent: number | null;
    maxDrawdownPercent: number | null;
    maxEquityDrawdownEgp: number | null;
  };
  dataQuality: {
    valuationDays: number;
    completeDays: number;
    incompleteDays: number;
    missingTickers: string[];
    hasUsableRange: boolean;
    requiresIntraday: boolean;
  };
}

function dateMs(date: string): number {
  const value = new Date(date).getTime();
  return Number.isFinite(value) ? value : NaN;
}

function dayKey(date: string): string {
  return String(date || '').slice(0, 10);
}

function hasExplicitCapitalFlowTransaction(transactions: TradeTransaction[]): boolean {
  return transactions.some((tx) => {
    const ticker = String(tx.ticker || '')
      .trim()
      .toUpperCase()
      .replace(/^EGX:/, '')
      .replace(/\.CA$/, '');

    if (ticker !== 'CASH') return false;

    const kind = typeof tx.cashFlowType === 'string'
      ? tx.cashFlowType.trim().toUpperCase()
      : '';

    return (
      kind === 'DEPOSIT' ||
      kind === 'WITHDRAWAL' ||
      (!kind && (tx.type === 'BUY' || tx.type === 'SELL'))
    );
  });
}

function portfolioFlow(flow: MWRRCashFlow): number {
  return -flow.amount;
}

function flowWithin(flow: MWRRCashFlow, startExclusive: string, endInclusive: string): boolean {
  const day = dayKey(flow.date);
  return day > startExclusive && day <= endInclusive;
}

function flowOnOrBefore(flow: MWRRCashFlow, date: string): boolean {
  return dayKey(flow.date) <= date;
}

function sumPortfolioFlows(flows: MWRRCashFlow[]): number {
  return flows.reduce((sum, flow) => sum + portfolioFlow(flow), 0);
}

function selectValuationWindow(
  valuations: PortfolioValuationPoint[],
  window: AnalyticsWindow,
): PortfolioValuationPoint[] {
  const complete = valuations
    .filter((point) => point.complete)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!complete.length || window.requiresIntraday) return [];

  const beforeOrAtStart = complete.filter((point) => point.date <= window.startDate);
  const anchor = beforeOrAtStart.at(-1) ?? complete.find((point) => point.date >= window.startDate);
  if (!anchor || anchor.date > window.endDate) return [];

  const selected = complete.filter(
    (point) => point.date >= anchor.date && point.date <= window.endDate,
  );

  return selected;
}

function periodicNpv(rate: number, flows: Array<{ date: string; amount: number }>, durationMs: number): number {
  if (rate <= -1) return Number.POSITIVE_INFINITY;
  const origin = dateMs(flows[0].date);
  return flows.reduce((sum, flow) => {
    const elapsed = dateMs(flow.date) - origin;
    const exponent = durationMs > 0 ? elapsed / durationMs : 0;
    return sum + flow.amount / Math.pow(1 + rate, exponent);
  }, 0);
}

function solvePeriodicRate(flows: Array<{ date: string; amount: number }>, durationMs: number): number | null {
  const hasPositive = flows.some((flow) => flow.amount > 0);
  const hasNegative = flows.some((flow) => flow.amount < 0);
  if (!hasPositive || !hasNegative || durationMs <= 0) return null;

  const candidates = [
    -0.999999, -0.99, -0.9, -0.75, -0.5, -0.25, 0,
    0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100, 250, 1000, 10000,
  ];

  let previousRate = candidates[0];
  let previousValue = periodicNpv(previousRate, flows, durationMs);

  if (Math.abs(previousValue) < 0.000001) return previousRate;

  for (const candidate of candidates.slice(1)) {
    const value = periodicNpv(candidate, flows, durationMs);
    if (Math.abs(value) < 0.000001) return candidate;

    if (Number.isFinite(previousValue) && Number.isFinite(value) && previousValue * value < 0) {
      let lo = previousRate;
      let hi = candidate;
      let flo = previousValue;

      for (let i = 0; i < 120; i++) {
        const mid = (lo + hi) / 2;
        const fm = periodicNpv(mid, flows, durationMs);
        if (Math.abs(fm) < 0.000001) return mid;
        if (flo * fm <= 0) {
          hi = mid;
        } else {
          lo = mid;
          flo = fm;
        }
      }
      return (lo + hi) / 2;
    }

    previousRate = candidate;
    previousValue = value;
  }

  return null;
}

export function calculatePeriodMWR(
  startingValue: number,
  startingDate: string,
  externalCashFlows: MWRRCashFlow[],
  endingValue: number,
  endingDate: string,
): number | null {
  if (
    !Number.isFinite(startingValue) ||
    startingValue <= 0 ||
    !Number.isFinite(endingValue) ||
    endingValue < 0
  ) {
    return null;
  }

  const startMs = dateMs(startingDate);
  const endMs = dateMs(endingDate);
  const durationMs = endMs - startMs;
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 0;

  const dailyBoundary = startingDate.length <= 10 && endingDate.length <= 10;
  const relevantFlows = externalCashFlows
    .filter((flow) => {
      if (dailyBoundary) {
        const flowDay = dayKey(flow.date);
        return flowDay > dayKey(startingDate) && flowDay <= dayKey(endingDate);
      }
      const flowMs = dateMs(flow.date);
      return Number.isFinite(flowMs) && flowMs > startMs && flowMs <= endMs;
    })
    .sort((a, b) => dateMs(a.date) - dateMs(b.date));

  if (!relevantFlows.length) {
    return ((endingValue / startingValue) - 1) * 100;
  }

  const flows = [
    { date: startingDate, amount: -startingValue },
    ...relevantFlows.map((flow) => ({ date: flow.date, amount: flow.amount })),
    { date: endingDate, amount: endingValue },
  ];

  const rate = solvePeriodicRate(flows, durationMs);
  return rate === null ? null : rate * 100;
}

function buildPoints(
  valuations: PortfolioValuationPoint[],
  allExternalFlows: MWRRCashFlow[],
  initialBaselineEquity?: number,
): UnifiedAnalyticsPoint[] {
  if (!valuations.length) return [];

  const anchor = valuations[0];
  const initialBaseline =
    Number.isFinite(initialBaselineEquity) && Number(initialBaselineEquity) > 0
      ? Number(initialBaselineEquity)
      : null;
  const periodStartingEquity = initialBaseline ?? anchor.equity;
  let twrFactor = initialBaseline ? anchor.equity / initialBaseline : 1;
  let performancePeak = Math.max(100, 100 * twrFactor);
  let equityPeak = initialBaseline ?? anchor.equity;

  return valuations.map((point, index) => {
    const netDeposits = sumPortfolioFlows(
      allExternalFlows.filter((flow) => flowOnOrBefore(flow, point.date)),
    );

    const dailyExternalFlows = allExternalFlows.filter((flow) => {
      if (index === 0) return dayKey(flow.date) === point.date;
      return flowWithin(flow, valuations[index - 1].date, point.date);
    });
    const externalFlow = sumPortfolioFlows(dailyExternalFlows);

    if (index > 0) {
      const previous = valuations[index - 1];
      if (previous.equity > 0) {
        const subperiodReturn = (point.equity - externalFlow) / previous.equity - 1;
        if (Number.isFinite(subperiodReturn) && subperiodReturn > -1) {
          twrFactor *= 1 + subperiodReturn;
        }
      }
    }

    const twrPercent = (twrFactor - 1) * 100;
    const performanceIndex = 100 * twrFactor;
    performancePeak = Math.max(performancePeak, performanceIndex);
    const drawdownPercent = performancePeak > 0
      ? ((performanceIndex - performancePeak) / performancePeak) * 100
      : null;

    equityPeak = Math.max(equityPeak, point.equity);
    const equityDrawdownEgp = Math.max(0, equityPeak - point.equity);

    const mwrrPercent = index === 0
      ? initialBaseline
        ? ((point.equity / initialBaseline) - 1) * 100
        : 0
      : calculatePeriodMWR(
          periodStartingEquity,
          anchor.date,
          allExternalFlows,
          point.equity,
          point.date,
        );

    const periodFlows = allExternalFlows.filter((flow) => {
      const flowDay = dayKey(flow.date);
      return flowDay > anchor.date && flowDay <= point.date;
    });
    const annualizedMwrrPercent = index === 0
      ? 0
      : calculateMWRR(
          [{ date: anchor.date, amount: -periodStartingEquity }, ...periodFlows],
          point.equity,
          point.date,
        );

    return {
      date: point.date,
      equity: point.equity,
      cash: point.cash,
      marketValue: point.marketValue,
      netDeposits,
      externalFlow,
      twrPercent,
      mwrrPercent,
      annualizedMwrrPercent,
      performanceIndex,
      drawdownPercent,
      equityDrawdownEgp,
      complete: point.complete,
    };
  });
}

export function buildUnifiedAnalyticsResult(
  transactions: TradeTransaction[],
  historicalPrices: HistoricalPriceSeries,
  timeframe: AnalyticsTimeframe,
  options: {
    latestSessionDate?: string;
    now?: Date;
    openingCapital?: number;
  } = {},
): UnifiedAnalyticsResult {
  const firstTransactionDate = transactions
    .map((tx) => dayKey(tx.date))
    .filter(Boolean)
    .sort()[0];

  const window = resolveAnalyticsWindow(timeframe, {
    latestSessionDate: options.latestSessionDate,
    now: options.now,
    firstPortfolioDate: firstTransactionDate,
  });

  const allValuations = buildHistoricalEquityCurve(
    transactions,
    historicalPrices,
    firstTransactionDate,
    window.endDate,
    options.openingCapital ?? 0,
  );

  const allExternalFlows = buildExternalCashFlows(
    transactions,
    options.openingCapital ?? 0,
    firstTransactionDate,
  );

  const selectedValuations = selectValuationWindow(allValuations, window);
  const openingCapital = Number.isFinite(options.openingCapital)
    ? Number(options.openingCapital)
    : 0;
  const initialBaselineEquity =
    openingCapital > 0 &&
    selectedValuations[0]?.date === firstTransactionDate &&
    !hasExplicitCapitalFlowTransaction(transactions)
      ? openingCapital
      : undefined;
  const points = buildPoints(selectedValuations, allExternalFlows, initialBaselineEquity);

  const incomplete = allValuations.filter(
    (point) => point.date >= window.startDate && point.date <= window.endDate && !point.complete,
  );

  const missingTickers = [...new Set(incomplete.flatMap((point) => point.missingTickers ?? []))];

  const first = points[0];
  const last = points.at(-1);
  const rangeFlows = first && last
    ? allExternalFlows.filter((flow) => flowWithin(flow, first.date, last.date))
    : [];
  const netExternalFlow = sumPortfolioFlows(rangeFlows);
  const effectiveStartEquity = initialBaselineEquity ?? first?.equity ?? null;
  const pnlEgp = effectiveStartEquity != null && last
    ? last.equity - effectiveStartEquity - netExternalFlow
    : null;

  const maxDrawdownPercent = points.length
    ? Math.min(...points.map((point) => point.drawdownPercent ?? 0))
    : null;
  const maxEquityDrawdownEgp = points.length
    ? Math.max(...points.map((point) => point.equityDrawdownEgp))
    : null;

  return {
    timeframe,
    window,
    points,
    summary: {
      startDate: first?.date ?? null,
      endDate: last?.date ?? null,
      startEquity: effectiveStartEquity,
      endEquity: last?.equity ?? null,
      pnlEgp,
      netExternalFlow,
      twrPercent: last?.twrPercent ?? null,
      mwrrPercent: last?.mwrrPercent ?? null,
      annualizedMwrrPercent: last?.annualizedMwrrPercent ?? null,
      maxDrawdownPercent,
      maxEquityDrawdownEgp,
    },
    dataQuality: {
      valuationDays: allValuations.filter(
        (point) => point.date >= window.startDate && point.date <= window.endDate,
      ).length,
      completeDays: allValuations.filter(
        (point) => point.date >= window.startDate && point.date <= window.endDate && point.complete,
      ).length,
      incompleteDays: incomplete.length,
      missingTickers,
      hasUsableRange: points.length >= 2,
      requiresIntraday: window.requiresIntraday,
    },
  };
}
