import { useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
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
  savePortfolioToFirestore,
  debouncedSavePortfolioToFirestore,
  forceFullSyncToFirestore,
  subscribeToPortfolioFromFirestore,
  updateFirestorePositions,
  updateFirestoreTickers,
  updateFirestoreTransactions,
  updateFirestoreCashBalance,
  flushPendingWriteQueue,
  markLocalMutation,
} from '../services/firestoreStorage';
import { auth, ensureAuthUser } from '../services/firebaseAuth';
import {
  reconcilePortfolioFromLedger,
  getOpenBuyTransactionIdsForTicker,
  ReconciliationReport,
} from '../services/portfolioReconciliation';
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

  // Managed Firestore Load and Snapshot Subscription with Auto-Reconciliation
  useEffect(() => {
    let activeUnsubscribe: (() => void) | null = null;
    let isMounted = true;

    const authUnsub = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;

      // Clean up any existing snapshot listener from a prior auth state
      if (activeUnsubscribe) {
        activeUnsubscribe();
        activeUnsubscribe = null;
      }

      try {
        if (!user) {
          await ensureAuthUser();
        }

        const remoteData = await loadPortfolioFromFirestore();
        if (remoteData && isMounted) {
          isRemoteSyncingRef.current = true;
          let loadedPositions = Array.isArray(remoteData.positions) ? remoteData.positions : [];
          let loadedClosed = Array.isArray(remoteData.closedTrades) ? remoteData.closedTrades : [];

          // Bidirectional merge of transactions so no trade is ever lost
          const txMap = new Map<string, TradeTransaction>();
          if (Array.isArray(remoteData.transactions)) {
            remoteData.transactions.forEach((tx) => {
              if (tx?.id) txMap.set(tx.id, normalizeTransaction(tx));
            });
          }
          transactions.forEach((tx) => {
            if (tx?.id && !txMap.has(tx.id)) {
              txMap.set(tx.id, normalizeTransaction(tx));
            }
          });

          let loadedTransactions = Array.from(txMap.values()).sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          );
          if (loadedTransactions.length === 0) {
            loadedTransactions = transactions;
          }

          let loadedCash = typeof remoteData.cashBalance === 'number' ? remoteData.cashBalance : cashBalance;
          let loadedCapital = typeof remoteData.capitalDeposits === 'number' && remoteData.capitalDeposits > 0
            ? remoteData.capitalDeposits
            : capitalDeposits;
          let loadedTickers = Array.isArray(remoteData.tickers) && remoteData.tickers.length > 0
            ? remoteData.tickers
            : tickers;

          // If transactions are available but positions or closed trades are missing/empty, auto-reconcile
          if (loadedTransactions.length > 0 && (loadedPositions.length === 0 || loadedClosed.length === 0)) {
            const report = reconcilePortfolioFromLedger(
              loadedTransactions,
              loadedTickers,
              loadedCapital,
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
              capitalDeposits: loadedCapital,
              tickers: loadedTickers,
            }, 300);
          }

          setPositions(loadedPositions);
          setClosedTrades(loadedClosed);
          setTransactions(loadedTransactions);
          setCashBalance(loadedCash);
          setCapitalDeposits(loadedCapital);
          if (Array.isArray(remoteData.tickers) && remoteData.tickers.length > 0) {
            setTickers(loadedTickers);
          }

          setTimeout(() => {
            isRemoteSyncingRef.current = false;
          }, 150);
        }
      } catch (err) {
        console.warn('Initial Firestore load failed, using local cache:', err);
      } finally {
        if (isMounted) setIsInitialized(true);
      }

      // Flush any queued offline writes
      try {
        await flushPendingWriteQueue();
      } catch {
        // ignore
      }

      // Start the real-time listener for remote changes
      if (isMounted) {
        try {
          activeUnsubscribe = subscribeToPortfolioFromFirestore((remoteData) => {
            if (!remoteData || !isMounted) return;
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
            if (typeof remoteData.cashBalance === 'number' && remoteData.cashBalance >= 0) {
              setCashBalance(remoteData.cashBalance);
            }
            if (typeof remoteData.capitalDeposits === 'number' && remoteData.capitalDeposits > 0) {
              setCapitalDeposits(remoteData.capitalDeposits);
            }

            setTimeout(() => {
              isRemoteSyncingRef.current = false;
            }, 150);
          });
        } catch (subErr) {
          console.warn('Firestore subscription failed:', subErr);
        }
      }
    });

    return () => {
      isMounted = false;
      if (activeUnsubscribe) activeUnsubscribe();
      authUnsub();
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

  const hasReconciledRef = useRef(false);

  // Force reconciliation once on load to heal any fragmented historical data
  useEffect(() => {
    if (isInitialized && transactions.length > 0 && !hasReconciledRef.current) {
      hasReconciledRef.current = true;
      reconcileLedger();
    }
  }, [isInitialized, transactions.length, reconcileLedger]);

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

    const maxExistingTradeId = transactions.reduce((max, t) => {
      const tid = Number(t.tradeId);
      return !isNaN(tid) && tid > max ? tid : max;
    }, 0);
    const nextTradeId = maxExistingTradeId > 0 ? maxExistingTradeId + 1 : (transactions.length + 1);

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
      tradeId: nextTradeId,
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

    // Save full normalized portfolio to Firestore
    savePortfolioToFirestore({
      positions: updatedPositions,
      closedTrades,
      transactions: updatedTransactions,
      cashBalance: newCash,
      capitalDeposits,
      tickers,
    }, false, 'trade-added');

    return newTx;
  }, [transactions, positions, closedTrades, cashBalance, tickers, capitalDeposits]);

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

    const maxExistingTradeId = transactions.reduce((max, t) => {
      const tid = Number(t.tradeId);
      return !isNaN(tid) && tid > max ? tid : max;
    }, 0);
    const nextTradeId = maxExistingTradeId > 0 ? maxExistingTradeId + 1 : (transactions.length + 1);

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
      tradeId: nextTradeId,
    };

    const updatedTransactions = [newTx, ...transactions];

    const report = reconcilePortfolioFromLedger(updatedTransactions, tickers, capitalDeposits);

    setTransactions(updatedTransactions);
    setClosedTrades(report.reconciledClosedTrades);
    setPositions(report.reconciledPositions);
    setCashBalance(report.reconciledCashBalance);

    updateFirestoreTransactions(
      updatedTransactions,
      report.reconciledPositions,
      report.reconciledClosedTrades,
      report.reconciledCashBalance,
      capitalDeposits
    );

    return { transaction: newTx, closedTrade: report.reconciledClosedTrades.find(t => t.ticker === tickerKey) };
  }, [positions, transactions, closedTrades, cashBalance, tickers, capitalDeposits]);

  // Edit Position targets, company name, sector, notes
  const editPosition = useCallback((updatedPosition: Position) => {
    const updated = positions.map((p) => (p.id === updatedPosition.id ? updatedPosition : p));
    setPositions(updated);
    updateFirestorePositions(updated);
  }, [positions]);

  // Delete Position and its associated open BUY transactions, auto-reconciling cash and ledger
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
    
    // Auto-reconcile portfolio from remaining ledger
    const report = reconcilePortfolioFromLedger(updatedTransactions, tickers, capitalDeposits);

    setTransactions(updatedTransactions);
    setPositions(report.reconciledPositions);
    setClosedTrades(report.reconciledClosedTrades);
    setCashBalance(report.reconciledCashBalance);

    updateFirestoreTransactions(
      updatedTransactions,
      report.reconciledPositions,
      report.reconciledClosedTrades,
      report.reconciledCashBalance,
      capitalDeposits
    );

    return updatedTransactions;
  }, [positions, transactions, tickers, capitalDeposits]);

  // Edit Transaction Record and auto-reconcile entire portfolio and cash balance
  const editTransaction = useCallback((updatedTx: TradeTransaction) => {
    const normalized = normalizeTransaction(updatedTx);
    const updatedTransactions = transactions.map((t) => (t.id === normalized.id ? normalized : t));
    
    const report = reconcilePortfolioFromLedger(updatedTransactions, tickers, capitalDeposits);

    setTransactions(updatedTransactions);
    setPositions(report.reconciledPositions);
    setClosedTrades(report.reconciledClosedTrades);
    setCashBalance(report.reconciledCashBalance);

    updateFirestoreTransactions(
      updatedTransactions,
      report.reconciledPositions,
      report.reconciledClosedTrades,
      report.reconciledCashBalance,
      capitalDeposits
    );

    return updatedTransactions;
  }, [transactions, tickers, capitalDeposits]);

  // Delete Transaction Record and auto-reconcile entire portfolio and cash balance
  const deleteTransaction = useCallback((txId: string) => {
    const updatedTransactions = transactions.filter((t) => t.id !== txId);
    
    const report = reconcilePortfolioFromLedger(updatedTransactions, tickers, capitalDeposits);

    setTransactions(updatedTransactions);
    setPositions(report.reconciledPositions);
    setClosedTrades(report.reconciledClosedTrades);
    setCashBalance(report.reconciledCashBalance);

    updateFirestoreTransactions(
      updatedTransactions,
      report.reconciledPositions,
      report.reconciledClosedTrades,
      report.reconciledCashBalance,
      capitalDeposits
    );

    return updatedTransactions;
  }, [transactions, tickers, capitalDeposits]);

  // Quick Cash Deposit / Withdrawal / Dividend
  const addCashTransaction = useCallback((amount: number, type: 'DEPOSIT' | 'WITHDRAW' | 'DIVIDEND', notes?: string) => {
    const cleanAmount = Math.abs(amount);
    let newBalance = cashBalance;
    let newCapital = capitalDeposits;

    if (type === 'DEPOSIT') {
      newBalance = Number((cashBalance + cleanAmount).toFixed(2));
      newCapital = Number((capitalDeposits + cleanAmount).toFixed(2));
      setCapitalDeposits(newCapital);
    } else if (type === 'WITHDRAW') {
      newBalance = Number((cashBalance - cleanAmount).toFixed(2));
      newCapital = Number((capitalDeposits - cleanAmount).toFixed(2));
      setCapitalDeposits(newCapital);
    } else if (type === 'DIVIDEND') {
      newBalance = Number((cashBalance + cleanAmount).toFixed(2));
    }

    setCashBalance(newBalance);

    let updatedTxList = transactions;
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
      updatedTxList = [divTx, ...transactions];
      setTransactions(updatedTxList);
    }

    // Persist cash and ledger updates to Firestore immediately
    savePortfolioToFirestore({
      positions,
      closedTrades,
      transactions: updatedTxList,
      cashBalance: newBalance,
      capitalDeposits: newCapital,
      tickers,
    }, false, 'cash-transaction');
  }, [cashBalance, capitalDeposits, transactions, positions, closedTrades, tickers]);

  // Import Backup Data with Immediate Authoritative Firestore Sync
  const importBackup = useCallback(async (backup: {
    positions?: Position[];
    closedTrades?: ClosedTrade[];
    transactions?: TradeTransaction[];
    cashBalance?: number;
    capitalDeposits?: number;
    tickers?: EGXTicker[];
  }) => {
    let importedTxs = Array.isArray(backup.transactions)
      ? backup.transactions.map(normalizeTransaction)
      : transactions;
    let importedPositions = Array.isArray(backup.positions) ? backup.positions : [];
    let importedClosed = Array.isArray(backup.closedTrades) ? backup.closedTrades : [];
    let importedCash = typeof backup.cashBalance === 'number' ? backup.cashBalance : cashBalance;
    let importedCapital = typeof backup.capitalDeposits === 'number' && backup.capitalDeposits > 0
      ? backup.capitalDeposits
      : capitalDeposits;
    let importedTickers = Array.isArray(backup.tickers) && backup.tickers.length > 0 ? backup.tickers : tickers;

    // If transactions are provided but positions or closed trades are missing, auto-reconcile
    if (importedTxs.length > 0 && (importedPositions.length === 0 || importedClosed.length === 0)) {
      const report = reconcilePortfolioFromLedger(importedTxs, importedTickers, importedCapital, importedPositions);
      if (importedPositions.length === 0 && report.reconciledPositions.length > 0) {
        importedPositions = report.reconciledPositions;
      }
      if (importedClosed.length === 0 && report.reconciledClosedTrades.length > 0) {
        importedClosed = report.reconciledClosedTrades;
      }
      if (importedCash === 0 && report.reconciledCashBalance > 0) {
        importedCash = report.reconciledCashBalance;
      }
    }

    setPositions(importedPositions);
    setClosedTrades(importedClosed);
    setTransactions(importedTxs);
    setCashBalance(importedCash);
    setCapitalDeposits(importedCapital);
    if (Array.isArray(backup.tickers) && backup.tickers.length > 0) {
      setTickers(importedTickers);
    }

    // Persist to local storage immediately
    try {
      localStorage.setItem(STORAGE_KEY_POSITIONS, JSON.stringify(importedPositions));
      localStorage.setItem(STORAGE_KEY_CLOSED, JSON.stringify(importedClosed));
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(importedTxs));
      localStorage.setItem(STORAGE_KEY_CASH, JSON.stringify(importedCash));
      localStorage.setItem(STORAGE_KEY_CAPITAL, JSON.stringify(importedCapital));
      if (Array.isArray(backup.tickers) && backup.tickers.length > 0) {
        localStorage.setItem(STORAGE_KEY_TICKERS, JSON.stringify(importedTickers));
      }
    } catch (e) {
      console.warn('LocalStorage save failed on import:', e);
    }

    // Lock out incoming snapshot echoes so remote doesn't revert state
    markLocalMutation(4000);

    // Save authoritatively to Firestore
    await forceFullSyncToFirestore({
      positions: importedPositions,
      closedTrades: importedClosed,
      transactions: importedTxs,
      cashBalance: importedCash,
      capitalDeposits: importedCapital,
      tickers: importedTickers,
    });
  }, [transactions, positions, closedTrades, cashBalance, tickers, capitalDeposits]);

  // Restore Default Initial Portfolio Seed
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

    await forceFullSyncToFirestore({
      positions: INITIAL_POSITIONS,
      closedTrades: INITIAL_CLOSED_TRADES,
      transactions: INITIAL_TRANSACTIONS,
      cashBalance: INITIAL_CASH_BALANCE,
      capitalDeposits: INITIAL_CAPITAL_DEPOSITS,
      tickers: INITIAL_EGX_TICKERS,
    });
  }, []);

  // Update Tickers Directory in local state & localStorage (prevents quota depletion from price ticks)
  const updateTickers = useCallback((newTickers: EGXTicker[]) => {
    setTickers(newTickers);
  }, []);

  // Explicitly update and calibrate cash balance, persisting to local and Firestore
  const updateCashBalance = useCallback((newCash: number) => {
    const validCash = Math.max(0, Number(newCash) || 0);
    setCashBalance(validCash);

    // Save to localStorage immediately
    try {
      localStorage.setItem(STORAGE_KEY_CASH, JSON.stringify(validCash));
    } catch {
      // ignore
    }

    // Direct patch to Firestore so mobile and desktop sync immediately
    updateFirestoreCashBalance(validCash, capitalDeposits);
  }, [capitalDeposits]);

  // Force a manual full sync to Firestore (bidirectional merge and bypass quota flags)
  const forceSync = useCallback(async () => {
    try {
      await ensureAuthUser();
      // 1. Pull latest from Firestore first
      const remote = await loadPortfolioFromFirestore();
      let mergedPositions = positions;
      let mergedClosed = closedTrades;
      let mergedTxs = transactions;
      let mergedCash = cashBalance;
      let mergedTickers = tickers;
      let mergedCapital = capitalDeposits;

      if (remote) {
        // Merge transactions
        const txMap = new Map<string, TradeTransaction>();
        (remote.transactions || []).forEach((t) => {
          if (t?.id) txMap.set(t.id, normalizeTransaction(t));
        });
        transactions.forEach((t) => {
          if (t?.id && !txMap.has(t.id)) {
            txMap.set(t.id, normalizeTransaction(t));
          }
        });
        mergedTxs = Array.from(txMap.values()).sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // If remote has positions or closed trades, prefer remote
        if (Array.isArray(remote.positions) && remote.positions.length > 0) {
          mergedPositions = remote.positions;
        }
        if (Array.isArray(remote.closedTrades) && remote.closedTrades.length > 0) {
          mergedClosed = remote.closedTrades;
        }
        if (typeof remote.cashBalance === 'number' && remote.cashBalance >= 0) {
          mergedCash = remote.cashBalance;
        }
        if (typeof remote.capitalDeposits === 'number' && remote.capitalDeposits > 0) {
          mergedCapital = remote.capitalDeposits;
        }

        // Update local state immediately
        setTransactions(mergedTxs);
        setPositions(mergedPositions);
        setClosedTrades(mergedClosed);
        setCashBalance(mergedCash);
        setCapitalDeposits(mergedCapital);
      }

      // 2. Save full merged payload to Firestore and clear quota exceeded flags
      const success = await forceFullSyncToFirestore({
        positions: mergedPositions,
        closedTrades: mergedClosed,
        transactions: mergedTxs,
        cashBalance: mergedCash,
        capitalDeposits: mergedCapital,
        tickers: mergedTickers,
      });

      return success;
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
    reconcileLedger,
    importBackup,
    restoreInitialState,
    updateTickers,
    forceSync,
  };
}
