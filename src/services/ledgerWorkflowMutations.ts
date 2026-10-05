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
import { currentCairoDateKey, expectedBonusShares } from './corporateActions';
import {
  deriveCapitalDepositsAfterLedgerChange,
  prepareCashLedgerChange,
  prepareCashLedgerEvent,
} from './cashLedger';
import type {
  CanonicalLedgerSnapshot,
  LedgerMutationPreparation,
} from './ledgerMutationService';

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


export interface BonusSharesCorporateActionInput {
  transactionId: string;
  ticker: string;
  bonusShares: number;
  officialRatio: number;
  effectiveDate: string;
  reference?: string;
  notes?: string;
}

export function prepareBonusSharesMutation(
  current: Readonly<CanonicalLedgerSnapshot>,
  input: BonusSharesCorporateActionInput,
): LedgerMutationPreparation<TradeTransaction> {
  const ticker = String(input.ticker || '').trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
  if (!ticker) throw new Error('Bonus-share action requires a ticker.');

  const effectiveDate = String(input.effectiveDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) || !Number.isFinite(Date.parse(effectiveDate))) {
    throw new Error('Bonus-share action requires a valid effective date.');
  }
  if (effectiveDate > currentCairoDateKey()) {
    throw new Error('Bonus shares cannot be applied before their effective/credit date.');
  }

  const report = reconcilePortfolioFromLedger(
    current.transactions,
    current.tickers,
    current.capitalDeposits,
    current.positions,
  );
  const position = report.reconciledPositions.find(
    (item) => item.ticker.trim().toUpperCase() === ticker,
  );
  if (!position) throw new Error(`No open ${ticker} position exists for this corporate action.`);

  const bonusShares = Number(input.bonusShares);
  if (!Number.isFinite(bonusShares) || bonusShares <= 0) {
    throw new Error('Actual bonus shares received must be greater than zero.');
  }

  const officialRatio = Number(input.officialRatio);
  if (!Number.isFinite(officialRatio) || officialRatio < 0) {
    throw new Error('Official bonus-share ratio must be a finite non-negative number.');
  }

  const theoretical = expectedBonusShares(position.shares, officialRatio);
  const action: TradeTransaction = {
    id: input.transactionId,
    type: 'CORPORATE_ACTION',
    ticker,
    companyName: position.companyName,
    sector: position.sector,
    shares: bonusShares,
    price: 0,
    date: effectiveDate,
    fees: 0,
    totalAmount: 0,
    netCashImpact: 0,
    corporateActionType: 'BONUS_SHARES',
    corporateActionRatio: officialRatio,
    corporateActionSourceShares: position.shares,
    corporateActionReference: input.reference?.trim() || undefined,
    positionId: position.id,
    notes: [
      input.notes?.trim(),
      `Bonus shares: ${bonusShares}; official ratio: ${officialRatio} per share; theoretical entitlement: ${theoretical.toFixed(8)}.`,
    ].filter(Boolean).join(' '),
  };

  return {
    transactions: [...current.transactions, action],
    capitalDeposits: current.capitalDeposits,
    positionSeed: current.positions,
    value: action,
  };
}
