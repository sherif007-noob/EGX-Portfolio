import { describe, expect, it } from 'vitest';
import type { TradeTransaction } from '../types';
import { estimateBrokerageFee, estimateBrokerageFeeRate } from './brokerageFeeEstimator';

const tx = (
  id: string,
  type: 'BUY' | 'SELL',
  gross: number,
  fee: number,
): TradeTransaction => ({
  id,
  tradeId: Number(id.replace(/\D/g, '')) || 1,
  type,
  ticker: 'TEST',
  companyName: 'Test',
  sector: 'Other',
  shares: 10,
  price: gross / 10,
  fees: fee,
  totalAmount: type === 'BUY' ? gross + fee : gross - fee,
  date: '2026-09-01',
});

describe('brokerage fee estimator', () => {
  it('learns a weighted rate from buy executions when enough history exists', () => {
    const estimate = estimateBrokerageFeeRate([
      tx('1', 'BUY', 1000, 2),
      tx('2', 'BUY', 2000, 5),
      tx('3', 'BUY', 3000, 9),
      tx('4', 'SELL', 10000, 40),
    ]);

    expect(estimate.source).toBe('buy_history');
    expect(estimate.sampleSize).toBe(3);
    expect(estimate.rate).toBeCloseTo(16 / 6000, 10);
    expect(estimateBrokerageFee(7500, estimate)).toBe(20);
  });

  it('falls back to all usable market executions when buy history is sparse', () => {
    const estimate = estimateBrokerageFeeRate([
      tx('1', 'BUY', 1000, 2.5),
      tx('2', 'SELL', 2000, 5),
    ]);

    expect(estimate.source).toBe('market_history');
    expect(estimate.sampleSize).toBe(2);
    expect(estimate.rate).toBeCloseTo(0.0025, 10);
  });

  it('uses the conservative default when no usable fee history exists', () => {
    const estimate = estimateBrokerageFeeRate([]);
    expect(estimate.source).toBe('fallback');
    expect(estimate.rate).toBe(0.0025);
    expect(estimateBrokerageFee(10000, estimate)).toBe(25);
  });
});
