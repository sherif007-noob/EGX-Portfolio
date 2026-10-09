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
  addBonusShares: (action: any) => Promise<any>;
  addIpoSubscription: (action: any) => Promise<any>;
  correctIpoSubscription: (action: any, auditReason: string) => Promise<any>;
  allocateIpoSubscription: (action: any) => Promise<any>;
  cancelIpoSubscription: (id: string) => Promise<any>;
  editPosition: (position: Position) => Promise<boolean>;
  editTransaction: (transaction: TradeTransaction, auditReason?: string) => Promise<any>;
  deleteTransaction: (id: string, auditReason?: string) => Promise<any>;
  reconcileLedger: (auditReason?: string) => Promise<any>;
  importOcrBatch: (trades: any[]) => Promise<any>;
  updateCashBalance: (newCash: number, auditReason?: string) => Promise<boolean>;
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

export interface BonusSharesInput {
  ticker: string;
  bonusShares: number;
  officialRatio: number;
  effectiveDate: string;
  reference?: string;
  notes?: string;
}

export interface IpoSubscriptionFormInput {
  ticker: string;
  companyName: string;
  sector: Sector;
  /** Explicit whole-share count from the IPO form. */
  requestedShares?: number;
  /** Derived shares × offer price commitment, never manually typed. */
  requestedAmount: number;
  /** Actual broker-held funds, separate from full order commitment. */
  reservedAmount?: number;
  offerPrice: number;
  subscriptionDate: string;
  reference?: string;
  listingDate?: string;
  notes?: string;
}

export interface IpoSubscriptionCorrectionFormInput {
  transactionId: string;
  subscriptionDate: string;
  executionTimeCairo?: string;
  requestedShares?: number;
  offerPrice?: number;
  reservedAmount?: number;
  reference?: string;
  notes?: string;
  auditReason: string;
}

export interface IpoAllocationFormInput {
  transactionId: string;
  allocatedShares: number;
  allocationDate: string;
  fees?: number;
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
    if (
      !sheetsConfig?.spreadsheetId
      || transaction.type === 'IPO_SUBSCRIPTION'
      || transaction.type === 'OPENING_POSITION'
    ) return;
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
        persistedTransactions.filter(
          (transaction) => transaction.type !== 'IPO_SUBSCRIPTION' && transaction.type !== 'OPENING_POSITION',
        ),
        token || undefined,
        sheetsConfig.sheetName || 'Transaction Logger',
      ))
      .catch(() => syncTransactionsLedgerToSheet(
        sheetsConfig.spreadsheetId,
        persistedTransactions.filter(
          (transaction) => transaction.type !== 'IPO_SUBSCRIPTION' && transaction.type !== 'OPENING_POSITION',
        ),
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

  const handleAddBonusShares = useCallback(async (
    input: BonusSharesInput,
  ): Promise<{ ok: boolean; error?: string }> => {
    const result = await portfolio.addBonusShares(input);
    if ('error' in result) {
      if (result.persisted) {
        showToast(
          `Bonus shares for ${input.ticker.toUpperCase()} were saved to Supabase, but this screen could not refresh. Reload before entering another action.`,
          'error',
          7000,
        );
        return { ok: true };
      }
      showToast(
        `Bonus shares were not saved: ${result.error.message} Nothing was changed.`,
        'error',
        7000,
      );
      return { ok: false, error: result.error.message };
    }

    const transaction = result.value as TradeTransaction | undefined;
    if (!transaction) {
      showToast(
        'Bonus shares were persisted but the saved corporate-action result was unavailable. Reload before entering another action.',
        'error',
        7000,
      );
      return { ok: true };
    }

    appendPersistedTransactionToSheet(transaction);
    showToast(
      `Recorded +${transaction.shares.toLocaleString('en-EG', { maximumFractionDigits: 8 })} bonus shares for ${transaction.ticker}. Cash and total cost basis unchanged.`,
      'success',
      5500,
    );
    return { ok: true };
  }, [appendPersistedTransactionToSheet, portfolio, showToast]);

  const handleAddIpoSubscription = useCallback(async (
    input: IpoSubscriptionFormInput,
  ): Promise<boolean> => {
    const result = await portfolio.addIpoSubscription(input);
    if ('error' in result) {
      showToast(`IPO subscription was not saved: ${result.error.message} Nothing was changed.`, 'error', 7000);
      return false;
    }
    const transaction = result.value as TradeTransaction | undefined;
    if (!transaction) return true;
    appendPersistedTransactionToSheet(transaction);
    showToast(
      `Held ${(input.reservedAmount ?? input.requestedAmount).toLocaleString('en-EG')} EGP against ${input.requestedAmount.toLocaleString('en-EG')} EGP ${input.ticker.toUpperCase()} IPO order. NAV unchanged.`,
      'success',
      5500,
    );
    return true;
  }, [appendPersistedTransactionToSheet, portfolio, showToast]);

  const handleCorrectIpoSubscription = useCallback(async (
    input: IpoSubscriptionCorrectionFormInput,
  ): Promise<boolean> => {
    const reason=input.auditReason.trim();
    if (!reason) {
      showToast('Enter an audit reason for the IPO correction.', 'error');
      return false;
    }
    const result=await portfolio.correctIpoSubscription({
      transactionId:input.transactionId,
      subscriptionDate:input.subscriptionDate,
      executionTimeCairo:input.executionTimeCairo,
      requestedShares:input.requestedShares,
      offerPrice:input.offerPrice,
      reservedAmount:input.reservedAmount,
      reference:input.reference,
      notes:input.notes,
    },reason);
    if ('error' in result){
      showToast(`IPO correction not saved: ${result.error.message} Nothing was changed.`, 'error', 7000);
      return false;
    }
    showToast(`IPO subscription corrected to ${input.subscriptionDate}. Original hold and order ID preserved.`, 'success');
    return true;
  }, [portfolio, showToast]);

  const handleAllocateIpoSubscription = useCallback(async (
    input: IpoAllocationFormInput,
  ): Promise<boolean> => {
    const result = await portfolio.allocateIpoSubscription(input);
    if ('error' in result) {
      showToast(`IPO allocation was not saved: ${result.error.message} Nothing was changed.`, 'error', 7000);
      return false;
    }
    mirrorPersistedLedgerToSheet(result.snapshot.transactions);
    const transaction = result.value as TradeTransaction | undefined;
    const refund = Number(transaction?.ipoSubscription?.refundAmount ?? 0);
    showToast(
      `IPO allocation recorded: ${input.allocatedShares.toLocaleString('en-EG')} shares${refund > 0 ? ` · ${refund.toLocaleString('en-EG')} EGP released back to cash` : ''}.`,
      'success',
      6000,
    );
    return true;
  }, [mirrorPersistedLedgerToSheet, portfolio, showToast]);

  const handleCancelIpoSubscription = useCallback(async (
    transactionId: string,
  ): Promise<boolean> => {
    const result = await portfolio.cancelIpoSubscription(transactionId);
    if ('error' in result) {
      showToast(`IPO cancellation was not saved: ${result.error.message} Nothing was changed.`, 'error', 7000);
      return false;
    }
    mirrorPersistedLedgerToSheet(result.snapshot.transactions);
    const transaction = result.value as TradeTransaction | undefined;
    showToast(
      `Cancelled ${transaction?.ticker || 'IPO'} subscription and released the reserved cash.`,
      'success',
      5000,
    );
    return true;
  }, [mirrorPersistedLedgerToSheet, portfolio, showToast]);

  const handleSavePositionEdit = useCallback(async (updated: {
    id: string;
    targetPrice?: number;
    stopLoss?: number;
    notes?: string;
  }): Promise<boolean> => {
    const position = positions.find((candidate) => candidate.id === updated.id);
    if (!position) {
      showToast('The position changed before its targets could be saved. Reload and try again.', 'error');
      return false;
    }

    const saved = await portfolio.editPosition({
      ...position,
      targetPrice: updated.targetPrice,
      stopLoss: updated.stopLoss,
      notes: updated.notes,
    });
    if (!saved) {
      showToast(`Targets & notes for ${position.ticker} were not saved. Nothing was changed.`, 'error', 6500);
      return false;
    }

    showToast(`Updated targets & notes for ${position.ticker}`, 'success');
    return true;
  }, [portfolio, positions, showToast]);

  const handleDeleteTransaction = useCallback(async (
    id: string,
    auditReason?: string,
  ): Promise<boolean> => {
    const transaction = transactions.find((candidate) => candidate.id === id);
    if (!transaction) return false;

    if (transaction.type === 'OPENING_POSITION') {
      showToast(
        'Opening-position migration records are protected because later corporate actions depend on them.',
        'error',
        6500,
      );
      return false;
    }

    const previousState = { positions, closedTrades, transactions, cashBalance, capitalDeposits };
    const result = await portfolio.deleteTransaction(id, auditReason);
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

  const handleEditTransaction = useCallback(async (
    updatedTx: TradeTransaction,
    auditReason?: string,
  ): Promise<boolean> => {
    if (
      updatedTx.type === 'CORPORATE_ACTION'
      || updatedTx.type === 'IPO_SUBSCRIPTION'
      || updatedTx.type === 'OPENING_POSITION'
    ) {
      showToast(
        'Protected ledger lifecycle records must be managed through their dedicated workflow instead of the trade editor.',
        'error',
        6000,
      );
      return false;
    }

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

    const result = await portfolio.editTransaction(updatedTx, auditReason);
    if ('error' in result) {
      const anotherSaveInFlight=result.code==='BUSY';
      showToast(
        anotherSaveInFlight
          ? 'A financial save is already in progress. Wait for its confirmation before editing again.'
          : `Transaction edit was not saved: ${result.error.message} Nothing was changed.`,
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

  const handleOverviewReconcile = useCallback(async (auditReason?: string): Promise<boolean> => {
    const result = await portfolio.reconcileLedger(auditReason);
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

  const handleCashBalanceUpdate = useCallback(async (
    newBalance: number,
    auditReason?: string,
  ): Promise<boolean> => {
    const saved = await portfolio.updateCashBalance(newBalance, auditReason);
    if (!saved) {
      showToast('Cash balance update was not saved. Nothing was changed.', 'error', 6000);
      return false;
    }
    showToast(`Cash balance updated to ${newBalance.toLocaleString()} EGP and persisted.`, 'success');
    return true;
  }, [portfolio, showToast]);

  const handleQuickCashBalanceUpdate = useCallback(async (
    newBalance: number,
    auditReason?: string,
  ): Promise<boolean> => {
    const saved = await portfolio.updateCashBalance(newBalance, auditReason);
    if (!saved) {
      showToast('Cash balance adjustment was not saved. Nothing was changed.', 'error', 6000);
      return false;
    }
    showToast(`Cash balance adjusted to ${newBalance.toLocaleString()} EGP and persisted.`, 'success');
    return true;
  }, [portfolio, showToast]);

  return {
    handleAddPosition,
    handleConfirmSell,
    handleAddBonusShares,
    handleAddIpoSubscription,
    handleCorrectIpoSubscription,
    handleAllocateIpoSubscription,
    handleCancelIpoSubscription,
    handleSavePositionEdit,
    handleDeleteTransaction,
    handleEditTransaction,
    handleAIScreenshotAddTransaction,
    handleAIScreenshotAddBatchTransactions,
    handleSyncPrices,
    handlePushPricesToSheetDirectly,
    handleOverviewReconcile,
    handleCashBalanceUpdate,
    handleQuickCashBalanceUpdate,
  };
}
