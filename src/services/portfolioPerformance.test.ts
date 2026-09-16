import { describe, expect, it } from 'vitest';
import { ClosedTrade, Position } from '../types';
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

const trade = (overrides: Partial<ClosedTrade> = {}): ClosedTrade => ({
  id: 'trade-1',
  ticker: 'TEST',
  companyName: 'Test',
  sector: 'Other',
  shares: 10,
  buyPrice: 10,
  sellPrice: 11,
  buyDate: '2026-01-01',
  sellDate: '2026-01-02',
  holdingDays: 1,
  realizedPnlEgp: 10,
  realizedPnlPercent: 9.8,
  buyFees: 2,
  sellFees: 1,
  totalFees: 3,
  outcome: 'WIN',
  tradeType: 'Swing',
  ...overrides,
});

describe('portfolio performance accounting', () => {
  it('reconciles equity using net capital plus realized and unrealized P&L', () => {
    const bridge = calculateEquityBridge(1000, [trade()], [position()], 100);

    // Equity = cash 100 + market value 120 = 220.
    // Unrealized P&L = 120 - 100 - 2 fees = 18.
    // 1000 + 10 + 18 = 1028, so this intentionally exposes an inconsistent
    // fixture rather than silently treating the difference as performance.
    expect(bridge.endingEquity).toBe(220);
    expect(bridge.realizedPnl).toBe(10);
    expect(bridge.unrealizedPnl).toBe(18);
    expect(bridge.reconciliationDelta).toBe(-808);
    expect(isEquityBridgeBalanced(bridge)).toBe(false);
  });

  it('does not double-count fees in the equity bridge', () => {
    const bridge = calculateEquityBridge(100, [], [position()], 0);

    // 100 capital -> 120 market value, with 2 of open buy fees already
    // deducted from unrealized P&L. The bridge is therefore balanced.
    expect(bridge.endingEquity).toBe(120);
    expect(bridge.unrealizedPnl).toBe(18);
    expect(bridge.reconciliationDelta).toBe(2);
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
