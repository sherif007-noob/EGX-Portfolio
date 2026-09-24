import { describe, expect, it } from 'vitest';
import type { TradeTransaction } from '../types';
import { resolveIntradaySessionTickers } from './intradayTickerUniverse';

function tx(input: Partial<TradeTransaction> & Pick<TradeTransaction, 'id' | 'type' | 'ticker' | 'shares' | 'price' | 'date'>): TradeTransaction {
  return {
    companyName: input.ticker,
    sector: input.ticker === 'CASH' ? 'Liquid Buying Power' : 'Other',
    fees: 0,
    totalAmount: input.shares * input.price,
    ...input,
  };
}

describe('intraday session ticker universe', () => {
  it('includes positions held entering the session and tickers traded that day', () => {
    const transactions = [
      tx({ id: 'buy-oras', type: 'BUY', ticker: 'ORAS', shares: 10, price: 100, date: '2026-09-20' }),
      tx({ id: 'buy-old', type: 'BUY', ticker: 'TALM', shares: 20, price: 30, date: '2026-09-20' }),
      tx({ id: 'sell-old', type: 'SELL', ticker: 'TALM', shares: 20, price: 31, date: '2026-09-22' }),
      tx({ id: 'buy-today', type: 'BUY', ticker: 'ACTF', shares: 50, price: 3, date: '2026-09-24' }),
      tx({ id: 'cash', type: 'BUY', ticker: 'CASH', shares: 1, price: 1000, date: '2026-09-24' }),
    ];

    expect(resolveIntradaySessionTickers(transactions, '2026-09-24')).toEqual(['ACTF', 'ORAS']);
  });

  it('keeps a same-day round trip because it affected intraday NAV', () => {
    const transactions = [
      tx({ id: 'buy', type: 'BUY', ticker: 'NAPR', shares: 10, price: 40, date: '2026-09-24' }),
      tx({ id: 'sell', type: 'SELL', ticker: 'NAPR', shares: 10, price: 42, date: '2026-09-24' }),
    ];

    expect(resolveIntradaySessionTickers(transactions, '2026-09-24')).toEqual(['NAPR']);
  });

  it('normalizes ticker variants and excludes closed historical positions', () => {
    const transactions = [
      tx({ id: 'buy', type: 'BUY', ticker: 'egx:oras', shares: 4, price: 100, date: '2026-09-20' }),
      tx({ id: 'sell', type: 'SELL', ticker: 'ORAS.CA', shares: 4, price: 110, date: '2026-09-21' }),
    ];

    expect(resolveIntradaySessionTickers(transactions, '2026-09-24')).toEqual([]);
  });
});
