import { describe, expect, it } from 'vitest';
import { Position } from '../types';
import { calculateEquityBridge, calculateMaxDrawdown, isEquityBridgeBalanced } from './portfolioPerformance';

const position = (overrides: Partial<Position> = {}): Position => ({
  id: 'pos-1',
  ticker: 'TEST',
  companyName: 'Test',
  sector: 'Other',
  shares: 10,
  avgBuyPrice: 10,
  currentPrice: 12,
  buyDate: '2026-01-01',
  totalFees: 2,
  ...overrides,
});

describe('portfolio performance accounting', () => {
  it('reconciles equity using net capital plus unrealized P&L without double-counting fees', () => {
    const bridge = calculateEquityBridge(102, [], [position()], 0);

    // The 102 contributed capital funded 100 of gross stock cost + 2 of buy
    // fees. Unrealized P&L is 120 - 100 - 2 = 18, so equity is 120.
    expect(bridge.endingEquity).toBe(120);
    expect(bridge.realizedPnl).toBe(0);
    expect(bridge.unrealizedPnl).toBe(18);
    expect(bridge.reconciliationDelta).toBe(0);
    expect(isEquityBridgeBalanced(bridge)).toBe(true);
  });

  it('exposes inconsistent capital/equity data instead of inventing performance', () => {
    const bridge = calculateEquityBridge(100, [], [position()], 0);

    expect(bridge.endingEquity).toBe(120);
    expect(bridge.unrealizedPnl).toBe(18);
    expect(bridge.reconciliationDelta).toBe(2);
    expect(isEquityBridgeBalanced(bridge)).toBe(false);
  });

  it('calculates peak-to-trough drawdown from equity, not realized P&L', () => {
    const drawdown = calculateMaxDrawdown([
      { equity: 1000 },
      { equity: 1200 },
      { equity: 1050 },
      { equity: 900 },
      { equity: 1100 },
    ]);

    expect(drawdown.maxDrawdownEgp).toBe(300);
    expect(drawdown.maxDrawdownPercent).toBe(25);
    expect(drawdown.peakEquity).toBe(1200);
    expect(drawdown.troughEquity).toBe(900);
  });

  it('ignores invalid equity observations', () => {
    const drawdown = calculateMaxDrawdown([
      { equity: Number.NaN },
      { equity: 1000 },
      { equity: Number.POSITIVE_INFINITY },
      { equity: 900 },
    ]);

    expect(drawdown.maxDrawdownEgp).toBe(100);
    expect(drawdown.maxDrawdownPercent).toBe(10);
  });
});
