import { useCallback, useEffect, useMemo } from 'react';
import type { Position } from '../../types';
import { usePortfolioHydration } from './hydration/usePortfolioHydration';
import { usePortfolioLedgerMutations } from './ledger/usePortfolioLedgerMutations';
import { usePortfolioLocalState } from './state/usePortfolioLocalState';
import { usePortfolioRepositoryActions } from './persistence/usePortfolioRepositoryActions';
import { primeTradingViewLogoCache } from '../../services/tradingviewLogos';

/**
 * Public application-facing portfolio boundary.
 *
 * Internal React setters remain private to the portfolio feature. Consumers get
 * explicit operations for market-only projection updates, ledger mutations and
 * persistence-backed metadata changes.
 */
export function usePortfolioState() {
  const state = usePortfolioLocalState();

  usePortfolioHydration(state);

  const ledger = usePortfolioLedgerMutations(state);
  const repository = usePortfolioRepositoryActions(state);

  const updateMarketPositions = useCallback((positions: Position[]) => {
    state.setPositions(positions);
  }, [state.setPositions]);

  const directoryByTicker = useMemo(
    () => new Map(
      state.tickers.map((ticker) => [
        ticker.ticker.trim().toUpperCase(),
        ticker,
      ]),
    ),
    [state.tickers],
  );

  const positionsWithDirectoryLogos = useMemo(
    () => state.positions.map((position) => {
      const directory = directoryByTicker.get(position.ticker.trim().toUpperCase());
      const logoUrl = directory?.logoUrl || position.logoUrl;
      return logoUrl === position.logoUrl ? position : { ...position, logoUrl };
    }),
    [state.positions, directoryByTicker],
  );

  useEffect(() => {
    primeTradingViewLogoCache(state.tickers);
  }, [state.tickers]);

  return {
    isInitialized: state.isInitialized,

    positions: positionsWithDirectoryLogos,
    closedTrades: state.closedTrades,
    transactions: state.transactions,
    cashBalance: state.cashBalance,
    tickers: state.tickers,
    capitalDeposits: state.capitalDeposits,

    updateMarketPositions,
    updateTickers: repository.updateTickers,
    updateCashBalance: ledger.updateCashBalance,

    addTrade: ledger.addTrade,
    sellPosition: ledger.sellPosition,
    addBonusShares: ledger.addBonusShares,
    addIpoSubscription: ledger.addIpoSubscription,
    allocateIpoSubscription: ledger.allocateIpoSubscription,
    cancelIpoSubscription: ledger.cancelIpoSubscription,
    editPosition: repository.editPosition,
    editTransaction: ledger.editTransaction,
    deleteTransaction: ledger.deleteTransaction,
    addCashTransaction: ledger.addCashTransaction,
    editCashTransaction: ledger.editCashTransaction,
    deleteCashTransaction: ledger.deleteCashTransaction,
    reconcileLedger: ledger.reconcileLedger,
    importBackup: ledger.importBackup,
    importOcrBatch: ledger.importOcrBatch,
    restoreLedgerSnapshot: ledger.restoreLedgerSnapshot,
    restoreInitialState: ledger.restoreInitialState,

    forceSync: repository.forceSync,
  };
}

export type PortfolioStateFacade = ReturnType<typeof usePortfolioState>;
