import { describe, expect, it } from 'vitest';
import { Position } from '../types';
import { calculatePortfolioMetrics } from './portfolioMetrics';

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
    expect(metrics.dayChangeEgp).toBe(100);
    expect(metrics.dayChangePercent).toBeCloseTo(5.2632, 3);
  });

  it('handles a cash-only portfolio without using the securities value as denominator', () => {
    const metrics = calculatePortfolioMetrics([], 1000, [], [], []);
    expect(metrics.totalValue).toBe(1000);
    expect(metrics.dayChangeEgp).toBe(0);
    expect(metrics.dayChangePercent).toBe(0);
  });
});
