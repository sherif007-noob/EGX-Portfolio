import { useState, useEffect, useCallback, useRef } from 'react';
import { Position, ClosedTrade, TradeTransaction, EGXTicker, Sector } from '../types';
import { INITIAL_EGX_TICKERS } from '../data/egxTickers';
import {
  INITIAL_POSITIONS,
  INITIAL_CLOSED_TRADES,
  INITIAL_CASH_BALANCE,
  INITIAL_TRANSACTIONS,
  INITIAL_CAPITAL_DEPOSITS,
} from '../data/initialPortfolio';
import {
  loadPortfolioFromFirestore,
  debouncedSavePortfolioToFirestore,
  subscribeToPortfolioFromFirestore,
  appendTransactionToFirestore,
  updateFirestorePositions,
  updateFirestoreTickers,
  updateFirestoreTransactions,
} from '../services/firestoreStorage';
import { reconcilePortfolioFromLedger, ReconciliationReport } from '../services/portfolioReconciliation';
import { normalizeTransaction } from '../utils/portfolioMetrics';

const STORAGE_KEY_POSITIONS = 'egx_pwa_positions_v3_reconciled';
const STORAGE_KEY_CLOSED = 'egx_pwa_closed_trades_v3_reconciled';
const STORAGE_KEY_CASH = 'egx_pwa_cash_balance_v3_reconciled';
const STORAGE_KEY_TICKERS = 'egx_pwa_tickers_directory_v3_reconciled';
const STORAGE_KEY_TRANSACTIONS = 'egx_pwa_transactions_v3_reconciled';
const STORAGE_KEY_CAPITAL = 'egx_pwa_capital_deposits_v1';

export function usePortfolioState() {
  // Load Tickers Directory first
  const [tickers, setTickers] = useState<EGXTicker[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TICKERS);
      return saved ? JSON.parse(saved) : INITIAL_EGX_TICKERS;
    } catch {
      return INITIAL_EGX_TICKERS;
    }
  });

  // Load Capital Deposits
  const [capitalDeposits, setCapitalDeposits] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CAPITAL);
      return saved ? JSON.parse(saved) : INITIAL_CAPITAL_DEPOSITS;
    } catch {
      return INITIAL_CAPITAL_DEPOSITS;
    }
  });

  // Load Transactions Ledger
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

  // Load Positions with ledger reconciliation fallback
  const [positions, setPositions] = useState<Position[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_POSITIONS);
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      // If transactions exist, reconcile positions from transaction ledger
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

  // Load Closed Trades with ledger reconciliation fallback
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLOSED);
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
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

  // Load Cash Balance with ledger reconciliation fallback
  const [cashBalance, setCashBalance] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CASH);
      const parsed = saved !== null ? JSON.parse(saved) : null;
      if (typeof parsed === 'number' && parsed > 0) {
        return parsed;
      }
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
      return report.reconciledCashBalance > 0 ? report.reconciledCashBalance : INITIAL_CASH_BALANCE;
    } catch {
      return INITIAL_CASH_BALANCE;
    }
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const isRemoteSyncingRef = useRef(false);

  // Sync to Local Storage on state changes
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

  // Debounced cloud persistence to Firestore
  useEffect(() => {
    if (!isInitialized || isRemoteSyncingRef.current) return;

    debouncedSavePortfolioToFirestore({
      positions,
      closedTrades,
      transactions,
      cashBalance,
      tickers,
    });
  }, [positions, closedTrades, transactions, cashBalance, tickers, isInitialized]);

  // Initial Firestore Load and Snapshot Subscription with Auto-Reconciliation
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function initFirestore() {
      try {
        const remoteData = await loadPortfolioFromFirestore();
        if (remoteData) {
          isRemoteSyncingRef.current = true;
          let loadedPositions = Array.isArray(remoteData.positions) ? remoteData.positions : [];
          let loadedClosed = Array.isArray(remoteData.closedTrades) ? remoteData.closedTrades : [];
          let loadedTransactions = Array.isArray(remoteData.transactions) && remoteData.transactions.length > 0
            ? remoteData.transactions.map(normalizeTransaction)
            : transactions;
          let loadedCash = typeof remoteData.cashBalance === 'number' ? remoteData.cashBalance : cashBalance;
          let loadedTickers = Array.isArray(remoteData.tickers) && remoteData.tickers.length > 0
            ? remoteData.tickers
            : tickers;

          // If transactions are available but positions or closed trades are missing/empty, auto-reconcile
          if (loadedTransactions.length > 0 && (loadedPositions.length === 0 || loadedClosed.length === 0)) {
            const report = reconcilePortfolioFromLedger(
              loadedTransactions,
              loadedTickers,
              capitalDeposits,
              loadedPositions
            );
            if (loadedPositions.length === 0 && report.reconciledPositions.length > 0) {
              loadedPositions = report.reconciledPositions;
            }
            if (loadedClosed.length === 0 && report.reconciledClosedTrades.length > 0) {
              loadedClosed = report.reconciledClosedTrades;
            }
            if (loadedCash === 0 && report.reconciledCashBalance > 0) {
              loadedCash = report.reconciledCashBalance;
            }

            // Save healed data back to Firestore
            debouncedSavePortfolioToFirestore({
              positions: loadedPositions,
              closedTrades: loadedClosed,
              transactions: loadedTransactions,
              cashBalance: loadedCash,
              tickers: loadedTickers,
            }, 300);
          }

          setPositions(loadedPositions);
          setClosedTrades(loadedClosed);
          setTransactions(loadedTransactions);
          setCashBalance(loadedCash);
          if (Array.isArray(remoteData.tickers) && remoteData.tickers.length > 0) {
            setTickers(loadedTickers);
          }

          setTimeout(() => {
            isRemoteSyncingRef.current = false;
          }, 100);
        }
      } catch (err) {
        console.warn('Initial Firestore load failed, using local cache:', err);
      } finally {
        setIsInitialized(true);
      }

      // Real-time listener
      try {
        unsubscribe = subscribeToPortfolioFromFirestore((remoteData) => {
          if (!remoteData) return;
          isRemoteSyncingRef.current = true;
          let loadedPositions = Array.isArray(remoteData.positions) ? remoteData.positions : [];
          let loadedClosed = Array.isArray(remoteData.closedTrades) ? remoteData.closedTrades : [];
          let loadedTransactions = Array.isArray(remoteData.transactions)
            ? remoteData.transactions.map(normalizeTransaction)
            : [];

          if (loadedTransactions.length > 0 && (loadedPositions.length === 0 || loadedClosed.length === 0)) {
            const report = reconcilePortfolioFromLedger(loadedTransactions, tickers, capitalDeposits, loadedPositions);
            if (loadedPositions.length === 0) loadedPositions = report.reconciledPositions;
            if (loadedClosed.length === 0) loadedClosed = report.reconciledClosedTrades;
          }

          if (loadedPositions.length > 0) setPositions(loadedPositions);
          if (loadedClosed.length > 0) setClosedTrades(loadedClosed);
          if (loadedTransactions.length > 0) setTransactions(loadedTransactions);
          if (typeof remoteData.cashBalance === 'number' && remoteData.cashBalance > 0) {
            setCashBalance(remoteData.cashBalance);
          }

          setTimeout(() => {
            isRemoteSyncingRef.current = false;
          }, 100);
        });
      } catch (subErr) {
        console.warn('Firestore subscription failed:', subErr);
      }
    }

    initFirestore();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Reconcile Entire Portfolio from Ledger
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
      tickers,
    }, 300);

    return report;
  }, [transactions, tickers, capitalDeposits, positions]);

  // Fallback check: if transactions exist but positions and closed trades are empty after initial load, reconcile
  useEffect(() => {
    if (isInitialized && transactions.length > 0 && positions.length === 0 && closedTrades.length === 0) {
      reconcileLedger();
    }
  }, [isInitialized, transactions.length, positions.length, closedTrades.length, reconcileLedger]);

  // Rehydrate open positions with ticker live quotes and company metadata
  const rehydratePositionsWithTickers = useCallback((posList: Position[], tickerList: EGXTicker[]): Position[] => {
    if (!tickerList || tickerList.length === 0 || !posList || posList.length === 0) return posList;
    const tickerMap = new Map(tickerList.map((t) => [t.ticker.trim().toUpperCase(), t]));
    let hasChanges = false;

    const rehydrated = posList.map((p) => {
      const t = tickerMap.get(p.ticker.trim().toUpperCase());
      if (!t) return p;

      const currentPrice = t.lastPrice > 0 ? t.lastPrice : p.currentPrice;
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

  useEffect(() => {
    setPositions((prev) => rehydratePositionsWithTickers(prev, tickers));
  }, [tickers, rehydratePositionsWithTickers]);

  // Execute a BUY Trade or DCA accumulation
  const addTrade = useCallback((tradeInput: {
    ticker: string;
    companyName: string;
    sector: Sector;
    shares: number;
    price: number;
    fees?: number;
    date: string;
    targetPrice?: number;
    stopLoss?: number;
    notes?: string;
    deductFromCash?: boolean;
    cycleTag?: string;
  }) => {
    const tickerKey = tradeInput.ticker.trim().toUpperCase();
    const cleanShares = Math.round(tradeInput.shares);
    const cleanPrice = Number(tradeInput.price.toFixed(4));
    const cleanFees = Number((tradeInput.fees || 0).toFixed(2));
    const grossCost = cleanShares * cleanPrice;
    const totalOutlay = grossCost + cleanFees;

    // Create normalized transaction
    const newTx: TradeTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'BUY',
      ticker: tickerKey,
      companyName: tradeInput.companyName,
      sector: tradeInput.sector,
      shares: cleanShares,
      price: cleanPrice,
      date: tradeInput.date,
      fees: cleanFees,
      totalAmount: totalOutlay,
      targetPrice: tradeInput.targetPrice,
      stopLoss: tradeInput.stopLoss,
      notes: tradeInput.notes || '',
      cycleTag: tradeInput.cycleTag,
      tradeId: transactions.length + 1,
    };

    const updatedTransactions = [newTx, ...transactions];

    // Update positions: merge with existing position or create new
    let updatedPositions: Position[];
    const existingIndex = positions.findIndex((p) => p.ticker.trim().toUpperCase() === tickerKey);

    if (existingIndex >= 0) {
      const existing = positions[existingIndex];
      const newTotalShares = existing.shares + cleanShares;
      const existingTotalCost = existing.shares * existing.avgBuyPrice;
      const newAvgBuyPrice = Number(((existingTotalCost + grossCost) / newTotalShares).toFixed(4));
      const newTotalFees = Number(((existing.totalFees || 0) + cleanFees).toFixed(2));

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
      const newPos: Position = {
        id: `pos-${tickerKey}-${Date.now()}`,
        ticker: tickerKey,
        companyName: tradeInput.companyName,
        sector: tradeInput.sector,
        shares: cleanShares,
        avgBuyPrice: cleanPrice,
        currentPrice: quoteMatch && quoteMatch.lastPrice > 0 ? quoteMatch.lastPrice : cleanPrice,
        buyDate: tradeInput.date,
        totalFees: cleanFees,
        targetPrice: tradeInput.targetPrice,
        stopLoss: tradeInput.stopLoss,
        notes: tradeInput.notes,
      };
      updatedPositions = [newPos, ...positions];
    }

    const newCash = tradeInput.deductFromCash !== false
      ? Number((cashBalance - totalOutlay).toFixed(2))
      : cashBalance;

    setTransactions(updatedTransactions);
    setPositions(updatedPositions);
    setCashBalance(newCash);

    // Save to Firestore
    appendTransactionToFirestore(newTx, updatedPositions, closedTrades, newCash);

    return newTx;
  }, [transactions, positions, closedTrades, cashBalance, tickers]);

  // Execute a SELL / Exit Trade
  const sellPosition = useCallback((sellInput: {
    position: Position;
    sharesToSell: number;
    sellPrice: number;
    fees?: number;
    sellDate: string;
    addToCash?: boolean;
    notes?: string;
  }) => {
    const { position, sharesToSell, sellPrice, fees = 0, sellDate, addToCash = true, notes } = sellInput;
    const tickerKey = position.ticker.trim().toUpperCase();
    const cleanShares = Math.min(sharesToSell, position.shares);
    const cleanSellPrice = Number(sellPrice.toFixed(4));
    const cleanFees = Number(fees.toFixed(2));

    const grossProceeds = cleanShares * cleanSellPrice;
    const netProceeds = Math.max(0, grossProceeds - cleanFees);

    const costBasisShares = cleanShares * position.avgBuyPrice;
    // Prorate entry fees for sold shares
    const proratedBuyFees = position.shares > 0
      ? (cleanShares / position.shares) * (position.totalFees || 0)
      : 0;
    const totalTradeFees = Number((proratedBuyFees + cleanFees).toFixed(2));
    const costBasisWithFees = costBasisShares + proratedBuyFees;

    const realizedPnlEgp = Number((netProceeds - costBasisWithFees).toFixed(2));
    const realizedPnlPercent = costBasisWithFees > 0
      ? Number(((realizedPnlEgp / costBasisWithFees) * 100).toFixed(2))
      : 0;

    const outcome: 'WIN' | 'LOSS' | 'BREAKEVEN' = realizedPnlEgp > 0.01
      ? 'WIN'
      : realizedPnlEgp < -0.01
      ? 'LOSS'
      : 'BREAKEVEN';

    const entryTime = new Date(position.buyDate).getTime();
    const exitTime = new Date(sellDate).getTime();
    const holdingDays = Math.max(1, Math.round((exitTime - entryTime) / (1000 * 60 * 60 * 24)) || 1);

    // Create ClosedTrade record
    const newClosedTrade: ClosedTrade = {
      id: `closed-${Date.now()}-${tickerKey}`,
      ticker: tickerKey,
      companyName: position.companyName,
      sector: position.sector,
      shares: cleanShares,
      buyPrice: position.avgBuyPrice,
      sellPrice: cleanSellPrice,
      buyDate: position.buyDate,
      sellDate,
      holdingDays,
      buyFees: Number(proratedBuyFees.toFixed(2)),
      sellFees: cleanFees,
      totalFees: totalTradeFees,
      realizedPnlEgp,
      realizedPnlPercent,
      outcome,
      tradeType: 'Swing',
      notes: notes || position.notes,
    };

    // Create SELL transaction record
    const newTx: TradeTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'SELL',
      ticker: tickerKey,
      companyName: position.companyName,
      sector: position.sector,
      shares: cleanShares,
      price: cleanSellPrice,
      date: sellDate,
      fees: cleanFees,
      totalAmount: netProceeds,
      realizedPnlEgp,
      realizedPnlPercent,
      outcome,
      holdingDays,
      notes: notes || '',
      tradeId: transactions.length + 1,
    };

    const updatedTransactions = [newTx, ...transactions];
    const updatedClosedTrades = [newClosedTrade, ...closedTrades];

    // Update or remove position
    let updatedPositions: Position[];
    const remainingShares = position.shares - cleanShares;

    if (remainingShares > 0.001) {
      const remainingFees = Math.max(0, (position.totalFees || 0) - proratedBuyFees);
      updatedPositions = positions.map((p) =>
        p.id === position.id
          ? {
              ...p,
              shares: remainingShares,
              totalFees: Number(remainingFees.toFixed(2)),
            }
          : p
      );
    } else {
      updatedPositions = positions.filter((p) => p.id !== position.id);
    }

    const newCash = addToCash !== false
      ? Number((cashBalance + netProceeds).toFixed(2))
      : cashBalance;

    setTransactions(updatedTransactions);
    setClosedTrades(updatedClosedTrades);
    setPositions(updatedPositions);
    setCashBalance(newCash);

    appendTransactionToFirestore(newTx, updatedPositions, updatedClosedTrades, newCash);

    return { transaction: newTx, closedTrade: newClosedTrade };
  }, [positions, transactions, closedTrades, cashBalance]);

  // Edit Position targets, company name, sector, notes
  const editPosition = useCallback((updatedPosition: Position) => {
    const updated = positions.map((p) => (p.id === updatedPosition.id ? updatedPosition : p));
    setPositions(updated);
    updateFirestorePositions(updated);
  }, [positions]);

  // Delete Position
  const deletePosition = useCallback((positionId: string) => {
    const updated = positions.filter((p) => p.id !== positionId);
    setPositions(updated);
    updateFirestorePositions(updated);
  }, [positions]);

  // Edit Transaction Record and optionally re-reconcile
  const editTransaction = useCallback((updatedTx: TradeTransaction) => {
    const normalized = normalizeTransaction(updatedTx);
    const updatedTransactions = transactions.map((t) => (t.id === normalized.id ? normalized : t));
    setTransactions(updatedTransactions);
    updateFirestoreTransactions(updatedTransactions, positions, closedTrades, cashBalance);
  }, [transactions, positions, closedTrades, cashBalance]);

  // Delete Transaction Record and auto-reconcile
  const deleteTransaction = useCallback((txId: string) => {
    const updatedTransactions = transactions.filter((t) => t.id !== txId);
    setTransactions(updatedTransactions);
    updateFirestoreTransactions(updatedTransactions, positions, closedTrades, cashBalance);
  }, [transactions, positions, closedTrades, cashBalance]);

  // Quick Cash Deposit / Withdrawal / Dividend
  const addCashTransaction = useCallback((amount: number, type: 'DEPOSIT' | 'WITHDRAW' | 'DIVIDEND', notes?: string) => {
    const cleanAmount = Math.abs(amount);
    let newBalance = cashBalance;

    if (type === 'DEPOSIT') {
      newBalance = Number((cashBalance + cleanAmount).toFixed(2));
      setCapitalDeposits((prev) => Number((prev + cleanAmount).toFixed(2)));
    } else if (type === 'WITHDRAW') {
      newBalance = Number((cashBalance - cleanAmount).toFixed(2));
      setCapitalDeposits((prev) => Number((prev - cleanAmount).toFixed(2)));
    } else if (type === 'DIVIDEND') {
      newBalance = Number((cashBalance + cleanAmount).toFixed(2));
    }

    setCashBalance(newBalance);

    // Also record a ledger transaction if dividend
    if (type === 'DIVIDEND' && notes) {
      const divTx: TradeTransaction = {
        id: `tx-div-${Date.now()}`,
        type: 'BUY',
        ticker: 'CASH',
        companyName: notes || 'Cash Dividend',
        sector: 'Banking',
        shares: 1,
        price: cleanAmount,
        fees: 0,
        date: new Date().toISOString().split('T')[0],
        totalAmount: cleanAmount,
        notes: `Cash Dividend: ${notes}`,
      };
      setTransactions((prev) => [divTx, ...prev]);
    }
  }, [cashBalance]);

  // Import Backup Data
  const importBackup = useCallback((backup: {
    positions?: Position[];
    closedTrades?: ClosedTrade[];
    transactions?: TradeTransaction[];
    cashBalance?: number;
    tickers?: EGXTicker[];
  }) => {
    let importedTxs = Array.isArray(backup.transactions) ? backup.transactions.map(normalizeTransaction) : transactions;
    let importedPositions = Array.isArray(backup.positions) ? backup.positions : [];
    let importedClosed = Array.isArray(backup.closedTrades) ? backup.closedTrades : [];
    let importedCash = typeof backup.cashBalance === 'number' ? backup.cashBalance : cashBalance;
    let importedTickers = Array.isArray(backup.tickers) ? backup.tickers : tickers;

    // If transactions are provided but positions or closed trades are missing, auto-reconcile
    if (importedTxs.length > 0 && (importedPositions.length === 0 || importedClosed.length === 0)) {
      const report = reconcilePortfolioFromLedger(importedTxs, importedTickers, capitalDeposits, importedPositions);
      if (importedPositions.length === 0) importedPositions = report.reconciledPositions;
      if (importedClosed.length === 0) importedClosed = report.reconciledClosedTrades;
      if (importedCash === 0) importedCash = report.reconciledCashBalance;
    }

    setPositions(importedPositions);
    setClosedTrades(importedClosed);
    setTransactions(importedTxs);
    setCashBalance(importedCash);
    if (Array.isArray(backup.tickers)) setTickers(importedTickers);

    debouncedSavePortfolioToFirestore({
      positions: importedPositions,
      closedTrades: importedClosed,
      transactions: importedTxs,
      cashBalance: importedCash,
      tickers: importedTickers,
    }, 200);
  }, [transactions, positions, closedTrades, cashBalance, tickers, capitalDeposits]);

  // Restore Default Initial Portfolio Seed
  const restoreInitialState = useCallback(() => {
    setPositions(INITIAL_POSITIONS);
    setClosedTrades(INITIAL_CLOSED_TRADES);
    setTransactions(INITIAL_TRANSACTIONS);
    setCashBalance(INITIAL_CASH_BALANCE);
    setTickers(INITIAL_EGX_TICKERS);
    setCapitalDeposits(INITIAL_CAPITAL_DEPOSITS);

    debouncedSavePortfolioToFirestore({
      positions: INITIAL_POSITIONS,
      closedTrades: INITIAL_CLOSED_TRADES,
      transactions: INITIAL_TRANSACTIONS,
      cashBalance: INITIAL_CASH_BALANCE,
      tickers: INITIAL_EGX_TICKERS,
    }, 200);
  }, []);

  // Update Tickers Directory
  const updateTickers = useCallback((newTickers: EGXTicker[]) => {
    setTickers(newTickers);
    updateFirestoreTickers(newTickers);
  }, []);

  return {
    positions,
    setPositions,
    closedTrades,
    setClosedTrades,
    transactions,
    setTransactions,
    cashBalance,
    setCashBalance,
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
    reconcileLedger,
    importBackup,
    restoreInitialState,
    updateTickers,
  };
}
