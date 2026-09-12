import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Position, 
  ClosedTrade, 
  EGXTicker, 
  PortfolioMetrics, 
  PerformanceStats, 
  GoogleSheetsConfig,
  Sector,
  TradeTransaction
} from './types';
import { INITIAL_EGX_TICKERS } from './data/egxTickers';
import { 
  INITIAL_POSITIONS, 
  INITIAL_CLOSED_TRADES, 
  INITIAL_CASH_BALANCE,
  INITIAL_TRANSACTIONS,
  INITIAL_CAPITAL_DEPOSITS
} from './data/initialPortfolio';
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
import { RealizedTrajectoryChart } from './components/RealizedTrajectoryChart';
import { OfflineIndicator } from './components/OfflineIndicator';
import { initAuth, logout, getAccessToken, isTokenExpired, clearExpiredToken } from './services/firebaseAuth';
import { appendTransactionToSheet, updateStockDirectoryInSheet, syncAllPortfolioToSheet } from './services/googleSheets';
import { 
  loadPortfolioFromFirestore, 
  savePortfolioToFirestore, 
  subscribeToPortfolioFromFirestore,
  appendTransactionToFirestore,
  updateFirestorePositions,
  updateFirestoreTickers,
  updateFirestoreCashBalance,
  updateFirestoreTransactions,
  getIsQuotaExceeded
} from './services/firestoreStorage';
import { reconcilePortfolioFromLedger } from './services/portfolioReconciliation';
import { validateTradeInput } from './utils/portfolioValidation';
import { User } from 'firebase/auth';
import { RotateCcw } from 'lucide-react';
import { 
  fetchTradingViewEGXPrices, 
  applyLivePricesToPortfolio, 
  getEGXSessionStatus,
  formatCairoTime,
  EGXScheduleStatus
} from './services/marketPriceSync';

const STORAGE_KEY_POSITIONS = 'egx_pwa_positions_v3_reconciled';
const STORAGE_KEY_CLOSED = 'egx_pwa_closed_trades_v3_reconciled';
const STORAGE_KEY_CASH = 'egx_pwa_cash_balance_v3_reconciled';
const STORAGE_KEY_TICKERS = 'egx_pwa_tickers_directory_v3_reconciled';
const STORAGE_KEY_SHEETS = 'egx_pwa_sheets_config_v1';
const STORAGE_KEY_TRANSACTIONS = 'egx_pwa_transactions_v3_reconciled';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('overview');

  // Core App State
  const [positions, setPositions] = useState<Position[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_POSITIONS);
      return saved ? JSON.parse(saved) : INITIAL_POSITIONS;
    } catch {
      return INITIAL_POSITIONS;
    }
  });

  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLOSED);
      return saved ? JSON.parse(saved) : INITIAL_CLOSED_TRADES;
    } catch {
      return INITIAL_CLOSED_TRADES;
    }
  });

  const [transactions, setTransactions] = useState<TradeTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
      return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  });

  const [cashBalance, setCashBalance] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CASH);
      return saved ? JSON.parse(saved) : INITIAL_CASH_BALANCE;
    } catch {
      return INITIAL_CASH_BALANCE;
    }
  });

  const [tickers, setTickers] = useState<EGXTicker[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TICKERS);
      return saved ? JSON.parse(saved) : INITIAL_EGX_TICKERS;
    } catch {
      return INITIAL_EGX_TICKERS;
    }
  });

  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SHEETS);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Auth state
  const [authUser, setAuthUser] = useState<User | null>(null);

  // Modals state
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isAddTradeModalOpen, setIsAddTradeModalOpen] = useState(false);
  const [isQuickCashModalOpen, setIsQuickCashModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isScreenshotModalOpen, setIsScreenshotModalOpen] = useState(false);
  const [sellingPosition, setSellingPosition] = useState<Position | null>(null);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [selectedTickerForTrade, setSelectedTickerForTrade] = useState<EGXTicker | null>(null);
  const [isSheetsTokenExpired, setIsSheetsTokenExpired] = useState<boolean>(() => isTokenExpired());

  // Periodically check if Google Sheets OAuth token is expired
  useEffect(() => {
    const checkExpiry = () => {
      setIsSheetsTokenExpired(isTokenExpired());
    };
    checkExpiry();
    const interval = setInterval(checkExpiry, 60000);
    window.addEventListener('focus', checkExpiry);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkExpiry);
    };
  }, []);

  // Helper to rehydrate positions with live or cached ticker quotes & targets
  const rehydratePositionsWithTickers = useCallback((posList: Position[], tickerList: EGXTicker[]): Position[] => {
    if (!tickerList || tickerList.length === 0 || !posList || posList.length === 0) return posList;
    const tickerMap = new Map(tickerList.map((t) => [t.ticker.toUpperCase(), t]));
    let hasChanges = false;

    const rehydrated = posList.map((p) => {
      const t = tickerMap.get(p.ticker.toUpperCase());
      if (!t || !t.lastPrice || t.lastPrice <= 0) return p;

      const currentPrice = t.lastPrice;
      const marketValue = p.shares * currentPrice;
      const unrealizedPnlEgp = marketValue - (p.shares * p.avgBuyPrice);
      const unrealizedPnlPercent = p.avgBuyPrice > 0 ? (unrealizedPnlEgp / (p.shares * p.avgBuyPrice)) * 100 : 0;
      const targetPrice = p.targetPrice ?? t.targetPrice;
      const stopLoss = p.stopLoss ?? t.stopLoss;

      if (
        Math.abs((p.currentPrice || 0) - currentPrice) > 0.0001 ||
        p.targetPrice !== targetPrice ||
        p.stopLoss !== stopLoss
      ) {
        hasChanges = true;
        return {
          ...p,
          currentPrice,
          targetPrice,
          stopLoss,
          companyName: p.companyName || t.nameEn || p.ticker,
          sector: p.sector || t.sector || 'Other',
        };
      }
      return p;
    });

    return hasChanges ? rehydrated : posList;
  }, []);

  // Auto-rehydrate positions whenever ticker directory is updated or loaded
  useEffect(() => {
    setPositions((prev) => rehydratePositionsWithTickers(prev, tickers));
  }, [tickers, rehydratePositionsWithTickers]);

  // Destructive Action Safety & Undo State
  const [confirmDeleteState, setConfirmDeleteState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    itemDetails?: any;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const [undoState, setUndoState] = useState<{
    previousState: {
      positions: Position[];
      closedTrades: ClosedTrade[];
      transactions: TradeTransaction[];
      cashBalance: number;
    };
    message: string;
  } | null>(null);

  // Live Price Injection State
  const [isSyncingPrices, setIsSyncingPrices] = useState(false);
  const [lastPriceSyncTime, setLastPriceSyncTime] = useState<string | null>(() => {
    try {
      return localStorage.getItem('egx_last_price_sync');
    } catch {
      return null;
    }
  });
  const [priceSyncNotification, setPriceSyncNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSyncingLedgerToSheets, setIsSyncingLedgerToSheets] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState<EGXScheduleStatus>(() => getEGXSessionStatus());

  // Handler to fetch and inject live prices into portfolio and directory
  const handleSyncLivePrices = async (isAutomatic = false) => {
    setIsSyncingPrices(true);
    try {
      const { quotes, discoveredTickers } = await fetchTradingViewEGXPrices();
      const updatedTimeStr = formatCairoTime(new Date());

      // Update positions with live prices
      let nextPositions: Position[] = positions;
      setPositions((prevPositions) => {
        const { updatedPositions } = applyLivePricesToPortfolio(prevPositions, tickers, quotes, discoveredTickers);
        nextPositions = updatedPositions;
        return updatedPositions;
      });

      // Update ticker directory with latest prices, changes, and volumes
      let nextTickers: EGXTicker[] = tickers;
      setTickers((prevTickers) => {
        const { updatedTickers } = applyLivePricesToPortfolio([], prevTickers, quotes, discoveredTickers);
        nextTickers = updatedTickers;
        
        // Auto-update connected Google Sheet ticker directory tab if connected & autoSync !== false
        if (sheetsConfig?.spreadsheetId && sheetsConfig.autoSync !== false) {
          getAccessToken().then((token) => {
            if (token) {
              updateStockDirectoryInSheet(
                sheetsConfig.spreadsheetId,
                updatedTickers,
                token,
                'ticker directory'
              ).catch((err) => console.warn('Background sheets price sync:', err));
            }
          });
        }

        return updatedTickers;
      });

      // Incremental Firestore write: only update positions and tickers
      updateFirestorePositions(nextPositions);
      updateFirestoreTickers(nextTickers);

      setLastPriceSyncTime(updatedTimeStr);
      try {
        localStorage.setItem('egx_last_price_sync', updatedTimeStr);
        localStorage.setItem('egx_last_price_sync_timestamp', String(Date.now()));
      } catch {}

      const symbolCount = Object.keys(quotes).length;
      setPriceSyncNotification({
        message: `Updated ${symbolCount} EGX prices from TradingView scanner (${isAutomatic ? 'Auto-sync' : 'Manual'})`,
        type: 'success'
      });
      setTimeout(() => setPriceSyncNotification(null), 5000);
    } catch (err: any) {
      console.error('Failed to sync live prices:', err);
      setPriceSyncNotification({
        message: `Price sync error: ${err.message || 'Unable to reach TradingView Egypt Scanner'}`,
        type: 'error'
      });
      setTimeout(() => setPriceSyncNotification(null), 6000);
    } finally {
      setIsSyncingPrices(false);
    }
  };

  // Schedule automatic sync during EGX session:
  // Runs Sun-Thu between 09:47 and 16:30 Cairo time
  // Every 15 minutes delayed by 2 minutes (:02, :17, :32, :47)
  useEffect(() => {
    let tickTimer: NodeJS.Timeout | null = null;
    let clockTimer: NodeJS.Timeout | null = null;

    const planNextSync = () => {
      const status = getEGXSessionStatus();
      setScheduleStatus(status);

      if (tickTimer) clearTimeout(tickTimer);

      tickTimer = setTimeout(() => {
        const currentStatus = getEGXSessionStatus();
        if (currentStatus.isSessionActive) {
          handleSyncLivePrices(true);
        }
        planNextSync();
      }, Math.max(3000, status.millisUntilNextTick));
    };

    planNextSync();

    // Clock update interval for live status badge
    clockTimer = setInterval(() => {
      setScheduleStatus(getEGXSessionStatus());
    }, 15000);

    return () => {
      if (tickTimer) clearTimeout(tickTimer);
      if (clockTimer) clearInterval(clockTimer);
    };
  }, [positions, tickers]);

  // Automatic live/closing price pull on startup / page reload:
  // Always fetches the latest available prices from TradingView on boot (even outside trading hours / weekends)
  // so open positions and market values reflect the most recent closing or live prices without requiring manual sync.
  useEffect(() => {
    const lastSyncTime = localStorage.getItem('egx_last_price_sync_timestamp');
    const now = Date.now();
    // Throttle to once every 20 seconds on rapid hot reloads, otherwise always fetch latest prices on boot
    if (lastSyncTime && now - Number(lastSyncTime) < 20000) {
      return;
    }

    const timer = setTimeout(() => {
      handleSyncLivePrices(true);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // Flag ref to prevent remote Firestore updates from triggering a write-back loop
  const isRemoteSyncingRef = useRef(false);

  // Firestore Database Cloud Persistence Sync
  useEffect(() => {
    // Initial fetch from Firestore
    loadPortfolioFromFirestore().then((remoteDoc) => {
      if (remoteDoc) {
        isRemoteSyncingRef.current = true;
        if (remoteDoc.positions) setPositions(remoteDoc.positions);
        if (remoteDoc.closedTrades) setClosedTrades(remoteDoc.closedTrades);
        if (remoteDoc.transactions) setTransactions(remoteDoc.transactions);
        if (typeof remoteDoc.cashBalance === 'number') setCashBalance(remoteDoc.cashBalance);
        if (remoteDoc.tickers) setTickers(remoteDoc.tickers);
        setTimeout(() => { 
          isRemoteSyncingRef.current = false;
          // Refresh prices against TradingView scanner to guarantee latest valuations
          handleSyncLivePrices(true);
        }, 800);
      } else {
        // Save initial state if no remote doc exists yet
        savePortfolioToFirestore({
          positions,
          closedTrades,
          transactions,
          cashBalance,
          tickers,
        });
      }
    });

    // Real-time listener for multi-device sync
    const unsubscribe = subscribeToPortfolioFromFirestore((remoteDoc) => {
      if (remoteDoc) {
        isRemoteSyncingRef.current = true;
        if (remoteDoc.positions) setPositions(remoteDoc.positions);
        if (remoteDoc.closedTrades) setClosedTrades(remoteDoc.closedTrades);
        if (remoteDoc.transactions) setTransactions(remoteDoc.transactions);
        if (typeof remoteDoc.cashBalance === 'number') setCashBalance(remoteDoc.cashBalance);
        if (remoteDoc.tickers) setTickers(remoteDoc.tickers);
        setTimeout(() => { isRemoteSyncingRef.current = false; }, 800);
      }
    });

    return () => unsubscribe();
  }, []);

  // Persist state changes locally to browser storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_POSITIONS, JSON.stringify(positions));
    localStorage.setItem(STORAGE_KEY_CLOSED, JSON.stringify(closedTrades));
    localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(transactions));
    localStorage.setItem(STORAGE_KEY_CASH, JSON.stringify(cashBalance));
    localStorage.setItem(STORAGE_KEY_TICKERS, JSON.stringify(tickers));
  }, [positions, closedTrades, transactions, cashBalance, tickers]);

  useEffect(() => {
    if (sheetsConfig) {
      localStorage.setItem(STORAGE_KEY_SHEETS, JSON.stringify(sheetsConfig));
    }
  }, [sheetsConfig]);

  // Auto-restore / reconstruct open positions & closed trades from transaction ledger if missing or lost
  useEffect(() => {
    if (transactions && transactions.length > 0) {
      const hasSellTxs = transactions.some((t) => t.type === 'SELL');
      const needsPositionRestore = !positions || positions.length === 0;
      const needsClosedTradesRestore = hasSellTxs && (!closedTrades || closedTrades.length === 0);

      if (needsPositionRestore || needsClosedTradesRestore) {
        const reconciliation = reconcilePortfolioFromLedger(transactions, tickers, INITIAL_CAPITAL_DEPOSITS, positions);
        if (needsPositionRestore && reconciliation.reconciledPositions.length > 0) {
          setPositions(reconciliation.reconciledPositions);
        }
        if (needsClosedTradesRestore && reconciliation.reconciledClosedTrades.length > 0) {
          setClosedTrades(reconciliation.reconciledClosedTrades);
        }
      }
    }
  }, [transactions, tickers]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => setAuthUser(user),
      () => setAuthUser(null)
    );
    return () => unsubscribe();
  }, []);

  // Update current market prices of positions whenever ticker directory updates
  useEffect(() => {
    setPositions((prevPositions) => {
      let changed = false;
      const updated = prevPositions.map((pos) => {
        const cleanTicker = pos.ticker.trim().toUpperCase();
        const liveTicker = tickers.find((t) => t.ticker.trim().toUpperCase() === cleanTicker);
        if (liveTicker && liveTicker.lastPrice > 0 && liveTicker.lastPrice !== pos.currentPrice) {
          changed = true;
          return {
            ...pos,
            currentPrice: liveTicker.lastPrice,
          };
        }
        return pos;
      });
      return changed ? updated : prevPositions;
    });
  }, [tickers]);

  // Derived Performance Indicators & Portfolio Metrics
  const metrics: PortfolioMetrics = useMemo(() => {
    let investedCapital = 0;
    let currentPositionsValue = 0;
    let dayChangeEgp = 0;

    positions.forEach((pos) => {
      const posCost = pos.shares * pos.avgBuyPrice;
      const posVal = pos.shares * pos.currentPrice;
      investedCapital += posCost;
      currentPositionsValue += posVal;

      const tickerInfo = tickers.find((t) => t.ticker === pos.ticker);
      if (tickerInfo && tickerInfo.change) {
        dayChangeEgp += pos.shares * tickerInfo.change;
      }
    });

    const unrealizedPnlEgp = currentPositionsValue - investedCapital;
    const unrealizedPnlPercent = investedCapital > 0 ? (unrealizedPnlEgp / investedCapital) * 100 : 0;
    const totalRealized = closedTrades.reduce((acc, t) => acc + t.realizedPnlEgp, 0);
    const totalValue = currentPositionsValue + cashBalance;
    const previousDayValue = totalValue - dayChangeEgp;
    const dayChangePercent = previousDayValue > 0 ? (dayChangeEgp / previousDayValue) * 100 : 0;

    const totalOpenFees = positions.reduce((acc, p) => acc + (p.totalFees || 0), 0);
    const totalClosedFees = closedTrades.reduce((acc, t) => acc + (t.totalFees || 0), 0);

    return {
      totalValue,
      totalCost: investedCapital,
      unrealizedPnlEgp,
      unrealizedPnlPercent,
      realizedPnlEgp: totalRealized,
      cashBalance,
      dayChangeEgp,
      dayChangePercent,
      totalPositions: positions.length,
      winningPositionsCount: positions.filter((p) => p.currentPrice >= p.avgBuyPrice).length,
      losingPositionsCount: positions.filter((p) => p.currentPrice < p.avgBuyPrice).length,
      totalFeesPaid: totalOpenFees + totalClosedFees,
    };
  }, [positions, closedTrades, cashBalance, tickers]);

  const stats: PerformanceStats = useMemo(() => {
    const totalTrades = closedTrades.length;
    const winningTradesList = closedTrades.filter((t) => t.outcome === 'WIN');
    const losingTradesList = closedTrades.filter((t) => t.outcome === 'LOSS');

    const winningTrades = winningTradesList.length;
    const losingTrades = losingTradesList.length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const totalRealizedGainEgp = winningTradesList.reduce((acc, t) => acc + t.realizedPnlEgp, 0);
    const totalRealizedLossEgp = Math.abs(losingTradesList.reduce((acc, t) => acc + t.realizedPnlEgp, 0));
    const profitFactor = totalRealizedLossEgp > 0 ? totalRealizedGainEgp / totalRealizedLossEgp : totalRealizedGainEgp > 0 ? 9.99 : 1.0;

    const avgReturnPercent =
      totalTrades > 0
        ? closedTrades.reduce((acc, t) => acc + t.realizedPnlPercent, 0) / totalTrades
        : 0;

    const bestTradePercent =
      totalTrades > 0
        ? Math.max(...closedTrades.map((t) => t.realizedPnlPercent))
        : 0;

    const worstTradePercent =
      totalTrades > 0
        ? Math.min(...closedTrades.map((t) => t.realizedPnlPercent))
        : 0;

    const avgHoldDays =
      totalTrades > 0
        ? Math.round(closedTrades.reduce((acc, t) => acc + t.holdingDays, 0) / totalTrades)
        : 0;

    const totalBrokerageFeesPaid = closedTrades.reduce((acc, t) => acc + (t.totalFees || 0), 0);

    const avgWinEgp = winningTrades > 0 ? totalRealizedGainEgp / winningTrades : 0;
    const avgLossEgp = losingTrades > 0 ? totalRealizedLossEgp / losingTrades : 0;
    const payoffRatio = avgLossEgp > 0 ? avgWinEgp / avgLossEgp : avgWinEgp > 0 ? 99.99 : 0;
    const expectancyEgp = totalTrades > 0 ? (totalRealizedGainEgp - totalRealizedLossEgp) / totalTrades : 0;

    // Accurate Max Drawdown calculation from chronological closed trades
    const sortedTradesChronological = [...closedTrades].sort((a, b) => {
      const dateA = a.sellDate || a.buyDate || '2026-01-01';
      const dateB = b.sellDate || b.buyDate || '2026-01-01';
      return dateA.localeCompare(dateB);
    });

    let runningEquity = 0;
    let peakEquity = 0;
    let maxDrawdownEgp = 0;

    sortedTradesChronological.forEach((t) => {
      runningEquity += t.realizedPnlEgp;
      if (runningEquity > peakEquity) {
        peakEquity = runningEquity;
      }
      const dd = peakEquity - runningEquity;
      if (dd > maxDrawdownEgp) {
        maxDrawdownEgp = dd;
      }
    });

    const openCost = positions.reduce((acc, p) => acc + p.shares * p.avgBuyPrice, 0);
    const baselineCapital = Math.max(1000, cashBalance + openCost);
    const maxDrawdownPercent = (maxDrawdownEgp / (baselineCapital + Math.max(0, peakEquity))) * 100;

    // Sector allocation based on open positions
    const sectorTotals: Record<Sector, number> = {} as any;
    let totalEquitiesVal = 0;
    positions.forEach((pos) => {
      const val = pos.shares * pos.currentPrice;
      totalEquitiesVal += val;
      sectorTotals[pos.sector] = (sectorTotals[pos.sector] || 0) + val;
    });

    const sectorAllocation = Object.entries(sectorTotals).map(([sec, val]) => ({
      sector: sec as Sector,
      value: val,
      percentage: totalEquitiesVal > 0 ? (val / totalEquitiesVal) * 100 : 0,
      count: positions.filter((p) => p.sector === sec).length,
    })).sort((a, b) => b.value - a.value);

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      profitFactor,
      totalRealizedGainEgp,
      totalRealizedLossEgp,
      avgReturnPercent,
      bestTradePercent,
      worstTradePercent,
      avgHoldDays,
      totalBrokerageFeesPaid,
      sectorAllocation,
      maxDrawdownPercent,
      maxDrawdownEgp,
      payoffRatio,
      expectancyEgp,
    };
  }, [closedTrades, positions]);

  // Handlers with strict Validation & Ledger Reconciliation
  const executeUndo = () => {
    if (!undoState) return;
    const { previousState, message } = undoState;
    setPositions(previousState.positions);
    setClosedTrades(previousState.closedTrades);
    setTransactions(previousState.transactions);
    setCashBalance(previousState.cashBalance);
    setUndoState(null);
    setPriceSyncNotification({
      message: `Restored state: ${message}`,
      type: 'success',
    });
    setTimeout(() => setPriceSyncNotification(null), 4000);
  };

  const handleReconcileLedger = () => {
    const report = reconcilePortfolioFromLedger(transactions, tickers, cashBalance, positions);
    setPositions(report.reconciledPositions);
    setClosedTrades(report.reconciledClosedTrades);
    setCashBalance(report.reconciledCashBalance);

    setPriceSyncNotification({
      message: `Reconciliation complete! Processed ${report.transactionsProcessed} transactions. ${
        report.discrepanciesFound.length > 0
          ? `${report.discrepanciesFound.length} discrepancies resolved.`
          : 'Portfolio is fully synchronized and consistent.'
      }`,
      type: 'success',
    });
    setTimeout(() => setPriceSyncNotification(null), 5000);
  };

  const handleAddPosition = (
    newTradeData: {
      ticker: string;
      companyName: string;
      sector: Sector;
      shares: number;
      buyPrice: number;
      buyDate: string;
      brokerageFee: number;
      targetPrice?: number;
      stopLoss?: number;
      notes?: string;
    },
    deductCash: boolean
  ) => {
    // Validate trade input rules
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
      setPriceSyncNotification({
        message: `Trade Validation Error: ${valResult.errors.join(', ')}`,
        type: 'error',
      });
      setTimeout(() => setPriceSyncNotification(null), 5000);
      return;
    }

    const existingIndex = positions.findIndex(
      (p) => p.ticker.toUpperCase() === newTradeData.ticker.toUpperCase()
    );

    const quoteMatch = tickers.find((t) => t.ticker.toUpperCase() === newTradeData.ticker.toUpperCase());
    const currentPrice = quoteMatch?.lastPrice || newTradeData.buyPrice;

    if (existingIndex >= 0) {
      // Stock already owned: merge into existing active position (DCA)
      const existing = positions[existingIndex];
      const combinedShares = existing.shares + newTradeData.shares;
      const existingCost = existing.shares * existing.avgBuyPrice;
      const newCost = newTradeData.shares * newTradeData.buyPrice;
      const combinedAvgBuy = combinedShares > 0 ? (existingCost + newCost) / combinedShares : newTradeData.buyPrice;
      const combinedFees = (existing.totalFees || 0) + (newTradeData.brokerageFee || 0);

      const updatedPosition: Position = {
        ...existing,
        shares: combinedShares,
        avgBuyPrice: Number(combinedAvgBuy.toFixed(4)),
        currentPrice,
        totalFees: combinedFees,
        targetPrice: newTradeData.targetPrice || existing.targetPrice,
        stopLoss: newTradeData.stopLoss || existing.stopLoss,
        notes: newTradeData.notes
          ? `${existing.notes ? `${existing.notes} | ` : ''}DCA: ${newTradeData.shares} shares @ ${newTradeData.buyPrice} (${newTradeData.notes})`
          : existing.notes,
      };

      const nextPositions = positions.map((p, idx) => (idx === existingIndex ? updatedPosition : p));
      setPositions(nextPositions);
      var currentPosList = nextPositions;
    } else {
      // New stock position
      const newPos: Position = {
        id: `pos-${Date.now()}-${newTradeData.ticker}`,
        ticker: newTradeData.ticker,
        companyName: newTradeData.companyName,
        sector: newTradeData.sector,
        shares: newTradeData.shares,
        avgBuyPrice: newTradeData.buyPrice,
        currentPrice,
        buyDate: newTradeData.buyDate,
        totalFees: newTradeData.brokerageFee,
        targetPrice: newTradeData.targetPrice,
        stopLoss: newTradeData.stopLoss,
        notes: newTradeData.notes,
      };

      const nextPositions = [newPos, ...positions];
      setPositions(nextPositions);
      var currentPosList = nextPositions;
    }

    const nextTradeId = (() => {
      let maxId = 0;
      transactions.forEach((t) => {
        const raw = t.tradeId !== undefined ? t.tradeId : t.trade_id;
        if (typeof raw === 'number' && raw > maxId) maxId = raw;
        else if (typeof raw === 'string') {
          const parsed = parseInt(raw, 10);
          if (!isNaN(parsed) && parsed > maxId) maxId = parsed;
        }
      });
      return maxId > 0 ? maxId + 1 : transactions.length + 1;
    })();

    // Always log as a separate chronological transaction in the trade ledger
    const newTx: TradeTransaction = {
      id: `tx-buy-${Date.now()}-${newTradeData.ticker}`,
      tradeId: nextTradeId,
      type: 'BUY',
      isDCA: existingIndex >= 0,
      ticker: newTradeData.ticker,
      companyName: newTradeData.companyName,
      sector: newTradeData.sector,
      shares: newTradeData.shares,
      price: newTradeData.buyPrice,
      date: newTradeData.buyDate,
      fees: newTradeData.brokerageFee || 0,
      totalAmount: (newTradeData.shares * newTradeData.buyPrice) + (newTradeData.brokerageFee || 0),
      notes: newTradeData.notes,
      targetPrice: newTradeData.targetPrice,
      stopLoss: newTradeData.stopLoss,
      positionId: existingIndex >= 0 ? positions[existingIndex].id : undefined,
    };
    setTransactions((prev) => [newTx, ...prev]);

    // Auto-sync transaction to Google Sheet Transaction Logger tab if configured
    if (sheetsConfig?.spreadsheetId) {
      syncTransactionToSheet(newTx);
    }

    let updatedCash = cashBalance;
    if (deductCash) {
      const totalOutlay = (newTradeData.shares * newTradeData.buyPrice) + (newTradeData.brokerageFee || 0);
      updatedCash = Math.max(0, cashBalance - totalOutlay);
      setCashBalance(updatedCash);
    }

    // Incremental Firestore write: append new tx and update positions/cash
    appendTransactionToFirestore(newTx, currentPosList, undefined, updatedCash);
  };

  const handleConfirmSell = (
    positionId: string,
    soldShares: number,
    sellPrice: number,
    sellDate: string,
    sellFees: number,
    notes: string,
    remainingShares: number
  ) => {
    const pos = positions.find((p) => p.id === positionId);
    if (!pos) return;

    // Validate SELL trade rules
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
      setPriceSyncNotification({
        message: `Sell Validation Error: ${valResult.errors.join(', ')}`,
        type: 'error',
      });
      setTimeout(() => setPriceSyncNotification(null), 5000);
      return;
    }

    // Prorated portion of buy fees attributed to sold shares
    const allocatedBuyFee = pos.totalFees ? (soldShares / pos.shares) * pos.totalFees : 0;
    const remainingBuyFee = pos.totalFees ? Math.max(0, pos.totalFees - allocatedBuyFee) : 0;
    const totalFeesForTrade = allocatedBuyFee + (sellFees || 0);

    const costBasis = soldShares * pos.avgBuyPrice;
    const grossProceeds = soldShares * sellPrice;
    const netProceeds = Math.max(0, grossProceeds - (sellFees || 0));

    // Net realized P&L after buy fee and sell fee
    const realizedPnlEgp = netProceeds - (costBasis + allocatedBuyFee);
    const costWithFees = costBasis + allocatedBuyFee;
    const realizedPnlPercent = costWithFees > 0 ? (realizedPnlEgp / costWithFees) * 100 : 0;
    const outcome = realizedPnlEgp > 0 ? 'WIN' : realizedPnlEgp < 0 ? 'LOSS' : 'BREAKEVEN';

    // Calculate holding days
    const entryTime = new Date(pos.buyDate).getTime();
    const exitTime = new Date(sellDate).getTime();
    const holdingDays = Math.max(1, Math.round((exitTime - entryTime) / (1000 * 60 * 60 * 24)) || 15);

    const newClosedTrade: ClosedTrade = {
      id: `ct-${Date.now()}-${pos.ticker}`,
      ticker: pos.ticker,
      companyName: pos.companyName,
      sector: pos.sector,
      shares: soldShares,
      buyPrice: pos.avgBuyPrice,
      sellPrice,
      buyDate: pos.buyDate,
      sellDate,
      holdingDays,
      buyFees: allocatedBuyFee,
      sellFees: sellFees,
      totalFees: totalFeesForTrade,
      realizedPnlEgp,
      realizedPnlPercent,
      outcome,
      tradeType: 'Swing',
      notes,
    };

    const nextClosed = [newClosedTrade, ...closedTrades];
    setClosedTrades(nextClosed);

    const nextTradeId = (() => {
      let maxId = 0;
      transactions.forEach((t) => {
        const raw = t.tradeId !== undefined ? t.tradeId : t.trade_id;
        if (typeof raw === 'number' && raw > maxId) maxId = raw;
        else if (typeof raw === 'string') {
          const parsed = parseInt(raw, 10);
          if (!isNaN(parsed) && parsed > maxId) maxId = parsed;
        }
      });
      return maxId > 0 ? maxId + 1 : transactions.length + 1;
    })();

    // Also log SELL transaction in chronological ledger
    const newSellTx: TradeTransaction = {
      id: `tx-sell-${Date.now()}-${pos.ticker}`,
      tradeId: nextTradeId,
      type: 'SELL',
      ticker: pos.ticker,
      companyName: pos.companyName,
      sector: pos.sector,
      shares: soldShares,
      price: sellPrice,
      date: sellDate,
      fees: sellFees || 0,
      totalAmount: netProceeds,
      realizedPnlEgp,
      realizedPnlPercent,
      outcome,
      holdingDays,
      notes,
      positionId,
    };
    setTransactions((prev) => [newSellTx, ...prev]);

    // Auto-sync SELL transaction to Google Sheet Transaction Logger tab if configured
    if (sheetsConfig?.spreadsheetId) {
      syncTransactionToSheet(newSellTx);
    }

    // Add net proceeds from sale to cash balance
    const updatedCash = cashBalance + netProceeds;
    setCashBalance(updatedCash);

    let updatedPositions: Position[] = [];
    if (remainingShares > 0) {
      updatedPositions = positions.map((p) =>
        p.id === positionId
          ? { ...p, shares: remainingShares, totalFees: remainingBuyFee }
          : p
      );
    } else {
      updatedPositions = positions.filter((p) => p.id !== positionId);
    }
    setPositions(updatedPositions);

    // Incremental Firestore write
    appendTransactionToFirestore(newSellTx, updatedPositions, nextClosed, updatedCash);
  };

  const handleDeletePosition = (id: string) => {
    const pos = positions.find((p) => p.id === id);
    if (!pos) return;

    setConfirmDeleteState({
      isOpen: true,
      title: `Delete Open Position (${pos.ticker})`,
      description: `Are you sure you want to delete this position of ${pos.shares.toLocaleString()} shares of ${pos.ticker}? This will remove the position record from your active holdings.`,
      itemDetails: {
        ticker: pos.ticker,
        type: 'Active Position',
        shares: pos.shares,
        amount: `${(pos.shares * pos.avgBuyPrice).toLocaleString()} EGP Cost Basis`,
        date: pos.buyDate,
      },
      onConfirm: () => {
        setUndoState({
          previousState: { positions, closedTrades, transactions, cashBalance },
          message: `Reverted deletion of ${pos.ticker} position`,
        });
        const updatedPositions = positions.filter((p) => p.id !== id);
        // Remove open buys for this ticker that are not part of closed cycles
        const updatedTxs = transactions.filter(
          (t) => !(t.type === 'BUY' && t.ticker.toUpperCase() === pos.ticker.toUpperCase() && !t.tradeCycle)
        );
        setPositions(updatedPositions);
        setTransactions(updatedTxs);
        updateFirestorePositions(updatedPositions);
        updateFirestoreTransactions(updatedTxs, updatedPositions, closedTrades, cashBalance);
      },
    });
  };

  const handleSavePositionEdit = (updated: {
    id: string;
    targetPrice?: number;
    stopLoss?: number;
    notes?: string;
  }) => {
    const updatedPositions = positions.map((p) => {
      if (p.id !== updated.id) return p;
      return {
        ...p,
        targetPrice: updated.targetPrice,
        stopLoss: updated.stopLoss,
        notes: updated.notes,
      };
    });
    setPositions(updatedPositions);
    updateFirestorePositions(updatedPositions);

    // Also update targetPrice and stopLoss in tickers directory if set
    const pos = positions.find((p) => p.id === updated.id);
    if (pos) {
      setTickers((prevTickers) =>
        prevTickers.map((t) => {
          if (t.ticker.toUpperCase() !== pos.ticker.toUpperCase()) return t;
          return {
            ...t,
            targetPrice: updated.targetPrice !== undefined ? updated.targetPrice : t.targetPrice,
            stopLoss: updated.stopLoss !== undefined ? updated.stopLoss : t.stopLoss,
          };
        })
      );
    }

    setPriceSyncNotification({
      message: `Updated targets & notes for ${pos?.ticker || 'position'}!`,
      type: 'success',
    });
    setTimeout(() => setPriceSyncNotification(null), 4000);
  };

  const handleDeleteTrade = (id: string) => {
    const trade = closedTrades.find((t) => t.id === id);

    setConfirmDeleteState({
      isOpen: true,
      title: `Delete Closed Trade Cycle`,
      description: `Are you sure you want to delete this closed trade cycle? This will remove the historical realized P&L record.`,
      itemDetails: {
        ticker: trade?.ticker,
        type: 'Closed Cycle',
        shares: trade?.shares,
        amount: trade ? `${trade.realizedPnlEgp > 0 ? '+' : ''}${trade.realizedPnlEgp.toFixed(2)} EGP Realized P&L` : undefined,
        date: trade?.sellDate,
      },
      onConfirm: () => {
        setUndoState({
          previousState: { positions, closedTrades, transactions, cashBalance },
          message: `Reverted deletion of closed trade`,
        });
        const updatedClosed = closedTrades.filter((t) => t.id !== id);
        const updatedTxs = transactions.filter((t) => t.id !== id);
        setClosedTrades(updatedClosed);
        setTransactions(updatedTxs);
        updateFirestoreTransactions(updatedTxs, positions, updatedClosed, cashBalance);
      },
    });
  };

  const handleDeleteTransaction = (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return;

    setConfirmDeleteState({
      isOpen: true,
      title: `Delete Transaction (${tx.type} ${tx.ticker})`,
      description: `Deleting this ${tx.type} transaction will remove the record from your chronological ledger and automatically recalculate your portfolio positions and cash balance.`,
      itemDetails: {
        ticker: tx.ticker,
        type: `${tx.type} Execution`,
        shares: tx.shares,
        amount: `${tx.totalAmount.toLocaleString()} EGP`,
        date: tx.date,
      },
      onConfirm: () => {
        setUndoState({
          previousState: { positions, closedTrades, transactions, cashBalance },
          message: `Reverted deletion of ${tx.type} ${tx.ticker} transaction`,
        });

        const updatedTxs = transactions.filter((t) => t.id !== id);
        setTransactions(updatedTxs);

        // Auto-reconcile portfolio from updated ledger
        const report = reconcilePortfolioFromLedger(updatedTxs, tickers, cashBalance, positions);
        setPositions(report.reconciledPositions);
        setClosedTrades(report.reconciledClosedTrades);
        setCashBalance(report.reconciledCashBalance);

        updateFirestoreTransactions(updatedTxs, report.reconciledPositions, report.reconciledClosedTrades, report.reconciledCashBalance);
      },
    });
  };

  const handleEditTransaction = (updatedTx: TradeTransaction) => {
    // Validate edit
    const valResult = validateTradeInput({
      ticker: updatedTx.ticker,
      shares: updatedTx.shares,
      price: updatedTx.price,
      fees: updatedTx.fees || 0,
      type: updatedTx.type,
      date: updatedTx.date,
    });

    if (!valResult.valid) {
      setPriceSyncNotification({
        message: `Edit Transaction Error: ${valResult.errors.join(', ')}`,
        type: 'error',
      });
      setTimeout(() => setPriceSyncNotification(null), 5000);
      return;
    }

    const updatedTxs = transactions.map((t) => (t.id === updatedTx.id ? updatedTx : t));
    setTransactions(updatedTxs);

    // Reconcile portfolio math automatically when any ledger transaction is edited
    const report = reconcilePortfolioFromLedger(updatedTxs, tickers, cashBalance, positions);
    setPositions(report.reconciledPositions);
    setClosedTrades(report.reconciledClosedTrades);
    setCashBalance(report.reconciledCashBalance);

    updateFirestoreTransactions(updatedTxs, report.reconciledPositions, report.reconciledClosedTrades, report.reconciledCashBalance);

    // Auto-sync EDITED transaction to Google Sheet in-place if connected
    if (sheetsConfig?.spreadsheetId) {
      syncTransactionToSheet(updatedTx);
    }
  };

  const handleSaveSheetsConfig = (config: GoogleSheetsConfig) => {
    setSheetsConfig(config);
    setPriceSyncNotification({
      message: `Google Sheets connection saved (${config.autoSync !== false ? 'Auto Sync ON' : 'Auto Sync OFF'})! Portfolio data preserved.`,
      type: 'success'
    });
    setTimeout(() => setPriceSyncNotification(null), 5000);
  };

  const handleImportGoogleSheets = (
    importedPositions: Position[],
    importedClosedTrades: ClosedTrade[],
    config: GoogleSheetsConfig,
    importedTransactions?: TradeTransaction[]
  ) => {
    // Only update app data if valid non-empty arrays are explicitly supplied
    let importedCount = 0;
    let nextPos = (importedPositions && importedPositions.length > 0) ? importedPositions : positions;
    const nextClosed = (importedClosedTrades && importedClosedTrades.length > 0) ? importedClosedTrades : closedTrades;

    // Rehydrate imported positions with latest cached prices
    nextPos = rehydratePositionsWithTickers(nextPos, tickers);

    if (importedPositions && importedPositions.length > 0) {
      setPositions(nextPos);
      updateFirestorePositions(nextPos);
      importedCount += importedPositions.length;
    }

    if (importedClosedTrades && importedClosedTrades.length > 0) {
      setClosedTrades(nextClosed);
      importedCount += importedClosedTrades.length;
    }

    if (importedTransactions && importedTransactions.length > 0) {
      setTransactions(importedTransactions);
      importedCount = importedTransactions.length;
      updateFirestoreTransactions(importedTransactions, nextPos, nextClosed, cashBalance);
    }

    setSheetsConfig(config);
    setIsSheetsTokenExpired(false);
    setPriceSyncNotification({
      message: `Successfully imported ${importedCount} records from Google Sheet "${config.sheetName || 'Transaction Logger'}"!`,
      type: 'success'
    });
    setTimeout(() => setPriceSyncNotification(null), 5000);
  };

  const handleReconcileFromLedger = () => {
    if (!transactions || transactions.length === 0) return;
    const report = reconcilePortfolioFromLedger(transactions, tickers, INITIAL_CAPITAL_DEPOSITS, positions);
    setPositions(report.reconciledPositions);
    setClosedTrades(report.reconciledClosedTrades);
    setCashBalance(report.reconciledCashBalance);
    setPriceSyncNotification({
      message: `Rebuilt portfolio state from ${transactions.length} transactions in the ledger! Audited cash: ${report.reconciledCashBalance.toFixed(2)} EGP.`,
      type: 'success'
    });
    setTimeout(() => setPriceSyncNotification(null), 5000);
  };

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
    const res = await updateStockDirectoryInSheet(
      sheetsConfig.spreadsheetId,
      tickers,
      token,
      'ticker directory'
    );
    if (!res.success) {
      throw new Error(res.message);
    }
  };

  const handleUpdateTickersFromPython = (newTickers: EGXTicker[]) => {
    setTickers(newTickers);
  };

  const syncTransactionToSheet = async (tx: TradeTransaction): Promise<boolean> => {
    if (!sheetsConfig?.spreadsheetId) return false;
    try {
      const token = await getAccessToken();
      if (!token) {
        setPriceSyncNotification({
          message: `Trade saved in app, but Google Sheet sync failed: Please open Google Sheets in header to sign in.`,
          type: 'error',
        });
        setTimeout(() => setPriceSyncNotification(null), 7000);
        return false;
      }
      const targetTab = sheetsConfig.sheetName || 'Transaction Logger';
      const res = await appendTransactionToSheet(
        sheetsConfig.spreadsheetId,
        tx,
        token,
        targetTab
      );
      if (res && res.success) {
        if (res.finalTradeId) {
          const numId = Number(res.finalTradeId);
          const assigned = !isNaN(numId) ? numId : res.finalTradeId;
          setTransactions((prev) =>
            prev.map((t) => (t.id === tx.id ? { ...t, tradeId: assigned } : t))
          );
        }
        setPriceSyncNotification({
          message: `Logged ${tx.type} ${tx.ticker} in app & synced to Google Sheet "${targetTab}"${res.finalTradeId ? ` (ID #${res.finalTradeId})` : ''}!`,
          type: 'success',
        });
        setTimeout(() => setPriceSyncNotification(null), 5000);
        return true;
      } else {
        setPriceSyncNotification({
          message: `Trade saved in app, but Google Sheet sync issue: ${res?.message || 'Check permissions'}`,
          type: 'error',
        });
        setTimeout(() => setPriceSyncNotification(null), 7000);
        return false;
      }
    } catch (err: any) {
      console.warn('Google Sheets tx append error:', err);
      setPriceSyncNotification({
        message: `Trade saved in app, but Google Sheet sync error: ${err.message || 'Network error'}`,
        type: 'error',
      });
      setTimeout(() => setPriceSyncNotification(null), 7000);
      return false;
    }
  };

  const syncBatchTransactionsToSheet = async (txs: TradeTransaction[]): Promise<boolean> => {
    if (!sheetsConfig?.spreadsheetId || txs.length === 0) return false;
    try {
      const token = await getAccessToken();
      if (!token) {
        setPriceSyncNotification({
          message: `${txs.length} trades saved in app, but Google Sheet sync failed: Please sign in via Google Sheets.`,
          type: 'error',
        });
        setTimeout(() => setPriceSyncNotification(null), 7000);
        return false;
      }
      const targetTab = sheetsConfig.sheetName || 'Transaction Logger';
      let successCount = 0;
      for (const tx of txs) {
        const res = await appendTransactionToSheet(
          sheetsConfig.spreadsheetId,
          tx,
          token,
          targetTab
        );
        if (res && res.success) {
          successCount++;
          if (res.finalTradeId) {
            const numId = Number(res.finalTradeId);
            const assigned = !isNaN(numId) ? numId : res.finalTradeId;
            setTransactions((prev) =>
              prev.map((t) => (t.id === tx.id ? { ...t, tradeId: assigned } : t))
            );
          }
        }
      }
      setPriceSyncNotification({
        message: `Successfully synced ${successCount} of ${txs.length} transactions to Google Sheet "${targetTab}"!`,
        type: 'success',
      });
      setTimeout(() => setPriceSyncNotification(null), 5000);
      return true;
    } catch (err: any) {
      console.warn('Batch sheets sync error:', err);
      return false;
    }
  };

  const handleSyncLedgerToSheet = async () => {
    if (!sheetsConfig?.spreadsheetId) {
      setIsSheetsModalOpen(true);
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      setIsSheetsModalOpen(true);
      return;
    }
    setIsSyncingLedgerToSheets(true);
    try {
      const res = await syncAllPortfolioToSheet(
        sheetsConfig.spreadsheetId,
        positions,
        closedTrades,
        transactions,
        tickers,
        token
      );
      if (res.success) {
        setIsSheetsTokenExpired(false);
        setPriceSyncNotification({
          message: `Successfully synchronized entire portfolio & ledger to Google Sheet!`,
          type: 'success',
        });
        setTimeout(() => setPriceSyncNotification(null), 5000);
      } else {
        throw new Error(res.message);
      }
    } catch (err: any) {
      if (err.message?.includes('401') || err.message?.includes('token') || isTokenExpired()) {
        clearExpiredToken();
        setIsSheetsTokenExpired(true);
      }
      setPriceSyncNotification({
        message: `Failed to sync transactions to Google Sheet: ${err.message || 'Check permissions'}`,
        type: 'error',
      });
      setTimeout(() => setPriceSyncNotification(null), 7000);
    } finally {
      setIsSyncingLedgerToSheets(false);
    }
  };

  const handleSelectTickerForTrade = (ticker: EGXTicker) => {
    setSelectedTickerForTrade(ticker);
    setIsAddTradeModalOpen(true);
  };

  const handleAIScreenshotAddTransaction = (parsedTx: {
    ticker: string;
    companyName: string;
    sector: Sector;
    type: 'BUY' | 'SELL';
    shares: number;
    price: number;
    date: string;
    fees: number;
    notes?: string;
  }) => {
    let maxId = 0;
    transactions.forEach((t) => {
      const raw = t.tradeId !== undefined ? t.tradeId : t.trade_id;
      if (typeof raw === 'number' && raw > maxId) maxId = raw;
      else if (typeof raw === 'string') {
        const parsed = parseInt(raw, 10);
        if (!isNaN(parsed) && parsed > maxId) maxId = parsed;
      }
    });
    const nextTradeId = maxId > 0 ? maxId + 1 : transactions.length + 1;

    const newTx: TradeTransaction = {
      id: `tx-ai-${Date.now()}-${parsedTx.ticker}`,
      tradeId: nextTradeId,
      type: parsedTx.type,
      ticker: parsedTx.ticker.toUpperCase(),
      companyName: parsedTx.companyName || parsedTx.ticker,
      sector: parsedTx.sector || 'Banking',
      shares: parsedTx.shares,
      price: parsedTx.price,
      date: parsedTx.date,
      fees: parsedTx.fees || 0,
      totalAmount: parsedTx.type === 'BUY' 
        ? (parsedTx.shares * parsedTx.price) + (parsedTx.fees || 0)
        : Math.max(0, (parsedTx.shares * parsedTx.price) - (parsedTx.fees || 0)),
      notes: parsedTx.notes || 'Logged via AI Screenshot Scanner',
    };

    const updatedTransactions = [newTx, ...transactions];
    setTransactions(updatedTransactions);

    // Auto-sync screenshot trade to Google Sheet Transaction Logger tab if configured
    if (sheetsConfig?.spreadsheetId) {
      syncTransactionToSheet(newTx);
    } else {
      setPriceSyncNotification({
        message: `Successfully logged ${parsedTx.type} ${parsedTx.shares.toLocaleString()} ${parsedTx.ticker} via screenshot scanner!`,
        type: 'success',
      });
      setTimeout(() => setPriceSyncNotification(null), 5000);
    }

    // Reconcile full portfolio state from ledger
    const reconciled = reconcilePortfolioFromLedger(updatedTransactions, tickers, cashBalance, positions);
    setPositions(reconciled.reconciledPositions);
    setClosedTrades(reconciled.reconciledClosedTrades);
    setCashBalance(reconciled.reconciledCashBalance);

    appendTransactionToFirestore(newTx, reconciled.reconciledPositions, reconciled.reconciledClosedTrades, reconciled.reconciledCashBalance);

    setPriceSyncNotification({
      message: `Successfully logged ${parsedTx.type} ${parsedTx.shares.toLocaleString()} ${parsedTx.ticker} via AI screenshot!`,
      type: 'success',
    });
    setTimeout(() => setPriceSyncNotification(null), 5000);
  };

  const handleAIScreenshotAddBatchTransactions = (parsedTxs: Array<{
    ticker: string;
    companyName: string;
    sector: Sector;
    type: 'BUY' | 'SELL';
    shares: number;
    price: number;
    date: string;
    fees: number;
    notes?: string;
  }>) => {
    if (parsedTxs.length === 0) return;

    let maxId = 0;
    transactions.forEach((t) => {
      const raw = t.tradeId !== undefined ? t.tradeId : t.trade_id;
      if (typeof raw === 'number' && raw > maxId) maxId = raw;
      else if (typeof raw === 'string') {
        const parsed = parseInt(raw, 10);
        if (!isNaN(parsed) && parsed > maxId) maxId = parsed;
      }
    });

    let currentTradeId = maxId > 0 ? maxId + 1 : transactions.length + 1;

    const newTxs: TradeTransaction[] = parsedTxs.map((pt, idx) => {
      const txId = currentTradeId + idx;
      return {
        id: `tx-ai-${Date.now()}-${idx}-${pt.ticker}`,
        tradeId: txId,
        type: pt.type,
        ticker: pt.ticker.toUpperCase(),
        companyName: pt.companyName || pt.ticker,
        sector: pt.sector || 'Banking',
        shares: pt.shares,
        price: pt.price,
        date: pt.date,
        fees: pt.fees || 0,
        totalAmount: pt.type === 'BUY'
          ? (pt.shares * pt.price) + (pt.fees || 0)
          : Math.max(0, (pt.shares * pt.price) - (pt.fees || 0)),
        notes: pt.notes || 'Logged via Trade Screenshot Scanner',
      };
    });

    // Sort chronologically ascending to maintain consistent ledger reconciliation order
    const combinedTransactions = [...newTxs, ...transactions].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    setTransactions(combinedTransactions);

    // Auto-sync batch screenshot trades to Google Sheet Transaction Logger tab if configured
    if (sheetsConfig?.spreadsheetId) {
      syncBatchTransactionsToSheet(newTxs);
    } else {
      setPriceSyncNotification({
        message: `Successfully imported ${newTxs.length} transactions from screenshots!`,
        type: 'success',
      });
      setTimeout(() => setPriceSyncNotification(null), 5000);
    }

    // Reconcile full portfolio state from ledger
    const reconciled = reconcilePortfolioFromLedger(combinedTransactions, tickers, cashBalance, positions);
    setPositions(reconciled.reconciledPositions);
    setClosedTrades(reconciled.reconciledClosedTrades);
    setCashBalance(reconciled.reconciledCashBalance);

    updateFirestoreTransactions(combinedTransactions, reconciled.reconciledPositions, reconciled.reconciledClosedTrades, reconciled.reconciledCashBalance);

    setPriceSyncNotification({
      message: `Successfully imported ${newTxs.length} transactions from Telda screenshots!`,
      type: 'success',
    });
    setTimeout(() => setPriceSyncNotification(null), 6000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
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
        onBackupReconcile={() => setIsBackupModalOpen(true)}
        isSheetsConnected={!!sheetsConfig}
        isTokenExpired={isSheetsTokenExpired}
        sheetsTitle={sheetsConfig?.sheetName}
        authUser={authUser}
        onLogout={() => logout()}
        onSyncLivePrices={() => handleSyncLivePrices(false)}
        isSyncingPrices={isSyncingPrices}
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

      {/* Price Sync Notification Toast */}
      {priceSyncNotification && (
        <div className="fixed top-20 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div
            className={`px-4 py-2.5 rounded-lg shadow-xl border text-xs font-semibold flex items-center gap-2.5 backdrop-blur-md ${
              priceSyncNotification.type === 'success'
                ? 'bg-slate-900/95 border-emerald-500/60 text-emerald-300'
                : 'bg-slate-900/95 border-rose-500/60 text-rose-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                priceSyncNotification.type === 'success' ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
            <span>{priceSyncNotification.message}</span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {getIsQuotaExceeded() && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span>
                <strong>Firebase Daily Write Quota Reached:</strong> Cloud database sync is paused until daily quota resets tomorrow. Your app continues working 100% offline via Local Storage & Google Sheets sync.
              </span>
            </div>
            <a
              href="https://firebase.google.com/pricing#cloud-firestore"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] underline text-amber-200 hover:text-white shrink-0 font-semibold"
            >
              Quota Info
            </a>
          </div>
        )}

        {/* Top Summary Banner */}
        <PortfolioSummary
          metrics={metrics}
          stats={stats}
          onQuickAddCash={() => setIsQuickCashModalOpen(true)}
          onSyncLivePrices={() => handleSyncLivePrices(false)}
          isSyncingPrices={isSyncingPrices}
          lastPriceSyncTime={lastPriceSyncTime}
          scheduleStatus={scheduleStatus}
        />

        {/* Tab Content Panels */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Active Stock Positions overview (placed before trajectory chart) */}
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
                onAddNewTrade={() => {
                  setSelectedTickerForTrade(null);
                  setIsAddTradeModalOpen(true);
                }}
              />
            </div>

            {/* Realized P&L Equity Trajectory Curve */}
            <RealizedTrajectoryChart closedTrades={closedTrades} stats={stats} />
          </div>
        )}

        {activeTab === 'positions' && (
          <div className="space-y-4">
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
            onSyncToSheets={handleSyncLedgerToSheet}
            isSyncingToSheets={isSyncingLedgerToSheets}
          />
        )}

        {activeTab === 'cash' && (
          <CashBalanceView
            cashBalance={cashBalance}
            totalPortfolioValue={metrics.totalValue}
            onUpdateCashBalance={(newBal) => {
              setCashBalance(newBal);
              updateFirestoreCashBalance(newBal);
            }}
            positions={positions}
            closedTrades={closedTrades}
            tradeTransactions={transactions}
          />
        )}

        {activeTab === 'directory' && (
          <TickerDirectoryView
            tickers={tickers}
            onSelectTickerForTrade={handleSelectTickerForTrade}
            onOpenSchemaSync={() => setIsSchemaModalOpen(true)}
            onSyncLivePrices={() => handleSyncLivePrices(false)}
            isSyncingPrices={isSyncingPrices}
            lastPriceSyncTime={lastPriceSyncTime}
            onPushPricesToSheet={handlePushPricesToSheetDirectly}
            isSheetsConnected={!!sheetsConfig?.spreadsheetId}
          />
        )}
      </main>

      {/* Modals & Dialogs */}
      <GoogleSheetsModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        onSaveConfig={handleSaveSheetsConfig}
        onImportData={handleImportGoogleSheets}
        currentConfig={sheetsConfig || undefined}
        authUser={authUser}
        onAuthSuccess={(user) => setAuthUser(user)}
        positions={positions}
        closedTrades={closedTrades}
        transactions={transactions}
        tickers={tickers}
        onReconcileFromLedger={handleReconcileFromLedger}
      />

      <PythonSchemaSyncModal
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        onUpdateTickers={handleUpdateTickersFromPython}
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
        onUpdateCash={(newCash) => setCashBalance(newCash)}
      />

      <ConfirmDeleteModal
        isOpen={confirmDeleteState.isOpen}
        onClose={() => setConfirmDeleteState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDeleteState.onConfirm}
        title={confirmDeleteState.title}
        description={confirmDeleteState.description}
        itemDetails={confirmDeleteState.itemDetails}
      />

      <PortfolioBackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        portfolioData={{
          positions,
          closedTrades,
          transactions,
          cashBalance,
          tickers,
        }}
        onRestorePortfolio={(restored) => {
          setPositions(restored.positions || []);
          setClosedTrades(restored.closedTrades || []);
          setTransactions(restored.transactions || []);
          if (typeof restored.cashBalance === 'number') setCashBalance(restored.cashBalance);
          if (restored.tickers) setTickers(restored.tickers);
          setPriceSyncNotification({
            message: 'Portfolio successfully restored from JSON backup file!',
            type: 'success',
          });
          setTimeout(() => setPriceSyncNotification(null), 5000);
        }}
        onTriggerReconcile={handleReconcileLedger}
      />

      {/* Offline PWA Indicator */}
      <OfflineIndicator />
    </div>
  );
}
