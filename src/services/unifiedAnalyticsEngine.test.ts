import { describe, expect, it } from 'vitest';
import { TradeTransaction } from '../types';
import { calculatePeriodMWR, buildUnifiedAnalyticsResult } from './unifiedAnalyticsEngine';

const cash = (
  id: string,
  date: string,
  amount: number,
  type: 'DEPOSIT' | 'WITHDRAWAL',
): TradeTransaction => ({
  id,
  type: type === 'WITHDRAWAL' ? 'SELL' : 'BUY',
  ticker: 'CASH',
  companyName: 'Cash',
  sector: 'Liquid Buying Power',
  shares: amount,
  price: 1,
  date,
  fees: 0,
  totalAmount: amount,
  cashFlowType: type,
  cashFlowAmount: amount,
});

const buy = (id: string, date: string, shares: number, price: number): TradeTransaction => ({
  id,
  type: 'BUY',
  ticker: 'TEST',
  companyName: 'Test',
  sector: 'Other',
  shares,
  price,
  date,
  fees: 0,
  totalAmount: shares * price,
});

describe('unified analytics engine', () => {
  it('calculates non-annualized period MWR for a simple gain', () => {
    expect(calculatePeriodMWR(1000, '2026-01-01', [], 1100, '2026-01-31')).toBeCloseTo(10, 8);
  });

  it('keeps MWR and TWR distinct when capital is added during the period', () => {
    const transactions = [
      cash('dep-1', '2026-01-01', 1000, 'DEPOSIT'),
      buy('buy-1', '2026-01-01', 10, 50),
      cash('dep-2', '2026-01-03', 1000, 'DEPOSIT'),
    ];
    const history = {
      TEST: [
        { date: '2026-01-01', close: 50 },
        { date: '2026-01-02', close: 60 },
        { date: '2026-01-03', close: 60 },
        { date: '2026-01-04', close: 66 },
      ],
    };

    const result = buildUnifiedAnalyticsResult(transactions, history, 'ALL', {
      latestSessionDate: '2026-01-04',
    });

    expect(result.points).toHaveLength(4);
    expect(result.points[0].netDeposits).toBe(1000);
    expect(result.points[2].netDeposits).toBe(2000);
    expect(result.summary.endEquity).toBe(2160);
    expect(result.summary.netExternalFlow).toBe(1000);
    expect(result.summary.pnlEgp).toBe(160);

    // TWR neutralizes the deposit. Jan 1 -> 2 returns +10%, Jan 2 -> 3 is 0%,
    // and Jan 3 -> 4 returns 60 / 2100 = 2.8571%.
    expect(result.summary.twrPercent).toBeCloseTo(13.142857, 6);
    expect(result.summary.mwrrPercent).not.toBeNull();
    expect(result.summary.mwrrPercent).not.toBeCloseTo(result.summary.twrPercent ?? 0, 2);
  });

  it('includes first trading-day performance when legacy opening capital is the inception baseline', () => {
    const transactions = [
      buy('buy-1', '2026-09-02', 10, 50),
    ];
    const history = {
      TEST: [
        { date: '2026-09-02', close: 51 },
        { date: '2026-09-03', close: 52 },
      ],
    };

    const result = buildUnifiedAnalyticsResult(transactions, history, 'ALL', {
      latestSessionDate: '2026-09-03',
      openingCapital: 1000,
    });

    expect(result.points[0].equity).toBe(1010);
    expect(result.points[0].twrPercent).toBeCloseTo(1, 8);
    expect(result.points[0].mwrrPercent).toBeCloseTo(1, 8);
    expect(result.summary.startEquity).toBe(1000);
    expect(result.summary.pnlEgp).toBe(20);
    expect(result.summary.twrPercent).toBeCloseTo(2, 8);
    expect(result.summary.mwrrPercent).toBeCloseTo(2, 8);
  });

  it('uses the last complete valuation at or before a rolling boundary as baseline', () => {
    const transactions = [
      cash('dep', '2026-09-01', 1000, 'DEPOSIT'),
      buy('buy', '2026-09-01', 10, 50),
    ];
    const history = {
      TEST: [
        { date: '2026-09-09', close: 50 },
        { date: '2026-09-10', close: 55 },
        { date: '2026-09-13', close: 60 },
        { date: '2026-09-17', close: 65 },
      ],
    };

    const result = buildUnifiedAnalyticsResult(transactions, history, '1W', {
      latestSessionDate: '2026-09-17',
    });

    expect(result.window.startDate).toBe('2026-09-10');
    expect(result.summary.startDate).toBe('2026-09-10');
    expect(result.summary.endDate).toBe('2026-09-17');
  });

  it('marks Today as requiring the intraday engine instead of fabricating a daily series', () => {
    const result = buildUnifiedAnalyticsResult(
      [cash('dep', '2026-09-01', 1000, 'DEPOSIT')],
      {},
      'TODAY',
      { latestSessionDate: '2026-09-17' },
    );

    expect(result.window.resolution).toBe('15m');
    expect(result.dataQuality.requiresIntraday).toBe(true);
    expect(result.points).toEqual([]);
    expect(result.summary.mwrrPercent).toBeNull();
  });

  it('calculates performance drawdown independently of deposit-driven equity jumps', () => {
    const transactions = [
      cash('dep-1', '2026-01-01', 1000, 'DEPOSIT'),
      buy('buy', '2026-01-01', 20, 50),
      cash('dep-2', '2026-01-03', 5000, 'DEPOSIT'),
    ];
    const history = {
      TEST: [
        { date: '2026-01-01', close: 50 },
        { date: '2026-01-02', close: 60 },
        { date: '2026-01-03', close: 54 },
      ],
    };

    const result = buildUnifiedAnalyticsResult(transactions, history, 'ALL', {
      latestSessionDate: '2026-01-03',
    });

    expect(result.summary.maxDrawdownPercent).toBeCloseTo(-10, 6);
    expect(result.summary.maxEquityDrawdownEgp).toBe(0);
  });
});
