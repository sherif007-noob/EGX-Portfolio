import { useEffect, useRef, useState } from 'react';
import type { TradeTransaction } from '../../types';
import {
  ensureHistoricalPriceCoverage,
  getHistoricalPricesForTransactions,
  type HistoricalPriceSeries,
} from '../../domain/market';
import { buildUnifiedAnalyticsResult } from '../../domain/performance';
import { VISUAL_REGRESSION_MODE } from '../../utils/visualRegressionMode';
import { VISUAL_REGRESSION_HISTORICAL_PRICES } from '../../data/visualRegressionFixture';

interface HistoricalDrawdown {
  maxDrawdownEgp: number;
  maxDrawdownPercent: number;
}

interface UseHistoricalPortfolioAnalyticsOptions {
  transactions: TradeTransaction[];
  openingCapital: number;
  isInitialized: boolean;
  marketRefresh: number;
}

const normalizeHistoryTicker = (ticker: string) =>
  ticker.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');

export function useHistoricalPortfolioAnalytics({
  transactions,
  openingCapital,
  isInitialized,
  marketRefresh,
}: UseHistoricalPortfolioAnalyticsOptions) {
  const [historicalDrawdown, setHistoricalDrawdown] = useState<HistoricalDrawdown | null>(null);
  const [historicalPriceSeries, setHistoricalPriceSeries] = useState<HistoricalPriceSeries>({});
  const [historicalAnalyticsLoading, setHistoricalAnalyticsLoading] = useState(false);
  const historicalBackfillAttemptsRef = useRef(new Set<string>());

  useEffect(() => {
    if (VISUAL_REGRESSION_MODE) {
      const visualResult = buildUnifiedAnalyticsResult(
        transactions,
        VISUAL_REGRESSION_HISTORICAL_PRICES,
        'ALL',
        { openingCapital },
      );
      setHistoricalPriceSeries(VISUAL_REGRESSION_HISTORICAL_PRICES);
      if (
        visualResult.summary.maxDrawdownPercent != null &&
        visualResult.summary.maxEquityDrawdownEgp != null
      ) {
        setHistoricalDrawdown({
          maxDrawdownEgp: visualResult.summary.maxEquityDrawdownEgp,
          maxDrawdownPercent: Math.abs(visualResult.summary.maxDrawdownPercent),
        });
      } else {
        setHistoricalDrawdown(null);
      }
      setHistoricalAnalyticsLoading(false);
      return;
    }

    let cancelled = false;
    setHistoricalDrawdown(null);
    setHistoricalPriceSeries({});
    setHistoricalAnalyticsLoading(true);

    const loadHistoricalPerformance = async () => {
      if (!isInitialized) {
        setHistoricalAnalyticsLoading(false);
        return;
      }

      const hasMarketTransactions = transactions.some((tx) => tx.ticker.trim().toUpperCase() !== 'CASH');
      if (!hasMarketTransactions) {
        if (!cancelled) setHistoricalAnalyticsLoading(false);
        return;
      }

      try {
        let historicalPrices = await getHistoricalPricesForTransactions(transactions);
        let result = buildUnifiedAnalyticsResult(transactions, historicalPrices, 'ALL', {
          openingCapital,
        });

        const repairTargets = result.dataQuality.missingTickers
          .map(normalizeHistoryTicker)
          .filter((ticker) => ticker && !historicalBackfillAttemptsRef.current.has(ticker))
          .map((ticker) => ({
            ticker,
            startDate: transactions
              .filter((tx) => normalizeHistoryTicker(tx.ticker) === ticker)
              .map((tx) => String(tx.date || '').slice(0, 10))
              .filter(Boolean)
              .sort()[0],
          }));

        if (repairTargets.length) {
          for (const target of repairTargets) historicalBackfillAttemptsRef.current.add(target.ticker);
          try {
            const repair = await ensureHistoricalPriceCoverage(repairTargets);
            for (const failure of repair.failures) {
              historicalBackfillAttemptsRef.current.delete(normalizeHistoryTicker(failure.ticker));
            }
            historicalPrices = await getHistoricalPricesForTransactions(transactions);
            result = buildUnifiedAnalyticsResult(transactions, historicalPrices, 'ALL', {
              openingCapital,
            });
          } catch (backfillError) {
            for (const target of repairTargets) historicalBackfillAttemptsRef.current.delete(target.ticker);
            console.warn(
              'Automatic historical-price backfill failed; keeping the existing trustworthy analytics range.',
              backfillError,
            );
          }
        }

        if (!cancelled) {
          setHistoricalPriceSeries(historicalPrices);
          if (
            result.dataQuality.hasUsableRange &&
            result.summary.maxDrawdownPercent != null &&
            result.summary.maxEquityDrawdownEgp != null
          ) {
            setHistoricalDrawdown({
              maxDrawdownEgp: result.summary.maxEquityDrawdownEgp,
              maxDrawdownPercent: Math.abs(result.summary.maxDrawdownPercent),
            });
          }
        }
      } catch (error) {
        if (!cancelled) {
          setHistoricalDrawdown(null);
          setHistoricalPriceSeries({});
        }
        console.warn('Unified historical analytics are unavailable; drawdown will remain N/A.', error);
      } finally {
        if (!cancelled) setHistoricalAnalyticsLoading(false);
      }
    };

    void loadHistoricalPerformance();
    return () => {
      cancelled = true;
    };
  }, [transactions, openingCapital, marketRefresh, isInitialized]);

  return {
    historicalDrawdown,
    historicalPriceSeries,
    historicalAnalyticsLoading,
  };
}
