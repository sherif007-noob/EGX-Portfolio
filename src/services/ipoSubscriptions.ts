import type {
  IpoSubscriptionMetadata,
  IpoSubscriptionStatus,
  TradeTransaction,
} from '../types';

const EPSILON = 0.000001;

export function normalizeIpoSubscriptionStatus(value: unknown): IpoSubscriptionStatus | undefined {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized === 'SUBMITTED' || normalized === 'ALLOCATED' || normalized === 'CANCELLED'
    ? normalized
    : undefined;
}

export function normalizeIpoSubscriptionMetadata(value: unknown): IpoSubscriptionMetadata | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  const status = normalizeIpoSubscriptionStatus(row.status);
  if (!status) return undefined;

  const requestedAmount = Number(row.requestedAmount);
  const requestedShares = Number(row.requestedShares);
  const offerPrice = Number(row.offerPrice);
  const allocatedShares = row.allocatedShares == null ? undefined : Number(row.allocatedShares);
  const allocatedAmount = row.allocatedAmount == null ? undefined : Number(row.allocatedAmount);
  const refundAmount = row.refundAmount == null ? undefined : Number(row.refundAmount);

  return {
    status,
    requestedAmount,
    requestedShares,
    offerPrice,
    reference: typeof row.reference === 'string' && row.reference.trim() ? row.reference.trim() : undefined,
    subscriptionDate: typeof row.subscriptionDate === 'string' && row.subscriptionDate.trim()
      ? row.subscriptionDate
      : '',
    listingDate: typeof row.listingDate === 'string' && row.listingDate.trim() ? row.listingDate : undefined,
    allocationDate: typeof row.allocationDate === 'string' && row.allocationDate.trim() ? row.allocationDate : undefined,
    cancellationDate: typeof row.cancellationDate === 'string' && row.cancellationDate.trim() ? row.cancellationDate : undefined,
    allocatedShares: Number.isFinite(allocatedShares) ? allocatedShares : undefined,
    allocatedAmount: Number.isFinite(allocatedAmount) ? allocatedAmount : undefined,
    refundAmount: Number.isFinite(refundAmount) ? refundAmount : undefined,
  };
}

export function isIpoSubscriptionTransaction(transaction: TradeTransaction): boolean {
  return transaction.type === 'IPO_SUBSCRIPTION' && !!transaction.ipoSubscription;
}

export function isPendingIpoSubscription(transaction: TradeTransaction): boolean {
  return isIpoSubscriptionTransaction(transaction)
    && transaction.ipoSubscription?.status === 'SUBMITTED';
}

export function pendingIpoSubscriptionValue(transactions: TradeTransaction[]): number {
  return transactions
    .filter(isPendingIpoSubscription)
    .reduce((sum, transaction) => {
      const amount = Number(transaction.ipoSubscription?.requestedAmount);
      return Number.isFinite(amount) && amount > 0 ? sum + amount : sum;
    }, 0);
}

export function validateIpoSubscriptionMetadata(metadata: IpoSubscriptionMetadata): void {
  if (!normalizeIpoSubscriptionStatus(metadata.status)) {
    throw new Error('IPO subscription status is invalid.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.subscriptionDate || '') || !Number.isFinite(Date.parse(metadata.subscriptionDate))) {
    throw new Error('IPO subscription date is invalid.');
  }
  if (!Number.isFinite(metadata.requestedAmount) || metadata.requestedAmount <= EPSILON) {
    throw new Error('IPO requested amount must be greater than zero.');
  }
  if (!Number.isFinite(metadata.offerPrice) || metadata.offerPrice <= EPSILON) {
    throw new Error('IPO offer price must be greater than zero.');
  }
  if (!Number.isFinite(metadata.requestedShares) || metadata.requestedShares <= EPSILON) {
    throw new Error('IPO requested shares must be greater than zero.');
  }

  if (metadata.status === 'ALLOCATED') {
    const allocatedShares = Number(metadata.allocatedShares);
    const allocatedAmount = Number(metadata.allocatedAmount);
    const refundAmount = Number(metadata.refundAmount);
    if (!Number.isFinite(allocatedShares) || allocatedShares <= EPSILON) {
      throw new Error('Allocated IPO shares must be greater than zero.');
    }
    if (!Number.isFinite(allocatedAmount) || allocatedAmount <= EPSILON) {
      throw new Error('Allocated IPO amount must be greater than zero.');
    }
    if (!Number.isFinite(refundAmount) || refundAmount < -EPSILON) {
      throw new Error('IPO refund amount cannot be negative.');
    }
    if (allocatedAmount > metadata.requestedAmount + EPSILON) {
      throw new Error('Allocated IPO amount cannot exceed the requested amount.');
    }
    if (Math.abs((allocatedAmount + refundAmount) - metadata.requestedAmount) > 0.01) {
      throw new Error('Allocated amount plus refund must equal the original IPO request.');
    }
  }

  if (metadata.status === 'CANCELLED') {
    const refundAmount = Number(metadata.refundAmount ?? metadata.requestedAmount);
    if (!Number.isFinite(refundAmount) || Math.abs(refundAmount - metadata.requestedAmount) > 0.01) {
      throw new Error('A cancelled IPO subscription must refund the full requested amount.');
    }
  }
}
