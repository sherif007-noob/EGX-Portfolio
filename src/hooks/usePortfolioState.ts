import { selectPositionQuote } from '../services/positionQuote';
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
  forceFullSyncToFirestore,
  subscribeToPortfolioFromFirestore,
  updateFirestorePositions,
  updateFirestoreTickers,
  updateFirestoreTransactions,
  flushPendingWriteQueue,
} from '../services/firestoreStorage';
import { getSupabaseBrowserClient } from '../services/supabaseBrowser';
import {
  reconcilePortfolioFromLedger,
  getOpenBuyTransactionIdsForTicker,
} from '../services/portfolioReconciliation';
import { normalizeTransaction } from '../utils/portfolioMetrics';
import {
  prepareCashBalanceAdjustmentMutation,
  prepareCashEntryMutation,
  prepareCashEventMutation,
  prepareLedgerReconciliationMutation,
  prepareLedgerSnapshotRestoreMutation,
  preparePortfolioRestoreMutation,
  prepareTransactionDeleteMutation,
  prepareTransactionEditMutation,
  type PortfolioRestoreInput,
} from '../services/ledgerWorkflowMutations';
import {
  prepareOcrBatchMutation,
  type OcrTradeInput,
} from '../services/ocrLedgerMutations';
import { resolveTickerFromDirectory } from '../services/tickerRegistry';
import { VISUAL_REGRESSION_MODE } from '../utils/visualRegressionMode';
import {
  createLedgerMutationExecutor,
  type CanonicalLedgerSnapshot,
} from '../services/ledgerMutationService';
import {
  prepareBuyTradeMutation,
  prepareSellTradeMutation,
} from '../services/tradeLedgerMutations';
import {
  VISUAL_REGRESSION_CAPITAL_DEPOSITS,
  VISUAL_REGRESSION_CASH_BALANCE,
  VISUAL_REGRESSION_CLOSED_TRADES,
  VISUAL_REGRESSION_POSITIONS,
  VISUAL_REGRESSION_TICKERS,
  VISUAL_REGRESSION_TRANSACTIONS,
} from '../data/visualRegressionFixture';

const STORAGE_KEY_POSITIONS = 'egx_pwa_positions_v3_reconciled';
const STORAGE_KEY_CLOSED = 'egx_pwa_closed_trades_v3_reconciled';
const STORAGE_KEY_CASH = 'egx_pwa_cash_balance_v3_reconciled';
const STORAGE_KEY_TICKERS = 'egx_pwa_tickers_directory_v3_reconciled';
const STORAGE_KEY_TRANSACTIONS = 'egx_pwa_transactions_v3_reconciled';
const STORAGE_KEY_CAPITAL = 'egx_pwa_capital_deposits_v1';

function rehydrateTransactionMetadata(
  transactionList: TradeTransaction[],
  tickerList: EGXTicker[],
): TradeTransaction[] {
  if (!transactionList.length || !tickerList.length) return transactionList;
  const tickerMap = new Map(tickerList.map((ticker) => [ticker.ticker.trim().toUpperCase(), ticker]));
  let changed = false;

  const next = transactionList.map((transaction) => {
    if (transaction.ticker.trim().toUpperCase() === 'CASH') return transaction;
    const canonicalTicker = resolveTickerFromDirectory(transaction.ticker, tickerList);
    const ticker = tickerMap.get(canonicalTicker);
    if (!ticker) return transaction;

    const companyName = ticker.nameEn || transaction.companyName;
    const sector = ticker.sector !== 'Other' ? ticker.sector : transaction.sector;
    if (
      transaction.ticker === canonicalTicker &&
      transaction.companyName === companyName &&
      transaction.sector === sector
    ) return transaction;

    changed = true;
    return { ...transaction, ticker: canonicalTicker, companyName, sector };
  });

  return changed ? next : transactionList;
}

function rehydrateClosedTradeMetadata(
  tradeList: ClosedTrade[],
  tickerList: EGXTicker[],
): ClosedTrade[] {
  if (!tradeList.length || !tickerList.length) return tradeList;
  const tickerMap = new Map(tickerList.map((ticker) => [ticker.ticker.trim().toUpperCase(), ticker]));
  let changed = false;

  const next = tradeList.map((trade) => {
    const canonicalTicker = resolveTickerFromDirectory(trade.ticker, tickerList);
    const ticker = tickerMap.get(canonicalTicker);
    if (!ticker) return trade;

    const companyName = ticker.nameEn || trade.companyName;
    const sector = ticker.sector !== 'Other' ? ticker.sector : trade.sector;
    if (
      trade.ticker === canonicalTicker &&
      trade.companyName === companyName &&
      trade.sector === sector
    ) return trade;

    changed = true;
    return { ...trade, ticker: canonicalTicker, companyName, sector };
  });

  return changed ? next : tradeList;
}

export function usePortfolioState() {
  const [tickers, setTickers] = useState<EGXTicker[]>(() => {
    if (VISUAL_REGRESSION_MODE) return VISUAL_REGRESSION_TICKERS.map((ticker) => ({ ...ticker }));
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TICKERS);
      return saved ? mergeTickerDirectoryWithBaseline(JSON.parse(saved)) : INITIAL_EGX_TICKERS;
    } catch {
      return INITIAL_EGX_TICKERS;
    }
  });

  const [capitalDeposits, setCapitalDeposits] = useState<number>(() => {
    if (VISUAL_REGRESSION_MODE) return VISUAL_REGRESSION_CAPITAL_DEPOSITS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CAPITAL);
      return saved ? JSON.parse(saved) : INITIAL_CAPITAL_DEPOSITS;
    } catch {
      return INITIAL_CAPITAL_DEPOSITS;
    }
  });

  const [transactions, setTransactions] = useState<TradeTransaction[]>(() => {
    if (VISUAL_REGRESSION_MODE) return VISUAL_REGRESSION_TRANSACTIONS.map((transaction) => ({ ...transaction }));
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
      const parsed = saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
      return Array.isArray(parsed) && parsed.length > 0
        ? rehydrateTransactionMetadata(parsed.map(normalizeTransaction), tickers)
        : rehydrateTransactionMetadata(INITIAL_TRANSACTIONS, tickers);
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  });

  const [positions, setPositions] = useState<Position[]>(() => {
    if (VISUAL_REGRESSION_MODE) return VISUAL_REGRESSION_POSITIONS.map((position) => ({ ...position }));
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
    if (VISUAL_REGRESSION_MODE) return VISUAL_REGRESSION_CLOSED_TRADES.map((trade) => ({ ...trade }));
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
    if (VISUAL_REGRESSION_MODE) return VISUAL_REGRESSION_CASH_BALANCE;
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

  const [isInitialized, setIsInitialized] = useState(VISUAL_REGRESSION_MODE);
  const isRemoteSyncingRef = useRef(false);
  const financialMutationExecutorRef = useRef<ReturnType<typeof createLedgerMutationExecutor> | null>(null);
  if (!financialMutationExecutorRef.current) {
    financialMutationExecutorRef.current = createLedgerMutationExecutor();
  }

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
    if (VISUAL_REGRESSION_MODE) return;

    let activeUnsubscribe: (() => void) | null = null;
    let isMounted = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const initializeRemotePortfolio = async () => {
      try {
        const remoteData = await loadPortfolioFromFirestore();
        if (!remoteData) throw new Error('Authoritative portfolio is unavailable.');
        if (remoteData && isMounted) {
          isRemoteSyncingRef.current = true;
          let loadedPositions = Array.isArray(remoteData.positions) ? remoteData.positions : [];
          let loadedClosed = Array.isArray(remoteData.closedTrades) ? remoteData.closedTrades : [];

          let loadedTransactions = Array.isArray(remoteData.transactions)
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
          loadedTransactions = rehydrateTransactionMetadata(loadedTransactions, loadedTickers);

          if (loadedTransactions.length > 0 && (loadedPositions.length === 0 || loadedClosed.length === 0)) {
            const report = reconcilePortfolioFromLedger(loadedTransactions, loadedTickers, loadedCapital, loadedPositions);
            if (loadedPositions.length === 0) loadedPositions = report.reconciledPositions;
            if (loadedClosed.length === 0) loadedClosed = report.reconciledClosedTrades;
            if (loadedCash === 0) loadedCash = report.reconciledCashBalance;
          }

          setIsInitialized(true);
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
        if (isMounted) retryTimer = setTimeout(initializeRemotePortfolio, 30_000);
        return;
      }

      try { await flushPendingWriteQueue(); } catch { /* ignore */ }

      if (!isMounted) return;
      try {
        activeUnsubscribe = subscribeToPortfolioFromFirestore((remoteData) => {
          if (!remoteData || !isMounted) return;
          isRemoteSyncingRef.current = true;
          let loadedPositions = Array.isArray(remoteData.positions) ? remoteData.positions : [];
          let loadedClosed = Array.isArray(remoteData.closedTrades) ? remoteData.closedTrades : [];
          const loadedTickers = mergeTickerDirectoryWithBaseline(
            Array.isArray(remoteData.tickers) && remoteData.tickers.length > 0
              ? remoteData.tickers
              : tickers,
          );
          const loadedTransactions = rehydrateTransactionMetadata(
            Array.isArray(remoteData.transactions)
              ? remoteData.transactions.map(normalizeTransaction)
              : [],
            loadedTickers,
          );

          if (loadedTransactions.length > 0 && (loadedPositions.length === 0 || loadedClosed.length === 0)) {
            const report = reconcilePortfolioFromLedger(loadedTransactions, loadedTickers, capitalDeposits, loadedPositions);
            if (loadedPositions.length === 0) loadedPositions = report.reconciledPositions;
            if (loadedClosed.length === 0) loadedClosed = report.reconciledClosedTrades;
          }

          setPositions(previous => loadedPositions.map(incoming => {
            const local = previous.find(p => p.ticker === incoming.ticker);
            const quote = selectPositionQuote(incoming, local ? {
              ticker: local.ticker, lastPrice: local.currentPrice, change: local.dayChange,
              changePercent: local.dayChangePercent, priceUpdatedAt: local.priceUpdatedAt,
            } as EGXTicker : undefined);
            return { ...incoming, ...quote };
          }));
          setClosedTrades(loadedClosed);
          setTransactions(loadedTransactions);
          if (Array.isArray(remoteData.tickers) && remoteData.tickers.length > 0) setTickers(previous => loadedTickers.map(incoming => {
            const local = previous.find(t => t.ticker === incoming.ticker);
            if (local && (Date.parse(local.priceUpdatedAt ?? '') || 0) > (Date.parse(incoming.priceUpdatedAt ?? '') || 0)) {
              return { ...incoming, lastPrice: local.lastPrice, change: local.change,
                changePercent: local.changePercent, priceUpdatedAt: local.priceUpdatedAt };
            }
            return incoming;
          }));
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
      clearTimeout(retryTimer);
      if (activeUnsubscribe) activeUnsubscribe();
    };
  }, []);

  const rehydratePositionsWithTickers = useCallback((posList: Position[], tickerList: EGXTicker[]): Position[] => {
    if (!tickerList?.length || !posList?.length) return posList;
    const tickerMap = new Map(tickerList.map((t) => [t.ticker.trim().toUpperCase(), t]));
    let hasChanges = false;
    const rehydrated = posList.map((p) => {
      const canonicalTicker = resolveTickerFromDirectory(p.ticker, tickerList);
      const t = tickerMap.get(canonicalTicker);
      if (!t) return p;
      const quote = selectPositionQuote(p, t);
      const currentPrice = quote.currentPrice;
      const targetPrice = p.targetPrice ?? t.targetPrice;
      const stopLoss = p.stopLoss ?? t.stopLoss;
      const companyName = t.nameEn || p.companyName || canonicalTicker;
      const sector = t.sector !== 'Other' ? t.sector : (p.sector || 'Other');
      if (
        p.priceUpdatedAt !== quote.priceUpdatedAt ||
        p.dayChange !== quote.dayChange ||
        p.dayChangePercent !== quote.dayChangePercent ||
        p.ticker !== canonicalTicker ||
        Math.abs((p.currentPrice || 0) - currentPrice) > 0.0001 ||
        p.targetPrice !== targetPrice ||
        p.stopLoss !== stopLoss ||
        p.companyName !== companyName ||
        p.sector !== sector
      ) {
        hasChanges = true;
        return { ...p, ...quote, ticker: canonicalTicker, currentPrice, targetPrice, stopLoss, companyName, sector };
      }
      return p;
    });
    return hasChanges ? rehydrated : posList;
  }, []);

  useEffect(() => {
    setPositions((prev) => rehydratePositionsWithTickers(prev, tickers));
    setTransactions((prev) => rehydrateTransactionMetadata(prev, tickers));
    setClosedTrades((prev) => rehydrateClosedTradeMetadata(prev, tickers));
  }, [tickers, rehydratePositionsWithTickers]);

  const applyLedgerSnapshot = useCallback((next: CanonicalLedgerSnapshot) => {
    setTransactions(next.transactions);
    setPositions(next.positions);
    setClosedTrades(next.closedTrades);
    setCashBalance(next.cashBalance);
    setCapitalDeposits(next.capitalDeposits);
  }, []);

  const currentLedgerSnapshot = useCallback((): CanonicalLedgerSnapshot => ({
    transactions,
    positions,
    closedTrades,
    cashBalance,
    capitalDeposits,
    tickers,
  }), [transactions, positions, closedTrades, cashBalance, capitalDeposits, tickers]);

  const executePreparedMutation = useCallback(async <T,>(
    kind: string,
    prepare: (current: Readonly<CanonicalLedgerSnapshot>) => import('../services/ledgerMutationService').LedgerMutationPreparation<T>,
  ) => {
    const executor = financialMutationExecutorRef.current!;
    return executor.execute<T>({
      kind,
      current: currentLedgerSnapshot(),
      prepare,
      apply: (snapshot) => applyLedgerSnapshot(snapshot),
    });
  }, [currentLedgerSnapshot, applyLedgerSnapshot]);

  const reconcileLedger = useCallback(() => executePreparedMutation(
    'RECONCILE_LEDGER',
    (current) => prepareLedgerReconciliationMutation(current),
  ), [executePreparedMutation]);

  const addTrade = useCallback(async (tradeInput: {
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
    const executor = financialMutationExecutorRef.current!;
    return executor.execute<TradeTransaction>({
      kind: 'BUY',
      current: currentLedgerSnapshot(),
      prepare: (current) => prepareBuyTradeMutation(current, {
        transactionId: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ...tradeInput,
      }),
      apply: (snapshot) => applyLedgerSnapshot(snapshot),
    });
  }, [currentLedgerSnapshot, applyLedgerSnapshot]);

  const sellPosition = useCallback(async (sellInput: {
    position: Position;
    sharesToSell: number;
    sellPrice: number;
    fees?: number;
    sellDate: string;
    executedAt?: string;
    addToCash?: boolean;
    notes?: string;
  }) => {
    const executor = financialMutationExecutorRef.current!;
    return executor.execute<TradeTransaction>({
      kind: 'SELL',
      current: currentLedgerSnapshot(),
      prepare: (current) => prepareSellTradeMutation(current, {
        transactionId: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        positionId: sellInput.position.id,
        sharesToSell: sellInput.sharesToSell,
        sellPrice: sellInput.sellPrice,
        fees: sellInput.fees,
        sellDate: sellInput.sellDate,
        executedAt: sellInput.executedAt,
        addToCash: sellInput.addToCash,
        notes: sellInput.notes,
      }),
      apply: (snapshot) => applyLedgerSnapshot(snapshot),
    });
  }, [currentLedgerSnapshot, applyLedgerSnapshot]);

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

  const editTransaction = useCallback((updatedTx: TradeTransaction) => executePreparedMutation(
    'EDIT_TRANSACTION',
    (current) => prepareTransactionEditMutation(current, updatedTx),
  ), [executePreparedMutation]);

  const deleteTransaction = useCallback((transactionId: string) => executePreparedMutation(
    'DELETE_TRANSACTION',
    (current) => prepareTransactionDeleteMutation(current, transactionId),
  ), [executePreparedMutation]);

  const commitCashEvent = useCallback((
    kind: 'DEPOSIT' | 'WITHDRAWAL' | 'DIVIDEND' | 'CASH_ADJUSTMENT',
    amount: number,
    notes?: string,
    date?: string,
  ) => executePreparedMutation(
    `CASH_${kind}`,
    (current) => prepareCashEventMutation(current, kind, amount, notes, date),
  ), [executePreparedMutation]);

  const addCashTransaction = useCallback(async (
    amount: number,
    type: 'DEPOSIT' | 'WITHDRAW' | 'DIVIDEND',
    notes?: string,
    date?: string,
  ): Promise<boolean> => {
    const result = await commitCashEvent(type === 'WITHDRAW' ? 'WITHDRAWAL' : type, amount, notes, date);
    if ('error' in result) {
      console.error('[Financial mutation] Cash add failed:', result.error);
      return false;
    }
    return true;
  }, [commitCashEvent]);

  const editCashTransaction = useCallback(async (transaction: CashTransaction): Promise<boolean> => {
    const result = await executePreparedMutation(
      'EDIT_CASH_TRANSACTION',
      (current) => prepareCashEntryMutation(current, transaction.id, transaction),
    );
    if ('error' in result) {
      console.error('[Financial mutation] Cash edit failed:', result.error);
      return false;
    }
    return true;
  }, [executePreparedMutation]);

  const deleteCashTransaction = useCallback(async (transactionId: string): Promise<boolean> => {
    const result = await executePreparedMutation(
      'DELETE_CASH_TRANSACTION',
      (current) => prepareCashEntryMutation(current, transactionId, null),
    );
    if ('error' in result) {
      console.error('[Financial mutation] Cash delete failed:', result.error);
      return false;
    }
    return true;
  }, [executePreparedMutation]);

  const importBackup = useCallback((backup: PortfolioRestoreInput) => executePreparedMutation(
    'RESTORE_PORTFOLIO',
    (current) => preparePortfolioRestoreMutation(current, backup),
  ), [executePreparedMutation]);

  const importOcrBatch = useCallback((trades: OcrTradeInput[]) => executePreparedMutation(
    'OCR_BATCH_IMPORT',
    (current) => prepareOcrBatchMutation(current, trades),
  ), [executePreparedMutation]);

  const restoreLedgerSnapshot = useCallback((restore: {
    transactions: TradeTransaction[];
    capitalDeposits: number;
    positions?: Position[];
  }) => executePreparedMutation(
    'RESTORE_LEDGER_SNAPSHOT',
    (current) => prepareLedgerSnapshotRestoreMutation(current, restore),
  ), [executePreparedMutation]);

  const restoreInitialState = useCallback(() => importBackup({
    positions: INITIAL_POSITIONS,
    closedTrades: INITIAL_CLOSED_TRADES,
    transactions: INITIAL_TRANSACTIONS,
    cashBalance: INITIAL_CASH_BALANCE,
    capitalDeposits: INITIAL_CAPITAL_DEPOSITS,
    tickers: INITIAL_EGX_TICKERS,
  }), [importBackup]);

  const updateTickers = useCallback((newTickers: EGXTicker[]) => setTickers(newTickers), []);

  const updateCashBalance = useCallback(async (newCash: number): Promise<boolean> => {
    const result = await executePreparedMutation(
      'CASH_ADJUSTMENT',
      (current) => prepareCashBalanceAdjustmentMutation(current, newCash),
    );
    if ('error' in result) {
      console.error('[Financial mutation] Cash adjustment failed:', result.error);
      return false;
    }
    return true;
  }, [executePreparedMutation]);

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
    importOcrBatch,
    restoreLedgerSnapshot,
    restoreInitialState,
    updateTickers,
    forceSync,
  };
}
