import { describe, expect, it } from 'vitest';
import { Position } from '../types';
import { calculatePortfolioMetrics, normalizeTransaction } from './portfolioMetrics';

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

  it('rejects unknown transaction types instead of silently converting them to BUY', () => {
    expect(() => normalizeTransaction({ type: 'UNKNOWN', ticker: 'TEST', shares: 1, price: 10 })).toThrow(
      'Unsupported transaction type: UNKNOWN',
    );
  });
});
