import type { CorporateActionType, TradeTransaction } from '../types';

export const SUPPORTED_CORPORATE_ACTION_TYPES: CorporateActionType[] = [
  'BONUS_SHARES',
];

export function normalizeCorporateActionType(value: unknown): CorporateActionType | undefined {
  const normalized = String(value ?? '').trim().toUpperCase();
  return SUPPORTED_CORPORATE_ACTION_TYPES.includes(normalized as CorporateActionType)
    ? normalized as CorporateActionType
    : undefined;
}

export function isCorporateActionTransaction(
  transaction: TradeTransaction,
): boolean {
  return transaction.type === 'CORPORATE_ACTION';
}

export function isBonusSharesTransaction(
  transaction: TradeTransaction,
): boolean {
  return transaction.type === 'CORPORATE_ACTION'
    && transaction.corporateActionType === 'BONUS_SHARES';
}

export function transactionShareDelta(transaction: TradeTransaction): number {
  const shares = Number(transaction.shares);
  if (!Number.isFinite(shares) || shares <= 0) return 0;
  if (transaction.type === 'SELL') return -shares;
  if (transaction.type === 'BUY') return shares;
  if (isBonusSharesTransaction(transaction)) return shares;
  return 0;
}

export function expectedBonusShares(sourceShares: number, ratio: number): number {
  if (!Number.isFinite(sourceShares) || sourceShares <= 0) return 0;
  if (!Number.isFinite(ratio) || ratio < 0) return 0;
  return sourceShares * ratio;
}

export function currentCairoDateKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${read('year')}-${read('month')}-${read('day')}`;
}
