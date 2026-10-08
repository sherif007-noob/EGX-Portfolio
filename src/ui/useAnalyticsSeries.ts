import { useEffect, useMemo, useState } from 'react';
import type { Position, TradeTransaction } from '../types';
import type { HistoricalPriceSeries } from '../services/historicalPriceStore';
import type { IntradayPriceSeries } from '../services/intradayPriceStore';
import { loadTodayIntraday } from '../services/todayIntraday';
import { buildUnifiedAnalyticsResult, type UnifiedAnalyticsResult } from '../services/unifiedAnalyticsEngine';
import { buildIntradayAnalyticsResult } from '../services/intradayAnalyticsEngine';
import { resolveIntradaySessionTickers } from '../services/intradayTickerUniverse';
import { resolveAnalyticsWindow, type AnalyticsTimeframe } from '../services/analyticsTimeframes';
import { PORTFOLIO_BENCHMARKS } from '../services/portfolioBenchmarks';
import { deriveCanonicalCapitalDeposits } from '../services/portfolioReconciliation';
import { trustedLivePrices } from '../services/positionQuote';
import { useMarketRefresh } from '../hooks/useMarketRefresh';
import { VISUAL_REGRESSION_MODE } from '../utils/visualRegressionMode';

interface Args {
  transactions: TradeTransaction[];
  historicalPrices: HistoricalPriceSeries;
  capitalDeposits: number;
  positions: Position[];
  currentCashBalance: number;
  timeframe: AnalyticsTimeframe;
  granularity?: 1 | 5 | 15 | 60;
}

export interface AnalyticsSeries {
  result: UnifiedAnalyticsResult | null;
  loading: boolean;
  error: string | null;
  intradayPrices: IntradayPriceSeries;
}

/**
 * Same data pipeline as the legacy performance chart (daily engine + intraday
 * session for TODAY), without its UI state, so any screen can reuse it.
 */
export function useAnalyticsSeries({
  transactions,
  historicalPrices,
  capitalDeposits,
  positions,
  currentCashBalance,
  timeframe,
  granularity = 1,
}: Args): AnalyticsSeries {
  const marketRefresh = useMarketRefresh();
  const [intradayResult, setIntradayResult] = useState<UnifiedAnalyticsResult | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [intradayPrices, setIntradayPrices] = useState<IntradayPriceSeries>({});
  const [intradayLoading, setIntradayLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openingCapital = useMemo(
    () => deriveCanonicalCapitalDeposits(transactions, currentCashBalance, capitalDeposits),
    [transactions, currentCashBalance, capitalDeposits],
  );

  const dailyResult = useMemo(() => {
    if (timeframe === 'TODAY') return null;
    return buildUnifiedAnalyticsResult(transactions, historicalPrices, timeframe, { openingCapital });
    // marketRefresh re-runs the computation when new quotes land.
  }, [transactions, historicalPrices, timeframe, openingCapital, marketRefresh]);

  useEffect(() => {
    if (timeframe !== 'TODAY' || VISUAL_REGRESSION_MODE) return undefined;
    let cancelled = false;
    setIntradayLoading(true);
    setError(null);

    const load = async () => {
      try {
        const sessionDate = resolveAnalyticsWindow('TODAY').endDate;
        const tickers = [
          ...new Set([
            ...resolveIntradaySessionTickers(transactions, sessionDate),
            ...PORTFOLIO_BENCHMARKS.map((benchmark) => benchmark.ticker),
          ]),
        ];
        // Coarse candles are aggregated from healthy fine-grained source by the shared loader.
        const selection = await loadTodayIntraday(tickers, sessionDate, granularity >= 15 ? granularity : 'AUTO');
        const prices: IntradayPriceSeries = selection?.series ?? {};
        const result = buildIntradayAnalyticsResult(transactions, historicalPrices, prices, {
          sessionDate: selection?.sessionDate ?? sessionDate,
          openingCapital,
          currentCashBalance,
          asOf: new Date(),
          livePrices: trustedLivePrices(positions, sessionDate),
        });
        if (!cancelled) {
          setIntradayPrices(prices);
          setIntradayResult(result);
          setLoadedKey(`${sessionDate}:${granularity}`);
        }
      } catch (caught) {
        if (!cancelled) {
          setIntradayResult(null);
          setLoadedKey('');
          setIntradayPrices({});
          setError(caught instanceof Error ? caught.message : 'Intraday data unavailable.');
        }
      } finally {
        if (!cancelled) setIntradayLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [timeframe, granularity, transactions, historicalPrices, openingCapital, currentCashBalance, positions, marketRefresh]);

  if (timeframe === 'TODAY') {
    const key = `${resolveAnalyticsWindow('TODAY').endDate}:${granularity}`;
    return { result: loadedKey === key ? intradayResult : null, loading: intradayLoading || loadedKey !== key, error, intradayPrices: loadedKey === key ? intradayPrices : {} };
  }
  return { result: dailyResult, loading: false, error: null, intradayPrices: {} };
}
