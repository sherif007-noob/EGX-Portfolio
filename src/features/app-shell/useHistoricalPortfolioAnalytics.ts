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
import { requiresListedMarketHistory } from '../../services/historicalCoverage';

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
  const unavailableOnDemandRepairRef = useRef(false);
  const [historyPollRevision, setHistoryPollRevision] = useState(0);

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
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    setHistoricalDrawdown(null);
    setHistoricalPriceSeries({});
    setHistoricalAnalyticsLoading(true);

    const loadHistoricalPerformance = async () => {
      if (!isInitialized) {
        setHistoricalAnalyticsLoading(false);
        return;
      }

      const hasMarketTransactions = transactions.some((tx) =>
        normalizeHistoryTicker(tx.ticker) !== 'CASH' && requiresListedMarketHistory(tx.type),
      );
      if (!hasMarketTransactions) {
        if (!cancelled) setHistoricalAnalyticsLoading(false);
        return;
      }

      try {
        let historicalPrices = await getHistoricalPricesForTransactions(transactions);
        let result = buildUnifiedAnalyticsResult(transactions, historicalPrices, 'ALL', {
          openingCapital,
        });

        const repairTargets = (unavailableOnDemandRepairRef.current ? [] : result.dataQuality.missingTickers)
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
            for (const missing of result.dataQuality.missingTickers) {
              historicalBackfillAttemptsRef.current.delete(normalizeHistoryTicker(missing));
            }
          } catch (backfillError) {
            for (const target of repairTargets) historicalBackfillAttemptsRef.current.delete(target.ticker);
            // Cloudflare Workers cannot run TradingView's Node/WebSocket
            // backfill. A 503 here means wait for scheduled Node ingestion,
            // rather than retrying an impossible endpoint on every price sync.
            if (String(backfillError).includes('Cloudflare Worker')) {
              unavailableOnDemandRepairRef.current = true;
            }
            console.warn(
              'Automatic historical-price backfill failed; keeping the existing trustworthy analytics range.',
              backfillError,
            );
          }
        }

        if (!cancelled) {
          // A new trade recorded after the EGX close can precede the next
          // scheduled daily bar ingestion. Re-read Supabase periodically while
          // any valuation date is incomplete; do not fabricate a last price.
          if (result.dataQuality.missingTickers.length > 0) {
            retryTimer = setTimeout(() => setHistoryPollRevision(revision => revision + 1), 5 * 60_000);
          }
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
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [transactions, openingCapital, marketRefresh, isInitialized, historyPollRevision]);

  return {
    historicalDrawdown,
    historicalPriceSeries,
    historicalAnalyticsLoading,
  };
}
