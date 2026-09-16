import { TradeTransaction } from '../types';
import { HistoricalPriceSeries } from './historicalPriceStore';
import { buildExternalCashFlows, buildHistoricalEquityCurve, buildMWRRSeries, calculateMaxDrawdown, MWRRCashFlow, MWRRPoint } from './portfolioPerformance';

export interface PerformanceEngineResult {
  valuations: MWRRPoint[];
  externalCashFlows: MWRRCashFlow[];
  maxDrawdownEgp: number;
  maxDrawdownPercent: number;
  peakEquity: number;
  troughEquity: number;
  dataQuality: {
    valuationDays: number;
    completeDays: number;
    incompleteDays: number;
    missingTickers: string[];
  };
}

export function buildPerformanceEngineResult(
  transactions: TradeTransaction[],
  historicalPrices: HistoricalPriceSeries,
  startDate?: string,
  endDate = new Date().toISOString().slice(0, 10),
): PerformanceEngineResult {
  const valuations = buildHistoricalEquityCurve(transactions, historicalPrices, startDate, endDate);
  const externalCashFlows = buildExternalCashFlows(transactions);
  const mwrrSeries = buildMWRRSeries(valuations, externalCashFlows);
  const drawdown = calculateMaxDrawdown(mwrrSeries.filter((point) => point.complete).map((point) => ({ equity: point.equity })));
  const missingTickers = [...new Set(mwrrSeries.flatMap((point) => point.missingTickers || []))];
  return {
    valuations: mwrrSeries,
    externalCashFlows,
    maxDrawdownEgp: drawdown.maxDrawdownEgp,
    maxDrawdownPercent: drawdown.maxDrawdownPercent,
    peakEquity: drawdown.peakEquity,
    troughEquity: drawdown.troughEquity,
    dataQuality: {
      valuationDays: mwrrSeries.length,
      completeDays: mwrrSeries.filter((point) => point.complete).length,
      incompleteDays: mwrrSeries.filter((point) => !point.complete).length,
      missingTickers,
    },
  };
}
