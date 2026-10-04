import { usePortfolioHydration } from '../features/portfolio/hydration/usePortfolioHydration';
import { usePortfolioLedgerMutations } from '../features/portfolio/ledger/usePortfolioLedgerMutations';
import { usePortfolioLocalState } from '../features/portfolio/state/usePortfolioLocalState';
import { usePortfolioRepositoryActions } from '../features/portfolio/persistence/usePortfolioRepositoryActions';

/**
 * Compatibility facade for the application-facing portfolio API.
 *
 * Stage 4.3 deliberately preserves the existing return shape while moving the
 * implementation into owned state, hydration, ledger, and persistence modules.
 * Consumers therefore do not need to know whether a financial write is an RPC,
 * queued persistence operation, or future repository implementation.
 */
export function usePortfolioState() {
  const state = usePortfolioLocalState();

  usePortfolioHydration(state);

  const ledger = usePortfolioLedgerMutations(state);
  const repository = usePortfolioRepositoryActions(state);

  return {
    positions: state.positions,
    setPositions: state.setPositions,
    closedTrades: state.closedTrades,
    setClosedTrades: state.setClosedTrades,
    transactions: state.transactions,
    setTransactions: state.setTransactions,
    cashBalance: state.cashBalance,
    setCashBalance: state.setCashBalance,
    updateCashBalance: ledger.updateCashBalance,
    tickers: state.tickers,
    setTickers: state.setTickers,
    capitalDeposits: state.capitalDeposits,
    setCapitalDeposits: state.setCapitalDeposits,
    isInitialized: state.isInitialized,

    addTrade: ledger.addTrade,
    sellPosition: ledger.sellPosition,
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

    updateTickers: repository.updateTickers,
    forceSync: repository.forceSync,
  };
}
