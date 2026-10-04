import { useCallback } from 'react';
import type { EGXTicker, Position } from '../../../types';
import { normalizeTransaction } from '../../../utils/portfolioMetrics';
import type { PortfolioLocalState } from '../state/usePortfolioLocalState';
import { portfolioRepository } from './portfolioRepository';

export function usePortfolioRepositoryActions(state: PortfolioLocalState) {
  const editPosition = useCallback((updatedPosition: Position) => {
    const updated = state.positions.map((position) =>
      position.id === updatedPosition.id ? updatedPosition : position
    );
    state.setPositions(updated);
    void portfolioRepository.updatePositions(updated);
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
      const mergedTickers = state.tickers;
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

        state.setTransactions(mergedTransactions);
        state.setPositions(mergedPositions);
        state.setClosedTrades(mergedClosed);
        state.setCashBalance(mergedCash);
        state.setCapitalDeposits(mergedCapital);
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
  ]);

  return {
    editPosition,
    updateTickers,
    forceSync,
  };
}
