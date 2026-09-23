import { useState, useEffect, useCallback, useRef } from 'react';
import { Position, ClosedTrade, TradeTransaction, EGXTicker, Sector, CashTransaction } from '../types';
import { INITIAL_EGX_TICKERS, mergeTickerDirectoryWithBaseline } from '../data/egxTickers';
import {
  INITIAL_POSITIONS,
  INITIAL_CLOSED_TRADES,
  INITIAL_CASH_BALANCE,
  INITIAL_TRANSACTIONS,
  INITIAL_CAPITAL_DEPOSITS,
} from '../data/initialPortfolio';
import {
  loadPortfolioFromFirestore,
  savePortfolioToFirestore,
  debouncedSavePortfolioToFirestore,
  forceFullSyncToFirestore,
  subscribeToPortfolioFromFirestore,
  updateFirestorePositions,
  updateFirestoreTickers,
  updateFirestoreTransactions,
  flushPendingWriteQueue,
  markLocalMutation,
} from '../services/firestoreStorage';
import { getSupabaseBrowserClient } from '../services/supabaseBrowser';
import {
  reconcilePortfolioFromLedger,
  getOpenBuyTransactionIdsForTicker,
  ReconciliationReport,
} from '../services/portfolioReconciliation';
import {
  calculateBuyImpact,
  calculateSellAccounting,
  calculateHoldingDays,
} from '../services/portfolioAccounting';
import { normalizeTransaction } from '../utils/portfolioMetrics';
import { applyCashLedgerEvent, changeCashLedgerEntry, rebuildAfterLedgerChange } from '../services/cashLedger';

const STORAGE_KEY_POSITIONS = 'egx_pwa_positions_v3_reconciled';
const STORAGE_KEY_CLOSED = 'egx_pwa_closed_trades_v3_reconciled';
const STORAGE_KEY_CASH = 'egx_pwa_cash_balance_v3_reconciled';
const STORAGE_KEY_TICKERS = 'egx_pwa_tickers_directory_v3_reconciled';
const STORAGE_KEY_TRANSACTIONS = 'egx_pwa_transactions_v3_reconciled';
const STORAGE_KEY_CAPITAL = 'egx_pwa_capital_deposits_v1';

export function usePortfolioState() {
  const [tickers, setTickers] = useState<EGXTicker[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TICKERS);
      return saved ? mergeTickerDirectoryWithBaseline(JSON.parse(saved)) : INITIAL_EGX_TICKERS;
    } catch {
      return INITIAL_EGX_TICKERS;
    }
  });

  const [capitalDeposits, setCapitalDeposits] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CAPITAL);
      return saved ? JSON.parse(saved) : INITIAL_CAPITAL_DEPOSITS;
    } catch {
      return INITIAL_CAPITAL_DEPOSITS;
    }
  });

  const [transactions, setTransactions] = useState<TradeTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
      const parsed = saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
      return Array.isArray(parsed) && parsed.length > 0
        ? parsed.map(normalizeTransaction)
        : INITIAL_TRANSACTIONS;
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  });

  const [positions, setPositions] = useState<Position[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_POSITIONS);
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      const txsToUse = (() => {
        try {
          const rawTxs = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
          const p = rawTxs ? JSON.parse(rawTxs) : null;
          return Array.isArray(p) && p.length > 0 ? p.map(normalizeTransaction) : INITIAL_TRANSACTIONS;
        } catch {
          return INITIAL_TRANSACTIONS;
        }
      })();
      const report = reconcilePortfolioFromLedger(txsToUse, INITIAL_EGX_TICKERS, INITIAL_CAPITAL_DEPOSITS);
      return report.reconciledPositions.length > 0 ? report.reconciledPositions : INITIAL_POSITIONS;
    } catch {
      return INITIAL_POSITIONS;
    }
  });

  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLOSED);
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      const txsToUse = (() => {
        try {
          const rawTxs = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
          const p = rawTxs ? JSON.parse(rawTxs) : null;
          return Array.isArray(p) && p.length > 0 ? p.map(normalizeTransaction) : INITIAL_TRANSACTIONS;
        } catch {
          return INITIAL_TRANSACTIONS;
        }
      })();
      const report = reconcilePortfolioFromLedger(txsToUse, INITIAL_EGX_TICKERS, INITIAL_CAPITAL_DEPOSITS);
      return report.reconciledClosedTrades.length > 0 ? report.reconciledClosedTrades : INITIAL_CLOSED_TRADES;
    } catch {
      return INITIAL_CLOSED_TRADES;
    }
  });

  const [cashBalance, setCashBalance] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CASH);
      const parsed = saved !== null ? JSON.parse(saved) : null;
      if (typeof parsed === 'number' && Number.isFinite(parsed)) return parsed;
      const txsToUse = (() => {
        try {
          const rawTxs = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
          const p = rawTxs ? JSON.parse(rawTxs) : null;
          return Array.isArray(p) && p.length > 0 ? p.map(normalizeTransaction) : INITIAL_TRANSACTIONS;
        } catch {
          return INITIAL_TRANSACTIONS;
        }
      })();
      const report = reconcilePortfolioFromLedger(txsToUse, INITIAL_EGX_TICKERS, INITIAL_CAPITAL_DEPOSITS);
      return Number.isFinite(report.reconciledCashBalance)
        ? report.reconciledCashBalance
        : INITIAL_CASH_BALANCE;
    } catch {
      return INITIAL_CASH_BALANCE;
    }
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const isRemoteSyncingRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_POSITIONS, JSON.stringify(positions));
      localStorage.setItem(STORAGE_KEY_CLOSED, JSON.stringify(closedTrades));
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(transactions));
      localStorage.setItem(STORAGE_KEY_CASH, JSON.stringify(cashBalance));
      localStorage.setItem(STORAGE_KEY_TICKERS, JSON.stringify(tickers));
      localStorage.setItem(STORAGE_KEY_CAPITAL, JSON.stringify(capitalDeposits));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }, [positions, closedTrades, transactions, cashBalance, tickers, capitalDeposits]);

  useEffect(() => {
    let activeUnsubscribe: (() => void) | null = null;
    let isMounted = true;

    const initializeRemotePortfolio = async () => {
      try {
        const remoteData = await loadPortfolioFromFirestore();
        if (remoteData && isMounted) {
          isRemoteSyncingRef.current = true;
          let loadedPositions = Array.isArray(remoteData.positions) ? remoteData.positions : [];
          let loadedClosed = Array.isArray(remoteData.closedTrades) ? remoteData.closedTrades : [];

          const loadedTransactions = Array.isArray(remoteData.transactions)
            ? remoteData.transactions.map(normalizeTransaction).sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
              )
            : [];

          let loadedCash = typeof remoteData.cashBalance === 'number' ? remoteData.cashBalance : cashBalance;
          const loadedCapital = typeof remoteData.capitalDeposits === 'number' && remoteData.capitalDeposits >= 0
            ? remoteData.capitalDeposits
            : capitalDeposits;
          const loadedTickers = mergeTickerDirectoryWithBaseline(
            Array.isArray(remoteData.tickers) && remoteData.tickers.length > 0
              ? remoteData.tickers
              : tickers,
          );

          if (loadedTransactions.length > 0 && (loadedPositions.length === 0 || loadedClosed.length === 0)) {
            const report = reconcilePortfolioFromLedger(loadedTransactions, loadedTickers, loadedCapital, loadedPositions);
            if (loadedPositions.length === 0) loadedPositions = report.reconciledPositions;
            if (loadedClosed.length === 0) loadedClosed = report.reconciledClosedTrades;
            if (loadedCash === 0) loadedCash = report.reconciledCashBalance;
            debouncedSavePortfolioToFirestore({
              positions: loadedPositions,
              closedTrades: loadedClosed,
              transactions: loadedTransactions,
              cashBalance: loadedCash,
              capitalDeposits: loadedCapital,
              tickers: loadedTickers,
            }, 300);
          }

          setPositions(loadedPositions);
          setClosedTrades(loadedClosed);
          setTransactions(loadedTransactions);
          setCashBalance(loadedCash);
          setCapitalDeposits(loadedCapital);
          if (Array.isArray(remoteData.tickers) && remoteData.tickers.length > 0) setTickers(loadedTickers);
          setTimeout(() => { isRemoteSyncingRef.current = false; }, 150);
        }
      } catch (err) {
        console.warn('Initial Supabase load failed, using local cache:', err);
      } finally {
        if (isMounted) setIsInitialized(true);
      }

      try { await flushPendingWriteQueue(); } catch { /* ignore */ }

      if (!isMounted) return;
      try {
        activeUnsubscribe = subscribeToPortfolioFromFirestore((remoteData) => {
          if (!remoteData || !isMounted) return;
          isRemoteSyncingRef.current = true;
          let loadedPositions = Array.isArray(remoteData.positions) ? remoteData.positions : [];
          let loadedClosed = Array.isArray(remoteData.closedTrades) ? remoteData.closedTrades : [];
          const loadedTransactions = Array.isArray(remoteData.transactions)
            ? remoteData.transactions.map(normalizeTransaction)
            : [];

          if (loadedTransactions.length > 0 && (loadedPositions.length === 0 || loadedClosed.length === 0)) {
            const report = reconcilePortfolioFromLedger(loadedTransactions, tickers, capitalDeposits, loadedPositions);
            if (loadedPositions.length === 0) loadedPositions = report.reconciledPositions;
            if (loadedClosed.length === 0) loadedClosed = report.reconciledClosedTrades;
          }

          setPositions(loadedPositions);
          setClosedTrades(loadedClosed);
          setTransactions(loadedTransactions);
          if (typeof remoteData.cashBalance === 'number' && Number.isFinite(remoteData.cashBalance)) setCashBalance(remoteData.cashBalance);
          if (typeof remoteData.capitalDeposits === 'number' && remoteData.capitalDeposits >= 0) setCapitalDeposits(remoteData.capitalDeposits);
          setTimeout(() => { isRemoteSyncingRef.current = false; }, 150);
        });
      } catch (subErr) {
        console.warn('Supabase portfolio subscription failed:', subErr);
      }
    };

    void initializeRemotePortfolio();

    return () => {
      isMounted = false;
      if (activeUnsubscribe) activeUnsubscribe();
    };
  }, []);

  const reconcileLedger = useCallback((): ReconciliationReport => {
    const report = reconcilePortfolioFromLedger(transactions, tickers, capitalDeposits, positions);
    setPositions(report.reconciledPositions);
    setClosedTrades(report.reconciledClosedTrades);
    setCashBalance(report.reconciledCashBalance);
    debouncedSavePortfolioToFirestore({
      positions: report.reconciledPositions,
      closedTrades: report.reconciledClosedTrades,
      transactions,
      cashBalance: report.reconciledCashBalance,
      capitalDeposits,
      tickers,
    }, 300);
    return report;
  }, [transactions, tickers, capitalDeposits, positions]);

  const rehydratePositionsWithTickers = useCallback((posList: Position[], tickerList: EGXTicker[]): Position[] => {
    if (!tickerList?.length || !posList?.length) return posList;
    const tickerMap = new Map(tickerList.map((t) => [t.ticker.trim().toUpperCase(), t]));
    let hasChanges = false;
    const rehydrated = posList.map((p) => {
      const t = tickerMap.get(p.ticker.trim().toUpperCase());
      if (!t) return p;
      const currentPrice = t.lastPrice > 0 ? t.lastPrice : p.currentPrice;
      const targetPrice = p.targetPrice ?? t.targetPrice;
      const stopLoss = p.stopLoss ?? t.stopLoss;
      const companyName = t.nameEn || p.companyName || p.ticker;
      const sector = t.sector !== 'Other' ? t.sector : (p.sector || 'Other');
      if (
        Math.abs((p.currentPrice || 0) - currentPrice) > 0.0001 ||
        p.targetPrice !== targetPrice ||
        p.stopLoss !== stopLoss ||
        p.companyName !== companyName ||
        p.sector !== sector
      ) {
        hasChanges = true;
        return { ...p, currentPrice, targetPrice, stopLoss, companyName, sector };
      }
      return p;
    });
    return hasChanges ? rehydrated : posList;
  }, []);

  useEffect(() => {
    setPositions((prev) => rehydratePositionsWithTickers(prev, tickers));
  }, [tickers, rehydratePositionsWithTickers]);

  const addTrade = useCallback((tradeInput: {
    ticker: string;
    companyName: string;
    sector: Sector;
    shares: number;
    price: number;
    fees?: number;
    date: string;
    executedAt?: string;
    targetPrice?: number;
    stopLoss?: number;
    notes?: string;
    deductFromCash?: boolean;
    cycleTag?: string;
  }) => {
    const tickerKey = tradeInput.ticker.trim().toUpperCase();
    const { grossCost, fees, cashOutflow } = calculateBuyImpact(
      tradeInput.shares,
      tradeInput.price,
      tradeInput.fees ?? 0,
    );

    const maxExistingTradeId = transactions.reduce((max, t) => {
      const tid = Number(t.tradeId);
      return !isNaN(tid) && tid > max ? tid : max;
    }, 0);
    const nextTradeId = maxExistingTradeId > 0 ? maxExistingTradeId + 1 : transactions.length + 1;

    const newTx: TradeTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'BUY',
      ticker: tickerKey,
      companyName: tradeInput.companyName,
      sector: tradeInput.sector,
      shares: tradeInput.shares,
      price: tradeInput.price,
      date: tradeInput.date,
      executedAt: tradeInput.executedAt,
      fees,
      totalAmount: cashOutflow,
      targetPrice: tradeInput.targetPrice,
      stopLoss: tradeInput.stopLoss,
      notes: tradeInput.notes || '',
      cycleTag: tradeInput.cycleTag,
      tradeId: nextTradeId,
      grossTradeValue: grossCost,
      netCashImpact: -cashOutflow,
    };

    const updatedTransactions = [newTx, ...transactions];
    let updatedPositions: Position[];
    const existingIndex = positions.findIndex((p) => p.ticker.trim().toUpperCase() === tickerKey);

    if (existingIndex >= 0) {
      const existing = positions[existingIndex];
      const newTotalShares = existing.shares + tradeInput.shares;
      const existingGrossCost = existing.shares * existing.avgBuyPrice;
      const newAvgBuyPrice = (existingGrossCost + grossCost) / newTotalShares;
      const newTotalFees = (existing.totalFees || 0) + fees;
      updatedPositions = [...positions];
      updatedPositions[existingIndex] = {
        ...existing,
        shares: newTotalShares,
        avgBuyPrice: newAvgBuyPrice,
        totalFees: newTotalFees,
        targetPrice: tradeInput.targetPrice !== undefined ? tradeInput.targetPrice : existing.targetPrice,
        stopLoss: tradeInput.stopLoss !== undefined ? tradeInput.stopLoss : existing.stopLoss,
        notes: tradeInput.notes || existing.notes,
      };
    } else {
      const quoteMatch = tickers.find((t) => t.ticker.trim().toUpperCase() === tickerKey);
      updatedPositions = [{
        id: `pos-${tickerKey}-${Date.now()}`,
        ticker: tickerKey,
        companyName: tradeInput.companyName,
        sector: tradeInput.sector,
        shares: tradeInput.shares,
        avgBuyPrice: tradeInput.price,
        currentPrice: quoteMatch && quoteMatch.lastPrice > 0 ? quoteMatch.lastPrice : tradeInput.price,
        buyDate: tradeInput.date,
        totalFees: fees,
        targetPrice: tradeInput.targetPrice,
        stopLoss: tradeInput.stopLoss,
        notes: tradeInput.notes,
      }, ...positions];
    }

    const newCash = tradeInput.deductFromCash !== false ? cashBalance - cashOutflow : cashBalance;
    setTransactions(updatedTransactions);
    setPositions(updatedPositions);
    setCashBalance(newCash);

    savePortfolioToFirestore({ positions: updatedPositions, closedTrades, transactions: updatedTransactions, cashBalance: newCash, capitalDeposits, tickers }, false, 'trade-added');
    return newTx;
  }, [transactions, positions, closedTrades, cashBalance, tickers, capitalDeposits]);

  const sellPosition = useCallback((sellInput: {
    position: Position;
    sharesToSell: number;
    sellPrice: number;
    fees?: number;
    sellDate: string;
    executedAt?: string;
    addToCash?: boolean;
    notes?: string;
  }) => {
    const { position, sharesToSell, sellPrice, fees = 0, sellDate, executedAt, addToCash = true, notes } = sellInput;
    const tickerKey = position.ticker.trim().toUpperCase();
    const accounting = calculateSellAccounting(
      sharesToSell,
      sellPrice,
      fees,
      position.shares,
      position.shares * position.avgBuyPrice,
      position.totalFees || 0,
    );
    const holdingDays = calculateHoldingDays(position.buyDate, sellDate);

    const maxExistingTradeId = transactions.reduce((max, t) => {
      const tid = Number(t.tradeId);
      return !isNaN(tid) && tid > max ? tid : max;
    }, 0);
    const nextTradeId = maxExistingTradeId > 0 ? maxExistingTradeId + 1 : transactions.length + 1;

    const newTx: TradeTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'SELL',
      ticker: tickerKey,
      companyName: position.companyName,
      sector: position.sector,
      shares: sharesToSell,
      price: sellPrice,
      date: sellDate,
      executedAt,
      fees,
      totalAmount: addToCash ? accounting.netProceeds : 0,
      grossTradeValue: accounting.grossProceeds,
      netCashImpact: addToCash ? accounting.netProceeds : 0,
      realizedPnlEgp: accounting.realizedPnlEgp,
      realizedPnlPercent: accounting.realizedPnlPercent,
      outcome: accounting.outcome,
      holdingDays,
      notes: notes || '',
      tradeId: nextTradeId,
    };

    const updatedTransactions = [newTx, ...transactions];
    const report = reconcilePortfolioFromLedger(updatedTransactions, tickers, capitalDeposits);

    setTransactions(updatedTransactions);
    setClosedTrades(report.reconciledClosedTrades);
    setPositions(report.reconciledPositions);
    setCashBalance(report.reconciledCashBalance);

    updateFirestoreTransactions(updatedTransactions, report.reconciledPositions, report.reconciledClosedTrades, report.reconciledCashBalance, capitalDeposits);
    return { transaction: newTx, closedTrade: report.reconciledClosedTrades.find(t => t.ticker === tickerKey) };
  }, [positions, transactions, tickers, capitalDeposits]);

  const editPosition = useCallback((updatedPosition: Position) => {
    const updated = positions.map((p) => (p.id === updatedPosition.id ? updatedPosition : p));
    setPositions(updated);
    updateFirestorePositions(updated);
  }, [positions]);

  const deletePosition = useCallback((positionId: string) => {
    const targetPos = positions.find((p) => p.id === positionId);
    if (!targetPos) {
      const updated = positions.filter((p) => p.id !== positionId);
      setPositions(updated);
      updateFirestorePositions(updated);
      return transactions;
    }
    const openBuyTxIds = getOpenBuyTransactionIdsForTicker(transactions, targetPos.ticker);
    const updatedTransactions = transactions.filter((t) => !openBuyTxIds.includes(t.id));
    const report = reconcilePortfolioFromLedger(updatedTransactions, tickers, capitalDeposits);
    setTransactions(updatedTransactions);
    setPositions(report.reconciledPositions);
    setClosedTrades(report.reconciledClosedTrades);
    setCashBalance(report.reconciledCashBalance);
    updateFirestoreTransactions(updatedTransactions, report.reconciledPositions, report.reconciledClosedTrades, report.reconciledCashBalance, capitalDeposits);
    return updatedTransactions;
  }, [positions, transactions, tickers, capitalDeposits]);

  const applyLedgerSnapshot = useCallback((next: ReturnType<typeof rebuildAfterLedgerChange>) => {
    setTransactions(next.transactions);
    setPositions(next.positions);
    setClosedTrades(next.closedTrades);
    setCashBalance(next.cashBalance);
    setCapitalDeposits(next.capitalDeposits);
  }, []);

  const editTransaction = useCallback((updatedTx: TradeTransaction) => {
    const normalized = normalizeTransaction(updatedTx);
    const updated = transactions.map((t) => t.id === normalized.id ? normalized : t);
    const next = rebuildAfterLedgerChange({ transactions, positions, tickers, capitalDeposits }, updated);
    applyLedgerSnapshot(next);
    void forceFullSyncToFirestore(next);
    return next.transactions;
  }, [transactions, positions, tickers, capitalDeposits, applyLedgerSnapshot]);

  const deleteTransaction = useCallback(async (txId: string): Promise<TradeTransaction[] | null> => {
    const next = rebuildAfterLedgerChange(
      { transactions, positions, tickers, capitalDeposits },
      transactions.filter((t) => t.id !== txId),
    );

    const saved = await forceFullSyncToFirestore(next);
    if (!saved) {
      console.error('[Supabase] Transaction delete was not persisted; keeping current local state.', txId);
      return null;
    }

    applyLedgerSnapshot(next);
    return next.transactions;
  }, [transactions, positions, tickers, capitalDeposits, applyLedgerSnapshot]);

  const cashSaveInFlight = useRef(false);
  const persistCashSnapshot = useCallback(async (next: ReturnType<typeof rebuildAfterLedgerChange>) => {
    if (cashSaveInFlight.current) return false;
    cashSaveInFlight.current = true;
    markLocalMutation();
    try {
      const saved = await forceFullSyncToFirestore(next);
      if (saved) applyLedgerSnapshot(next);
      return saved;
    } catch {
      return false;
    } finally {
      cashSaveInFlight.current = false;
    }
  }, [applyLedgerSnapshot]);

  const commitCashEvent = useCallback((kind: 'DEPOSIT' | 'WITHDRAWAL' | 'DIVIDEND' | 'CASH_ADJUSTMENT', amount: number, notes?: string, date?: string) => {
    const { transaction: _transaction, ...next } = applyCashLedgerEvent({ transactions, positions, tickers, capitalDeposits }, kind, amount, notes, date);
    return persistCashSnapshot(next);
  }, [transactions, positions, tickers, capitalDeposits, persistCashSnapshot]);

  const addCashTransaction = useCallback((amount: number, type: 'DEPOSIT' | 'WITHDRAW' | 'DIVIDEND', notes?: string, date?: string) => {
    return commitCashEvent(type === 'WITHDRAW' ? 'WITHDRAWAL' : type, amount, notes, date);
  }, [commitCashEvent]);

  const editCashTransaction = useCallback((tx: CashTransaction) => {
    return persistCashSnapshot(changeCashLedgerEntry({ transactions, positions, tickers, capitalDeposits }, tx.id, tx));
  }, [transactions, positions, tickers, capitalDeposits, persistCashSnapshot]);

  const deleteCashTransaction = useCallback((id: string) => {
    return persistCashSnapshot(changeCashLedgerEntry({ transactions, positions, tickers, capitalDeposits }, id, null));
  }, [transactions, positions, tickers, capitalDeposits, persistCashSnapshot]);

  const importBackup = useCallback(async (backup: {
    positions?: Position[];
    closedTrades?: ClosedTrade[];
    transactions?: TradeTransaction[];
    cashBalance?: number;
    capitalDeposits?: number;
    tickers?: EGXTicker[];
  }) => {
    let importedTxs = Array.isArray(backup.transactions) ? backup.transactions.map(normalizeTransaction) : transactions;
    let importedPositions = Array.isArray(backup.positions) ? backup.positions : [];
    let importedClosed = Array.isArray(backup.closedTrades) ? backup.closedTrades : [];
    let importedCash = typeof backup.cashBalance === 'number' ? backup.cashBalance : cashBalance;
    let importedCapital = typeof backup.capitalDeposits === 'number' && backup.capitalDeposits >= 0 ? backup.capitalDeposits : capitalDeposits;
    let importedTickers = Array.isArray(backup.tickers) && backup.tickers.length > 0 ? backup.tickers : tickers;

    if (importedTxs.length > 0 && (importedPositions.length === 0 || importedClosed.length === 0)) {
      const report = reconcilePortfolioFromLedger(importedTxs, importedTickers, importedCapital, importedPositions);
      if (importedPositions.length === 0) importedPositions = report.reconciledPositions;
      if (importedClosed.length === 0) importedClosed = report.reconciledClosedTrades;
      if (importedCash === 0) importedCash = report.reconciledCashBalance;
    }

    setPositions(importedPositions);
    setClosedTrades(importedClosed);
    setTransactions(importedTxs);
    setCashBalance(importedCash);
    setCapitalDeposits(importedCapital);
    if (Array.isArray(backup.tickers) && backup.tickers.length > 0) setTickers(importedTickers);

    try {
      localStorage.setItem(STORAGE_KEY_POSITIONS, JSON.stringify(importedPositions));
      localStorage.setItem(STORAGE_KEY_CLOSED, JSON.stringify(importedClosed));
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(importedTxs));
      localStorage.setItem(STORAGE_KEY_CASH, JSON.stringify(importedCash));
      localStorage.setItem(STORAGE_KEY_CAPITAL, JSON.stringify(importedCapital));
      if (Array.isArray(backup.tickers) && backup.tickers.length > 0) localStorage.setItem(STORAGE_KEY_TICKERS, JSON.stringify(importedTickers));
    } catch (e) {
      console.warn('LocalStorage save failed on import:', e);
    }

    markLocalMutation(4000);
    await forceFullSyncToFirestore({ positions: importedPositions, closedTrades: importedClosed, transactions: importedTxs, cashBalance: importedCash, capitalDeposits: importedCapital, tickers: importedTickers });
  }, [transactions, positions, closedTrades, cashBalance, tickers, capitalDeposits]);

  const restoreInitialState = useCallback(async () => {
    setPositions(INITIAL_POSITIONS);
    setClosedTrades(INITIAL_CLOSED_TRADES);
    setTransactions(INITIAL_TRANSACTIONS);
    setCashBalance(INITIAL_CASH_BALANCE);
    setTickers(INITIAL_EGX_TICKERS);
    setCapitalDeposits(INITIAL_CAPITAL_DEPOSITS);
    try {
      localStorage.setItem(STORAGE_KEY_POSITIONS, JSON.stringify(INITIAL_POSITIONS));
      localStorage.setItem(STORAGE_KEY_CLOSED, JSON.stringify(INITIAL_CLOSED_TRADES));
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(INITIAL_TRANSACTIONS));
      localStorage.setItem(STORAGE_KEY_CASH, JSON.stringify(INITIAL_CASH_BALANCE));
      localStorage.setItem(STORAGE_KEY_TICKERS, JSON.stringify(INITIAL_EGX_TICKERS));
      localStorage.setItem(STORAGE_KEY_CAPITAL, JSON.stringify(INITIAL_CAPITAL_DEPOSITS));
    } catch (e) {
      console.warn('LocalStorage reset failed:', e);
    }
    markLocalMutation(4000);
    await forceFullSyncToFirestore({ positions: INITIAL_POSITIONS, closedTrades: INITIAL_CLOSED_TRADES, transactions: INITIAL_TRANSACTIONS, cashBalance: INITIAL_CASH_BALANCE, capitalDeposits: INITIAL_CAPITAL_DEPOSITS, tickers: INITIAL_EGX_TICKERS });
  }, []);

  const updateTickers = useCallback((newTickers: EGXTicker[]) => setTickers(newTickers), []);

  const updateCashBalance = useCallback((newCash: number) => {
    if (!Number.isFinite(newCash)) return;
    const current = reconcilePortfolioFromLedger(transactions, tickers, capitalDeposits, positions);
    const delta = Number((newCash - current.reconciledCashBalance).toFixed(2));
    if (delta === 0) return;
    return commitCashEvent('CASH_ADJUSTMENT', delta, 'Manual cash balance adjustment');
  }, [transactions, tickers, capitalDeposits, positions, commitCashEvent]);

  const forceSync = useCallback(async () => {
    try {
      const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
      if (!session) throw new Error('No authenticated Supabase session.');
      const remote = await loadPortfolioFromFirestore();
      let mergedPositions = positions;
      let mergedClosed = closedTrades;
      let mergedTxs = transactions;
      let mergedCash = cashBalance;
      let mergedTickers = tickers;
      let mergedCapital = capitalDeposits;

      if (remote) {
        mergedTxs = Array.isArray(remote.transactions)
          ? remote.transactions.map(normalizeTransaction).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          : [];
        mergedPositions = Array.isArray(remote.positions) ? remote.positions : [];
        mergedClosed = Array.isArray(remote.closedTrades) ? remote.closedTrades : [];
        if (typeof remote.cashBalance === 'number' && Number.isFinite(remote.cashBalance)) mergedCash = remote.cashBalance;
        if (typeof remote.capitalDeposits === 'number' && remote.capitalDeposits >= 0) mergedCapital = remote.capitalDeposits;
        setTransactions(mergedTxs);
        setPositions(mergedPositions);
        setClosedTrades(mergedClosed);
        setCashBalance(mergedCash);
        setCapitalDeposits(mergedCapital);
      }

      return await forceFullSyncToFirestore({ positions: mergedPositions, closedTrades: mergedClosed, transactions: mergedTxs, cashBalance: mergedCash, capitalDeposits: mergedCapital, tickers: mergedTickers });
    } catch (err) {
      console.error('forceSync failed:', err);
      return false;
    }
  }, [positions, closedTrades, transactions, cashBalance, tickers, capitalDeposits]);

  return {
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
    isInitialized,
    addTrade,
    sellPosition,
    editPosition,
    deletePosition,
    editTransaction,
    deleteTransaction,
    addCashTransaction,
    editCashTransaction,
    deleteCashTransaction,
    reconcileLedger,
    importBackup,
    restoreInitialState,
    updateTickers,
    forceSync,
  };
}
