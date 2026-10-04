import { useEffect, useRef } from 'react';
import type { EGXTicker } from '../../../types';
import { mergeTickerDirectoryWithBaseline } from '../../../data/egxTickers';
import { normalizeTransaction } from '../../../utils/portfolioMetrics';
import { reconcilePortfolioFromLedger } from '../../../domain/accounting';
import { selectPositionQuote } from '../../../domain/market';
import { VISUAL_REGRESSION_MODE } from '../../../utils/visualRegressionMode';
import type { PortfolioLocalState } from '../state/usePortfolioLocalState';
import { rehydrateTransactionMetadata } from '../state/portfolioCompatibility';
import { portfolioRepository } from '../persistence/portfolioRepository';

export function usePortfolioHydration(state: PortfolioLocalState) {
  const isRemoteSyncingRef = useRef(false);
  const latestStateRef = useRef(state);
  latestStateRef.current = state;

  useEffect(() => {
    if (VISUAL_REGRESSION_MODE) return;

    let activeUnsubscribe: (() => void) | null = null;
    let isMounted = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const initializeRemotePortfolio = async () => {
      try {
        const remoteData = await portfolioRepository.load();
        if (!remoteData) throw new Error('Authoritative portfolio is unavailable.');

        if (isMounted) {
          const latestState = latestStateRef.current;
          isRemoteSyncingRef.current = true;
          let loadedPositions = Array.isArray(remoteData.positions) ? remoteData.positions : [];
          let loadedClosed = Array.isArray(remoteData.closedTrades) ? remoteData.closedTrades : [];
          let loadedTransactions = Array.isArray(remoteData.transactions)
            ? remoteData.transactions.map(normalizeTransaction).sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
              )
            : [];

          let loadedCash =
            typeof remoteData.cashBalance === 'number'
              ? remoteData.cashBalance
              : latestState.cashBalance;
          const loadedCapital =
            typeof remoteData.capitalDeposits === 'number' && remoteData.capitalDeposits >= 0
              ? remoteData.capitalDeposits
              : latestState.capitalDeposits;
          const loadedTickers = mergeTickerDirectoryWithBaseline(
            Array.isArray(remoteData.tickers) && remoteData.tickers.length > 0
              ? remoteData.tickers
              : latestState.tickers,
          );
          loadedTransactions = rehydrateTransactionMetadata(loadedTransactions, loadedTickers);

          if (
            loadedTransactions.length > 0 &&
            (loadedPositions.length === 0 || loadedClosed.length === 0)
          ) {
            const report = reconcilePortfolioFromLedger(
              loadedTransactions,
              loadedTickers,
              loadedCapital,
              loadedPositions,
            );
            if (loadedPositions.length === 0) loadedPositions = report.reconciledPositions;
            if (loadedClosed.length === 0) loadedClosed = report.reconciledClosedTrades;
            if (loadedCash === 0) loadedCash = report.reconciledCashBalance;
          }

          state.setIsInitialized(true);
          state.setPositions(loadedPositions);
          state.setClosedTrades(loadedClosed);
          state.setTransactions(loadedTransactions);
          state.setCashBalance(loadedCash);
          state.setCapitalDeposits(loadedCapital);
          if (Array.isArray(remoteData.tickers) && remoteData.tickers.length > 0) {
            state.setTickers(loadedTickers);
          }
          setTimeout(() => {
            isRemoteSyncingRef.current = false;
          }, 150);
        }
      } catch (error) {
        console.warn('Initial Supabase load failed, using local cache:', error);
        if (isMounted) retryTimer = setTimeout(initializeRemotePortfolio, 30_000);
        return;
      }

      try {
        await portfolioRepository.flushPendingWrites();
      } catch {
        // Compatibility queue is best-effort.
      }

      if (!isMounted) return;

      try {
        activeUnsubscribe = portfolioRepository.subscribe((remoteData) => {
          if (!remoteData || !isMounted) return;

          const latestState = latestStateRef.current;
          isRemoteSyncingRef.current = true;
          let loadedPositions = Array.isArray(remoteData.positions) ? remoteData.positions : [];
          let loadedClosed = Array.isArray(remoteData.closedTrades) ? remoteData.closedTrades : [];
          const loadedTickers = mergeTickerDirectoryWithBaseline(
            Array.isArray(remoteData.tickers) && remoteData.tickers.length > 0
              ? remoteData.tickers
              : latestState.tickers,
          );
          const loadedTransactions = rehydrateTransactionMetadata(
            Array.isArray(remoteData.transactions)
              ? remoteData.transactions.map(normalizeTransaction)
              : [],
            loadedTickers,
          );

          if (
            loadedTransactions.length > 0 &&
            (loadedPositions.length === 0 || loadedClosed.length === 0)
          ) {
            const report = reconcilePortfolioFromLedger(
              loadedTransactions,
              loadedTickers,
              latestState.capitalDeposits,
              loadedPositions,
            );
            if (loadedPositions.length === 0) loadedPositions = report.reconciledPositions;
            if (loadedClosed.length === 0) loadedClosed = report.reconciledClosedTrades;
          }

          state.setPositions((previous) => loadedPositions.map((incoming) => {
            const local = previous.find((position) => position.ticker === incoming.ticker);
            const quote = selectPositionQuote(
              incoming,
              local
                ? ({
                    ticker: local.ticker,
                    lastPrice: local.currentPrice,
                    change: local.dayChange,
                    changePercent: local.dayChangePercent,
                    priceUpdatedAt: local.priceUpdatedAt,
                  } as EGXTicker)
                : undefined,
            );
            return { ...incoming, ...quote };
          }));

          state.setClosedTrades(loadedClosed);
          state.setTransactions(loadedTransactions);

          if (Array.isArray(remoteData.tickers) && remoteData.tickers.length > 0) {
            state.setTickers((previous) => loadedTickers.map((incoming) => {
              const local = previous.find((ticker) => ticker.ticker === incoming.ticker);
              if (
                local &&
                (Date.parse(local.priceUpdatedAt ?? '') || 0) >
                  (Date.parse(incoming.priceUpdatedAt ?? '') || 0)
              ) {
                return {
                  ...incoming,
                  lastPrice: local.lastPrice,
                  change: local.change,
                  changePercent: local.changePercent,
                  priceUpdatedAt: local.priceUpdatedAt,
                };
              }
              return incoming;
            }));
          }

          if (
            typeof remoteData.cashBalance === 'number' &&
            Number.isFinite(remoteData.cashBalance)
          ) {
            state.setCashBalance(remoteData.cashBalance);
          }
          if (
            typeof remoteData.capitalDeposits === 'number' &&
            remoteData.capitalDeposits >= 0
          ) {
            state.setCapitalDeposits(remoteData.capitalDeposits);
          }

          setTimeout(() => {
            isRemoteSyncingRef.current = false;
          }, 150);
        }, (error) => {
          if (!isMounted) return;
          console.warn('Supabase portfolio subscription poll failed:', error);
        });
      } catch (error) {
        console.warn('Supabase portfolio subscription setup failed:', error);
      }
    };

    void initializeRemotePortfolio();

    return () => {
      isMounted = false;
      clearTimeout(retryTimer);
      if (activeUnsubscribe) activeUnsubscribe();
    };
    // Hydration intentionally owns the mount lifecycle. Subsequent changes arrive
    // through the subscription and canonical mutation paths rather than restarting it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
