import { describe, expect, it } from 'vitest';
import { buildPerformanceEngineResult } from './performanceEngine';

describe('performance engine', () => {
  it('combines historical valuation, external cash flows, MWRR, and drawdown', () => {
    const result = buildPerformanceEngineResult([
      { id: 'dep', type: 'BUY', ticker: 'CASH', companyName: 'Cash', sector: 'Liquid Buying Power', shares: 1000, price: 1, date: '2026-01-01', fees: 0, totalAmount: 1000, cashFlowType: 'DEPOSIT' },
      { id: 'buy', type: 'BUY', ticker: 'TEST', companyName: 'Test', sector: 'Other', shares: 10, price: 50, date: '2026-01-02', fees: 0, totalAmount: 500 },
    ], {
      TEST: [{ date: '2026-01-02', close: 50 }, { date: '2026-01-03', close: 60 }],
    }, '2026-01-01', '2026-01-03');

    expect(result.valuations).toHaveLength(3);
    expect(result.externalCashFlows).toHaveLength(1);
    expect(result.externalCashFlows[0].amount).toBe(-1000);
    expect(result.dataQuality.incompleteDays).toBe(0);
    expect(result.valuations.at(-1)?.equity).toBe(1100);
    expect(result.maxDrawdownEgp).toBe(0);
  });
});
