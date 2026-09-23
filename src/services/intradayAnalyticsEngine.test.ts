import { describe, expect, it } from 'vitest';
import { TradeTransaction } from '../types';
import { buildIntradayAnalyticsResult } from './intradayAnalyticsEngine';

const tx = (input: Partial<TradeTransaction> & Pick<TradeTransaction, 'id' | 'type' | 'ticker' | 'shares' | 'price' | 'date'>): TradeTransaction => ({
  companyName: input.ticker,
  sector: input.ticker === 'CASH' ? 'Liquid Buying Power' : 'Other',
  fees: 0,
  totalAmount: input.shares * input.price,
  ...input,
});

describe('intraday analytics engine', () => {
  it('reconstructs same-session buys and round trips from execution timestamps', () => {
    const transactions: TradeTransaction[] = [
      tx({ id: 'dep', type: 'BUY', ticker: 'CASH', shares: 2000, price: 1, totalAmount: 2000, cashFlowType: 'DEPOSIT', cashFlowAmount: 2000, date: '2026-09-16' }),
      tx({ id: 'hold', type: 'BUY', ticker: 'OLD', shares: 10, price: 50, totalAmount: 500, date: '2026-09-16', executedAt: '2026-09-16T08:00:00Z' }),
      tx({ id: 'new', type: 'BUY', ticker: 'NEW', shares: 1, price: 50, fees: 1, totalAmount: 51, date: '2026-09-17', executedAt: '2026-09-17T07:12:00Z' }),
      tx({ id: 'rnd-buy', type: 'BUY', ticker: 'RND', shares: 100, price: 10, fees: 1, totalAmount: 1001, date: '2026-09-17', executedAt: '2026-09-17T07:17:00Z' }),
      tx({ id: 'rnd-sell', type: 'SELL', ticker: 'RND', shares: 100, price: 9.5, fees: 1, totalAmount: 949, date: '2026-09-17', executedAt: '2026-09-17T07:24:00Z' }),
    ];

    const historical = {
      OLD: [{ date: '2026-09-16', close: 100 }],
      NEW: [{ date: '2026-09-16', close: 40 }],
      RND: [{ date: '2026-09-16', close: 10 }],
    };
    const intraday = {
      OLD: [
        { timestamp: '2026-09-17T07:00:00Z', intervalMinutes: 15, open: 100, high: 105, low: 99, close: 105 },
        { timestamp: '2026-09-17T07:15:00Z', intervalMinutes: 15, open: 105, high: 110, low: 104, close: 110 },
      ],
      NEW: [
        { timestamp: '2026-09-17T07:00:00Z', intervalMinutes: 15, open: 45, high: 55, low: 45, close: 55 },
        { timestamp: '2026-09-17T07:15:00Z', intervalMinutes: 15, open: 55, high: 60, low: 54, close: 60 },
      ],
      RND: [
        { timestamp: '2026-09-17T07:00:00Z', intervalMinutes: 15, open: 10, high: 10, low: 9.8, close: 9.9 },
        { timestamp: '2026-09-17T07:15:00Z', intervalMinutes: 15, open: 9.9, high: 10, low: 9.4, close: 9.5 },
      ],
    };

    const result = buildIntradayAnalyticsResult(transactions, historical, intraday, {
      sessionDate: '2026-09-17',
      asOf: '2026-09-17T07:30:00Z',
    });

    expect(result.points).toHaveLength(3);
    expect(result.summary.startEquity).toBe(2500);
    expect(result.summary.endEquity).toBe(2557);
    expect(result.summary.pnlEgp).toBe(57);
    expect(result.summary.mwrrPercent).toBeCloseTo(2.28, 2);
    expect(result.dataQuality.hasUsableRange).toBe(true);
  });

  it('refuses to present a complete intraday curve when a session trade has no execution timestamp', () => {
    const result = buildIntradayAnalyticsResult(
      [
        tx({ id: 'dep', type: 'BUY', ticker: 'CASH', shares: 1000, price: 1, totalAmount: 1000, cashFlowType: 'DEPOSIT', cashFlowAmount: 1000, date: '2026-09-16' }),
        tx({ id: 'missing-time', type: 'BUY', ticker: 'TEST', shares: 1, price: 100, totalAmount: 100, date: '2026-09-17' }),
      ],
      { TEST: [{ date: '2026-09-16', close: 100 }] },
      {
        TEST: [{ timestamp: '2026-09-17T07:00:00Z', intervalMinutes: 15, open: 100, high: 101, low: 99, close: 101 }],
      },
      { sessionDate: '2026-09-17', asOf: '2026-09-17T07:15:00Z' },
    );

    expect(result.points).toEqual([]);
    expect(result.dataQuality.hasUsableRange).toBe(false);
    expect(result.dataQuality.incompleteDays).toBeGreaterThan(0);
  });

  it('appends the authoritative live NAV as the final active-session point', () => {
    const transactions: TradeTransaction[] = [
      tx({ id: 'dep', type: 'BUY', ticker: 'CASH', shares: 1000, price: 1, totalAmount: 1000, cashFlowType: 'DEPOSIT', cashFlowAmount: 1000, date: '2026-09-17' }),
      tx({ id: 'hold', type: 'BUY', ticker: 'TEST', shares: 5, price: 100, totalAmount: 500, date: '2026-09-17', executedAt: '2026-09-17T06:30:00Z' }),
    ];

    const result = buildIntradayAnalyticsResult(
      transactions,
      { TEST: [{ date: '2026-09-16', close: 100 }] },
      {
        TEST: [
          { timestamp: '2026-09-17T07:00:00Z', intervalMinutes: 15, open: 100, high: 101, low: 99, close: 100 },
          { timestamp: '2026-09-17T07:15:00Z', intervalMinutes: 15, open: 100, high: 101, low: 99, close: 100 },
        ],
      },
      {
        sessionDate: '2026-09-17',
        asOf: '2026-09-17T07:37:00Z',
        livePrices: { TEST: 102 },
      },
    );

    expect(result.points.at(-1)?.date).toBe('2026-09-17T07:37:00.000Z');
    expect(result.summary.endEquity).toBe(1010);
    expect(result.summary.pnlEgp).toBe(10);
  });

  it('does not append a mixed stale/live endpoint when a held ticker lacks a live quote', () => {
    const transactions: TradeTransaction[] = [
      tx({ id: 'dep', type: 'BUY', ticker: 'CASH', shares: 1000, price: 1, totalAmount: 1000, cashFlowType: 'DEPOSIT', cashFlowAmount: 1000, date: '2026-09-17' }),
      tx({ id: 'a', type: 'BUY', ticker: 'AAA', shares: 2, price: 100, totalAmount: 200, date: '2026-09-17', executedAt: '2026-09-17T06:30:00Z' }),
      tx({ id: 'b', type: 'BUY', ticker: 'BBB', shares: 2, price: 100, totalAmount: 200, date: '2026-09-17', executedAt: '2026-09-17T06:30:00Z' }),
    ];

    const result = buildIntradayAnalyticsResult(
      transactions,
      {
        AAA: [{ date: '2026-09-16', close: 100 }],
        BBB: [{ date: '2026-09-16', close: 100 }],
      },
      {
        AAA: [{ timestamp: '2026-09-17T07:00:00Z', intervalMinutes: 15, open: 100, high: 101, low: 99, close: 100 }],
        BBB: [{ timestamp: '2026-09-17T07:00:00Z', intervalMinutes: 15, open: 100, high: 101, low: 99, close: 100 }],
      },
      {
        sessionDate: '2026-09-17',
        asOf: '2026-09-17T07:37:00Z',
        livePrices: { AAA: 102 },
      },
    );

    expect(result.points.at(-1)?.date).toBe('2026-09-17T07:15:00.000Z');
    expect(result.summary.endEquity).toBe(1000);
  });

});
