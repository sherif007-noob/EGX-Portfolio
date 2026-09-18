import { describe, expect, it } from 'vitest';
import { Position } from '../types';
import { calculatePortfolioMetrics, getLatestEgxTradingSessionDate, normalizeTransaction } from './portfolioMetrics';

const position = (overrides: Partial<Position> = {}): Position => ({
  id: 'pos-1',
  ticker: 'TEST',
  companyName: 'Test',
  sector: 'Other',
  shares: 10,
  avgBuyPrice: 100,
  currentPrice: 110,
  buyDate: '2026-01-01',
  totalFees: 0,
  ...overrides,
});

describe('portfolio metrics', () => {
  it('uses total portfolio value, including cash, as the day-change denominator', () => {
    const metrics = calculatePortfolioMetrics(
      [position()],
      900,
      [],
      [{
        ticker: 'TEST',
        nameEn: 'Test',
        nameAr: 'Test',
        isin: 'TEST',
        sector: 'Other',
        lastPrice: 110,
        change: 10,
        changePercent: 10,
        dayLow: 100,
        dayHigh: 110,
        yearLow: 80,
        yearHigh: 120,
        volume: 0,
        valueEgp: 0,
        trendStatus: 'Rangebound Neutral',
        rsi14: 50,
        support: 100,
        resistance: 120,
        targetPrice: 120,
        stopLoss: 90,
        lastUpdated: '2026-01-01',
      }],
    );

    // Current NAV = 2,000. Prior NAV = 1,900. Return = 100 / 1,900.
    // calculatePortfolioMetrics exposes percentages rounded to two decimals.
    expect(metrics.dayChangeEgp).toBe(100);
    expect(metrics.dayChangePercent).toBe(5.26);
  });

  it('includes intraday realized P&L and measures same-session buys from execution cost', () => {
    const sessionDate = getLatestEgxTradingSessionDate();
    const positions = [
      position({ ticker: 'TEST', shares: 10, avgBuyPrice: 90, currentPrice: 110 }),
      position({ id: 'pos-new', ticker: 'NEW', shares: 1, avgBuyPrice: 50, currentPrice: 60, totalFees: 1 }),
    ];
    const tickers = [
      {
        ticker: 'TEST', nameEn: 'Test', nameAr: 'Test', isin: 'TEST', sector: 'Other' as const,
        lastPrice: 110, change: 10, changePercent: 10, dayLow: 100, dayHigh: 110,
        yearLow: 80, yearHigh: 120, volume: 0, valueEgp: 0, trendStatus: 'Rangebound Neutral' as const,
        rsi14: 50, support: 100, resistance: 120, targetPrice: 120, stopLoss: 90, lastUpdated: sessionDate,
      },
      {
        ticker: 'NEW', nameEn: 'New', nameAr: 'New', isin: 'NEW', sector: 'Other' as const,
        lastPrice: 60, change: 20, changePercent: 50, dayLow: 40, dayHigh: 60,
        yearLow: 40, yearHigh: 60, volume: 0, valueEgp: 0, trendStatus: 'Rangebound Neutral' as const,
        rsi14: 50, support: 40, resistance: 60, targetPrice: 60, stopLoss: 40, lastUpdated: sessionDate,
      },
      {
        ticker: 'RND', nameEn: 'Round Trip', nameAr: 'Round Trip', isin: 'RND', sector: 'Other' as const,
        lastPrice: 9.5, change: -0.5, changePercent: -5, dayLow: 9.5, dayHigh: 10,
        yearLow: 9, yearHigh: 11, volume: 0, valueEgp: 0, trendStatus: 'Rangebound Neutral' as const,
        rsi14: 50, support: 9, resistance: 11, targetPrice: 11, stopLoss: 9, lastUpdated: sessionDate,
      },
    ];
    const transactions = [
      { id: 'rnd-buy', type: 'BUY' as const, ticker: 'RND', companyName: 'Round Trip', sector: 'Other' as const, shares: 100, price: 10, date: sessionDate, fees: 1, totalAmount: 1001 },
      { id: 'rnd-sell', type: 'SELL' as const, ticker: 'RND', companyName: 'Round Trip', sector: 'Other' as const, shares: 100, price: 9.5, date: sessionDate, fees: 1, totalAmount: 949 },
      { id: 'new-buy', type: 'BUY' as const, ticker: 'NEW', companyName: 'New', sector: 'Other' as const, shares: 1, price: 50, date: sessionDate, fees: 1, totalAmount: 51 },
    ];

    // Start equity = 1,000 cash + 1,000 TEST at prior close = 2,000.
    // Current equity = 897 cash + 1,100 TEST + 60 NEW = 2,057.
    // Daily P&L = +57 = +100 TEST -52 RND round-trip +9 NEW after fee.
    const metrics = calculatePortfolioMetrics(positions, 897, [], tickers, transactions);
    expect(metrics.dayChangeEgp).toBe(57);
    expect(metrics.dayChangePercent).toBe(2.85);
  });

  it('handles a cash-only portfolio without using the securities value as denominator', () => {
    const metrics = calculatePortfolioMetrics([], 1000, [], [], []);
    expect(metrics.totalValue).toBe(1000);
    expect(metrics.dayChangeEgp).toBe(0);
    expect(metrics.dayChangePercent).toBe(0);
  });

  it('preserves legacy deposits and withdrawals as CASH flows instead of BUY trades', () => {
    const deposit = normalizeTransaction({
      id: 'cash-in-1',
      type: 'DEPOSIT',
      amount: 1000,
      date: '2026-01-01',
    });
    const withdrawal = normalizeTransaction({
      id: 'cash-out-1',
      type: 'WITHDRAWAL',
      amount: 250,
      date: '2026-01-02',
    });

    expect(deposit).toMatchObject({ type: 'BUY', ticker: 'CASH', shares: 1000, price: 1, totalAmount: 1000 });
    expect(withdrawal).toMatchObject({ type: 'SELL', ticker: 'CASH', shares: 250, price: 1, totalAmount: 250 });
  });

  it('preserves database-shaped executed_at timestamps during normalization', () => {
    const normalized = normalizeTransaction({
      id: 'db-row',
      type: 'BUY',
      ticker: 'TEST',
      shares: 1,
      price: 10,
      transaction_date: '2026-09-17',
      executed_at: '2026-09-17T07:12:34.000Z',
      total_amount: 10,
    });

    expect(normalized.executedAt).toBe('2026-09-17T07:12:34.000Z');
  });

  it('rejects unknown transaction types instead of silently converting them to BUY', () => {
    expect(() => normalizeTransaction({ type: 'UNKNOWN', ticker: 'TEST', shares: 1, price: 10 })).toThrow(
      'Unsupported transaction type: UNKNOWN',
    );
  });
});
