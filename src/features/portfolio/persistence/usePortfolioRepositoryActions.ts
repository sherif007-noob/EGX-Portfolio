import { useCallback } from 'react';
import type { EGXTicker, Position } from '../../../types';
import { normalizeTransaction } from '../../../utils/portfolioMetrics';
import { mergeTickerDirectoryWithBaseline } from '../../../data/egxTickers';
import type { PortfolioLocalState } from '../state/usePortfolioLocalState';
import { portfolioRepository } from './portfolioRepository';

export function usePortfolioRepositoryActions(state: PortfolioLocalState) {
  const editPosition = useCallback(async (updatedPosition: Position): Promise<boolean> => {
    const existing = state.positions.find((position) => position.id === updatedPosition.id);
    if (!existing) return false;

    const candidate = state.positions.map((position) =>
      position.id === updatedPosition.id ? updatedPosition : position
    );

    try {
      const saved = await portfolioRepository.updatePositions(candidate);
      if (!saved) return false;

      // Apply only editable position metadata to the latest local row. Market quotes
      // and canonical ledger-derived shares/cost may have advanced while persistence
      // was in flight and must not be overwritten by the pre-save snapshot.
      state.setPositions((current) => current.map((position) =>
        position.id === updatedPosition.id
          ? {
              ...position,
              targetPrice: updatedPosition.targetPrice,
              stopLoss: updatedPosition.stopLoss,
              notes: updatedPosition.notes,
            }
          : position
      ));
      return true;
    } catch (error) {
      console.error('Position metadata persistence failed:', error);
      return false;
    }
  }, [state.positions, state.setPositions]);

  const updateTickers = useCallback((newTickers: EGXTicker[]) => {
    state.setTickers(newTickers);
  }, [state.setTickers]);

  const forceSync = useCallback(async () => {
    try {
      const session = await portfolioRepository.getSession();
      if (!session) throw new Error('No authenticated Supabase session.');

      const remote = await portfolioRepository.load();
      let mergedPositions = state.positions;
      let mergedClosed = state.closedTrades;
      let mergedTransactions = state.transactions;
      let mergedCash = state.cashBalance;
      let mergedTickers = state.tickers;
      let mergedCapital = state.capitalDeposits;

      if (remote) {
        mergedTransactions = Array.isArray(remote.transactions)
          ? remote.transactions
              .map(normalizeTransaction)
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          : [];
        mergedPositions = Array.isArray(remote.positions) ? remote.positions : [];
        mergedClosed = Array.isArray(remote.closedTrades) ? remote.closedTrades : [];
        if (typeof remote.cashBalance === 'number' && Number.isFinite(remote.cashBalance)) {
          mergedCash = remote.cashBalance;
        }
        if (
          typeof remote.capitalDeposits === 'number' &&
          remote.capitalDeposits >= 0
        ) {
          mergedCapital = remote.capitalDeposits;
        }
        if (Array.isArray(remote.tickers) && remote.tickers.length > 0) {
          // Keep locally discovered symbols, but let the authoritative remote
          // directory win duplicate metadata instead of overwriting it with a
          // stale local copy during an explicit force-sync.
          mergedTickers = mergeTickerDirectoryWithBaseline([
            ...state.tickers,
            ...remote.tickers,
          ]);
        }

        state.setTransactions(mergedTransactions);
        state.setPositions(mergedPositions);
        state.setClosedTrades(mergedClosed);
        state.setCashBalance(mergedCash);
        state.setCapitalDeposits(mergedCapital);
        state.setTickers(mergedTickers);
      }

      return await portfolioRepository.saveSnapshot({
        positions: mergedPositions,
        closedTrades: mergedClosed,
        transactions: mergedTransactions,
        cashBalance: mergedCash,
        capitalDeposits: mergedCapital,
        tickers: mergedTickers,
      });
    } catch (error) {
      console.error('forceSync failed:', error);
      return false;
    }
  }, [
    state.capitalDeposits,
    state.cashBalance,
    state.closedTrades,
    state.positions,
    state.tickers,
    state.transactions,
    state.setCapitalDeposits,
    state.setCashBalance,
    state.setClosedTrades,
    state.setPositions,
    state.setTransactions,
    state.setTickers,
  ]);

  return {
    editPosition,
    updateTickers,
    forceSync,
  };
}
