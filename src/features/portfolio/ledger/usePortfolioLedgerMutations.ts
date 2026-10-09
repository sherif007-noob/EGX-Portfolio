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
  prepareIpoAllocationMutation,
  prepareIpoCancellationMutation,
  prepareIpoSubscriptionMutation,
  prepareIpoSubscriptionCorrectionMutation,
  prepareLedgerReconciliationMutation,
  prepareLedgerSnapshotRestoreMutation,
  preparePortfolioRestoreMutation,
  prepareSellTradeMutation,
  prepareTransactionDeleteMutation,
  prepareTransactionEditMutation,
  type BonusSharesCorporateActionInput,
  type CanonicalLedgerSnapshot,
  type IpoAllocationInput,
  type IpoSubscriptionInput,
  type IpoSubscriptionCorrectionInput,
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
    auditReason?: string,
  ) => executorRef.current!.execute<T>({
    kind,
    current: currentLedgerSnapshot(),
    prepare,
    apply: (snapshot) => applyLedgerSnapshot(snapshot),
    auditReason,
  }), [applyLedgerSnapshot, currentLedgerSnapshot]);

  const reconcileLedger = useCallback((auditReason?: string) => executePreparedMutation(
    'RECONCILE_LEDGER',
    (current) => prepareLedgerReconciliationMutation(current),
    auditReason,
  ), [executePreparedMutation]);

  const addTrade = useCallback((tradeInput: BuyTradeInput) => executePreparedMutation<TradeTransaction>(
    'BUY',
    (current) => prepareBuyTradeMutation(current, {
      transactionId: `tx-${crypto.randomUUID()}`,
      ...tradeInput,
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

  const addBonusShares = useCallback((
    input: Omit<BonusSharesCorporateActionInput, 'transactionId'>,
  ) => executePreparedMutation<TradeTransaction>(
    'CORPORATE_ACTION_BONUS_SHARES',
    (current) => prepareBonusSharesMutation(current, {
      transactionId: `tx-${crypto.randomUUID()}`,
      ...input,
    }),
  ), [executePreparedMutation]);

  const addIpoSubscription = useCallback((
    input: Omit<IpoSubscriptionInput, 'transactionId'>,
  ) => executePreparedMutation<TradeTransaction>(
    'IPO_SUBSCRIPTION_SUBMIT',
    (current) => prepareIpoSubscriptionMutation(current, {
      transactionId: `tx-${crypto.randomUUID()}`,
      ...input,
    }),
  ), [executePreparedMutation]);

  const correctIpoSubscription = useCallback((
    input: IpoSubscriptionCorrectionInput,
    auditReason: string,
  ) => {
    if (!auditReason?.trim()) {
      return Promise.resolve({ ok:false as const, error:new Error('An audit reason is required for IPO corrections.'), kind:'IPO_SUBSCRIPTION_CORRECT', persisted:false as const, stage:'prepare' as const, code:'PREPARE_FAILED' as const });
    }
    return executePreparedMutation<TradeTransaction>(
      'IPO_SUBSCRIPTION_CORRECT',
      (current)=>prepareIpoSubscriptionCorrectionMutation(current,input),
      auditReason.trim(),
    );
  }, [executePreparedMutation]);

  const allocateIpoSubscription = useCallback((
    input: IpoAllocationInput,
  ) => executePreparedMutation<TradeTransaction>(
    'IPO_SUBSCRIPTION_ALLOCATE',
    (current) => prepareIpoAllocationMutation(current, input),
  ), [executePreparedMutation]);

  const cancelIpoSubscription = useCallback((
    transactionId: string,
  ) => executePreparedMutation<TradeTransaction>(
    'IPO_SUBSCRIPTION_CANCEL',
    (current) => prepareIpoCancellationMutation(current, transactionId),
  ), [executePreparedMutation]);

  const editTransaction = useCallback((updated: TradeTransaction, auditReason?: string) => executePreparedMutation(
    'EDIT_TRANSACTION',
    (current) => prepareTransactionEditMutation(current, updated),
    auditReason,
  ), [executePreparedMutation]);

  const deleteTransaction = useCallback((transactionId: string, auditReason?: string) => executePreparedMutation(
    'DELETE_TRANSACTION',
    (current) => prepareTransactionDeleteMutation(current, transactionId),
    auditReason,
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
    auditReason?: string,
  ): Promise<boolean> => {
    const result = await executePreparedMutation(
      'EDIT_CASH_TRANSACTION',
      (current) => prepareCashEntryMutation(current, transaction.id, transaction),
      auditReason,
    );
    if ('error' in result) {
      console.error('[Financial mutation] Cash edit failed:', result.error);
      return false;
    }
    return true;
  }, [executePreparedMutation]);

  const deleteCashTransaction = useCallback(async (
    transactionId: string,
    auditReason?: string,
  ): Promise<boolean> => {
    const result = await executePreparedMutation(
      'DELETE_CASH_TRANSACTION',
      (current) => prepareCashEntryMutation(current, transactionId, null),
      auditReason,
    );
    if ('error' in result) {
      console.error('[Financial mutation] Cash delete failed:', result.error);
      return false;
    }
    return true;
  }, [executePreparedMutation]);

  const importBackup = useCallback((backup: PortfolioRestoreInput, auditReason?: string) => executePreparedMutation(
    'RESTORE_PORTFOLIO',
    (current) => preparePortfolioRestoreMutation(current, backup),
    auditReason,
  ), [executePreparedMutation]);

  const importOcrBatch = useCallback((trades: OcrTradeInput[]) => executePreparedMutation(
    'OCR_BATCH_IMPORT',
    (current) => prepareOcrBatchMutation(current, trades),
  ), [executePreparedMutation]);

  const restoreLedgerSnapshot = useCallback((restore: {
    transactions: TradeTransaction[];
    capitalDeposits: number;
    positions?: Position[];
  }, auditReason?: string) => executePreparedMutation(
    'RESTORE_LEDGER_SNAPSHOT',
    (current) => prepareLedgerSnapshotRestoreMutation(current, restore),
    auditReason,
  ), [executePreparedMutation]);

  const restoreInitialState = useCallback(() => importBackup({
    positions: INITIAL_POSITIONS,
    closedTrades: INITIAL_CLOSED_TRADES,
    transactions: INITIAL_TRANSACTIONS,
    cashBalance: INITIAL_CASH_BALANCE,
    capitalDeposits: INITIAL_CAPITAL_DEPOSITS,
    tickers: INITIAL_EGX_TICKERS,
  }), [importBackup]);

  const updateCashBalance = useCallback(async (
    newCash: number,
    auditReason?: string,
  ): Promise<boolean> => {
    const result = await executePreparedMutation(
      'RECONCILIATION_ADJUSTMENT',
      (current) => prepareCashBalanceAdjustmentMutation(current, newCash),
      auditReason,
    );
    if ('error' in result) {
      console.error('[Financial mutation] Cash adjustment failed:', result.error);
      return false;
    }
    return true;
  }, [executePreparedMutation]);

  return {
    addTrade,
    sellPosition,
    addBonusShares,
    addIpoSubscription,
    correctIpoSubscription,
    allocateIpoSubscription,
    cancelIpoSubscription,
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
