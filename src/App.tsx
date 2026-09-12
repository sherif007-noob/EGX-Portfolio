import React, { useState, useEffect, useMemo } from 'react';
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
  INITIAL_TRANSACTIONS
} from './data/initialPortfolio';
import { Header, NavigationTab } from './components/Header';
import { PortfolioSummary } from './components/PortfolioSummary';
import { PositionsTable } from './components/PositionsTable';
import { PerformanceReports } from './components/PerformanceReports';
import { TradingJournal } from './components/TradingJournal';
import { TickerDirectoryView } from './components/TickerDirectoryView';
import { CashBalanceView } from './components/CashBalanceView';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { PythonSchemaSyncModal } from './components/PythonSchemaSyncModal';
import { AddTradeModal } from './components/AddTradeModal';
import { SellPositionModal } from './components/SellPositionModal';
import { QuickCashModal } from './components/QuickCashModal';
import { RealizedTrajectoryChart } from './components/RealizedTrajectoryChart';
import { OfflineIndicator } from './components/OfflineIndicator';
import { initAuth, logout, getAccessToken } from './services/firebaseAuth';
import { appendTransactionToSheet, updateStockDirectoryInSheet } from './services/googleSheets';
import { User } from 'firebase/auth';
import { 
  fetchTradingViewEGXPrices, 
  applyLivePricesToPortfolio, 
  getEGXSessionStatus,
  formatCairoTime,
  EGXScheduleStatus
} from './services/marketPriceSync';

const STORAGE_KEY_POSITIONS = 'egx_pwa_positions_v1';
const STORAGE_KEY_CLOSED = 'egx_pwa_closed_trades_v1';
const STORAGE_KEY_CASH = 'egx_pwa_cash_balance_v1';
const STORAGE_KEY_TICKERS = 'egx_pwa_tickers_directory_v1';
const STORAGE_KEY_SHEETS = 'egx_pwa_sheets_config_v1';
const STORAGE_KEY_TRANSACTIONS = 'egx_pwa_transactions_v1';

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
  const [sellingPosition, setSellingPosition] = useState<Position | null>(null);
  const [selectedTickerForTrade, setSelectedTickerForTrade] = useState<EGXTicker | null>(null);

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
  const [scheduleStatus, setScheduleStatus] = useState<EGXScheduleStatus>(() => getEGXSessionStatus());

  // Handler to fetch and inject live prices into portfolio and directory
  const handleSyncLivePrices = async (isAutomatic = false) => {
    setIsSyncingPrices(true);
    try {
      const quotes = await fetchTradingViewEGXPrices();
      const updatedTimeStr = formatCairoTime(new Date());

      // Update positions with live prices
      setPositions((prevPositions) => {
        const { updatedPositions } = applyLivePricesToPortfolio(prevPositions, tickers, quotes);
        return updatedPositions;
      });

      // Update ticker directory with latest prices, changes, and volumes
      setTickers((prevTickers) => {
        const { updatedTickers } = applyLivePricesToPortfolio([], prevTickers, quotes);
        
        // Auto-update connected Google Sheet stock directory tab if connected
        if (sheetsConfig?.spreadsheetId && authUser) {
          getAccessToken().then((token) => {
            if (token) {
              updateStockDirectoryInSheet(
                sheetsConfig.spreadsheetId,
                updatedTickers,
                token,
                'Stock Directory'
              ).catch((err) => console.warn('Background sheets price sync:', err));
            }
          });
        }

        return updatedTickers;
      });

      setLastPriceSyncTime(updatedTimeStr);
      try {
        localStorage.setItem('egx_last_price_sync', updatedTimeStr);
      } catch {}

      const symbolCount = Object.keys(quotes).length;
      setPriceSyncNotification({
        message: `Updated ${symbolCount} EGX prices from TradingView (${isAutomatic ? 'Auto-sync' : 'Manual'})`,
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

  // Initial sync on startup if session is active and no prices synced today
  useEffect(() => {
    const status = getEGXSessionStatus();
    if (status.isSessionActive) {
      const saved = localStorage.getItem('egx_last_price_sync');
      if (!saved) {
        const timer = setTimeout(() => {
          handleSyncLivePrices(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_POSITIONS, JSON.stringify(positions));
  }, [positions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CLOSED, JSON.stringify(closedTrades));
  }, [closedTrades]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CASH, JSON.stringify(cashBalance));
  }, [cashBalance]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TICKERS, JSON.stringify(tickers));
  }, [tickers]);

  useEffect(() => {
    if (sheetsConfig) {
      localStorage.setItem(STORAGE_KEY_SHEETS, JSON.stringify(sheetsConfig));
    }
  }, [sheetsConfig]);

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
        const liveTicker = tickers.find((t) => t.ticker === pos.ticker);
        if (liveTicker && liveTicker.lastPrice !== pos.currentPrice) {
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
    };
  }, [closedTrades, positions]);

  // Handlers
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

      setPositions((prev) => {
        const copy = [...prev];
        copy[existingIndex] = updatedPosition;
        return copy;
      });
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

      setPositions((prev) => [newPos, ...prev]);
    }

    // Always log as a separate chronological transaction in the trade ledger
    const newTx: TradeTransaction = {
      id: `tx-buy-${Date.now()}-${newTradeData.ticker}`,
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
    if (sheetsConfig?.spreadsheetId && authUser) {
      getAccessToken().then((token) => {
        if (token) {
          appendTransactionToSheet(
            sheetsConfig.spreadsheetId,
            newTx,
            token,
            'Transaction Logger'
          ).catch((err) => console.warn('Background sheets tx append error:', err));
        }
      });
    }

    if (deductCash) {
      const totalOutlay = (newTradeData.shares * newTradeData.buyPrice) + (newTradeData.brokerageFee || 0);
      setCashBalance((prev) => Math.max(0, prev - totalOutlay));
    }
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

    setClosedTrades((prev) => [newClosedTrade, ...prev]);

    // Also log SELL transaction in chronological ledger
    const newSellTx: TradeTransaction = {
      id: `tx-sell-${Date.now()}-${pos.ticker}`,
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
    if (sheetsConfig?.spreadsheetId && authUser) {
      getAccessToken().then((token) => {
        if (token) {
          appendTransactionToSheet(
            sheetsConfig.spreadsheetId,
            newSellTx,
            token,
            'Transaction Logger'
          ).catch((err) => console.warn('Background sheets sell tx append error:', err));
        }
      });
    }

    // Add net proceeds from sale to cash balance
    setCashBalance((prev) => prev + netProceeds);

    if (remainingShares > 0) {
      setPositions((prev) =>
        prev.map((p) =>
          p.id === positionId
            ? { ...p, shares: remainingShares, totalFees: remainingBuyFee }
            : p
        )
      );
    } else {
      setPositions((prev) => prev.filter((p) => p.id !== positionId));
    }
  };

  const handleDeletePosition = (id: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));
  };

  const handleDeleteTrade = (id: string) => {
    setClosedTrades((prev) => prev.filter((t) => t.id !== id));
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const handleImportGoogleSheets = (
    importedPositions: Position[],
    importedClosedTrades: ClosedTrade[],
    config: GoogleSheetsConfig
  ) => {
    if (importedPositions.length > 0) {
      setPositions(importedPositions);
    }
    if (importedClosedTrades.length > 0) {
      setClosedTrades((prev) => [...importedClosedTrades, ...prev]);
    }
    setSheetsConfig(config);
  };

  const handleUpdateTickersFromPython = (newTickers: EGXTicker[]) => {
    setTickers(newTickers);
  };

  const handleSelectTickerForTrade = (ticker: EGXTicker) => {
    setSelectedTickerForTrade(ticker);
    setIsAddTradeModalOpen(true);
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
        isSheetsConnected={!!sheetsConfig}
        sheetsTitle={sheetsConfig?.sheetName}
        authUser={authUser}
        onLogout={() => logout()}
        onSyncLivePrices={() => handleSyncLivePrices(false)}
        isSyncingPrices={isSyncingPrices}
      />

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
                onEditPosition={(pos) => {
                  setSelectedTickerForTrade(tickers.find((t) => t.ticker === pos.ticker) || null);
                  setIsAddTradeModalOpen(true);
                }}
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
              onEditPosition={(pos) => {
                setSelectedTickerForTrade(tickers.find((t) => t.ticker === pos.ticker) || null);
                setIsAddTradeModalOpen(true);
              }}
              onDeletePosition={handleDeletePosition}
              onAddNewTrade={() => {
                setSelectedTickerForTrade(null);
                setIsAddTradeModalOpen(true);
              }}
            />
          </div>
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
            onDeleteTrade={handleDeleteTrade}
            onDeletePosition={handleDeletePosition}
          />
        )}

        {activeTab === 'cash' && (
          <CashBalanceView
            cashBalance={cashBalance}
            totalPortfolioValue={metrics.totalValue}
            onUpdateCashBalance={(newBal) => setCashBalance(newBal)}
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
          />
        )}
      </main>

      {/* Modals & Dialogs */}
      <GoogleSheetsModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        onImportData={handleImportGoogleSheets}
        currentConfig={sheetsConfig || undefined}
        authUser={authUser}
        onAuthSuccess={(user) => setAuthUser(user)}
        positions={positions}
        closedTrades={closedTrades}
        transactions={transactions}
        tickers={tickers}
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

      {/* Offline PWA Indicator */}
      <OfflineIndicator />
    </div>
  );
}
