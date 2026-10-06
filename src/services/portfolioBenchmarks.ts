import type { HistoricalPriceSeries } from './historicalPriceStore';
import type { IntradayPriceSeries } from './intradayPriceStore';

export const PORTFOLIO_BENCHMARKS = [
  { ticker: 'EGX30', label: 'EGX30', tradingviewSymbol: 'EGX30' },
  { ticker: 'EGX70EWI', label: 'EGX70', tradingviewSymbol: 'EGX70EWI' },
  { ticker: 'EGX100EWI', label: 'EGX100', tradingviewSymbol: 'EGX100EWI' },
] as const;

export type PortfolioBenchmarkTicker = typeof PORTFOLIO_BENCHMARKS[number]['ticker'];

export interface BenchmarkComparisonPoint {
  date: string;
  portfolioReturnPercent: number;
  EGX30?: number;
  EGX70EWI?: number;
  EGX100EWI?: number;
}

export function isPortfolioBenchmarkTicker(value: string): value is PortfolioBenchmarkTicker {
  return PORTFOLIO_BENCHMARKS.some((item) => item.ticker === value);
}

export function benchmarkTradingViewSymbol(ticker: string): string | undefined {
  return PORTFOLIO_BENCHMARKS.find((item) => item.ticker === ticker)?.tradingviewSymbol;
}

function normalizeFromBaseline(values: Array<{ key: string; close: number }>): Map<string, number> {
  const baseline = values.find((point) => Number.isFinite(point.close) && point.close > 0)?.close;
  if (!baseline) return new Map();
  return new Map(
    values
      .filter((point) => Number.isFinite(point.close) && point.close > 0)
      .map((point) => [point.key, (point.close / baseline - 1) * 100]),
  );
}

function latestAtOrBefore(
  normalized: Map<string, number>,
  sortedKeys: string[],
  target: string,
): number | undefined {
  let value: number | undefined;
  for (const key of sortedKeys) {
    if (key > target) break;
    const candidate = normalized.get(key);
    if (candidate != null) value = candidate;
  }
  return value;
}

export function buildDailyBenchmarkComparison(
  portfolioPoints: Array<{ date: string; twrPercent: number }>,
  historicalPrices: HistoricalPriceSeries,
): BenchmarkComparisonPoint[] {
  if (!portfolioPoints.length) return [];

  const benchmarkMaps = new Map<PortfolioBenchmarkTicker, { values: Map<string, number>; keys: string[] }>();
  for (const benchmark of PORTFOLIO_BENCHMARKS) {
    const source = [...(historicalPrices[benchmark.ticker] ?? [])]
      .map((point) => ({ key: String(point.date).slice(0, 10), close: Number(point.close) }))
      .filter((point) => point.key && Number.isFinite(point.close) && point.close > 0)
      .sort((a, b) => a.key.localeCompare(b.key));

    // Include the last observation at/before the portfolio window as the
    // benchmark's beginning-of-period baseline, then normalize to 0%.
    const firstPortfolioDate = String(portfolioPoints[0].date).slice(0, 10);
    const baselineIndex = source.reduce(
      (index, point, candidateIndex) => point.key <= firstPortfolioDate ? candidateIndex : index,
      -1,
    );
    const visible = source.slice(Math.max(0, baselineIndex), source.length);
    const values = normalizeFromBaseline(visible);
    benchmarkMaps.set(benchmark.ticker, { values, keys: [...values.keys()].sort() });
  }

  return portfolioPoints.map((point) => {
    const date = String(point.date).slice(0, 10);
    const row: BenchmarkComparisonPoint = {
      date: point.date,
      portfolioReturnPercent: Number(point.twrPercent),
    };
    for (const benchmark of PORTFOLIO_BENCHMARKS) {
      const map = benchmarkMaps.get(benchmark.ticker);
      if (!map) continue;
      const value = latestAtOrBefore(map.values, map.keys, date);
      if (value != null) row[benchmark.ticker] = value;
    }
    return row;
  });
}

export function buildIntradayBenchmarkComparison(
  portfolioPoints: Array<{ date: string; twrPercent: number }>,
  intradayPrices: IntradayPriceSeries,
): BenchmarkComparisonPoint[] {
  if (!portfolioPoints.length) return [];

  const benchmarkMaps = new Map<PortfolioBenchmarkTicker, { values: Map<string, number>; keys: string[] }>();
  for (const benchmark of PORTFOLIO_BENCHMARKS) {
    const source = [...(intradayPrices[benchmark.ticker] ?? [])]
      .map((point) => ({ key: point.timestamp, close: Number(point.close) }))
      .filter((point) => Number.isFinite(new Date(point.key).getTime()) && Number.isFinite(point.close) && point.close > 0)
      .sort((a, b) => a.key.localeCompare(b.key));
    const values = normalizeFromBaseline(source);
    benchmarkMaps.set(benchmark.ticker, { values, keys: [...values.keys()].sort() });
  }

  return portfolioPoints.map((point) => {
    const row: BenchmarkComparisonPoint = {
      date: point.date,
      portfolioReturnPercent: Number(point.twrPercent),
    };
    for (const benchmark of PORTFOLIO_BENCHMARKS) {
      const map = benchmarkMaps.get(benchmark.ticker);
      if (!map) continue;
      const value = latestAtOrBefore(map.values, map.keys, point.date);
      if (value != null) row[benchmark.ticker] = value;
    }
    return row;
  });
}

export function benchmarkRelativeReturn(
  point: BenchmarkComparisonPoint | undefined,
  ticker: PortfolioBenchmarkTicker,
): number | null {
  if (!point) return null;
  const benchmark = point[ticker];
  if (!Number.isFinite(point.portfolioReturnPercent) || !Number.isFinite(benchmark)) return null;
  return point.portfolioReturnPercent - Number(benchmark);
}
