import type {
  CanonicalCashFlowType,
  CashTransaction,
  ClosedTrade,
  EGXTicker,
  Position,
  TradeTransaction,
} from '../types';
import { normalizeTransaction } from '../utils/portfolioMetrics';
import { calculateBuyImpact } from './portfolioAccounting';
import { reconcilePortfolioFromLedger } from './portfolioReconciliation';
import {
  deriveCapitalDepositsAfterLedgerChange,
  prepareCashLedgerChange,
  prepareCashLedgerEvent,
} from './cashLedger';
import type {
  CanonicalLedgerSnapshot,
  LedgerMutationPreparation,
} from './ledgerMutationService';

export interface BonusSharesMutationInput {
  transactionId: string;
  ticker: string;
  creditedShares: number;
  effectiveDate: string;
  notes?: string;
}

export interface PortfolioRestoreInput {
  positions?: Position[];
  closedTrades?: ClosedTrade[];
  transactions?: TradeTransaction[];
  cashBalance?: number;
  capitalDeposits?: number;
  tickers?: EGXTicker[];
}

function canonicalizeEditedTrade(transaction: TradeTransaction): TradeTransaction {
  const normalized = normalizeTransaction(transaction);

  if (normalized.ticker === 'CASH' || normalized.cashFlowType) {
    return normalized;
  }

  const grossTradeValue = normalized.shares * normalized.price;
  if (normalized.type === 'BUY') {
    const impact = calculateBuyImpact(normalized.shares, normalized.price, normalized.fees || 0);
    return {
      ...normalized,
      totalAmount: impact.cashOutflow,
      grossTradeValue: impact.grossCost,
      netCashImpact: -impact.cashOutflow,
      realizedPnlEgp: undefined,
      realizedPnlPercent: undefined,
      outcome: undefined,
      holdingDays: undefined,
    };
  }

  const netProceeds = Math.max(0, grossTradeValue - (normalized.fees || 0));
  return {
    ...normalized,
    totalAmount: netProceeds,
    grossTradeValue,
    netCashImpact: netProceeds,
    // These are projections of the surrounding ledger, not editable source facts.
    realizedPnlEgp: undefined,
    realizedPnlPercent: undefined,
    outcome: undefined,
    holdingDays: undefined,
  };
}

export function prepareTransactionEditMutation(
  current: Readonly<CanonicalLedgerSnapshot>,
  updatedTransaction: TradeTransaction,
): LedgerMutationPreparation<TradeTransaction> {
  const existing = current.transactions.find((transaction) => transaction.id === updatedTransaction.id);
  if (!existing) throw new Error('Transaction was not found. Reload and try again.');

  const canonical = canonicalizeEditedTrade(updatedTransaction);
  const transactions = current.transactions.map((transaction) =>
    transaction.id === canonical.id ? canonical : transaction,
  );
  const capitalDeposits = deriveCapitalDepositsAfterLedgerChange(
    current.transactions,
    transactions,
    current.capitalDeposits,
  );

  return {
    transactions,
    capitalDeposits,
    positionSeed: current.positions,
    value: canonical,
  };
}

export function prepareTransactionDeleteMutation(
  current: Readonly<CanonicalLedgerSnapshot>,
  transactionId: string,
): LedgerMutationPreparation<TradeTransaction> {
  const deleted = current.transactions.find((transaction) => transaction.id === transactionId);
  if (!deleted) throw new Error('Transaction was not found. Reload and try again.');

  const transactions = current.transactions.filter((transaction) => transaction.id !== transactionId);
  const capitalDeposits = deriveCapitalDepositsAfterLedgerChange(
    current.transactions,
    transactions,
    current.capitalDeposits,
  );

  return {
    transactions,
    capitalDeposits,
    positionSeed: current.positions,
    value: deleted,
  };
}

export function prepareBonusSharesMutation(
  current: Readonly<CanonicalLedgerSnapshot>,
  input: BonusSharesMutationInput,
): LedgerMutationPreparation<TradeTransaction> {
  const ticker = String(input.ticker || '').trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
  if (!ticker) throw new Error('Bonus shares require a ticker.');
  if (!Number.isFinite(input.creditedShares) || input.creditedShares <= 0) {
    throw new Error('Credited bonus shares must be greater than zero.');
  }
  if (!/^\d{4}-\d{2}-\d{2}/.test(input.effectiveDate || '') || !Number.isFinite(Date.parse(input.effectiveDate))) {
    throw new Error('Bonus shares require a valid effective date.');
  }

  const position = current.positions.find((item) => item.ticker.trim().toUpperCase() === ticker);
  if (!position) throw new Error(`No open ${ticker} position exists for this bonus-share event.`);

  const transaction: TradeTransaction = {
    id: input.transactionId,
    type: 'BONUS_SHARES',
    ticker,
    companyName: position.companyName,
    sector: position.sector,
    shares: input.creditedShares,
    price: 0,
    date: input.effectiveDate.slice(0, 10),
    fees: 0,
    totalAmount: 0,
    netCashImpact: 0,
    notes: input.notes?.trim() || 'Bonus shares corporate action',
    positionId: position.id,
  };

  return {
    transactions: [...current.transactions, transaction],
    capitalDeposits: current.capitalDeposits,
    positionSeed: current.positions,
    value: transaction,
  };
}

export function prepareCashEventMutation(
  current: Readonly<CanonicalLedgerSnapshot>,
  kind: CanonicalCashFlowType,
  amount: number,
  notes?: string,
  date?: string,
): LedgerMutationPreparation<TradeTransaction> {
  const prepared = prepareCashLedgerEvent(
    {
      transactions: current.transactions,
      positions: current.positions,
      tickers: current.tickers,
      capitalDeposits: current.capitalDeposits,
    },
    kind,
    amount,
    notes,
    date,
  );

  return {
    transactions: prepared.transactions,
    capitalDeposits: prepared.capitalDeposits,
    positionSeed: current.positions,
    value: prepared.transaction,
  };
}

export function prepareCashEntryMutation(
  current: Readonly<CanonicalLedgerSnapshot>,
  transactionId: string,
  changes: Pick<CashTransaction, 'type' | 'amount' | 'date' | 'notes'> | null,
): LedgerMutationPreparation<string> {
  const prepared = prepareCashLedgerChange(
    {
      transactions: current.transactions,
      positions: current.positions,
      tickers: current.tickers,
      capitalDeposits: current.capitalDeposits,
    },
    transactionId,
    changes,
  );

  return {
    transactions: prepared.transactions,
    capitalDeposits: prepared.capitalDeposits,
    positionSeed: current.positions,
    value: transactionId,
  };
}

export function prepareCashBalanceAdjustmentMutation(
  current: Readonly<CanonicalLedgerSnapshot>,
  requestedCashBalance: number,
): LedgerMutationPreparation<TradeTransaction | undefined> {
  if (!Number.isFinite(requestedCashBalance)) throw new Error('Cash balance must be finite.');
  const report = reconcilePortfolioFromLedger(
    current.transactions,
    current.tickers,
    current.capitalDeposits,
    current.positions,
  );
  const delta = Number((requestedCashBalance - report.reconciledCashBalance).toFixed(2));
  if (Math.abs(delta) < 0.005) {
    return {
      transactions: current.transactions,
      capitalDeposits: current.capitalDeposits,
      positionSeed: current.positions,
      value: undefined,
    };
  }
  return prepareCashEventMutation(
    current,
    'RECONCILIATION_ADJUSTMENT',
    delta,
    'Manual cash balance adjustment',
  );
}

export function prepareLedgerReconciliationMutation(
  current: Readonly<CanonicalLedgerSnapshot>,
): LedgerMutationPreparation<number> {
  return {
    transactions: current.transactions,
    capitalDeposits: current.capitalDeposits,
    tickers: current.tickers,
    positionSeed: current.positions,
    value: current.transactions.length,
  };
}

export function preparePortfolioRestoreMutation(
  current: Readonly<CanonicalLedgerSnapshot>,
  restore: PortfolioRestoreInput,
): LedgerMutationPreparation<{ transactions: number; sourceCash?: number }> {
  if (!Array.isArray(restore.transactions)) {
    throw new Error('Restore requires an authoritative transaction ledger.');
  }

  const transactions = restore.transactions.map(normalizeTransaction);
  const hasProjectionOnlyFinancialData =
    transactions.length === 0 &&
    (
      (restore.positions?.length || 0) > 0 ||
      (restore.closedTrades?.length || 0) > 0 ||
      (Number.isFinite(restore.cashBalance) && Math.abs(Number(restore.cashBalance)) > 0.005)
    );

  if (hasProjectionOnlyFinancialData) {
    throw new Error(
      'This backup contains financial projections but no transaction ledger. Restore was blocked to avoid replacing ledger-authoritative accounting with derived rows.',
    );
  }

  const tickers = Array.isArray(restore.tickers) && restore.tickers.length > 0
    ? restore.tickers
    : current.tickers;
  const fallbackCapital =
    typeof restore.capitalDeposits === 'number' &&
    Number.isFinite(restore.capitalDeposits) &&
    restore.capitalDeposits >= 0
      ? restore.capitalDeposits
      : current.capitalDeposits;
  const capitalDeposits = deriveCapitalDepositsAfterLedgerChange(
    [],
    transactions,
    fallbackCapital,
  );

  return {
    transactions,
    capitalDeposits,
    tickers,
    positionSeed: Array.isArray(restore.positions) ? restore.positions : [],
    value: {
      transactions: transactions.length,
      sourceCash: typeof restore.cashBalance === 'number' ? restore.cashBalance : undefined,
    },
  };
}

export function prepareLedgerSnapshotRestoreMutation(
  current: Readonly<CanonicalLedgerSnapshot>,
  restore: Pick<CanonicalLedgerSnapshot, 'transactions' | 'capitalDeposits'> & {
    positions?: Position[];
  },
): LedgerMutationPreparation<number> {
  return {
    transactions: restore.transactions,
    capitalDeposits: restore.capitalDeposits,
    tickers: current.tickers,
    positionSeed: restore.positions ?? current.positions,
    value: restore.transactions.length,
  };
}
