import { useCallback, useRef } from 'react';
import type {
  CashTransaction,
  Position,
  Sector,
  TradeTransaction,
} from '../../../types';
import {
  createLedgerMutationExecutor,
  prepareBonusSharesMutation,
  prepareBuyTradeMutation,
  prepareCashBalanceAdjustmentMutation,
  prepareCashEntryMutation,
  prepareCashEventMutation,
  prepareLedgerReconciliationMutation,
  prepareLedgerSnapshotRestoreMutation,
  preparePortfolioRestoreMutation,
  prepareSellTradeMutation,
  prepareTransactionDeleteMutation,
  prepareTransactionEditMutation,
  type CanonicalLedgerSnapshot,
  type LedgerMutationPreparation,
  type PortfolioRestoreInput,
} from '../../../domain/accounting';
import {
  prepareOcrBatchMutation,
  type OcrTradeInput,
} from '../../../integrations/ocr';
import {
  INITIAL_CAPITAL_DEPOSITS,
  INITIAL_CASH_BALANCE,
  INITIAL_CLOSED_TRADES,
  INITIAL_POSITIONS,
  INITIAL_TRANSACTIONS,
} from '../../../data/initialPortfolio';
import { INITIAL_EGX_TICKERS } from '../../../data/egxTickers';
import type { PortfolioLocalState } from '../state/usePortfolioLocalState';

export interface BuyTradeInput {
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
  cycleTag?: string;
}

export interface BonusSharesInput {
  position: Position;
  awardedShares: number;
  effectiveDate: string;
  executedAt?: string;
  ratio?: number;
  reference?: string;
  notes?: string;
}

export interface SellTradeInput {
  position: Position;
  sharesToSell: number;
  sellPrice: number;
  fees?: number;
  sellDate: string;
  executedAt?: string;
  notes?: string;
}

export function usePortfolioLedgerMutations(state: PortfolioLocalState) {
  const executorRef = useRef<ReturnType<typeof createLedgerMutationExecutor> | null>(null);
  if (!executorRef.current) executorRef.current = createLedgerMutationExecutor();

  const renderedSnapshot: CanonicalLedgerSnapshot = {
    transactions: state.transactions,
    positions: state.positions,
    closedTrades: state.closedTrades,
    cashBalance: state.cashBalance,
    capitalDeposits: state.capitalDeposits,
    tickers: state.tickers,
  };
  const latestLedgerSnapshotRef = useRef<CanonicalLedgerSnapshot>(renderedSnapshot);
  latestLedgerSnapshotRef.current = renderedSnapshot;

  const applyLedgerSnapshot = useCallback((next: CanonicalLedgerSnapshot) => {
    // Advance the mutation source synchronously. React state application is batched,
    // so a caller can legitimately await one mutation and start another before the
    // next render. The second mutation must prepare from the persisted first snapshot,
    // never the stale render that preceded it.
    latestLedgerSnapshotRef.current = next;
    state.setTransactions(next.transactions);
    state.setPositions(next.positions);
    state.setClosedTrades(next.closedTrades);
    state.setCashBalance(next.cashBalance);
    state.setCapitalDeposits(next.capitalDeposits);
  }, [
    state.setCapitalDeposits,
    state.setCashBalance,
    state.setClosedTrades,
    state.setPositions,
    state.setTransactions,
  ]);

  const currentLedgerSnapshot = useCallback(
    (): CanonicalLedgerSnapshot => latestLedgerSnapshotRef.current,
    [],
  );

  const executePreparedMutation = useCallback(async <T,>(
    kind: string,
    prepare: (current: Readonly<CanonicalLedgerSnapshot>) => LedgerMutationPreparation<T>,
  ) => executorRef.current!.execute<T>({
    kind,
    current: currentLedgerSnapshot(),
    prepare,
    apply: (snapshot) => applyLedgerSnapshot(snapshot),
  }), [applyLedgerSnapshot, currentLedgerSnapshot]);

  const reconcileLedger = useCallback(() => executePreparedMutation(
    'RECONCILE_LEDGER',
    (current) => prepareLedgerReconciliationMutation(current),
  ), [executePreparedMutation]);

  const addTrade = useCallback((tradeInput: BuyTradeInput) => executePreparedMutation<TradeTransaction>(
    'BUY',
    (current) => prepareBuyTradeMutation(current, {
      transactionId: `tx-${crypto.randomUUID()}`,
      ...tradeInput,
    }),
  ), [executePreparedMutation]);

  const addBonusShares = useCallback((input: BonusSharesInput) => executePreparedMutation<TradeTransaction>(
    'BONUS_SHARES',
    (current) => prepareBonusSharesMutation(current, {
      transactionId: `ca-${crypto.randomUUID()}`,
      positionId: input.position.id,
      awardedShares: input.awardedShares,
      effectiveDate: input.effectiveDate,
      executedAt: input.executedAt,
      ratio: input.ratio,
      reference: input.reference,
      notes: input.notes,
    }),
  ), [executePreparedMutation]);

  const sellPosition = useCallback((sellInput: SellTradeInput) => executePreparedMutation<TradeTransaction>(
    'SELL',
    (current) => prepareSellTradeMutation(current, {
      transactionId: `tx-${crypto.randomUUID()}`,
      positionId: sellInput.position.id,
      sharesToSell: sellInput.sharesToSell,
      sellPrice: sellInput.sellPrice,
      fees: sellInput.fees,
      sellDate: sellInput.sellDate,
      executedAt: sellInput.executedAt,
      notes: sellInput.notes,
    }),
  ), [executePreparedMutation]);

  const editTransaction = useCallback((updated: TradeTransaction) => executePreparedMutation(
    'EDIT_TRANSACTION',
    (current) => prepareTransactionEditMutation(current, updated),
  ), [executePreparedMutation]);

  const deleteTransaction = useCallback((transactionId: string) => executePreparedMutation(
    'DELETE_TRANSACTION',
    (current) => prepareTransactionDeleteMutation(current, transactionId),
  ), [executePreparedMutation]);

  const commitCashEvent = useCallback((
    kind:
      | 'DEPOSIT'
      | 'WITHDRAWAL'
      | 'DIVIDEND'
      | 'FEE'
      | 'OTHER_INCOME'
      | 'OTHER_EXPENSE'
      | 'RECONCILIATION_ADJUSTMENT',
    amount: number,
    notes?: string,
    date?: string,
  ) => executePreparedMutation(
    `CASH_${kind}`,
    (current) => prepareCashEventMutation(current, kind, amount, notes, date),
  ), [executePreparedMutation]);

  const addCashTransaction = useCallback(async (
    amount: number,
    type: 'DEPOSIT' | 'WITHDRAW' | 'DIVIDEND' | 'FEE' | 'OTHER_INCOME' | 'OTHER_EXPENSE',
    notes?: string,
    date?: string,
  ): Promise<boolean> => {
    const result = await commitCashEvent(
      type === 'WITHDRAW' ? 'WITHDRAWAL' : type,
      amount,
      notes,
      date,
    );
    if ('error' in result) {
      console.error('[Financial mutation] Cash add failed:', result.error);
      return false;
    }
    return true;
  }, [commitCashEvent]);

  const editCashTransaction = useCallback(async (
    transaction: CashTransaction,
  ): Promise<boolean> => {
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

  const updateCashBalance = useCallback(async (newCash: number): Promise<boolean> => {
    const result = await executePreparedMutation(
      'RECONCILIATION_ADJUSTMENT',
      (current) => prepareCashBalanceAdjustmentMutation(current, newCash),
    );
    if ('error' in result) {
      console.error('[Financial mutation] Cash adjustment failed:', result.error);
      return false;
    }
    return true;
  }, [executePreparedMutation]);

  return {
    addTrade,
    addBonusShares,
    sellPosition,
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
    updateCashBalance,
  };
}

export type PortfolioLedgerMutations = ReturnType<typeof usePortfolioLedgerMutations>;
