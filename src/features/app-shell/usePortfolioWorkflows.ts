import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  ClosedTrade,
  GoogleSheetsConfig,
  Position,
  Sector,
  TradeTransaction,
} from '../../types';
import type { UndoState, ToastKind } from './useAppNotifications';
import { validateTradeInput } from '../../utils/portfolioValidation';
import { findStrongDuplicateExecution } from '../../utils/tradeExecutionIdentity';
import { getAccessToken } from '../../services/firebaseAuth';
import {
  appendTransactionToSheet,
  syncTransactionsLedgerToSheet,
} from '../../integrations/google-sheets';

type ShowToast = (message: string, type?: ToastKind, duration?: number) => void;

interface PortfolioActions {
  addTrade: (trade: any) => Promise<any>;
  sellPosition: (sell: any) => Promise<any>;
  editPosition: (position: Position) => void;
  editTransaction: (transaction: TradeTransaction) => Promise<any>;
  deleteTransaction: (id: string) => Promise<any>;
  reconcileLedger: () => Promise<any>;
  importOcrBatch: (trades: any[]) => Promise<any>;
  updateCashBalance: (newCash: number) => Promise<boolean>;
}

interface UsePortfolioWorkflowsOptions {
  positions: Position[];
  closedTrades: ClosedTrade[];
  transactions: TradeTransaction[];
  cashBalance: number;
  capitalDeposits: number;
  portfolio: PortfolioActions;
  sheetsConfig: GoogleSheetsConfig | null;
  syncPricesOnlyToSheets: () => Promise<{
    success: boolean;
    message?: string;
    updatedTabs?: string[];
  }>;
  syncLivePrices: (manual?: boolean) => Promise<{
    success: boolean;
    count?: number;
    error?: string;
  } | undefined>;
  openSheetsModal: () => void;
  showToast: ShowToast;
  setUndoState: Dispatch<SetStateAction<UndoState | null>>;
}

export interface AddPositionInput {
  ticker: string;
  companyName: string;
  sector: Sector;
  shares: number;
  buyPrice: number;
  buyDate: string;
  executedAt?: string;
  brokerageFee: number;
  targetPrice?: number;
  stopLoss?: number;
  notes?: string;
}

export interface ParsedScreenshotTrade {
  ticker: string;
  companyName: string;
  sector: Sector;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  date: string;
  executedAt?: string;
  fees: number;
  notes?: string;
}

export function usePortfolioWorkflows({
  positions,
  closedTrades,
  transactions,
  cashBalance,
  capitalDeposits,
  portfolio,
  sheetsConfig,
  syncPricesOnlyToSheets,
  syncLivePrices,
  openSheetsModal,
  showToast,
  setUndoState,
}: UsePortfolioWorkflowsOptions) {
  const appendPersistedTransactionToSheet = useCallback((transaction: TradeTransaction) => {
    if (!sheetsConfig?.spreadsheetId) return;
    getAccessToken()
      .then((token) => appendTransactionToSheet(
        sheetsConfig.spreadsheetId,
        transaction,
        token || undefined,
        sheetsConfig.sheetName || 'Transaction Logger',
      ))
      .catch(() => appendTransactionToSheet(
        sheetsConfig.spreadsheetId,
        transaction,
        undefined,
        sheetsConfig.sheetName || 'Transaction Logger',
      ))
      .catch((error) => console.warn('Background Sheets append failed:', error));
  }, [sheetsConfig]);

  const mirrorPersistedLedgerToSheet = useCallback((persistedTransactions: TradeTransaction[]) => {
    if (!sheetsConfig?.spreadsheetId) return;
    getAccessToken()
      .then((token) => syncTransactionsLedgerToSheet(
        sheetsConfig.spreadsheetId,
        persistedTransactions,
        token || undefined,
        sheetsConfig.sheetName || 'Transaction Logger',
      ))
      .catch(() => syncTransactionsLedgerToSheet(
        sheetsConfig.spreadsheetId,
        persistedTransactions,
        undefined,
        sheetsConfig.sheetName || 'Transaction Logger',
      ))
      .catch((error) => console.warn('Background Sheets ledger sync failed:', error));
  }, [sheetsConfig]);

  const handleAddPosition = useCallback(async (newTradeData: AddPositionInput): Promise<boolean> => {
    const validation = validateTradeInput({
      ticker: newTradeData.ticker,
      shares: newTradeData.shares,
      price: newTradeData.buyPrice,
      fees: newTradeData.brokerageFee,
      type: 'BUY',
      date: newTradeData.buyDate,
      availableCash: cashBalance,
    });
    if (!validation.valid) {
      showToast(`Trade Validation Error: ${validation.errors.join(', ')}`, 'error');
      return false;
    }

    const result = await portfolio.addTrade({
      ticker: newTradeData.ticker,
      companyName: newTradeData.companyName,
      sector: newTradeData.sector,
      shares: newTradeData.shares,
      price: newTradeData.buyPrice,
      fees: newTradeData.brokerageFee,
      date: newTradeData.buyDate,
      executedAt: newTradeData.executedAt,
      targetPrice: newTradeData.targetPrice,
      stopLoss: newTradeData.stopLoss,
      notes: newTradeData.notes,
    });

    if ('error' in result) {
      if (result.persisted) {
        showToast(
          `BUY ${newTradeData.ticker.toUpperCase()} was saved to Supabase, but this screen could not refresh. Reload before entering another trade.`,
          'error',
          7000,
        );
        return true;
      }
      showToast(`BUY was not saved: ${result.error.message} Nothing was changed.`, 'error', 7000);
      return false;
    }

    const transaction = result.value as TradeTransaction | undefined;
    if (!transaction) {
      showToast(
        'BUY was persisted but the saved transaction result was unavailable. Reload before entering another trade.',
        'error',
        7000,
      );
      return true;
    }

    appendPersistedTransactionToSheet(transaction);
    showToast(
      `Logged BUY order for ${newTradeData.shares} shares of ${newTradeData.ticker.toUpperCase()}`,
      'success',
    );
    return true;
  }, [appendPersistedTransactionToSheet, cashBalance, portfolio, showToast]);

  const handleConfirmSell = useCallback(async (
    positionId: string,
    soldShares: number,
    sellPrice: number,
    sellDate: string,
    executedAt: string | undefined,
    sellFees: number,
    notes: string,
    _remainingShares: number,
  ): Promise<boolean> => {
    const position = positions.find((candidate) => candidate.id === positionId);
    if (!position) {
      showToast('The position changed before the sale could be prepared. Reload and try again.', 'error');
      return false;
    }

    const validation = validateTradeInput({
      ticker: position.ticker,
      shares: soldShares,
      price: sellPrice,
      fees: sellFees,
      type: 'SELL',
      date: sellDate,
      existingPosition: position,
    });
    if (!validation.valid) {
      showToast(`Sell Validation Error: ${validation.errors.join(', ')}`, 'error');
      return false;
    }

    const result = await portfolio.sellPosition({
      position,
      sharesToSell: soldShares,
      sellPrice,
      fees: sellFees,
      sellDate,
      executedAt,
      notes,
    });

    if ('error' in result) {
      if (result.persisted) {
        showToast(
          `SELL ${position.ticker} was saved to Supabase, but this screen could not refresh. Reload before entering another trade.`,
          'error',
          7000,
        );
        return true;
      }
      showToast(`SELL was not saved: ${result.error.message} Nothing was changed.`, 'error', 7000);
      return false;
    }

    const transaction = result.value as TradeTransaction | undefined;
    if (!transaction) {
      showToast(
        'SELL was persisted but the saved transaction result was unavailable. Reload before entering another trade.',
        'error',
        7000,
      );
      return true;
    }

    appendPersistedTransactionToSheet(transaction);
    const closedTrade = (result.snapshot.closedTrades as ClosedTrade[]).find((trade) =>
      trade.sellTransactionIds?.includes(transaction.id),
    );
    showToast(
      closedTrade
        ? `Sold ${soldShares} shares of ${position.ticker} (${closedTrade.realizedPnlEgp >= 0 ? '+' : ''}${closedTrade.realizedPnlEgp.toFixed(2)} EGP realized)`
        : `Sold ${soldShares} shares of ${position.ticker} and persisted the updated ledger.`,
      'success',
    );
    return true;
  }, [appendPersistedTransactionToSheet, portfolio, positions, showToast]);

  const handleSavePositionEdit = useCallback((updated: {
    id: string;
    targetPrice?: number;
    stopLoss?: number;
    notes?: string;
  }) => {
    const position = positions.find((candidate) => candidate.id === updated.id);
    if (!position) return;
    portfolio.editPosition({
      ...position,
      targetPrice: updated.targetPrice,
      stopLoss: updated.stopLoss,
      notes: updated.notes,
    });
    showToast(`Updated targets & notes for ${position.ticker}`, 'success');
  }, [portfolio, positions, showToast]);

  const handleDeleteTransaction = useCallback(async (id: string): Promise<boolean> => {
    const transaction = transactions.find((candidate) => candidate.id === id);
    if (!transaction) return false;

    const previousState = { positions, closedTrades, transactions, cashBalance, capitalDeposits };
    const result = await portfolio.deleteTransaction(id);
    if ('error' in result) {
      showToast(
        `Could not delete ${transaction.type} ${transaction.ticker}: ${result.error.message} Nothing was changed.`,
        'error',
        6500,
      );
      return false;
    }

    setUndoState({
      previousState,
      message: `Deleted ${transaction.type} ${transaction.ticker} transaction`,
    });
    showToast(
      `Deleted ${transaction.type} ${transaction.ticker} transaction and persisted reconciled balances`,
      'success',
    );
    mirrorPersistedLedgerToSheet(result.snapshot.transactions);
    return true;
  }, [
    capitalDeposits,
    cashBalance,
    closedTrades,
    mirrorPersistedLedgerToSheet,
    portfolio,
    positions,
    setUndoState,
    showToast,
    transactions,
  ]);

  const handleEditTransaction = useCallback(async (updatedTx: TradeTransaction): Promise<boolean> => {
    const validation = validateTradeInput({
      ticker: updatedTx.ticker,
      shares: updatedTx.shares,
      price: updatedTx.price,
      fees: updatedTx.fees || 0,
      type: updatedTx.type,
      date: updatedTx.date,
    });
    if (!validation.valid) {
      showToast(`Edit Transaction Error: ${validation.errors.join(', ')}`, 'error');
      return false;
    }

    const result = await portfolio.editTransaction(updatedTx);
    if ('error' in result) {
      showToast(
        `Transaction edit was not saved: ${result.error.message} Nothing was changed.`,
        'error',
        6500,
      );
      return false;
    }

    showToast(
      `Updated ${updatedTx.type} ${updatedTx.ticker} transaction and persisted reconciled balances`,
      'success',
    );
    mirrorPersistedLedgerToSheet(result.snapshot.transactions);
    return true;
  }, [mirrorPersistedLedgerToSheet, portfolio, showToast]);

  const handleAIScreenshotAddTransaction = useCallback(async (
    parsedTx: ParsedScreenshotTrade,
  ): Promise<boolean> => {
    const duplicate = findStrongDuplicateExecution(transactions, {
      type: parsedTx.type,
      ticker: parsedTx.ticker,
      shares: parsedTx.shares,
      price: parsedTx.price,
      date: parsedTx.date,
      executedAt: parsedTx.executedAt,
      fees: parsedTx.fees,
    });
    if (duplicate) {
      showToast(
        `Duplicate screenshot execution blocked: ${parsedTx.type} ${parsedTx.ticker.toUpperCase()} already exists at this execution time.`,
        'error',
        5500,
      );
      return false;
    }

    if (parsedTx.type === 'BUY') {
      return handleAddPosition({
        ticker: parsedTx.ticker,
        companyName: parsedTx.companyName,
        sector: parsedTx.sector,
        shares: parsedTx.shares,
        buyPrice: parsedTx.price,
        buyDate: parsedTx.date,
        executedAt: parsedTx.executedAt,
        brokerageFee: parsedTx.fees,
        notes: parsedTx.notes || 'Logged via Screenshot Scanner',
      });
    }

    const position = positions.find(
      (candidate) => candidate.ticker.toUpperCase() === parsedTx.ticker.toUpperCase(),
    );
    if (!position) {
      showToast(
        `Could not log SELL ${parsedTx.ticker.toUpperCase()}: no matching open position exists. Import the corresponding BUY first or use batch import.`,
        'error',
        6500,
      );
      return false;
    }

    return handleConfirmSell(
      position.id,
      parsedTx.shares,
      parsedTx.price,
      parsedTx.date,
      parsedTx.executedAt,
      parsedTx.fees,
      parsedTx.notes || 'Logged via Screenshot Scanner',
      Math.max(0, position.shares - parsedTx.shares),
    );
  }, [handleAddPosition, handleConfirmSell, positions, showToast, transactions]);

  const handleAIScreenshotAddBatchTransactions = useCallback(async (
    parsedTxs: ParsedScreenshotTrade[],
  ): Promise<boolean> => {
    if (parsedTxs.length === 0) return false;
    const result = await portfolio.importOcrBatch(parsedTxs);
    if ('error' in result) {
      showToast(`OCR batch was not saved: ${result.error.message} Nothing was changed.`, 'error', 7000);
      return false;
    }

    const summary = result.value;
    if (!summary) {
      showToast('OCR batch persisted but no import summary was returned.', 'error', 6000);
      return true;
    }

    const details = [
      summary.duplicateCount > 0 ? `${summary.duplicateCount} duplicate execution(s) blocked` : '',
      summary.skippedCount > 0 ? `${summary.skippedCount} unreconciled trade(s) skipped` : '',
    ].filter(Boolean).join('; ');

    showToast(
      details
        ? `Persisted ${summary.processedCount} OCR trade(s). ${details}.`
        : `Successfully persisted all ${summary.processedCount} OCR trades!`,
      summary.skippedCount > 0 ? 'error' : 'success',
      details ? 6500 : 5000,
    );
    return true;
  }, [portfolio, showToast]);

  const handleSyncPrices = useCallback(async () => {
    const result = await syncLivePrices(true);
    if (result?.success) {
      if (!sheetsConfig?.spreadsheetId) {
        showToast(`Live quotes updated for ${result.count || ''} EGX equities.`, 'success', 3500);
      }
      return;
    }
    showToast(result?.error || 'Failed updating market prices', 'error', 4000);
  }, [sheetsConfig?.spreadsheetId, showToast, syncLivePrices]);

  const handlePushPricesToSheetDirectly = useCallback(async () => {
    if (!sheetsConfig?.spreadsheetId) {
      openSheetsModal();
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      openSheetsModal();
      return;
    }
    const result = await syncPricesOnlyToSheets();
    if (!result.success) throw new Error(result.message);
    showToast(
      `Updated market quotes in Google Sheets (${result.updatedTabs?.join(' & ') || 'Directory & Positions'})`,
      'success',
    );
  }, [openSheetsModal, sheetsConfig?.spreadsheetId, showToast, syncPricesOnlyToSheets]);

  const handleOverviewReconcile = useCallback(async (): Promise<boolean> => {
    const result = await portfolio.reconcileLedger();
    if ('error' in result) {
      showToast(`Ledger reconciliation was not saved: ${result.error.message}`, 'error', 6500);
      return false;
    }
    showToast(
      `Reconciled and persisted ${result.snapshot.transactions.length} transactions: ${result.snapshot.positions.length} open positions, ${result.snapshot.closedTrades.length} closed cycles.`,
      'success',
    );
    return true;
  }, [portfolio, showToast]);

  const handleCashBalanceUpdate = useCallback(async (newBalance: number): Promise<boolean> => {
    const saved = await portfolio.updateCashBalance(newBalance);
    if (!saved) {
      showToast('Cash balance update was not saved. Nothing was changed.', 'error', 6000);
      return false;
    }
    showToast(`Cash balance updated to ${newBalance.toLocaleString()} EGP and persisted.`, 'success');
    return true;
  }, [portfolio, showToast]);

  return {
    handleAddPosition,
    handleConfirmSell,
    handleSavePositionEdit,
    handleDeleteTransaction,
    handleEditTransaction,
    handleAIScreenshotAddTransaction,
    handleAIScreenshotAddBatchTransactions,
    handleSyncPrices,
    handlePushPricesToSheetDirectly,
    handleOverviewReconcile,
    handleCashBalanceUpdate,
  };
}
