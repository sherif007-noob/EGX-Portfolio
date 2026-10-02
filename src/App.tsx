import { useMarketRefresh } from './hooks/useMarketRefresh';
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
import { TradingJournal, type JournalLedgerFocus } from './components/TradingJournal';
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
import { useSectorMomentumAlerts } from './hooks/useSectorMomentumAlerts';
import { calculatePortfolioMetrics, calculatePerformanceStats } from './utils/portfolioMetrics';
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
import {
  deriveCanonicalCapitalDeposits,
} from './services/portfolioReconciliation';
import {
  getActivePositionLedgerTransactionIds,
  getClosedCycleLedgerTransactionIds,
} from './services/ledgerProjectionOwnership';
import { ensureHistoricalPriceCoverage, getHistoricalPricesForTransactions, type HistoricalPriceSeries } from './services/historicalPriceStore';
import { buildUnifiedAnalyticsResult } from './services/unifiedAnalyticsEngine';
import { MotionSwap, SurfacePresence } from './components/PremiumMotion';
import { runVisualTransition } from './utils/visualTransition';
import { VISUAL_REGRESSION_MODE } from './utils/visualRegressionMode';
import { VISUAL_REGRESSION_HISTORICAL_PRICES } from './data/visualRegressionFixture';

// Phase 10.8 exact-head validation trigger: complete modal/workflow consistency runtime source.
// Phase 10.9 exact-head validation trigger: responsive cross-app containment runtime source.
export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('overview');
  const [settledTab, setSettledTab] = useState<NavigationTab>('overview');
  const [ledgerCorrectionFocus, setLedgerCorrectionFocus] = useState<JournalLedgerFocus | null>(null);

  const handleTabChange = (nextTab: NavigationTab) => {
    if (nextTab !== 'journal') setLedgerCorrectionFocus(null);
    if (nextTab === activeTab) return;

    const desktopMotionTarget =
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)').matches;

    const update = () => runVisualTransition('tab', () => setActiveTab(nextTab));

    if (desktopMotionTarget) {
      React.startTransition(update);
      return;
    }

    setSettledTab(nextTab);
    update();
  };

  // Portfolio State Hook (Encapsulates LocalStorage, Supabase sync, and CRUD)
  const {
    isInitialized,
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
    editTransaction: executeEditTransaction,
    deleteTransaction: executeDeleteTransaction,
    addCashTransaction,
    editCashTransaction,
    deleteCashTransaction,
    reconcileLedger,
    importBackup,
    importOcrBatch,
    restoreLedgerSnapshot,
    updateTickers,
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
  } = useMarketData(positions, tickers, setPositions, updateTickers, handleLivePricesSynced, isInitialized);

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

  // Live 5-10 minute sector-cluster detector (e.g. cement rotation).
  useSectorMomentumAlerts(scheduleStatus);

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
      capitalDeposits: number;
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

  const analyticsCapitalDeposits = useMemo(
    () => deriveCanonicalCapitalDeposits(transactions, cashBalance, capitalDeposits),
    [transactions, cashBalance, capitalDeposits],
  );

  const [historicalDrawdown, setHistoricalDrawdown] = useState<{
    maxDrawdownEgp: number;
    maxDrawdownPercent: number;
  } | null>(null);
  const [historicalPriceSeries, setHistoricalPriceSeries] = useState<HistoricalPriceSeries>({});
  const [historicalAnalyticsLoading, setHistoricalAnalyticsLoading] = useState(false);
  const marketRefresh = useMarketRefresh();
  const historicalBackfillAttemptsRef = useRef(new Set<string>());

  useEffect(() => {
    if (VISUAL_REGRESSION_MODE) {
      const visualResult = buildUnifiedAnalyticsResult(
        transactions,
        VISUAL_REGRESSION_HISTORICAL_PRICES,
        'ALL',
        { openingCapital: analyticsCapitalDeposits },
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
      if (!isInitialized) { setHistoricalAnalyticsLoading(false); return; }
      const hasMarketTransactions = transactions.some((tx) => tx.ticker.trim().toUpperCase() !== 'CASH');
      if (!hasMarketTransactions) {
        if (!cancelled) setHistoricalAnalyticsLoading(false);
        return;
      }

      try {
        let historicalPrices = await getHistoricalPricesForTransactions(transactions);
        let result = buildUnifiedAnalyticsResult(transactions, historicalPrices, 'ALL', {
          openingCapital: analyticsCapitalDeposits,
        });

        const normalizeHistoryTicker = (ticker: string) =>
          ticker.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');

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
              openingCapital: analyticsCapitalDeposits,
            });
          } catch (backfillError) {
            for (const target of repairTargets) historicalBackfillAttemptsRef.current.delete(target.ticker);
            console.warn('Automatic historical-price backfill failed; keeping the existing trustworthy analytics range.', backfillError);
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
  }, [transactions, analyticsCapitalDeposits, marketRefresh, isInitialized]);


  const stats: PerformanceStats = useMemo(() => {
    const baseStats = calculatePerformanceStats(closedTrades, positions);
    return historicalDrawdown ? { ...baseStats, ...historicalDrawdown } : baseStats;
  }, [closedTrades, positions, historicalDrawdown]);

  // Execute Undo Action
  const executeUndo = async () => {
    if (!undoState) return;
    const { previousState, message } = undoState;
    const result = await restoreLedgerSnapshot({
      transactions: previousState.transactions,
      capitalDeposits: previousState.capitalDeposits,
      positions: previousState.positions,
    });
    if ('error' in result) {
      showToast(`Undo was not saved: ${result.error.message}`, 'error', 6000);
      return;
    }
    setUndoState(null);
    showToast(`Restored state: ${message}`, 'success', 4000);
  };

  // Add Position / Buy Trade
  const handleAddPosition = async (
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
  ): Promise<boolean> => {
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
      return false;
    }

    const result = await executeAddTrade({
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

    if ('error' in result) {
      if (result.persisted) {
        showToast(
          `BUY ${newTradeData.ticker.toUpperCase()} was saved to Supabase, but this screen could not refresh. Reload before entering another trade.`,
          'error',
          7000,
        );
        return true;
      }
      showToast(
        `BUY was not saved: ${result.error.message} Nothing was changed.`,
        'error',
        7000,
      );
      return false;
    }

    const newTx = result.value;
    if (!newTx) {
      showToast('BUY was persisted but the saved transaction result was unavailable. Reload before entering another trade.', 'error', 7000);
      return true;
    }

    // Sheets is an optional mirror. It starts only after authoritative portfolio
    // persistence succeeds and its failure never rolls back the saved trade.
    if (sheetsConfig?.spreadsheetId) {
      getAccessToken()
        .then((token) => {
          appendTransactionToSheet(
            sheetsConfig.spreadsheetId,
            newTx,
            token || undefined,
            sheetsConfig.sheetName || 'Transaction Logger'
          ).catch((err) => console.warn('Background sheets sync after persisted BUY:', err));
        })
        .catch(() => {
          appendTransactionToSheet(
            sheetsConfig.spreadsheetId,
            newTx,
            undefined,
            sheetsConfig.sheetName || 'Transaction Logger'
          ).catch((err) => console.warn('Background sheets sync fallback after persisted BUY:', err));
        });
    }

    showToast(`Logged BUY order for ${newTradeData.shares} shares of ${newTradeData.ticker.toUpperCase()}`, 'success');
    return true;
  };

  // Sell Position
  const handleConfirmSell = async (
    positionId: string,
    soldShares: number,
    sellPrice: number,
    sellDate: string,
    executedAt: string | undefined,
    sellFees: number,
    notes: string,
    _remainingShares: number
  ): Promise<boolean> => {
    const pos = positions.find((p) => p.id === positionId);
    if (!pos) {
      showToast('The position changed before the sale could be prepared. Reload and try again.', 'error');
      return false;
    }

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
      return false;
    }

    const result = await executeSellPosition({
      position: pos,
      sharesToSell: soldShares,
      sellPrice,
      fees: sellFees,
      sellDate,
      executedAt,
      addToCash: true,
      notes,
    });

    if ('error' in result) {
      if (result.persisted) {
        showToast(
          `SELL ${pos.ticker} was saved to Supabase, but this screen could not refresh. Reload before entering another trade.`,
          'error',
          7000,
        );
        return true;
      }
      showToast(
        `SELL was not saved: ${result.error.message} Nothing was changed.`,
        'error',
        7000,
      );
      return false;
    }

    const transaction = result.value;
    if (!transaction) {
      showToast('SELL was persisted but the saved transaction result was unavailable. Reload before entering another trade.', 'error', 7000);
      return true;
    }
    const closedTrade = result.snapshot.closedTrades.find((trade) =>
      trade.sellTransactionIds?.includes(transaction.id),
    );

    // Optional Sheets mirror starts only after authoritative portfolio persistence.
    if (sheetsConfig?.spreadsheetId) {
      getAccessToken()
        .then((token) => {
          appendTransactionToSheet(
            sheetsConfig.spreadsheetId,
            transaction,
            token || undefined,
            sheetsConfig.sheetName || 'Transaction Logger'
          ).catch((err) => console.warn('Background sheets sync after persisted SELL:', err));
        })
        .catch(() => {
          appendTransactionToSheet(
            sheetsConfig.spreadsheetId,
            transaction,
            undefined,
            sheetsConfig.sheetName || 'Transaction Logger'
          ).catch((err) => console.warn('Background sheets sync fallback after persisted SELL:', err));
        });
    }

    if (closedTrade) {
      showToast(
        `Sold ${soldShares} shares of ${pos.ticker} (${closedTrade.realizedPnlEgp >= 0 ? '+' : ''}${closedTrade.realizedPnlEgp.toFixed(2)} EGP realized)`,
        'success'
      );
    } else {
      showToast(`Sold ${soldShares} shares of ${pos.ticker} and persisted the updated ledger.`, 'success');
    }
    return true;
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

  const openPositionLedgerCorrection = useCallback((position: Position) => {
    const transactionIds = getActivePositionLedgerTransactionIds(transactions, position.ticker);
    setLedgerCorrectionFocus({
      key: `position:${position.id}:${Date.now()}`,
      source: 'POSITION',
      ticker: position.ticker,
      transactionIds,
      title: `${position.ticker} open-position source executions`,
      detail: transactionIds.length > 0
        ? `Showing the ${transactionIds.length} execution(s) in the active weighted-average trade cycle.`
        : 'No explicit active-cycle IDs were resolved, so the journal is scoped to this ticker.',
    });
    handleTabChange('journal');
  }, [transactions]);

  const openClosedCycleLedgerCorrection = useCallback((
    cycle: ClosedTrade,
    renderedTransactionIds: string[],
  ) => {
    const canonicalIds = getClosedCycleLedgerTransactionIds(cycle);
    const transactionIds = canonicalIds.length > 0 ? canonicalIds : renderedTransactionIds;
    setLedgerCorrectionFocus({
      key: `closed-cycle:${cycle.id}:${Date.now()}`,
      source: 'CLOSED_CYCLE',
      ticker: cycle.ticker,
      transactionIds,
      title: `${cycle.ticker} closed-cycle source executions`,
      detail: transactionIds.length > 0
        ? `Showing ${transactionIds.length} BUY/SELL source execution(s) linked to this derived cycle.`
        : 'No explicit source IDs were stored for this legacy cycle, so the journal is scoped to this ticker.',
    });
    handleTabChange('journal');
  }, []);

  // Delete Transaction
  const handleDeleteTransaction = async (id: string): Promise<boolean> => {
    const tx = transactions.find((transaction) => transaction.id === id);
    if (!tx) return false;

    const previousState = { positions, closedTrades, transactions, cashBalance, capitalDeposits };
    const result = await executeDeleteTransaction(id);

    if ('error' in result) {
      showToast(`Could not delete ${tx.type} ${tx.ticker}: ${result.error.message} Nothing was changed.`, 'error', 6500);
      return false;
    }

    setUndoState({
      previousState,
      message: `Deleted ${tx.type} ${tx.ticker} transaction`,
    });
    showToast(`Deleted ${tx.type} ${tx.ticker} transaction and persisted reconciled balances`, 'success');

    if (sheetsConfig?.spreadsheetId) {
      const persistedTransactions = result.snapshot.transactions;
      getAccessToken()
        .then((token) => {
          syncTransactionsLedgerToSheet(
            sheetsConfig.spreadsheetId,
            persistedTransactions,
            token || undefined,
            sheetsConfig.sheetName || 'Transaction Logger'
          ).catch((err) => console.warn('Background sheets delete sync after persisted delete:', err));
        })
        .catch(() => {
          syncTransactionsLedgerToSheet(
            sheetsConfig.spreadsheetId,
            persistedTransactions,
            undefined,
            sheetsConfig.sheetName || 'Transaction Logger'
          ).catch((err) => console.warn('Background sheets delete sync fallback after persisted delete:', err));
        });
    }

    return true;
  };

  // Edit Transaction
  const handleEditTransaction = async (updatedTx: TradeTransaction): Promise<boolean> => {
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
      return false;
    }

    const result = await executeEditTransaction(updatedTx);
    if ('error' in result) {
      showToast(`Transaction edit was not saved: ${result.error.message} Nothing was changed.`, 'error', 6500);
      return false;
    }

    showToast(`Updated ${updatedTx.type} ${updatedTx.ticker} transaction and persisted reconciled balances`, 'success');

    if (sheetsConfig?.spreadsheetId) {
      const persistedTransactions = result.snapshot.transactions;
      getAccessToken()
        .then((token) => {
          syncTransactionsLedgerToSheet(
            sheetsConfig.spreadsheetId,
            persistedTransactions,
            token || undefined,
            sheetsConfig.sheetName || 'Transaction Logger'
          ).catch((err) => console.warn('Background sheets edit sync after persisted edit:', err));
        })
        .catch(() => {
          syncTransactionsLedgerToSheet(
            sheetsConfig.spreadsheetId,
            persistedTransactions,
            undefined,
            sheetsConfig.sheetName || 'Transaction Logger'
          ).catch((err) => console.warn('Background sheets edit sync fallback after persisted edit:', err));
        });
    }
    return true;
  };

  // AI Screenshot Single Transaction
  const handleAIScreenshotAddTransaction = async (parsedTx: {
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
  }): Promise<boolean> => {
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
      return handleAddPosition(
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
    }

    const pos = positions.find((position) =>
      position.ticker.toUpperCase() === parsedTx.ticker.toUpperCase(),
    );
    if (!pos) {
      showToast(
        `Could not log SELL ${parsedTx.ticker.toUpperCase()}: no matching open position exists. Import the corresponding BUY first or use batch import.`,
        'error',
        6500,
      );
      return false;
    }

    return handleConfirmSell(
      pos.id,
      parsedTx.shares,
      parsedTx.price,
      parsedTx.date,
      parsedTx.executedAt,
      parsedTx.fees,
      parsedTx.notes || 'Logged via Screenshot Scanner',
      Math.max(0, pos.shares - parsedTx.shares)
    );
  };

  // OCR batch is persisted as one canonical ledger mutation so valid dependent
  // BUY/SELL executions cannot be half-applied locally.
  const handleAIScreenshotAddBatchTransactions = async (parsedTxs: Array<{
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
  }>): Promise<boolean> => {
    if (parsedTxs.length === 0) return false;

    const result = await importOcrBatch(parsedTxs);
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

    if (details) {
      showToast(
        `Persisted ${summary.processedCount} OCR trade(s). ${details}.`,
        summary.skippedCount > 0 ? 'error' : 'success',
        6500,
      );
    } else {
      showToast(`Successfully persisted all ${summary.processedCount} OCR trades!`, 'success');
    }
    return true;
  };

  // Manual trigger for Live Price Sync (TradingView -> App -> Google Sheet)
  const handleSyncPrices = useCallback(async () => {
    const result = await syncLivePrices(true);
    if (result && result.success) {
      if (!sheetsConfig?.spreadsheetId) {
        showToast(`Live quotes updated for ${result.count || ''} EGX equities.`, 'success', 3500);
      }
    } else {
      showToast(result?.error || 'Failed updating market prices', 'error', 4000);
    }
  }, [syncLivePrices, sheetsConfig?.spreadsheetId, showToast]);

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

  const handleQuickAddCash = useCallback(() => {
    setIsQuickCashModalOpen(true);
  }, []);

  const handleOverviewReconcile = useCallback(async (): Promise<boolean> => {
    const result = await reconcileLedger();
    if ('error' in result) {
      showToast(`Ledger reconciliation was not saved: ${result.error.message}`, 'error', 6500);
      return false;
    }
    showToast(
      `Reconciled and persisted ${result.snapshot.transactions.length} transactions: ${result.snapshot.positions.length} open positions, ${result.snapshot.closedTrades.length} closed cycles.`,
      'success',
    );
    return true;
  }, [reconcileLedger, showToast]);

  return (
    <div className="premium-page min-h-[100dvh] text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* App Header & Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onOpenGoogleSheets={() => setIsSheetsModalOpen(true)}
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
        onSyncLivePrices={handleSyncPrices}
        isSyncingPrices={isSyncingPrices}
        onOpenSettings={() => showToast('Settings are reserved for a future phase.', 'info')}
      />

      {/* Undo Toast Notification */}
      <SurfacePresence isOpen={!!undoState} className="premium-fixed-overlay premium-fixed-mobile-span premium-fixed-bottom-above-status fixed bottom-6 right-6 z-50">
        {undoState && (
        <div className="w-full">
          <div className="premium-floating w-full px-4 py-3 rounded-xl border text-xs font-semibold flex items-center gap-3 text-slate-200">
            <span className="min-w-0 flex-1">{undoState.message}</span>
            <button
              onClick={executeUndo}
              className="premium-action premium-action-success shrink-0 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Undo
            </button>
          </div>
        </div>
        )}
      </SurfacePresence>

      {/* Price / Action Notification Toast */}
      <SurfacePresence isOpen={!!toastNotification} className="premium-fixed-overlay premium-fixed-mobile-span premium-fixed-top-after-header fixed top-20 right-4 z-50">
        {toastNotification && (
        <div className="w-full">
          <div
            className={`w-full px-4 py-2.5 rounded-lg shadow-xl border text-xs font-semibold flex items-center gap-2.5 backdrop-blur-md ${
              toastNotification.type === 'success'
                ? 'premium-floating border-emerald-500/60 text-emerald-300'
                : toastNotification.type === 'info'
                ? 'premium-floating border-blue-500/60 text-blue-300'
                : 'premium-floating border-rose-500/60 text-rose-300'
            }`}
          >
            <span
              className={`w-2 h-2 shrink-0 rounded-full ${
                toastNotification.type === 'success'
                  ? 'bg-emerald-400'
                  : toastNotification.type === 'info'
                  ? 'bg-blue-400'
                  : 'bg-rose-400'
              }`}
            />
            <span className="min-w-0 flex-1">{toastNotification.message}</span>
          </div>
        </div>
      )}
      </SurfacePresence>

      {/* Main Container */}
      <main className="premium-safe-inline-main premium-flow-major relative z-10 flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-6">
        {/* Top Summary Banner */}
        <PortfolioSummary
          metrics={metrics}
          stats={stats}
          onQuickAddCash={handleQuickAddCash}
          onSyncLivePrices={handleSyncPrices}
          onReconcileLedger={handleOverviewReconcile}
          isSyncingPrices={isSyncingPrices}
          lastPriceSyncTime={lastPriceSyncTime}
          scheduleStatus={scheduleStatus}
        />

        {/* Ledger Reconciliation Alert if transactions exist but positions/closed cycles are empty */}
        {transactions.length > 0 && positions.length === 0 && (
          <div
            className="premium-panel premium-hierarchy-h4 premium-pad-h4 rounded-xl border-blue-500/35 text-blue-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            data-hierarchy="h4"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping shrink-0" />
              <span>
                <strong>{transactions.length} Trade Transactions in Ledger:</strong> Auto-reconcile to calculate open holdings, closed trade performance metrics, and cash balance.
              </span>
            </div>
            <button
              onClick={() => { void handleOverviewReconcile(); }}
              className="premium-action premium-action-primary px-3.5 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap"
            >
              ⚡ Reconcile Portfolio Now
            </button>
          </div>
        )}

        {/* Tab Content Panels — Phase 10 page-closure composition; Closed Cycles source validation */}
        <MotionSwap
          motionKey={activeTab}
          variant="tab"
          className="premium-tab-stage"
          onEnterComplete={(completedTab) => {
            if (completedTab === activeTab) setSettledTab(activeTab);
          }}
        >
        {activeTab === 'overview' && (
          <div className="premium-flow-major">
            <section className="premium-flow-control" data-overview-section="positions-preview">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <h2 className="premium-type-section-title">Active Stock Positions</h2>
                  <p className="premium-type-helper mt-0.5">
                    {positions.length} active holding{positions.length === 1 ? '' : 's'} · compact portfolio snapshot
                  </p>
                </div>
                <button
                  onClick={() => handleTabChange('positions')}
                  className="premium-action premium-action-priority-secondary w-full justify-center px-2.5 py-1 rounded-lg text-xs font-semibold sm:w-auto"
                >
                  Open Positions →
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
                onCorrectLedger={openPositionLedgerCorrection}
                onOpenPriceAlerts={() => setIsPriceAlertsModalOpen(true)}
                onAddNewTrade={() => {
                  setSelectedTickerForTrade(null);
                  setIsAddTradeModalOpen(true);
                }}
                variant="overview"
                overviewLimit={4}
              />
            </section>

            {/* Unified portfolio analytics */}
            <PerformanceTimeframeChart
              transactions={transactions}
              historicalPrices={historicalPriceSeries}
              capitalDeposits={analyticsCapitalDeposits}
              positions={positions}
              currentCashBalance={cashBalance}
              historicalLoading={historicalAnalyticsLoading}
              entranceReady={settledTab === activeTab}
              visualContext="overview"
            />
          </div>
        )}

        {activeTab === 'positions' && (
          <section
            className="premium-hierarchy-h0 premium-flow-related"
            data-hierarchy="h0"
            data-page="positions"
          >
            <div className="min-w-0">
              <h2 className="premium-type-section-title">EGX Portfolio Positions</h2>
              <p className="premium-type-helper mt-0.5">
                Track holdings, unrealized performance, price targets, and position actions.
              </p>
            </div>
            <PositionsTable
              positions={positions}
              onSellPosition={(pos) => setSellingPosition(pos)}
              onBuyMore={(pos) => {
                setSelectedTickerForTrade(tickers.find((t) => t.ticker === pos.ticker) || null);
                setIsAddTradeModalOpen(true);
              }}
              onEditPosition={(pos) => setEditingPosition(pos)}
              onCorrectLedger={openPositionLedgerCorrection}
              onOpenPriceAlerts={() => setIsPriceAlertsModalOpen(true)}
              onAddNewTrade={() => {
                setSelectedTickerForTrade(null);
                setIsAddTradeModalOpen(true);
              }}
            />
          </section>
        )}

        {activeTab === 'closed_cycles' && (
          <ClosedCyclesView
            closedTrades={closedTrades}
            transactions={transactions}
            onCorrectLedger={openClosedCycleLedgerCorrection}
          />
        )}

        {activeTab === 'reports' && (
          <PerformanceReports
            stats={stats}
            closedTrades={closedTrades}
            positions={positions}
            metrics={metrics}
            cashBalance={cashBalance}
            capitalDeposits={analyticsCapitalDeposits}
            transactions={transactions}
            historicalPrices={historicalPriceSeries}
            historicalLoading={historicalAnalyticsLoading}
            chartsReady={settledTab === activeTab}
          />
        )}

        {activeTab === 'journal' && (
          <TradingJournal
            transactions={transactions}
            closedTrades={closedTrades}
            positions={positions}
            onDeleteTransaction={handleDeleteTransaction}
            onEditTransaction={handleEditTransaction}
            ledgerFocus={ledgerCorrectionFocus}
            onClearLedgerFocus={() => setLedgerCorrectionFocus(null)}
            onOpenScreenshotModal={() => setIsScreenshotModalOpen(true)}
            onSyncToSheets={syncToSheets}
            isSyncingToSheets={isSyncingToSheets}
          />
        )}

        {activeTab === 'cash' && (
          <CashBalanceView
            cashBalance={cashBalance}
            totalPortfolioValue={metrics.totalValue}
            onUpdateCashBalance={async (newBal) => {
              const saved = await updateCashBalance(newBal);
              if (!saved) {
                showToast('Cash balance update was not saved. Nothing was changed.', 'error', 6000);
                return false;
              }
              showToast(`Cash balance updated to ${newBal.toLocaleString()} EGP and persisted.`, 'success');
              return true;
            }}
            positions={positions}
            closedTrades={closedTrades}
            tradeTransactions={transactions}
            capitalDeposits={capitalDeposits}
            onAddCashTransaction={addCashTransaction}
            onEditCashTransaction={editCashTransaction}
            onDeleteCashTransaction={deleteCashTransaction}
            onReconcileLedger={handleOverviewReconcile}
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
        </MotionSwap>
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
        onImportData={async (importedPositions, importedClosedTrades, config, importedTransactions) => {
          const result = await importBackup({
            positions: importedPositions,
            closedTrades: importedClosedTrades,
            transactions: importedTransactions || [],
            capitalDeposits,
            tickers,
          });
          if ('error' in result) {
            showToast(`Google Sheets import was not saved: ${result.error.message}`, 'error', 7000);
            return false;
          }
          updateSheetsConfig(config);
          showToast(`Imported and persisted ${result.snapshot.transactions.length} ledger records from Google Sheet "${config.sheetName || 'Transaction Logger'}"!`);
          return true;
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
        onReconcileFromLedger={handleOverviewReconcile}
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
        onUpdateCash={async (newCash) => {
          const saved = await updateCashBalance(newCash);
          if (!saved) {
            showToast('Cash balance adjustment was not saved. Nothing was changed.', 'error', 6000);
            return false;
          }
          showToast(`Cash balance adjusted to ${newCash.toLocaleString()} EGP and persisted.`, 'success');
          return true;
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
          const result = await importBackup(restored);
          if ('error' in result) {
            showToast(`Portfolio restore was not saved: ${result.error.message}`, 'error', 7000);
            return false;
          }
          showToast(`Portfolio ledger restored and persisted (${result.snapshot.transactions.length} transactions).`, 'success');
          return true;
        }}
        onReconcileLedger={handleOverviewReconcile}
      />

      {/* Offline PWA Indicator */}
      <OfflineIndicator />
    </div>
  );
}
