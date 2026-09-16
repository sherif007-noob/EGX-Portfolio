import { describe, expect, it } from 'vitest';
import { Position } from '../types';
import { buildExternalCashFlows, buildHistoricalEquityCurve, calculateEquityBridge, calculateMWRR, calculateMaxDrawdown, isEquityBridgeBalanced } from './portfolioPerformance';

const position = (overrides: Partial<Position> = {}): Position => ({
  id: 'pos-1', ticker: 'TEST', companyName: 'Test', sector: 'Other', shares: 10, avgBuyPrice: 10, currentPrice: 12, buyDate: '2026-01-01', totalFees: 2, ...overrides,
});

describe('portfolio performance accounting', () => {
  it('reconciles equity using net capital plus unrealized P&L without double-counting fees', () => {
    const bridge = calculateEquityBridge(102, [], [position()], 0);
    expect(bridge.endingEquity).toBe(120);
    expect(bridge.realizedPnl).toBe(0);
    expect(bridge.unrealizedPnl).toBe(18);
    expect(bridge.reconciliationDelta).toBe(0);
    expect(isEquityBridgeBalanced(bridge)).toBe(true);
  });

  it('exposes inconsistent capital/equity data instead of inventing performance', () => {
    const bridge = calculateEquityBridge(100, [], [position()], 0);
    expect(bridge.reconciliationDelta).toBe(2);
    expect(isEquityBridgeBalanced(bridge)).toBe(false);
  });

  it('calculates peak-to-trough drawdown from equity', () => {
    const drawdown = calculateMaxDrawdown([{ equity: 1000 }, { equity: 1200 }, { equity: 1050 }, { equity: 900 }, { equity: 1100 }]);
    expect(drawdown.maxDrawdownEgp).toBe(300);
    expect(drawdown.maxDrawdownPercent).toBe(25);
    expect(drawdown.peakEquity).toBe(1200);
    expect(drawdown.troughEquity).toBe(900);
  });

  it('ignores invalid equity observations', () => {
    const drawdown = calculateMaxDrawdown([{ equity: Number.NaN }, { equity: 1000 }, { equity: Number.POSITIVE_INFINITY }, { equity: 900 }]);
    expect(drawdown.maxDrawdownEgp).toBe(100);
    expect(drawdown.maxDrawdownPercent).toBe(10);
  });

  it('reconstructs historical equity from dated ledger transactions and closes', () => {
    const curve = buildHistoricalEquityCurve([
      { id: 'dep', type: 'BUY', ticker: 'CASH', companyName: 'Cash', sector: 'Liquid Buying Power', shares: 1000, price: 1, date: '2026-01-01', fees: 0, totalAmount: 1000, cashFlowType: 'DEPOSIT' },
      { id: 'buy', type: 'BUY', ticker: 'TEST', companyName: 'Test', sector: 'Other', shares: 10, price: 50, date: '2026-01-02', fees: 0, totalAmount: 500 },
      { id: 'sell', type: 'SELL', ticker: 'TEST', companyName: 'Test', sector: 'Other', shares: 5, price: 70, date: '2026-01-03', fees: 0, totalAmount: 350 },
    ], {
      TEST: [
        { date: '2026-01-02', close: 50 },
        { date: '2026-01-03', close: 70 },
      ],
    }, '2026-01-01', '2026-01-03');
    expect(curve.find((p) => p.date === '2026-01-02')?.equity).toBe(1000);
    expect(curve.find((p) => p.date === '2026-01-03')?.equity).toBe(1200);
  });

  it('does not treat dividends as investor cash flows', () => {
    const flows = buildExternalCashFlows([
      { id: 'dep', type: 'BUY', ticker: 'CASH', companyName: 'Cash', sector: 'Liquid Buying Power', shares: 1000, price: 1, date: '2026-01-01', fees: 0, totalAmount: 1000, cashFlowType: 'DEPOSIT' },
      { id: 'div', type: 'BUY', ticker: 'CASH', companyName: 'Cash', sector: 'Liquid Buying Power', shares: 100, price: 1, date: '2026-02-01', fees: 0, totalAmount: 100, cashFlowType: 'DIVIDEND' },
      { id: 'out', type: 'SELL', ticker: 'CASH', companyName: 'Cash', sector: 'Liquid Buying Power', shares: 200, price: 1, date: '2026-03-01', fees: 0, totalAmount: 200, cashFlowType: 'WITHDRAWAL' },
    ]);
    expect(flows).toHaveLength(2);
    expect(flows.map((flow) => flow.amount)).toEqual([-1000, 200]);
  });

  it('calculates a zero MWRR when the ending value equals the contributed capital', () => {
    expect(calculateMWRR([{ date: '2026-01-01', amount: -1000 }], 1000, '2027-01-01')).toBeCloseTo(0, 5);
  });
});
