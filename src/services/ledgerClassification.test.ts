import { describe, expect, it } from 'vitest';
import type { TradeTransaction } from '../types';
import { cashRowAmount, cashRowKind, isCashFlowTransaction } from './ledgerClassification';

const base = { id: 'x', companyName: 'Cash', sector: 'Other', date: '2026-09-20', fees: 0 } as const;

const tx = (overrides: Partial<TradeTransaction>): TradeTransaction =>
  ({ ...base, type: 'BUY', ticker: 'CASH', shares: 0, price: 1, totalAmount: 0, ...overrides }) as TradeTransaction;

describe('cash movements are not trades', () => {
  it('classifies explicit cash flows and legacy CASH rows, and nothing else', () => {
    expect(isCashFlowTransaction(tx({ cashFlowType: 'DEPOSIT' }))).toBe(true);
    expect(isCashFlowTransaction(tx({ type: 'SELL' }))).toBe(true);
    expect(isCashFlowTransaction(tx({ ticker: 'cash' }))).toBe(true);
    expect(isCashFlowTransaction(tx({ ticker: 'COMI', type: 'BUY' }))).toBe(false);
    expect(isCashFlowTransaction(tx({ ticker: 'COMI', type: 'SELL' }))).toBe(false);
    expect(isCashFlowTransaction(tx({ ticker: 'COMI', type: 'OPENING_POSITION' }))).toBe(false);
  });

  it('derives the kind and the signed amount', () => {
    expect(cashRowKind(tx({ cashFlowType: 'DEPOSIT' }))).toBe('DEPOSIT');
    expect(cashRowKind(tx({ cashFlowType: 'WITHDRAWAL' }))).toBe('WITHDRAWAL');
    expect(cashRowKind(tx({ cashFlowType: 'CASH_ADJUSTMENT' }))).toBe('ADJUSTMENT');
    expect(cashRowKind(tx({ type: 'SELL' }))).toBe('WITHDRAWAL');

    expect(cashRowAmount(tx({ cashFlowType: 'DEPOSIT', cashFlowAmount: 120000 }))).toBe(120000);
    expect(cashRowAmount(tx({ cashFlowType: 'WITHDRAWAL', cashFlowAmount: 5000 }))).toBe(-5000);
    expect(cashRowAmount(tx({ type: 'SELL', shares: 5000, price: 1, totalAmount: 5000 }))).toBe(-5000);
    expect(cashRowAmount(tx({ cashFlowType: 'CASH_ADJUSTMENT', cashFlowAmount: 40, netCashImpact: -40 }))).toBe(-40);
  });
});
