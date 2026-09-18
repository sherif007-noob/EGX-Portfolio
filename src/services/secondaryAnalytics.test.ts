import { describe, expect, it } from 'vitest';
import type { TradeTransaction } from '../types';
import type { UnifiedAnalyticsResult } from './unifiedAnalyticsEngine';
import { buildSecondaryAnalytics } from './secondaryAnalytics';

const tx = (input: Partial<TradeTransaction> & Pick<TradeTransaction, 'id' | 'type' | 'ticker' | 'shares' | 'price' | 'date'>): TradeTransaction => ({
  companyName: input.ticker,
  sector: 'Other',
  fees: 0,
  totalAmount: input.shares * input.price,
  ...input,
});

const result: UnifiedAnalyticsResult = {
  timeframe: 'ALL',
  window: {
    timeframe: 'ALL',
    label: 'All time',
    startDate: '2026-01-01',
    endDate: '2026-01-03',
    resolution: '1d',
    requiresIntraday: false,
  },
  points: [
    {
      date: '2026-01-01', equity: 1000, cash: 499, marketValue: 501,
      netDeposits: 1000, externalFlow: 0, twrPercent: 0, mwrrPercent: 0,
      annualizedMwrrPercent: 0, performanceIndex: 100, drawdownPercent: 0,
      equityDrawdownEgp: 0, complete: true,
    },
    {
      date: '2026-01-02', equity: 1099, cash: 499, marketValue: 600,
      netDeposits: 1000, externalFlow: 0, twrPercent: 9.9, mwrrPercent: 9.9,
      annualizedMwrrPercent: 0, performanceIndex: 109.9, drawdownPercent: 0,
      equityDrawdownEgp: 0, complete: true,
    },
    {
      date: '2026-01-03', equity: 1072, cash: 798, marketValue: 275,
      netDeposits: 1000, externalFlow: 0, twrPercent: 7.2, mwrrPercent: 7.2,
      annualizedMwrrPercent: 0, performanceIndex: 107.2, drawdownPercent: -2.4568,
      equityDrawdownEgp: 27, complete: true,
    },
  ],
  summary: {
    startDate: '2026-01-01', endDate: '2026-01-03', startEquity: 1000, endEquity: 1072,
    pnlEgp: 72, netExternalFlow: 0, twrPercent: 7.2, mwrrPercent: 7.2,
    annualizedMwrrPercent: 0, maxDrawdownPercent: -2.4568, maxEquityDrawdownEgp: 27,
  },
  dataQuality: {
    valuationDays: 3, completeDays: 3, incompleteDays: 0,
    missingTickers: [], hasUsableRange: true, requiresIntraday: false,
  },
};

describe('secondary analytics', () => {
  it('replays fee-aware realized and unrealized P&L', () => {
    const transactions: TradeTransaction[] = [
      tx({ id: 'buy', type: 'BUY', ticker: 'TEST', shares: 10, price: 50, fees: 1, totalAmount: 501, date: '2026-01-01' }),
      tx({ id: 'sell', type: 'SELL', ticker: 'TEST', shares: 5, price: 60, fees: 1, totalAmount: 299, date: '2026-01-03' }),
    ];

    const analytics = buildSecondaryAnalytics(
      transactions,
      {
        TEST: [
          { date: '2026-01-01', close: 50 },
          { date: '2026-01-02', close: 60 },
          { date: '2026-01-03', close: 55 },
        ],
      },
      {},
      result,
    );

    expect(analytics.points).toHaveLength(3);
    expect(analytics.points[0].unrealizedPnlEgp).toBeCloseTo(-1, 8);
    expect(analytics.points[1].unrealizedPnlEgp).toBeCloseTo(99, 8);
    expect(analytics.points[2].realizedPnlEgp).toBeCloseTo(48.5, 8);
    expect(analytics.points[2].unrealizedPnlEgp).toBeCloseTo(24.5, 8);
    expect(analytics.summary.feesInPeriodEgp).toBeCloseTo(2, 8);
  });

  it('uses the unified performance drawdown instead of recomputing nominal equity drawdown', () => {
    const analytics = buildSecondaryAnalytics([], {}, {}, result);
    expect(analytics.summary.maxDrawdownPercent).toBeCloseTo(-2.4568, 8);
    expect(analytics.summary.maxEquityDrawdownEgp).toBe(27);
  });

  it('counts explicit cash fee rows without treating deposits as fees', () => {
    const transactions: TradeTransaction[] = [
      tx({
        id: 'fee', type: 'SELL', ticker: 'CASH', shares: 3, price: 1, totalAmount: 3,
        cashFlowType: 'FEE', cashFlowAmount: 3, date: '2026-01-02',
      }),
      tx({
        id: 'deposit', type: 'BUY', ticker: 'CASH', shares: 100, price: 1, totalAmount: 100,
        cashFlowType: 'DEPOSIT', cashFlowAmount: 100, date: '2026-01-02',
      }),
    ];

    const analytics = buildSecondaryAnalytics(transactions, {}, {}, result);
    expect(analytics.summary.feesInPeriodEgp).toBe(3);
  });
});
