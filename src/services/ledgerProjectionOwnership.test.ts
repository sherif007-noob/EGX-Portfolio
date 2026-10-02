import { describe, expect, it } from 'vitest';
import type { ClosedTrade, TradeTransaction } from '../types';
import {
  getActivePositionLedgerTransactionIds,
  getClosedCycleLedgerTransactionIds,
} from './ledgerProjectionOwnership';

const tx = (overrides: Partial<TradeTransaction>): TradeTransaction => ({
  id: 'tx',
  type: 'BUY',
  ticker: 'TEST',
  companyName: 'Test',
  sector: 'Other',
  shares: 100,
  price: 10,
  fees: 0,
  totalAmount: 1000,
  date: '2026-01-01',
  ...overrides,
});

describe('ledger projection ownership', () => {
  it('keeps every execution in an active DCA + partial-sell cycle without FIFO ownership', () => {
    const transactions = [
      tx({ id: 'buy-1', type: 'BUY', shares: 100, price: 10, date: '2026-01-01', totalAmount: 1000 }),
      tx({ id: 'buy-2', type: 'BUY', shares: 100, price: 20, date: '2026-01-02', totalAmount: 2000 }),
      tx({ id: 'sell-1', type: 'SELL', shares: 100, price: 30, date: '2026-01-03', totalAmount: 3000 }),
    ];

    expect(getActivePositionLedgerTransactionIds(transactions, 'TEST')).toEqual([
      'buy-1',
      'buy-2',
      'sell-1',
    ]);
  });

  it('starts a new correction scope after a full close and reopen', () => {
    const transactions = [
      tx({ id: 'buy-old', type: 'BUY', shares: 100, date: '2026-01-01' }),
      tx({ id: 'sell-old', type: 'SELL', shares: 100, date: '2026-01-02' }),
      tx({ id: 'buy-new-1', type: 'BUY', shares: 50, date: '2026-01-03' }),
      tx({ id: 'buy-new-2', type: 'BUY', shares: 50, date: '2026-01-04' }),
      tx({ id: 'sell-new', type: 'SELL', shares: 25, date: '2026-01-05' }),
    ];

    expect(getActivePositionLedgerTransactionIds(transactions, 'TEST')).toEqual([
      'buy-new-1',
      'buy-new-2',
      'sell-new',
    ]);
  });

  it('returns no active source scope for a fully closed ticker', () => {
    const transactions = [
      tx({ id: 'buy', type: 'BUY', shares: 100, date: '2026-01-01' }),
      tx({ id: 'sell', type: 'SELL', shares: 100, date: '2026-01-02' }),
    ];

    expect(getActivePositionLedgerTransactionIds(transactions, 'TEST')).toEqual([]);
  });

  it('uses the closed-cycle source IDs without duplicating shared IDs', () => {
    const cycle = {
      id: 'closed-1',
      ticker: 'TEST',
      companyName: 'Test',
      sector: 'Other',
      shares: 100,
      buyPrice: 10,
      sellPrice: 12,
      buyDate: '2026-01-01',
      sellDate: '2026-01-05',
      holdingDays: 4,
      realizedPnlEgp: 200,
      realizedPnlPercent: 20,
      outcome: 'WIN',
      tradeType: 'Swing',
      buyTransactionIds: ['buy-1', 'buy-2', 'buy-1'],
      sellTransactionIds: ['sell-1'],
    } satisfies ClosedTrade;

    expect(getClosedCycleLedgerTransactionIds(cycle)).toEqual([
      'buy-1',
      'buy-2',
      'sell-1',
    ]);
  });
});
