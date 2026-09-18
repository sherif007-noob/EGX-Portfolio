import { describe, expect, it } from 'vitest';
import type { TradeTransaction } from '../types';
import { findStrongDuplicateExecution, isStrongDuplicateExecution } from './tradeExecutionIdentity';

const existing: TradeTransaction = {
  id: 'tx-1',
  type: 'BUY',
  ticker: 'ORAS',
  companyName: 'Orascom',
  sector: 'Other',
  shares: 1,
  price: 861,
  date: '2026-09-17',
  executedAt: '2026-09-17T10:27:00.000Z',
  fees: 1.65,
  totalAmount: 862.65,
};

describe('trade execution identity', () => {
  it('blocks the same broker execution even if timestamp seconds differ inside the same minute', () => {
    expect(isStrongDuplicateExecution(existing, {
      type: 'BUY',
      ticker: 'egx:oras',
      shares: 1,
      price: 861,
      date: '2026-09-17',
      executedAt: '2026-09-17T10:27:42.000Z',
      fees: 1.65,
    })).toBe(true);
  });

  it('does not auto-dedupe a date-only trade', () => {
    expect(isStrongDuplicateExecution(existing, {
      type: 'BUY',
      ticker: 'ORAS',
      shares: 1,
      price: 861,
      date: '2026-09-17',
      fees: 1.65,
    })).toBe(false);
  });

  it('does not collapse legitimate executions with different economics', () => {
    expect(isStrongDuplicateExecution(existing, {
      type: 'BUY',
      ticker: 'ORAS',
      shares: 2,
      price: 861,
      date: '2026-09-17',
      executedAt: '2026-09-17T10:27:10.000Z',
      fees: 1.65,
    })).toBe(false);
  });

  it('finds a strong duplicate in an existing ledger', () => {
    expect(findStrongDuplicateExecution([existing], {
      type: 'BUY',
      ticker: 'ORAS',
      shares: 1,
      price: 861,
      date: '2026-09-17',
      executedAt: '2026-09-17T10:27:01.000Z',
      fees: 1.65,
    })?.id).toBe('tx-1');
  });
});
