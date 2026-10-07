import type { ClosedTrade, Position, TradeTransaction } from '../types';
import type { CanonicalLedgerSnapshot } from './ledgerMutationService';

export type AuditTrailEntityType =
  | 'TRANSACTION'
  | 'CASH'
  | 'PORTFOLIO_LEDGER'
  | 'CORPORATE_ACTION'
  | 'IPO_SUBSCRIPTION';

export interface AuditTrailEntityState {
  cashBalance: number;
  capitalDeposits: number;
  transactionCount: number;
  positionCount: number;
  closedTradeCount: number;
  transaction?: TradeTransaction | null;
  position?: {
    id: string;
    ticker: string;
    shares: number;
    avgBuyPrice: number;
    totalFees: number;
  } | null;
}

export interface AuditTrailDraft {
  mutationId: string;
  mutationKind: string;
  entityType: AuditTrailEntityType;
  entityId?: string;
  ticker?: string;
  reason?: string;
  beforeState: AuditTrailEntityState;
  afterState: AuditTrailEntityState;
  metadata: {
    addedTransactionIds: string[];
    removedTransactionIds: string[];
    changedTransactionIds: string[];
    changedPositionTickers: string[];
  };
}

export interface AuditTrailRecord extends AuditTrailDraft {
  id: string;
  createdAt: string;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

function transactionMap(rows: TradeTransaction[]): Map<string, TradeTransaction> {
  return new Map(rows.map((row) => [row.id, row]));
}

function positionMap(rows: Position[]): Map<string, Position> {
  return new Map(rows.map((row) => [row.ticker.trim().toUpperCase(), row]));
}

function changedIds<T extends { id: string }>(
  before: T[],
  after: T[],
): { added: string[]; removed: string[]; changed: string[] } {
  const beforeMap = new Map(before.map((row) => [row.id, row]));
  const afterMap = new Map(after.map((row) => [row.id, row]));
  const added = [...afterMap.keys()].filter((id) => !beforeMap.has(id));
  const removed = [...beforeMap.keys()].filter((id) => !afterMap.has(id));
  const changed = [...beforeMap.keys()].filter((id) => {
    const next = afterMap.get(id);
    return next && stableJson(beforeMap.get(id)) !== stableJson(next);
  });
  return { added, removed, changed };
}

function changedPositionTickers(before: Position[], after: Position[]): string[] {
  const beforeMap = positionMap(before);
  const afterMap = positionMap(after);
  return [...new Set([...beforeMap.keys(), ...afterMap.keys()])]
    .filter((ticker) => stableJson(beforeMap.get(ticker) ?? null) !== stableJson(afterMap.get(ticker) ?? null))
    .sort();
}

function positionSummary(position?: Position): AuditTrailEntityState['position'] {
  if (!position) return null;
  return {
    id: position.id,
    ticker: position.ticker,
    shares: position.shares,
    avgBuyPrice: position.avgBuyPrice,
    totalFees: Number(position.totalFees || 0),
  };
}

function snapshotState(
  snapshot: CanonicalLedgerSnapshot,
  transaction?: TradeTransaction | null,
  ticker?: string,
): AuditTrailEntityState {
  const normalizedTicker = String(ticker || transaction?.ticker || '').trim().toUpperCase();
  const position = normalizedTicker
    ? snapshot.positions.find((row) => row.ticker.trim().toUpperCase() === normalizedTicker)
    : undefined;

  return {
    cashBalance: snapshot.cashBalance,
    capitalDeposits: snapshot.capitalDeposits,
    transactionCount: snapshot.transactions.length,
    positionCount: snapshot.positions.length,
    closedTradeCount: snapshot.closedTrades.length,
    transaction: transaction ?? null,
    position: positionSummary(position),
  };
}

function isTradeTransaction(value: unknown): value is TradeTransaction {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<TradeTransaction>;
  return typeof row.id === 'string' && typeof row.ticker === 'string' && typeof row.type === 'string';
}

function entityTypeFor(kind: string, transaction?: TradeTransaction): AuditTrailEntityType {
  if (
    kind === 'RESTORE_PORTFOLIO'
    || kind === 'RESTORE_LEDGER_SNAPSHOT'
    || kind === 'RECONCILE_LEDGER'
  ) return 'PORTFOLIO_LEDGER';
  if (kind.startsWith('CORPORATE_ACTION_') || transaction?.type === 'CORPORATE_ACTION') return 'CORPORATE_ACTION';
  if (kind.startsWith('IPO_SUBSCRIPTION_') || transaction?.type === 'IPO_SUBSCRIPTION') return 'IPO_SUBSCRIPTION';
  if (
    kind.includes('CASH')
    || transaction?.cashFlowType
    || transaction?.ticker?.trim().toUpperCase() === 'CASH'
  ) return 'CASH';
  if (transaction) return 'TRANSACTION';
  return 'PORTFOLIO_LEDGER';
}

function nextMutationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `audit-${crypto.randomUUID()}`;
  }
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function buildAuditTrailDraft<TResult>(
  kind: string,
  before: CanonicalLedgerSnapshot,
  after: CanonicalLedgerSnapshot,
  value?: TResult,
  reason?: string,
): AuditTrailDraft | null {
  const transactionChanges = changedIds(before.transactions, after.transactions);
  const positionChanges = changedPositionTickers(before.positions, after.positions);
  const closedChanges = changedIds<ClosedTrade>(before.closedTrades, after.closedTrades);

  const hasChange =
    transactionChanges.added.length > 0
    || transactionChanges.removed.length > 0
    || transactionChanges.changed.length > 0
    || positionChanges.length > 0
    || closedChanges.added.length > 0
    || closedChanges.removed.length > 0
    || closedChanges.changed.length > 0
    || Math.abs(before.cashBalance - after.cashBalance) > 0.000001
    || Math.abs(before.capitalDeposits - after.capitalDeposits) > 0.000001;

  if (!hasChange) return null;

  const beforeTransactions = transactionMap(before.transactions);
  const afterTransactions = transactionMap(after.transactions);

  let entityTransaction: TradeTransaction | undefined;
  if (isTradeTransaction(value)) {
    entityTransaction = afterTransactions.get(value.id) ?? beforeTransactions.get(value.id) ?? value;
  } else {
    const primaryId =
      transactionChanges.changed[0]
      ?? transactionChanges.added[0]
      ?? transactionChanges.removed[0];
    if (primaryId) entityTransaction = afterTransactions.get(primaryId) ?? beforeTransactions.get(primaryId);
  }

  const portfolioLevel = entityTypeFor(kind, entityTransaction) === 'PORTFOLIO_LEDGER';
  const entityId = portfolioLevel
    ? 'portfolio-ledger'
    : entityTransaction?.id ?? (kind.includes('CASH') ? 'cash' : 'portfolio-ledger');
  const ticker = portfolioLevel
    ? undefined
    : entityTransaction?.ticker ?? (positionChanges.length === 1 ? positionChanges[0] : undefined);
  const beforeTransaction = entityTransaction
    ? beforeTransactions.get(entityTransaction.id) ?? null
    : null;
  const afterTransaction = entityTransaction
    ? afterTransactions.get(entityTransaction.id) ?? null
    : null;

  return {
    mutationId: nextMutationId(),
    mutationKind: kind,
    entityType: entityTypeFor(kind, entityTransaction),
    entityId,
    ticker,
    reason: reason?.trim() || undefined,
    beforeState: snapshotState(before, beforeTransaction, ticker),
    afterState: snapshotState(after, afterTransaction, ticker),
    metadata: {
      addedTransactionIds: transactionChanges.added,
      removedTransactionIds: transactionChanges.removed,
      changedTransactionIds: transactionChanges.changed,
      changedPositionTickers: positionChanges,
    },
  };
}
