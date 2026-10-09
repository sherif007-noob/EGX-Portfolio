import { calculateIpoOrderQuote } from './ipoOrderQuote';
import { parseUserCalendarDate } from '../utils/dateUtils';
import { cairoOrderTimeToUtcIso } from './ipoSubscriptionEditing';
import type {
  CanonicalCashFlowType,
  CashTransaction,
  ClosedTrade,
  EGXTicker,
  Position,
  Sector,
  TradeTransaction,
} from '../types';
import { normalizeTransaction } from '../utils/portfolioMetrics';
import { calculateBuyImpact } from './portfolioAccounting';
import { reconcilePortfolioFromLedger } from './portfolioReconciliation';
import { currentCairoDateKey, expectedBonusShares } from './corporateActions';
import { validateIpoSubscriptionMetadata } from './ipoSubscriptions';
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
  if (deleted.type === 'OPENING_POSITION') {
    throw new Error('Opening-position migration records are protected.');
  }
  if (deleted.type === 'IPO_SUBSCRIPTION' && deleted.ipoSubscription?.status !== 'SUBMITTED') {
    throw new Error('Allocated or cancelled IPO lifecycle records cannot be deleted directly.');
  }

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

  // Entitlement is anchored to the ledger immediately before the action's
  // effective/ex-date, not to today's final position. This keeps historical
  // actions deterministic even when later BUY/SELL executions exist.
  const preActionTransactions = current.transactions.filter(
    (transaction) => String(transaction.date || '').slice(0, 10) < effectiveDate,
  );
  const report = reconcilePortfolioFromLedger(
    preActionTransactions,
    current.tickers,
    current.capitalDeposits,
    current.positions,
  );
  let position = report.reconciledPositions.find(
    (item) => item.ticker.trim().toUpperCase() === ticker,
  );

  let openingPositionSeed: TradeTransaction | undefined;
  if (!position) {
    const hasAnyTickerLedger = current.transactions.some(
      (transaction) => String(transaction.ticker || '').trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '') === ticker,
    );
    const legacyPosition = current.positions.find(
      (item) => item.ticker.trim().toUpperCase() === ticker,
    );
    const legacyPredatesAction = legacyPosition
      && /^\d{4}-\d{2}-\d{2}$/.test(String(legacyPosition.buyDate || '').slice(0, 10))
      && String(legacyPosition.buyDate).slice(0, 10) < effectiveDate;

    if (!hasAnyTickerLedger && legacyPosition && legacyPredatesAction) {
      openingPositionSeed = {
        id: `opening-${input.transactionId}`,
        type: 'OPENING_POSITION',
        ticker,
        companyName: legacyPosition.companyName || ticker,
        sector: legacyPosition.sector || 'Other',
        shares: Number(legacyPosition.shares),
        price: Number(legacyPosition.avgBuyPrice),
        date: String(legacyPosition.buyDate).slice(0, 10),
        fees: Number(legacyPosition.totalFees || 0),
        totalAmount: 0,
        netCashImpact: 0,
        positionId: legacyPosition.id,
        targetPrice: legacyPosition.targetPrice,
        stopLoss: legacyPosition.stopLoss,
        notes: [
          legacyPosition.notes,
          'Legacy opening position migrated into the canonical ledger before recording bonus shares.',
        ].filter(Boolean).join(' '),
      };

      const seededReport = reconcilePortfolioFromLedger(
        [...preActionTransactions, openingPositionSeed],
        current.tickers,
        current.capitalDeposits,
        current.positions,
      );
      position = seededReport.reconciledPositions.find(
        (item) => item.ticker.trim().toUpperCase() === ticker,
      );
    }
  }

  if (!position) {
    throw new Error(`No eligible open ${ticker} position exists before ${effectiveDate}. If this is a legacy holding, its buy date must predate the corporate action and it must not conflict with existing ticker ledger rows.`);
  }

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
    transactions: [
      ...current.transactions,
      ...(openingPositionSeed ? [openingPositionSeed] : []),
      action,
    ],
    capitalDeposits: current.capitalDeposits,
    positionSeed: current.positions,
    value: action,
  };
}


export interface IpoSubscriptionInput {
  transactionId: string;
  ticker: string;
  companyName: string;
  sector: Sector;
  /** Explicit number of requested shares, authoritative for new IPO entry forms. */
  requestedShares?: number;
  /** Full EGP order commitment. Legacy integrations may supply only this and price. */
  requestedAmount: number;
  /** Broker's actual cash hold, which may be only a percentage of the order. */
  reservedAmount?: number;
  offerPrice: number;
  subscriptionDate: string;
  reference?: string;
  listingDate?: string;
  notes?: string;
}

export interface IpoAllocationInput {
  transactionId: string;
  allocatedShares: number;
  allocationDate: string;
  fees?: number;
}

export function prepareIpoSubscriptionMutation(
  current: Readonly<CanonicalLedgerSnapshot>,
  input: IpoSubscriptionInput,
): LedgerMutationPreparation<TradeTransaction> {
  const ticker = String(input.ticker || '').trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
  if (!ticker) throw new Error('IPO subscription requires a ticker.');

  const suppliedAmount = Number(input.requestedAmount);
  const offerPrice = Number(input.offerPrice);
  if (!Number.isFinite(offerPrice) || offerPrice <= 0) {
    throw new Error('IPO offer price must be greater than zero.');
  }
  if (!Number.isFinite(suppliedAmount) || suppliedAmount <= 0) {
    throw new Error('IPO requested amount must be greater than zero.');
  }
  // New forms submit exact share count. Validate rather than infer it from a
  // rounded amount (which can otherwise create fractional shares).
  const explicitQuote = input.requestedShares == null
    ? null
    : calculateIpoOrderQuote(Number(input.requestedShares), offerPrice, 100);
  if (explicitQuote && Math.abs(suppliedAmount - explicitQuote.requestedAmount) > 0.005) {
    throw new Error('IPO order amount does not match shares × offer price.');
  }
  const requestedAmount = explicitQuote?.requestedAmount ?? suppliedAmount;
  const requestedShares = explicitQuote?.requestedShares ?? requestedAmount / offerPrice;

  const subscriptionDate = String(input.subscriptionDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(subscriptionDate) || !Number.isFinite(Date.parse(subscriptionDate))) {
    throw new Error('IPO subscription requires a valid subscription date.');
  }

  const reservedAmount = input.reservedAmount == null ? requestedAmount : Number(input.reservedAmount);
  if (!Number.isFinite(reservedAmount) || reservedAmount <= 0 || reservedAmount > requestedAmount + 0.01) {
    throw new Error('Broker cash hold must be positive and no greater than the full order amount.');
  }
  const metadata = {
    status: 'SUBMITTED' as const,
    requestedAmount,
    reservedAmount,
    requestedShares,
    offerPrice,
    reference: input.reference?.trim() || undefined,
    subscriptionDate,
    listingDate: input.listingDate?.slice(0, 10) || undefined,
  };
  validateIpoSubscriptionMetadata(metadata);

  const transaction: TradeTransaction = {
    id: input.transactionId,
    type: 'IPO_SUBSCRIPTION',
    ticker,
    companyName: input.companyName || ticker,
    sector: input.sector || 'Other',
    shares: requestedShares,
    price: offerPrice,
    date: subscriptionDate,
    fees: 0,
    totalAmount: requestedAmount,
    netCashImpact: -reservedAmount,
    ipoSubscription: metadata,
    notes: input.notes?.trim() || undefined,
  };

  return {
    transactions: [...current.transactions, transaction],
    capitalDeposits: current.capitalDeposits,
    positionSeed: current.positions,
    value: transaction,
  };
}

export interface IpoSubscriptionCorrectionInput {
  transactionId: string;
  subscriptionDate: string;
  /** Optional real order placement clock (HH:MM) in Africa/Cairo. */
  executionTimeCairo?: string;
  /** Optional edited broker order terms, all checked against canonical ledger. */
  requestedShares?: number;
  offerPrice?: number;
  reservedAmount?: number;
  reference?: string;
  notes?: string;
}

/**
 * Correct a saved pending subscription in place. This MUST NOT create a
 * second reservation or replace a lifecycle event with BUY/SELL.
 * The persistence executor recalculates cash/NAV and writes an audit event.
 */
export function prepareIpoSubscriptionCorrectionMutation(
  current: Readonly<CanonicalLedgerSnapshot>,
  input: IpoSubscriptionCorrectionInput,
): LedgerMutationPreparation<TradeTransaction> {
  const existing=current.transactions.find(tx=>tx.id===input.transactionId);
  if(!existing || existing.type!=='IPO_SUBSCRIPTION' || !existing.ipoSubscription) {
    throw new Error('The IPO subscription was not found. Reload and try again.');
  }
  if(existing.ipoSubscription.status!=='SUBMITTED'){
    throw new Error('Only pending IPO subscriptions may have their order date corrected.');
  }

  const date=parseUserCalendarDate(input.subscriptionDate);
  if (!date) throw new Error('Enter a valid subscription date.');
  const time=(input.executionTimeCairo??'').trim();
  const fundingOnCorrectedDate = date!==existing.date && current.transactions.some(tx =>
    tx.id!==existing.id && tx.date.slice(0,10)===date &&
    (tx.cashFlowType==='DEPOSIT' || (tx.ticker.toUpperCase()==='CASH' && tx.type==='BUY' && !tx.cashFlowType)),
  );
  if (fundingOnCorrectedDate && !time) {
    throw new Error('Enter the actual Cairo placement time: cash deposits exist on that date.');
  }
  if(!time && existing.executedAt && date!==existing.date) {
    throw new Error('Enter the actual Cairo placement time to correct this dated execution.');
  }
  const executedAt = time ? cairoOrderTimeToUtcIso(date,time)
    : existing.executedAt;
  if(existing.date===date && existing.ipoSubscription.subscriptionDate===date &&
    (existing.executedAt??null)===(executedAt??null) &&
    (input.requestedShares===undefined || input.requestedShares===existing.ipoSubscription.requestedShares) &&
    (input.offerPrice===undefined || input.offerPrice===existing.ipoSubscription.offerPrice) &&
    (input.reservedAmount===undefined || input.reservedAmount===(existing.ipoSubscription.reservedAmount ?? existing.ipoSubscription.requestedAmount)) &&
    (input.reference===undefined || input.reference===(existing.ipoSubscription.reference??'')) &&
    (input.notes===undefined || input.notes===(existing.notes??''))) {
    throw new Error('There are no IPO subscription changes to save.');
  }
  const shares=input.requestedShares ?? existing.ipoSubscription.requestedShares;
  const price=input.offerPrice ?? existing.ipoSubscription.offerPrice;
  // Keep explicit held EGP separate from the full requested commitment.
  const oldReserved=existing.ipoSubscription.reservedAmount ?? existing.ipoSubscription.requestedAmount;
  const reserved=input.reservedAmount ?? oldReserved;
  const quote=calculateIpoOrderQuote(shares,price,100);
  if(!Number.isFinite(reserved) || reserved<=0 || reserved>quote.requestedAmount+0.01){
    throw new Error('IPO cash held must be positive and no greater than the order value.');
  }
  const metadata={...existing.ipoSubscription,subscriptionDate:date,
    requestedShares:shares,offerPrice:price,requestedAmount:quote.requestedAmount,reservedAmount:reserved,
    reference:input.reference === undefined ? existing.ipoSubscription.reference : input.reference.trim() || undefined,
  };
  validateIpoSubscriptionMetadata(metadata);
  const corrected:TradeTransaction={...existing,date,executedAt,ipoSubscription:metadata,
    shares,price,totalAmount:quote.requestedAmount,netCashImpact:-reserved,
    notes:input.notes === undefined ? existing.notes : input.notes.trim() || undefined};
  return {
    transactions:current.transactions.map(tx=>tx.id===existing.id?corrected:tx),
    capitalDeposits:current.capitalDeposits,
    positionSeed:current.positions,
    value:corrected,
  };
}

export function prepareIpoAllocationMutation(
  current: Readonly<CanonicalLedgerSnapshot>,
  input: IpoAllocationInput,
): LedgerMutationPreparation<TradeTransaction> {
  const existing = current.transactions.find((transaction) => transaction.id === input.transactionId);
  if (!existing || existing.type !== 'IPO_SUBSCRIPTION' || !existing.ipoSubscription) {
    throw new Error('IPO subscription was not found.');
  }
  if (existing.ipoSubscription.status !== 'SUBMITTED') {
    throw new Error('Only a submitted IPO subscription can be allocated.');
  }

  const allocatedShares = Number(input.allocatedShares);
  const fees = Number(input.fees ?? 0);
  if (!Number.isFinite(allocatedShares) || allocatedShares <= 0) {
    throw new Error('Allocated IPO shares must be greater than zero.');
  }
  if (!Number.isFinite(fees) || fees < 0) throw new Error('IPO allocation fees cannot be negative.');

  const allocatedAmount = allocatedShares * existing.ipoSubscription.offerPrice;
  const totalAmount = allocatedAmount + fees;
  if (totalAmount > existing.ipoSubscription.requestedAmount + 0.01) {
    throw new Error('IPO allocation cost cannot exceed the full subscription commitment.');
  }
  if (allocatedShares > existing.ipoSubscription.requestedShares + 0.000001) {
    throw new Error('IPO allocation cannot exceed the shares requested.');
  }
  const reserved = existing.ipoSubscription.reservedAmount ?? existing.ipoSubscription.requestedAmount;
  const refundAmount = Math.max(0, Number((reserved - totalAmount).toFixed(2)));
  const additionalPaymentAmount = Math.max(0, Number((totalAmount - reserved).toFixed(2)));
  if (additionalPaymentAmount > current.cashBalance + 0.005) {
    throw new Error(`IPO allocation requires ${additionalPaymentAmount.toFixed(2)} EGP in additional cash, but only ${current.cashBalance.toFixed(2)} EGP is available.`);
  }
  const allocationDate = String(input.allocationDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(allocationDate) || !Number.isFinite(Date.parse(allocationDate))) {
    throw new Error('IPO allocation requires a valid allocation date.');
  }

  const metadata = {
    ...existing.ipoSubscription,
    status: 'ALLOCATED' as const,
    allocationDate,
    allocatedShares,
    allocatedAmount: totalAmount,
    refundAmount,
    additionalPaymentAmount,
  };
  validateIpoSubscriptionMetadata(metadata);

  const allocated: TradeTransaction = {
    ...existing,
    shares: allocatedShares,
    price: existing.ipoSubscription.offerPrice,
    fees,
    totalAmount,
    netCashImpact: -totalAmount,
    ipoSubscription: metadata,
  };

  return {
    transactions: current.transactions.map((transaction) =>
      transaction.id === allocated.id ? allocated : transaction
    ),
    capitalDeposits: current.capitalDeposits,
    positionSeed: current.positions,
    value: allocated,
  };
}

export function prepareIpoCancellationMutation(
  current: Readonly<CanonicalLedgerSnapshot>,
  transactionId: string,
): LedgerMutationPreparation<TradeTransaction> {
  const existing = current.transactions.find((transaction) => transaction.id === transactionId);
  if (!existing || existing.type !== 'IPO_SUBSCRIPTION' || !existing.ipoSubscription) {
    throw new Error('IPO subscription was not found.');
  }
  if (existing.ipoSubscription.status !== 'SUBMITTED') {
    throw new Error('Only a submitted IPO subscription can be cancelled.');
  }

  const metadata = {
    ...existing.ipoSubscription,
    status: 'CANCELLED' as const,
    cancellationDate: currentCairoDateKey(),
    refundAmount: existing.ipoSubscription.reservedAmount ?? existing.ipoSubscription.requestedAmount,
  };
  validateIpoSubscriptionMetadata(metadata);

  const cancelled: TradeTransaction = {
    ...existing,
    shares: 0,
    fees: 0,
    totalAmount: 0,
    netCashImpact: 0,
    ipoSubscription: metadata,
  };

  return {
    transactions: current.transactions.map((transaction) =>
      transaction.id === cancelled.id ? cancelled : transaction
    ),
    capitalDeposits: current.capitalDeposits,
    positionSeed: current.positions,
    value: cancelled,
  };
}
