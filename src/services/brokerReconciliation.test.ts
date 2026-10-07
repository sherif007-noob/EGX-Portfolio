import { describe, expect, it } from 'vitest';
import type { EGXTicker, Position, TradeTransaction } from '../types';
import {
  parseBrokerPositionsText,
  reconcileBrokerSnapshot,
} from './brokerReconciliation';

const tickers: EGXTicker[] = [
  {
    ticker: 'KORA',
    nameEn: 'Korra Energi',
    nameAr: '',
    isin: 'TEST-KORA',
    sector: 'Contracting & Construction',
    lastPrice: 6.13,
    change: 0,
    changePercent: 0,
    dayLow: 0,
    dayHigh: 0,
    yearLow: 0,
    yearHigh: 0,
    volume: 0,
    valueEgp: 0,
    trendStatus: 'Rangebound Neutral',
    rsi14: 50,
    support: 0,
    resistance: 0,
    targetPrice: 0,
    stopLoss: 0,
    lastUpdated: '',
    aliases: ['OLDKORA'],
  },
];

function position(ticker: string, shares: number): Position {
  return {
    id: `pos-${ticker}`,
    ticker,
    companyName: ticker,
    sector: 'Other',
    shares,
    avgBuyPrice: 10,
    currentPrice: 10,
    buyDate: '2026-10-01',
  };
}

function tx(
  id: string,
  type: 'BUY' | 'SELL',
  ticker: string,
  shares: number,
  date: string,
  totalAmount = shares * 10,
): TradeTransaction {
  return {
    id,
    type,
    ticker,
    companyName: ticker,
    sector: 'Other',
    shares,
    price: 10,
    date,
    fees: 0,
    totalAmount,
    netCashImpact: type === 'BUY' ? -totalAmount : totalAmount,
  };
}

describe('broker reconciliation', () => {
  it('parses pasted holdings and resolves directory aliases', () => {
    expect(parseBrokerPositionsText('Ticker,Shares\nOLDKORA,650', tickers)).toEqual([
      { ticker: 'KORA', shares: 650, avgPrice: undefined },
    ]);
  });

  it('rejects duplicate broker rows instead of silently double-counting shares', () => {
    expect(() => parseBrokerPositionsText('KORA,100\nKORA,100', tickers))
      .toThrow('appears more than once');
  });

  it('reports an exact portfolio and cash match', () => {
    const report = reconcileBrokerSnapshot(
      {
        brokerName: 'Telda',
        asOfDate: '2026-10-07',
        cashBalance: 5_000,
        positions: [{ ticker: 'KORA', shares: 650 }],
      },
      {
        positions: [position('KORA', 650)],
        transactions: [tx('buy-1', 'BUY', 'KORA', 650, '2026-10-01')],
        cashBalance: 5_000,
        tickers,
      },
    );

    expect(report.isFullyMatched).toBe(true);
    expect(report.mismatchedPositions).toBe(0);
    expect(report.cash.differenceCash).toBe(0);
  });

  it('shows App minus Broker share difference and attributes the active ledger cycle', () => {
    const report = reconcileBrokerSnapshot(
      {
        brokerName: 'Telda',
        asOfDate: '2026-10-07',
        cashBalance: 2_000,
        positions: [{ ticker: 'KORA', shares: 320 }],
      },
      {
        positions: [position('KORA', 640)],
        transactions: [
          tx('buy-1', 'BUY', 'KORA', 500, '2026-10-01'),
          tx('buy-2', 'BUY', 'KORA', 300, '2026-10-02'),
          tx('sell-1', 'SELL', 'KORA', 160, '2026-10-03'),
        ],
        cashBalance: 2_000,
        tickers,
      },
    );

    expect(report.rows[0]).toMatchObject({
      ticker: 'KORA',
      brokerShares: 320,
      appShares: 640,
      differenceShares: 320,
      status: 'SHARE_MISMATCH',
      ledgerTransactionIds: ['buy-1', 'buy-2', 'sell-1'],
    });
  });

  it('flags broker-only holdings as missing from the app', () => {
    const report = reconcileBrokerSnapshot(
      {
        brokerName: 'Telda',
        asOfDate: '2026-10-07',
        cashBalance: 0,
        positions: [{ ticker: 'OLDKORA', shares: 50 }],
      },
      {
        positions: [],
        transactions: [],
        cashBalance: 0,
        tickers,
      },
    );

    expect(report.rows[0]).toMatchObject({
      ticker: 'KORA',
      status: 'MISSING_IN_APP',
      brokerShares: 50,
      appShares: 0,
      differenceShares: -50,
    });
  });

  it('reports cash mismatch and exposes recent cash-affecting ledger evidence', () => {
    const report = reconcileBrokerSnapshot(
      {
        brokerName: 'Telda',
        asOfDate: '2026-10-07',
        cashBalance: 1_000,
        positions: [],
      },
      {
        positions: [],
        transactions: [tx('buy-1', 'BUY', 'KORA', 10, '2026-10-01', 100)],
        cashBalance: 1_400,
        tickers,
      },
    );

    expect(report.cash.matches).toBe(false);
    expect(report.cash.differenceCash).toBe(400);
    expect(report.cash.ledgerEvidence[0].id).toBe('buy-1');
  });
});
