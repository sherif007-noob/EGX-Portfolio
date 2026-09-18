import type { TradeTransaction } from '../types';

export interface TradeExecutionCandidate {
  type: 'BUY' | 'SELL';
  ticker: string;
  shares: number;
  price: number;
  date: string;
  executedAt?: string;
  fees?: number;
}

function normalizeTicker(value: string): string {
  return value.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
}

function executionMinute(value?: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 60_000);
}

function nearlyEqual(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

/**
 * Strong duplicate detection for broker executions.
 *
 * We only auto-block when BOTH rows have a valid execution timestamp and match
 * on minute + economic execution details. Date-only trades are intentionally
 * not deduplicated because two legitimate fills can otherwise look identical.
 */
export function isStrongDuplicateExecution(
  existing: TradeTransaction,
  candidate: TradeExecutionCandidate,
): boolean {
  if (normalizeTicker(existing.ticker) === 'CASH') return false;

  const existingMinute = executionMinute(existing.executedAt);
  const candidateMinute = executionMinute(candidate.executedAt);
  if (existingMinute === null || candidateMinute === null) return false;

  return (
    existing.type === candidate.type &&
    normalizeTicker(existing.ticker) === normalizeTicker(candidate.ticker) &&
    existingMinute === candidateMinute &&
    String(existing.date || '').slice(0, 10) === String(candidate.date || '').slice(0, 10) &&
    nearlyEqual(Number(existing.shares), Number(candidate.shares), 1e-6) &&
    nearlyEqual(Number(existing.price), Number(candidate.price), 1e-6) &&
    nearlyEqual(Number(existing.fees || 0), Number(candidate.fees || 0), 0.01)
  );
}

export function findStrongDuplicateExecution(
  transactions: TradeTransaction[],
  candidate: TradeExecutionCandidate,
): TradeTransaction | null {
  return transactions.find((tx) => isStrongDuplicateExecution(tx, candidate)) ?? null;
}
