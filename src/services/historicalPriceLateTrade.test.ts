import { describe, expect, it } from 'vitest';
import { historyStorageTickers, projectHistoricalPriceRows } from './historicalPriceStore';
import { requiresListedMarketHistory } from './historicalCoverage';

describe('late-logged EGX trade history and renamed symbols', () => {
  const oct11 = {
    ticker: 'AIHC', trading_date: '2026-10-11', close: 0.861,
    source: 'tradingview' as const, retrieved_at: '2026-10-11T17:15:42Z',
  };

  it('queries both the persisted AIH ledger ticker and its canonical AIHC storage ticker', () => {
    expect(historyStorageTickers(['AIH'])).toEqual(['AIH', 'AIHC']);
    expect(historyStorageTickers(['AIH', 'AIHC'])).toEqual(['AIH', 'AIHC']);
    expect(historyStorageTickers(['EGX:AIH', 'AIHC.CA'])).toEqual(['AIH', 'AIHC']);
  });

  it('projects the real canonical daily closing price under the original AIH ledger symbol', () => {
    const result = projectHistoricalPriceRows(['AIH'], [oct11]);
    expect(result.AIH).toEqual([{
      date:'2026-10-11',close:0.861,open:undefined,high:undefined,low:undefined,
      volume:undefined,source:'tradingview',retrievedAt:'2026-10-11T17:15:42Z',
    }]);
    expect(result.AIHC).toBeUndefined();
  });

  it('retains older legacy dates but prefers current canonical prices on duplicate dates', () => {
    const result = projectHistoricalPriceRows(['AIH'], [
      {ticker:'AIH', trading_date:'2026-10-08', close:0.81},
      {ticker:'AIH', trading_date:'2026-10-11', close:0.82},
      oct11,
    ]);
    expect(result.AIH.map(x=>[x.date,x.close])).toEqual([
      ['2026-10-08',0.81],
      ['2026-10-11',0.861],
    ]);
  });

  it('does not invent close prices when neither ticker has daily history', () => {
    expect(projectHistoricalPriceRows(['AIH'], []).AIH).toEqual([]);
  });

  it('excludes subscription-only and cash events, retaining executed share buys', () => {
    expect(requiresListedMarketHistory('IPO_SUBSCRIPTION')).toBe(false);
    expect(requiresListedMarketHistory('CASH')).toBe(false);
    expect(requiresListedMarketHistory('DEPOSIT')).toBe(false);
    expect(requiresListedMarketHistory('BUY')).toBe(true);
    expect(requiresListedMarketHistory('SELL')).toBe(true);
    expect(requiresListedMarketHistory('OPENING_POSITION')).toBe(true);
  });
});
