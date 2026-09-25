import { describe, expect, it } from 'vitest';
import type { ClosedTrade } from '../types';
import { filterRealizedTrajectoryTrades } from './realizedTrajectoryTimeframes';

function trade(id: string, sellDate: string): ClosedTrade {
  return {
    id,
    ticker: id,
    companyName: id,
    sector: 'Other',
    shares: 1,
    buyPrice: 10,
    sellPrice: 11,
    buyDate: '2026-01-01',
    sellDate,
    holdingDays: 1,
    realizedPnlEgp: 1,
    realizedPnlPercent: 10,
    outcome: 'WIN',
    tradeType: 'Swing',
  };
}

const trades = [
  trade('JAN', '2026-01-15'),
  trade('JUN', '2026-06-20'),
  trade('AUG', '2026-08-30'),
  trade('SEP16', '2026-09-16'),
  trade('SEP18', '2026-09-18'),
  trade('SEP24', '2026-09-24'),
];

const options = { latestSessionDate: '2026-09-24' };

describe('realized trajectory timeframe filter', () => {
  it('keeps all trades for ALL', () => {
    expect(filterRealizedTrajectoryTrades(trades, 'ALL', options)).toHaveLength(6);
  });

  it('uses the latest EGX session for 1D', () => {
    expect(filterRealizedTrajectoryTrades(trades, '1D', options).map((row) => row.id))
      .toEqual(['SEP24']);
  });

  it('filters the rolling weekly window inclusively', () => {
    expect(filterRealizedTrajectoryTrades(trades, '1W', options).map((row) => row.id))
      .toEqual(['SEP18', 'SEP24']);
  });

  it('filters one month, 90 days, and YTD using the shared analytics windows', () => {
    expect(filterRealizedTrajectoryTrades(trades, '1M', options).map((row) => row.id))
      .toEqual(['AUG', 'SEP16', 'SEP18', 'SEP24']);
    expect(filterRealizedTrajectoryTrades(trades, '90D', options).map((row) => row.id))
      .toEqual(['AUG', 'SEP16', 'SEP18', 'SEP24']);
    expect(filterRealizedTrajectoryTrades(trades, 'YTD', options)).toHaveLength(6);
  });
});
