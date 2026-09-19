import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Position,
  ClosedTrade,
  EGXTicker,
  PortfolioMetrics,
  PerformanceStats,
  GoogleSheetsConfig,
  Sector,
  TradeTransaction,
} from './types';
import { Header, NavigationTab } from './components/Header';
import { PortfolioSummary } from './components/PortfolioSummary';
import { PositionsTable } from './components/PositionsTable';
import { EditPositionModal } from './components/EditPositionModal';
import { ClosedCyclesView } from './components/ClosedCyclesView';
import { PerformanceReports } from './components/PerformanceReports';
import { TradingJournal } from './components/TradingJournal';
import { TickerDirectoryView } from './components/TickerDirectoryView';
import { CashBalanceView } from './components/CashBalanceView';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { PythonSchemaSyncModal } from './components/PythonSchemaSyncModal';
import { AddTradeModal } from './components/AddTradeModal';
import { SellPositionModal } from './components/SellPositionModal';
import { QuickCashModal } from './components/QuickCashModal';
import { PortfolioBackupModal } from './components/PortfolioBackupModal';
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal';
import { TradeScreenshotModal } from './components/TradeScreenshotModal';
import { PriceAlertsModal } from './components/PriceAlertsModal';
import { PerformanceTimeframeChart } from './components/charts/PerformanceTimeframeChart';
import { OfflineIndicator } from './components/OfflineIndicator';
import { usePortfolioState } from './hooks/usePortfolioState';
import { useMarketData } from './hooks/useMarketData';
import { useGoogleSheetsSync } from './hooks/useGoogleSheetsSync';
import { usePriceAlerts } from './hooks/usePriceAlerts';
import { calculatePortfolioMetrics, calculatePerformanceStats } from './utils/portfolioMetrics';
import { forceFullSyncToFirestore } from './services/firestoreStorage';
import { validateTradeInput } from './utils/portfolioValidation';
import { findStrongDuplicateExecution } from './utils/tradeExecutionIdentity';
import { getAccessToken } from './services/firebaseAuth';
import {
  appendTransactionToSheet,
  updateStockDirectoryInSheet,
  syncTransactionsLedgerToSheet,
  syncStockPricesToSheet,
} from './services/googleSheets';
import { RotateCcw } from 'lucide-react';
import { reconcilePortfolioFromLedger } from './services/portfolioReconciliation';
import { calculateBuyImpact, calculateSellAccounting, calculateHoldingDays } from './services/portfolioAccounting';
import { getHistoricalPricesForTransactions, type HistoricalPriceSeries } from './services/historicalPriceStore';
import { buildUnifiedAnalyticsResult } from './services/unifiedAnalyticsEngine';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('overview');

  // Portfolio State Hook (Encapsulates LocalStorage, Supabase sync, and CRUD)
  const {
    positions,
    setPositions,
    closedTrades,
    setClosedTrades,
    transactions,
    setTransactions,
    cashBalance,
    setCashBalance,
    updateCashBalance,
    tickers,
    setTickers,
    capitalDeposits,
    setCapitalDeposits,
    addTrade: executeAddTrade,
    sellPosition: executeSellPosition,
    editPosition: executeEditPosition,
    deletePosition: executeDeletePosition,
    editTransaction: executeEditTransaction,
    deleteTransaction: executeDeleteTransaction,
    addCashTransaction,
    editCashTransaction,
    deleteCashTransaction,
    reconcileLedger,
    importBackup,
    updateTickers,
    forceSync,
  } = usePortfolioState();

  // Google Sheets Sync Hook (Encapsulates OAuth, full sync, price sync, and token expiration)
  const {
    sheetsConfig,
    authUser,
    isSyncingToSheets,
    isSheetsTokenExpired,
    syncToSheets,
    syncPricesOnlyToSheets,
    updateSheetsConfig,
    handleLogin,
    handleLogout,
  } = useGoogleSheetsSync(positions, closedTrades, transactions, cashBalance, tickers);

  const sheetsConfigRef = useRef(sheetsConfig);
  sheetsConfigRef.current = sheetsConfig;
  const lastSheetAutoPushRef = useRef<number>(0);

  // Auto-sync or push live market quotes to Google Sheet
  const handleLivePricesSynced = useCallback(
    async (updatedPositions: Position[], updatedTickers: EGXTicker[], manual: boolean) => {
      const config = sheetsConfigRef.current;
      if (!config?.spreadsheetId) return;

      const now = Date.now();
      // Manual sync pushes immediately; auto-sync throttles to once every 45s
      const shouldPush = manual || (config.autoSync !== false && now - lastSheetAutoPushRef.current > 45000);

      if (shouldPush) {
        lastSheetAutoPushRef.current = now;
        try {
          const res = await syncPricesOnlyToSheets(updatedTickers, updatedPositions);
          if (res.success && res.updatedTabs && res.updatedTabs.length > 0) {
            if (manual) {
              setToastNotification({
                message: `Live prices updated & synced to Excel / Google Sheet (${res.updatedTabs.join(' & ')})!`,
                type: 'success',
              });
              setTimeout(() => setToastNotification(null), 4500);
            }
          }
        } catch (err) {
          console.warn('Auto-sync prices to Google Sheet failed:', err);
        }
      }
    },
    [syncPricesOnlyToSheets]
  );

  // Market Price Sync Hook (Encapsulates TradingView scanner & Cairo session scheduling)
  const {
    isSyncingPrices,
    lastPriceSyncTime,
    scheduleStatus,
    syncLivePrices,
  } = useMarketData(positions, tickers, setPositions, updateTickers, handleLivePricesSynced);

  // Price Target & Web Push Alerts Hook (PWA service worker push notifications & thresholds)
  const {
    settings: alertSettings,
    updateSettings: updateAlertSettings,
    alertHistory,
    clearHistory: clearAlertHistory,
    markAllRead: markAllAlertsRead,
    unreadCount: unreadAlertCount,
    permission: alertPermission,
    requestPermission: requestAlertPermission,
    sendTestNotification,
  } = usePriceAlerts(positions, tickers, scheduleStatus);

  // Modals & UI States
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isAddTradeModalOpen, setIsAddTradeModalOpen] = useState(false);
  const [isQuickCashModalOpen, setIsQuickCashModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isScreenshotModalOpen, setIsScreenshotModalOpen] = useState(false);
  const [isPriceAlertsModalOpen, setIsPriceAlertsModalOpen] = useState(false);
  const [sellingPosition, setSellingPosition] = useState<Position | null>(null);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [selectedTickerForTrade, setSelectedTickerForTrade] = useState<EGXTicker | null>(null);

  // Notification Toast & Undo State
  const [toastNotification, setToastNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [undoState, setUndoState] = useState<{
    previousState: {
      positions: Position[];
      closedTrades: ClosedTrade[];
      transactions: TradeTransaction[];
      cashBalance: number;
    };
    message: string;
  } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success', duration = 5000) => {
    setToastNotification({ message, type });
    setTimeout(() => setToastNotification(null), duration);
  }, []);

  // Performance Metrics & Indicators (Centralized calculation engine)
  const metrics: PortfolioMetrics = useMemo(() => {
    return calculatePortfolioMetrics(positions, cashBalance, closedTrades, tickers, transactions);
  }, [positions, cashBalance, closedTrades, tickers, transactions]);

  const [historicalDrawdown, setHistoricalDrawdown] = useState<{
    maxDrawdownEgp: number;
    maxDrawdownPercent: number;
  } | null>(null);
  const [historicalPriceSeries, setHistoricalPriceSeries] = useState<HistoricalPriceSeries>({});
  const [historicalAnalyticsLoading, setHistoricalAnalyticsLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== 'overview' && activeTab !== 'reports') return;

    let cancelled = false;
    setHistoricalDrawdown(null);
    setHistoricalPriceSeries({});
    setHistoricalAnalyticsLoading(true);

    const loadHistoricalPerformance = async () => {
      const hasMarketTransactions = transactions.some((tx) => tx.ticker.trim().toUpperCase() !== 'CASH');
      if (!hasMarketTransactions) {
        if (!cancelled) setHistoricalAnalyticsLoading(false);
        return;
      }

      try {
        const historicalPrices = await getHistoricalPricesForTransactions(transactions);
        const result = buildUnifiedAnalyticsResult(transactions, historicalPrices, 'ALL', {
          openingCapital: capitalDeposits,
        });

        if (!cancelled) {
          setHistoricalPriceSeries(historicalPrices);
          if (
            result.dataQuality.hasUsableRange &&
            result.summary.maxDrawdownPercent != null &&
            result.summary.maxEquityDrawdownEgp != null
          ) {
            setHistoricalDrawdown({
              // Performance percentage is external-flow-neutral TWR drawdown.
              // The EGP companion remains the nominal equity peak-to-trough gap.
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
  }, [activeTab, transactions, capitalDeposits]);

  const stats: PerformanceStats = useMemo(() => {
    const baseStats = calculatePerformanceStats(closedTrades, positions);
    return historicalDrawdown ? { ...baseStats, ...historicalDrawdown } : baseStats;
  }, [closedTrades, positions, historicalDrawdown]);

  // Execute Undo Action
  const executeUndo = () => {
    if (!undoState) return;
    const { previousState, message } = undoState;
    setPositions(previousState.positions);
    setClosedTrades(previousState.closedTrades);
    setTransactions(previousState.transactions);
    setCashBalance(previousState.cashBalance);
    setUndoState(null);
    showToast(`Restored state: ${message}`, 'success', 4000);
  };

  // Add Position / Buy Trade
  const handleAddPosition = (
    newTradeData: {
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
    },
    deductCash: boolean
  ) => {
    const valResult = validateTradeInput({
      ticker: newTradeData.ticker,
      shares: newTradeData.shares,
      price: newTradeData.buyPrice,
      fees: newTradeData.brokerageFee,
      type: 'BUY',
      date: newTradeData.buyDate,
      availableCash: cashBalance,
      deductFromCash: deductCash,
    });

    if (!valResult.valid) {
      showToast(`Trade Validation Error: ${valResult.errors.join(', ')}`, 'error');
      return;
    }

    const newTx = executeAddTrade({
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
      deductFromCash: deductCash,
    });

    // Auto-sync transaction to Google Sheets if connected
    if (sheetsConfig?.spreadsheetId) {
      getAccessToken()
        .then((token) => {
          appendTransactionToSheet(
            sheetsConfig.spreadsheetId,
            newTx,
            token || undefined,
            sheetsConfig.sheetName || 'Transaction Logger'
          ).catch((err) => console.warn('Background sheets sync:', err));
        })
        .catch(() => {
          appendTransactionToSheet(
            sheetsConfig.spreadsheetId,
            newTx,
            undefined,
            sheetsConfig.sheetName || 'Transaction Logger'
          ).catch((err) => console.warn('Background sheets sync fallback:', err));
        });
    }

    showToast(`Logged BUY order for ${newTradeData.shares} shares of ${newTradeData.ticker.toUpperCase()}`, 'success');
  };

  // Sell Position
  const handleConfirmSell = (
    positionId: string,
    soldShares: number,
    sellPrice: number,
    sellDate: string,
    executedAt: string | undefined,
    sellFees: number,
    notes: string,
    remainingShares: number
  ) => {
    const pos = positions.find((p) => p.id === positionId);
    if (!pos) return;

    const valResult = validateTradeInput({
      ticker: pos.ticker,
      shares: soldShares,
      price: sellPrice,
      fees: sellFees,
      type: 'SELL',
      date: sellDate,
      existingPosition: pos,
    });

    if (!valResult.valid) {
      showToast(`Sell Validation Error: ${valResult.errors.join(', ')}`, 'error');
      return;
    }

    const result = executeSellPosition({
      position: pos,
      sharesToSell: soldShares,
      sellPrice,
      fees: sellFees,
      sellDate,
      executedAt,
      addToCash: true,
      notes,
    });

    // Auto-sync SELL transaction to Google Sheets if connected
    if (sheetsConfig?.spreadsheetId && result.transaction) {
      getAccessToken()
        .then((token) => {
          appendTransactionToSheet(
            sheetsConfig.spreadsheetId,
            result.transaction,
            token || undefined,
            sheetsConfig.sheetName || 'Transaction Logger'
          ).catch((err) => console.warn('Background sheets sync:', err));
        })
        .catch(() => {
          appendTransactionToSheet(
            sheetsConfig.spreadsheetId,
            result.transaction,
            undefined,
            sheetsConfig.sheetName || 'Transaction Logger'
          ).catch((err) => console.warn('Background sheets sync fallback:', err));
        });
    }

    showToast(
      `Sold ${soldShares} shares of ${pos.ticker} (${result.closedTrade.realizedPnlEgp >= 0 ? '+' : ''}${result.closedTrade.realizedPnlEgp.toFixed(2)} EGP realized)`,
      'success'
    );
  };

  // Edit Position targets and notes
  const handleSavePositionEdit = (updated: {
    id: string;
    targetPrice?: number;
    stopLoss?: number;
    notes?: string;
  }) => {
    const pos = positions.find((p) => p.id === updated.id);
    if (!pos) return;

    const updatedPos: Position = {
      ...pos,
      targetPrice: updated.targetPrice,
      stopLoss: updated.stopLoss,
      notes: updated.notes,
    };

    executeEditPosition(updatedPos);
    showToast(`Updated targets & notes for ${pos.ticker}`, 'success');
  };

  // Delete Position
  const handleDeletePosition = (id: string) => {
    const pos = positions.find((p) => p.id === id);
    if (!pos) return;

    setUndoState({
      previousState: { positions, closedTrades, transactions, cashBalance },
      message: `Deleted ${pos.ticker} position`,
    });

    const updatedTxs = executeDeletePosition(id);
    showToast(`Deleted position ${pos.ticker}`, 'success');

    // Auto-sync updated transactions to Google Sheets to clear deleted rows
    if (sheetsConfig?.spreadsheetId && updatedTxs) {
      getAccessToken()
        .then((token) => {
          syncTransactionsLedgerToSheet(
            sheetsConfig.spreadsheetId,
            updatedTxs,
            token || undefined,
            sheetsConfig.sheetName || 'Transaction Logger'
          ).catch((err) => console.warn('Background sheets delete sync:', err));
        })
        .catch(() => {
          syncTransactionsLedgerToSheet(
            sheetsConfig.spreadsheetId,
            updatedTxs,
            undefined,
            sheetsConfig.sheetName || 'Transaction Logger'
          ).catch((err) => console.warn('Background sheets delete sync fallback:', err));
        });
    }
  };

  // Delete Transaction
  const handleDeleteTransaction = async (id: string): Promise<boolean> => {
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return false;

    const previousState = { positions, closedTrades, transactions, cashBalance };
    const updatedTxs = await executeDeleteTransaction(id);

    if (!updatedTxs) {
      showToast(`Could not delete ${tx.type} ${tx.ticker}: Supabase save failed. Nothing was changed.`, 'error');
      return false;
    }

    setUndoState({
      previousState,
      message: `Deleted ${tx.type} ${tx.ticker} transaction`,
    });
    showToast(`Deleted ${tx.type} ${tx.ticker} transaction and updated portfolio balances`, 'success');

    // Only mirror to Google Sheets after the authoritative Supabase delete succeeds.
    if (sheetsConfig?.spreadsheetId) {
      getAccessToken()
        .then((token) => {
          syncTransactionsLedgerToSheet(
            sheetsConfig.spreadsheetId,
            updatedTxs,
            token || undefined,
            sheetsConfig.sheetName || 'Transaction Logger'
          ).catch((err) => console.warn('Background sheets delete sync:', err));
        })
        .catch(() => {
          syncTransactionsLedgerToSheet(
            sheetsConfig.spreadsheetId,
            updatedTxs,
            undefined,
            sheetsConfig.sheetName || 'Transaction Logger'
          ).catch((err) => console.warn('Background sheets delete sync fallback:', err));
        });
    }

    return true;
  };

  // Edit Transaction
  const handleEditTransaction = (updatedTx: TradeTransaction) => {
    const valResult = validateTradeInput({
      ticker: updatedTx.ticker,
      shares: updatedTx.shares,
      price: updatedTx.price,
      fees: updatedTx.fees || 0,
      type: updatedTx.type,
      date: updatedTx.date,
    });

    if (!valResult.valid) {
      showToast(`Edit Transaction Error: ${valResult.errors.join(', ')}`, 'error');
      return;
    }

    const updatedTxs = executeEditTransaction(updatedTx);
    showToast(`Updated ${updatedTx.type} ${updatedTx.ticker} transaction record`, 'success');

    // Auto-sync updated transactions to Google Sheets
    if (sheetsConfig?.spreadsheetId && updatedTxs) {
      getAccessToken()
        .then((token) => {
          syncTransactionsLedgerToSheet(
            sheetsConfig.spreadsheetId,
            updatedTxs,
            token || undefined,
            sheetsConfig.sheetName || 'Transaction Logger'
          ).catch((err) => console.warn('Background sheets edit sync:', err));
        })
        .catch(() => {
          syncTransactionsLedgerToSheet(
            sheetsConfig.spreadsheetId,
            updatedTxs,
            undefined,
            sheetsConfig.sheetName || 'Transaction Logger'
          ).catch((err) => console.warn('Background sheets edit sync fallback:', err));
        });
    }
  };

  // Delete Closed Trade Cycle
  const handleDeleteTrade = (id: string) => {
    const trade = closedTrades.find((t) => t.id === id);
    if (!trade) return;

    setUndoState({
      previousState: { positions, closedTrades, transactions, cashBalance },
      message: `Deleted ${trade.ticker} closed trade cycle`,
    });

    const nextClosed = closedTrades.filter((t) => t.id !== id);
    setClosedTrades(nextClosed);
    showToast(`Deleted closed trade cycle for ${trade.ticker}`, 'success');
  };

  // AI Screenshot Single Transaction
  const handleAIScreenshotAddTransaction = (parsedTx: {
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
  }) => {
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
      return;
    }

    if (parsedTx.type === 'BUY') {
      handleAddPosition(
        {
          ticker: parsedTx.ticker,
          companyName: parsedTx.companyName,
          sector: parsedTx.sector,
          shares: parsedTx.shares,
          buyPrice: parsedTx.price,
          buyDate: parsedTx.date,
          executedAt: parsedTx.executedAt,
          brokerageFee: parsedTx.fees,
          notes: parsedTx.notes || 'Logged via Screenshot Scanner',
        },
        true
      );
    } else {
      const pos = positions.find((p) => p.ticker.toUpperCase() === parsedTx.ticker.toUpperCase());
      if (pos) {
        handleConfirmSell(
          pos.id,
          parsedTx.shares,
          parsedTx.price,
          parsedTx.date,
          parsedTx.executedAt,
          parsedTx.fees,
          parsedTx.notes || 'Logged via Screenshot Scanner',
          Math.max(0, pos.shares - parsedTx.shares)
        );
      } else {
        showToast(
          `Could not log SELL ${parsedTx.ticker.toUpperCase()}: no matching open position exists. Import the corresponding BUY first or use batch import.`,
          'error',
          6500,
        );
      }
    }
  };

  // AI Screenshot Batch Transactions
  // Process the entire OCR batch as one working ledger. Exact execution timestamps
  // are honored when present; only timestamp-missing same-day ties fall back to
  // BUY-before-SELL ordering so dependent sells can still reconcile safely.
  const handleAIScreenshotAddBatchTransactions = (
    parsedTxs: Array<{
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
    }>
  ) => {
    if (parsedTxs.length === 0) return;

    const orderedTxs = parsedTxs
      .map((tx, index) => ({ tx, index }))
      .sort((a, b) => {
        const aTime = new Date(a.tx.executedAt || a.tx.date).getTime();
        const bTime = new Date(b.tx.executedAt || b.tx.date).getTime();
        const dateDiff = aTime - bTime;
        if (Number.isFinite(dateDiff) && dateDiff !== 0) return dateDiff;
        const sameTicker = a.tx.ticker.trim().toUpperCase() === b.tx.ticker.trim().toUpperCase();
        if (sameTicker && a.tx.type !== b.tx.type) {
          return a.tx.type === 'BUY' ? -1 : 1;
        }
        return a.index - b.index;
      })
      .map(({ tx }) => tx);

    let workingTransactions = [...transactions];
    let workingReport = reconcilePortfolioFromLedger(workingTransactions, tickers, capitalDeposits);
    let processedCount = 0;
    let skippedCount = 0;
    let duplicateCount = 0;
    const pending = [...orderedTxs];

    // Keep retrying blocked SELLs after later BUYs have been applied. This makes
    // the batch dependency-aware instead of treating upload order as execution order.
    while (pending.length > 0) {
      let progressed = false;

      for (let i = 0; i < pending.length; i++) {
        const parsedTx = pending[i];
        const ticker = parsedTx.ticker.toUpperCase().trim();
        const shares = Number(parsedTx.shares);
        const price = Number(parsedTx.price);
        const fees = Number(parsedTx.fees) || 0;

        if (!ticker || !Number.isFinite(shares) || shares <= 0 || !Number.isFinite(price) || price <= 0) {
          pending.splice(i, 1);
          i--;
          skippedCount++;
          continue;
        }

        const duplicate = findStrongDuplicateExecution(workingTransactions, {
          type: parsedTx.type,
          ticker,
          shares,
          price,
          date: parsedTx.date,
          executedAt: parsedTx.executedAt,
          fees,
        });
        if (duplicate) {
          pending.splice(i, 1);
          i--;
          duplicateCount++;
          progressed = true;
          continue;
        }

        const maxTradeId = workingTransactions.reduce((max, t) => {
          const id = Number(t.tradeId);
          return Number.isFinite(id) && id > max ? id : max;
        }, 0);
        const tradeId = maxTradeId > 0 ? maxTradeId + 1 : workingTransactions.length + 1;

        if (parsedTx.type === 'SELL') {
          const position = workingReport.reconciledPositions.find((p) => p.ticker.toUpperCase() === ticker);
          if (!position || shares > position.shares) {
            continue;
          }

          const accounting = calculateSellAccounting(
            shares,
            price,
            fees,
            position.shares,
            position.shares * position.avgBuyPrice,
            position.totalFees || 0
          );
          const tx: TradeTransaction = {
            id: `tx-ocr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            tradeId,
            type: 'SELL',
            ticker,
            companyName: position.companyName || parsedTx.companyName || ticker,
            sector: position.sector || parsedTx.sector,
            shares,
            price,
            date: parsedTx.date,
            executedAt: parsedTx.executedAt,
            fees,
            totalAmount: accounting.netProceeds,
            grossTradeValue: accounting.grossProceeds,
            netCashImpact: accounting.netProceeds,
            realizedPnlEgp: accounting.realizedPnlEgp,
            realizedPnlPercent: accounting.realizedPnlPercent,
            outcome: accounting.outcome,
            holdingDays: calculateHoldingDays(position.buyDate, parsedTx.date),
            notes: parsedTx.notes || 'Logged via Screenshot Scanner',
          };
          workingTransactions = [tx, ...workingTransactions];
        } else {
          const impact = calculateBuyImpact(shares, price, fees);
          const tx: TradeTransaction = {
            id: `tx-ocr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            tradeId,
            type: 'BUY',
            ticker,
            companyName: parsedTx.companyName || ticker,
            sector: parsedTx.sector,
            shares,
            price,
            date: parsedTx.date,
            executedAt: parsedTx.executedAt,
            fees,
            totalAmount: impact.cashOutflow,
            grossTradeValue: impact.grossCost,
            netCashImpact: -impact.cashOutflow,
            notes: parsedTx.notes || 'Logged via Screenshot Scanner',
          };
          workingTransactions = [tx, ...workingTransactions];
        }

        pending.splice(i, 1);
        i--;
        progressed = true;
        processedCount++;
        workingReport = reconcilePortfolioFromLedger(workingTransactions, tickers, capitalDeposits);
      }

      if (!progressed) {
        skippedCount += pending.length;
        break;
      }
    }

    const finalReport = reconcilePortfolioFromLedger(workingTransactions, tickers, capitalDeposits);
    setTransactions(workingTransactions);
    setPositions(finalReport.reconciledPositions);
    setClosedTrades(finalReport.reconciledClosedTrades);
    setCashBalance(finalReport.reconciledCashBalance);
    void forceFullSyncToFirestore({
      positions: finalReport.reconciledPositions,
      closedTrades: finalReport.reconciledClosedTrades,
      transactions: workingTransactions,
      cashBalance: finalReport.reconciledCashBalance,
      capitalDeposits,
      tickers,
    });

    if (skippedCount > 0 || duplicateCount > 0) {
      const details = [
        duplicateCount > 0 ? `${duplicateCount} duplicate execution(s) blocked` : '',
        skippedCount > 0 ? `${skippedCount} unreconciled trade(s) skipped` : '',
      ].filter(Boolean).join('; ');
      showToast(`Logged ${processedCount} OCR trades. ${details}.`, skippedCount > 0 ? 'error' : 'success', 6500);
    } else {
      showToast(`Successfully processed all ${processedCount} OCR trades!`, 'success');
    }
  };

  // Manual trigger for Live Price Sync (TradingView -> App -> Google Sheet)
  const handleSyncPrices = async () => {
    const result = await syncLivePrices(true);
    if (result && result.success) {
      if (!sheetsConfig?.spreadsheetId) {
        showToast(`Live quotes updated for ${result.count || ''} EGX equities.`, 'success', 3500);
      }
    } else {
      showToast(result?.error || 'Failed updating market prices', 'error', 4000);
    }
  };

  // Push prices to connected Google Sheet
  const handlePushPricesToSheetDirectly = async () => {
    if (!sheetsConfig?.spreadsheetId) {
      setIsSheetsModalOpen(true);
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      setIsSheetsModalOpen(true);
      return;
    }
    const res = await syncPricesOnlyToSheets();
    if (!res.success) {
      throw new Error(res.message);
    }
    showToast(`Updated market quotes in Google Sheets (${res.updatedTabs?.join(' & ') || 'Directory & Positions'})`, 'success');
  };

  return (
    <div className="premium-page min-h-screen text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* App Header & Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenGoogleSheets={() => setIsSheetsModalOpen(true)}
        onOpenSchemaSync={() => setIsSchemaModalOpen(true)}
        onOpenAddTrade={() => {
          setSelectedTickerForTrade(null);
          setIsAddTradeModalOpen(true);
        }}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onOpenScreenshotModal={() => setIsScreenshotModalOpen(true)}
        onOpenPriceAlerts={() => setIsPriceAlertsModalOpen(true)}
        unreadAlertCount={unreadAlertCount}
        isAlertsActive={alertSettings.enabled}
        isSheetsConnected={!!sheetsConfig}
        isTokenExpired={isSheetsTokenExpired}
        sheetsTitle={sheetsConfig?.sheetName}
        authUser={authUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onSyncLivePrices={handleSyncPrices}
        isSyncingPrices={isSyncingPrices}
        forceSyncToFirestore={forceSync}
      />

      {/* Undo Toast Notification */}
      {undoState && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl text-xs font-semibold flex items-center gap-3 text-slate-200">
            <span>{undoState.message}</span>
            <button
              onClick={executeUndo}
              className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Undo
            </button>
          </div>
        </div>
      )}

      {/* Price / Action Notification Toast */}
      {toastNotification && (
        <div className="fixed top-20 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div
            className={`px-4 py-2.5 rounded-lg shadow-xl border text-xs font-semibold flex items-center gap-2.5 backdrop-blur-md ${
              toastNotification.type === 'success'
                ? 'bg-slate-900/95 border-emerald-500/60 text-emerald-300'
                : toastNotification.type === 'info'
                ? 'bg-slate-900/95 border-blue-500/60 text-blue-300'
                : 'bg-slate-900/95 border-rose-500/60 text-rose-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                toastNotification.type === 'success'
                  ? 'bg-emerald-400'
                  : toastNotification.type === 'info'
                  ? 'bg-blue-400'
                  : 'bg-rose-400'
              }`}
            />
            <span>{toastNotification.message}</span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">
        {/* Top Summary Banner */}
        <PortfolioSummary
          metrics={metrics}
          stats={stats}
          onQuickAddCash={() => setIsQuickCashModalOpen(true)}
          onSyncLivePrices={handleSyncPrices}
          onReconcileLedger={() => {
            const report = reconcileLedger();
            showToast(`Reconciled ${report.transactionsProcessed} transactions: ${report.reconciledPositions.length} open positions, ${report.reconciledClosedTrades.length} closed cycles.`, 'success');
          }}
          isSyncingPrices={isSyncingPrices}
          lastPriceSyncTime={lastPriceSyncTime}
          scheduleStatus={scheduleStatus}
        />

        {/* Ledger Reconciliation Alert if transactions exist but positions/closed cycles are empty */}
        {transactions.length > 0 && positions.length === 0 && (
          <div className="p-4 rounded-xl bg-blue-950/60 border border-blue-500/40 text-blue-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping shrink-0" />
              <span>
                <strong>{transactions.length} Trade Transactions in Ledger:</strong> Auto-reconcile to calculate open holdings, closed trade performance metrics, and cash balance.
              </span>
            </div>
            <button
              onClick={() => {
                const report = reconcileLedger();
                showToast(`Reconciled ${report.transactionsProcessed} transactions: ${report.reconciledPositions.length} open positions, ${report.reconciledClosedTrades.length} closed cycles.`, 'success');
              }}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs whitespace-nowrap shadow transition active:scale-95"
            >
              ⚡ Reconcile Portfolio Now
            </button>
          </div>
        )}

        {/* Tab Content Panels */}
        {activeTab === 'overview' && (
          <div className="premium-section-enter space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Active Stock Positions ({positions.length})
                </h2>
                <button
                  onClick={() => setActiveTab('positions')}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition"
                >
                  View Full Table →
                </button>
              </div>
              <PositionsTable
                positions={positions}
                onSellPosition={(pos) => setSellingPosition(pos)}
                onBuyMore={(pos) => {
                  setSelectedTickerForTrade(tickers.find((t) => t.ticker === pos.ticker) || null);
                  setIsAddTradeModalOpen(true);
                }}
                onEditPosition={(pos) => setEditingPosition(pos)}
                onDeletePosition={handleDeletePosition}
                onOpenPriceAlerts={() => setIsPriceAlertsModalOpen(true)}
                onAddNewTrade={() => {
                  setSelectedTickerForTrade(null);
                  setIsAddTradeModalOpen(true);
                }}
              />
            </div>

            {/* Unified portfolio analytics */}
            <PerformanceTimeframeChart
              transactions={transactions}
              historicalPrices={historicalPriceSeries}
              capitalDeposits={capitalDeposits}
              historicalLoading={historicalAnalyticsLoading}
            />
          </div>
        )}

        {activeTab === 'positions' && (
          <div className="premium-section-enter space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  EGX Portfolio Positions
                </h2>
                <p className="text-xs text-slate-400">
                  Track equities, real-time unrealized gains, and price targets.
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedTickerForTrade(null);
                  setIsAddTradeModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition"
              >
                + Add Position
              </button>
            </div>
            <PositionsTable
              positions={positions}
              onSellPosition={(pos) => setSellingPosition(pos)}
              onBuyMore={(pos) => {
                setSelectedTickerForTrade(tickers.find((t) => t.ticker === pos.ticker) || null);
                setIsAddTradeModalOpen(true);
              }}
              onEditPosition={(pos) => setEditingPosition(pos)}
              onDeletePosition={handleDeletePosition}
              onOpenPriceAlerts={() => setIsPriceAlertsModalOpen(true)}
              onAddNewTrade={() => {
                setSelectedTickerForTrade(null);
                setIsAddTradeModalOpen(true);
              }}
            />
          </div>
        )}

        {activeTab === 'closed_cycles' && (
          <ClosedCyclesView
            closedTrades={closedTrades}
            transactions={transactions}
            onDeleteTrade={handleDeleteTrade}
          />
        )}

        {activeTab === 'reports' && (
          <PerformanceReports
            stats={stats}
            closedTrades={closedTrades}
            positions={positions}
            metrics={metrics}
            cashBalance={cashBalance}
            capitalDeposits={capitalDeposits}
            transactions={transactions}
            historicalPrices={historicalPriceSeries}
            historicalLoading={historicalAnalyticsLoading}
          />
        )}

        {activeTab === 'journal' && (
          <TradingJournal
            transactions={transactions}
            closedTrades={closedTrades}
            positions={positions}
            onDeleteTransaction={handleDeleteTransaction}
            onEditTransaction={handleEditTransaction}
            onDeleteTrade={handleDeleteTrade}
            onDeletePosition={handleDeletePosition}
            onOpenScreenshotModal={() => setIsScreenshotModalOpen(true)}
            onSyncToSheets={syncToSheets}
            isSyncingToSheets={isSyncingToSheets}
          />
        )}

        {activeTab === 'cash' && (
          <CashBalanceView
            cashBalance={cashBalance}
            totalPortfolioValue={metrics.totalValue}
            onUpdateCashBalance={(newBal) => {
              updateCashBalance(newBal);
              showToast(`Cash balance updated to ${newBal.toLocaleString()} EGP and synced.`, 'success');
            }}
            positions={positions}
            closedTrades={closedTrades}
            tradeTransactions={transactions}
            capitalDeposits={capitalDeposits}
            onAddCashTransaction={addCashTransaction}
            onEditCashTransaction={editCashTransaction}
            onDeleteCashTransaction={deleteCashTransaction}
            onReconcileLedger={() => {
              const report = reconcileLedger();
              showToast(`Reconciled ${report.transactionsProcessed} transactions: Cash adjusted to ${report.reconciledCashBalance.toLocaleString()} EGP.`, 'success');
            }}
          />
        )}

        {activeTab === 'directory' && (
          <TickerDirectoryView
            tickers={tickers}
            onSelectTickerForTrade={(t) => {
              setSelectedTickerForTrade(t);
              setIsAddTradeModalOpen(true);
            }}
            onOpenSchemaSync={() => setIsSchemaModalOpen(true)}
            onSyncLivePrices={handleSyncPrices}
            isSyncingPrices={isSyncingPrices}
            lastPriceSyncTime={lastPriceSyncTime}
            onPushPricesToSheet={handlePushPricesToSheetDirectly}
            isSheetsConnected={!!sheetsConfig?.spreadsheetId}
          />
        )}
      </main>

      {/* Modals & Dialogs */}
      <PriceAlertsModal
        isOpen={isPriceAlertsModalOpen}
        onClose={() => setIsPriceAlertsModalOpen(false)}
        positions={positions}
        settings={alertSettings}
        onUpdateSettings={updateAlertSettings}
        alertHistory={alertHistory}
        onClearHistory={clearAlertHistory}
        onMarkAllRead={markAllAlertsRead}
        permission={alertPermission}
        onRequestPermission={requestAlertPermission}
        onSendTestNotification={sendTestNotification}
        scheduleStatus={scheduleStatus}
        onEditPosition={(pos) => setEditingPosition(pos)}
      />

      <GoogleSheetsModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        onSaveConfig={(cfg) => {
          updateSheetsConfig(cfg);
          showToast(`Google Sheets connection saved (${cfg.autoSync !== false ? 'Auto Sync ON' : 'Auto Sync OFF'})!`);
        }}
        onImportData={(importedPositions, importedClosedTrades, config, importedTransactions) => {
          if (importedPositions?.length) setPositions(importedPositions);
          if (importedClosedTrades?.length) setClosedTrades(importedClosedTrades);
          if (importedTransactions?.length) setTransactions(importedTransactions);
          updateSheetsConfig(config);
          showToast(`Imported records from Google Sheet "${config.sheetName || 'Transaction Logger'}"!`);
        }}
        currentConfig={sheetsConfig || undefined}
        authUser={authUser}
        onAuthSuccess={() => {
          showToast('Signed in with Google Account successfully!', 'success');
        }}
        onLogout={async () => {
          await handleLogout();
          showToast('Signed out of Google Account.', 'info');
        }}
        positions={positions}
        closedTrades={closedTrades}
        transactions={transactions}
        tickers={tickers}
        onReconcileFromLedger={() => {
          reconcileLedger();
          showToast('Audited and reconciled portfolio from transaction ledger', 'success');
        }}
      />

      <PythonSchemaSyncModal
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        onUpdateTickers={updateTickers}
      />

      <AddTradeModal
        isOpen={isAddTradeModalOpen}
        onClose={() => {
          setIsAddTradeModalOpen(false);
          setSelectedTickerForTrade(null);
        }}
        onAddPosition={handleAddPosition}
        tickers={tickers}
        preselectedTicker={selectedTickerForTrade}
        cashBalance={cashBalance}
        existingPositions={positions}
        transactions={transactions}
        onOpenScreenshotModal={() => setIsScreenshotModalOpen(true)}
      />

      <TradeScreenshotModal
        isOpen={isScreenshotModalOpen}
        onClose={() => setIsScreenshotModalOpen(false)}
        tickers={tickers}
        onAddTransaction={handleAIScreenshotAddTransaction}
        onAddBatchTransactions={handleAIScreenshotAddBatchTransactions}
      />

      <EditPositionModal
        position={editingPosition}
        isOpen={!!editingPosition}
        onClose={() => setEditingPosition(null)}
        onSave={handleSavePositionEdit}
      />

      <SellPositionModal
        position={sellingPosition}
        isOpen={!!sellingPosition}
        onClose={() => setSellingPosition(null)}
        onConfirmSell={handleConfirmSell}
      />

      <QuickCashModal
        isOpen={isQuickCashModalOpen}
        onClose={() => setIsQuickCashModalOpen(false)}
        currentCash={cashBalance}
        onUpdateCash={(newCash) => {
          updateCashBalance(newCash);
          showToast(`Cash balance adjusted to ${newCash.toLocaleString()} EGP and saved.`, 'success');
        }}
      />

      <PortfolioBackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        positions={positions}
        closedTrades={closedTrades}
        transactions={transactions}
        cashBalance={cashBalance}
        capitalDeposits={capitalDeposits}
        tickers={tickers}
        onRestoreBackup={async (restored) => {
          await importBackup(restored);
          showToast('Portfolio successfully restored from backup file & synced to cloud!', 'success');
        }}
        onReconcileLedger={() => {
          reconcileLedger();
          showToast('Portfolio reconciled against trade transactions ledger', 'success');
        }}
      />

      {/* Offline PWA Indicator */}
      <OfflineIndicator />
    </div>
  );
}
