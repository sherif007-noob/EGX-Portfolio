import type { CashFlowType, CanonicalCashFlowType, TradeTransaction } from '../types';

const CANONICAL_TYPES = new Set<CanonicalCashFlowType>([
  'DEPOSIT',
  'WITHDRAWAL',
  'DIVIDEND',
  'FEE',
  'OTHER_INCOME',
  'OTHER_EXPENSE',
  'RECONCILIATION_ADJUSTMENT',
]);

export function normalizeCashFlowType(value: unknown): CanonicalCashFlowType | undefined {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return undefined;
  if (raw === 'CASH_ADJUSTMENT') return 'RECONCILIATION_ADJUSTMENT';
  return CANONICAL_TYPES.has(raw as CanonicalCashFlowType)
    ? raw as CanonicalCashFlowType
    : undefined;
}

export function isCapitalCashFlowType(
  kind: CashFlowType | CanonicalCashFlowType | string | undefined,
): kind is 'DEPOSIT' | 'WITHDRAWAL' {
  const normalized = normalizeCashFlowType(kind);
  return normalized === 'DEPOSIT' || normalized === 'WITHDRAWAL';
}

export function isReconciliationCashFlowType(
  kind: CashFlowType | CanonicalCashFlowType | string | undefined,
): boolean {
  return normalizeCashFlowType(kind) === 'RECONCILIATION_ADJUSTMENT';
}

export function isPerformanceCashFlowType(
  kind: CashFlowType | CanonicalCashFlowType | string | undefined,
): kind is 'DIVIDEND' | 'FEE' | 'OTHER_INCOME' | 'OTHER_EXPENSE' {
  const normalized = normalizeCashFlowType(kind);
  return normalized === 'DIVIDEND'
    || normalized === 'FEE'
    || normalized === 'OTHER_INCOME'
    || normalized === 'OTHER_EXPENSE';
}

export function cashFlowSignedImpact(
  kind: CashFlowType | CanonicalCashFlowType | string | undefined,
  rawAmount: unknown,
): number | null {
  const normalized = normalizeCashFlowType(kind);
  if (!normalized) return null;

  const numeric = Number(rawAmount);
  if (!Number.isFinite(numeric)) return null;

  if (normalized === 'RECONCILIATION_ADJUSTMENT') {
    return numeric;
  }

  const amount = Math.abs(numeric);
  if (normalized === 'WITHDRAWAL' || normalized === 'FEE' || normalized === 'OTHER_EXPENSE') {
    return -amount;
  }
  return amount;
}

export function cashFlowPerformancePnl(
  kind: CashFlowType | CanonicalCashFlowType | string | undefined,
  rawAmount: unknown,
): number {
  const normalized = normalizeCashFlowType(kind);
  if (!normalized || !isPerformanceCashFlowType(normalized)) return 0;
  return cashFlowSignedImpact(normalized, rawAmount) ?? 0;
}

export function cashFlowReturnNeutralPortfolioFlow(
  kind: CashFlowType | CanonicalCashFlowType | string | undefined,
  rawAmount: unknown,
): number {
  const normalized = normalizeCashFlowType(kind);
  if (!normalized) return 0;
  if (!isCapitalCashFlowType(normalized) && normalized !== 'RECONCILIATION_ADJUSTMENT') return 0;
  return cashFlowSignedImpact(normalized, rawAmount) ?? 0;
}

export function transactionCashFlowAmount(tx: TradeTransaction): number {
  const normalized = normalizeCashFlowType(tx.cashFlowType);
  if (normalized === 'RECONCILIATION_ADJUSTMENT') {
    return Number(tx.cashFlowAmount ?? tx.totalAmount);
  }
  return Math.abs(Number(tx.cashFlowAmount ?? tx.totalAmount));
}
