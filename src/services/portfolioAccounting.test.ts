import { describe, expect, it } from 'vitest';
import { ClosedTrade } from '../types';
import {
  calculateHoldingDays,
  calculatePerformanceStats,
  calculateSellAccounting,
} from './portfolioAccounting';

const closedTrade = (pnl: number, pnlPercent = pnl): ClosedTrade => ({
  id: `ct-${pnl}-${pnlPercent}`,
  ticker: 'TEST',
  companyName: 'Test',
  sector: 'Other',
  shares: 10,
  buyPrice: 10,
  sellPrice: 10 + pnl / 10,
  buyDate: '2026-01-01T10:00:00Z',
  sellDate: '2026-01-02T10:00:00Z',
  holdingDays: 1,
  realizedPnlEgp: pnl,
  realizedPnlPercent: pnlPercent,
  outcome: pnl > 0.01 ? 'WIN' : pnl < -0.01 ? 'LOSS' : 'BREAKEVEN',
  tradeType: 'Swing',
});

describe('portfolio accounting', () => {
  it('calculates fee-inclusive partial sell P&L', () => {
    const result = calculateSellAccounting(5, 12, 1, 10, 100, 2);
    expect(result.grossProceeds).toBe(60);
    expect(result.netProceeds).toBe(59);
    expect(result.allocatedGrossCost).toBe(50);
    expect(result.allocatedBuyFees).toBe(1);
    expect(result.realizedPnlEgp).toBe(8);
  });

  it('rejects selling more shares than are open', () => {
    expect(() => calculateSellAccounting(11, 12, 0, 10, 100, 2)).toThrow();
  });

  it('rejects sell fees greater than gross proceeds', () => {
    expect(() => calculateSellAccounting(1, 10, 11, 10, 100, 0)).toThrow();
  });

  it('allows same-day trades to have zero holding days', () => {
    expect(calculateHoldingDays('2026-01-01T10:00:00Z', '2026-01-01T15:00:00Z')).toBe(0);
  });

  it('excludes breakevens from win-rate denominator', () => {
    const stats = calculatePerformanceStats([
      closedTrade(100, 10),
      closedTrade(-50, -5),
      closedTrade(0, 0),
    ]);
    expect(stats.winningTrades).toBe(1);
    expect(stats.losingTrades).toBe(1);
    expect(stats.breakevenTrades).toBe(1);
    expect(stats.winRate).toBe(50);
  });

  it('returns Infinity profit factor when there are profits and no losses', () => {
    const stats = calculatePerformanceStats([closedTrade(100, 10)]);
    expect(stats.profitFactor).toBe(Infinity);
  });

  it('returns null profit factor and win rate when there are no decisive trades', () => {
    const stats = calculatePerformanceStats([closedTrade(0, 0)]);
    expect(stats.profitFactor).toBeNull();
    expect(stats.winRate).toBeNull();
  });
});
