import { describe, expect, it } from 'vitest';
import { historyStorageTickers, projectHistoricalPriceRows } from './historicalPriceStore';
import { requiresListedMarketHistory } from './historicalCoverage';
import { buildUnifiedAnalyticsResult } from './unifiedAnalyticsEngine';
import type { TradeTransaction } from '../types';

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

  it('clears the AIH incomplete-valuation warning after the scheduled AIHC bar arrives', () => {
    const orders: TradeTransaction[] = [
      {id:'base',type:'BUY',ticker:'TEST',companyName:'Test',sector:'Other',shares:10,
        price:10,date:'2026-10-08',fees:0,totalAmount:100},
      {id:'late-log',type:'BUY',ticker:'AIH',companyName:'Arabia Investments',
        sector:'Other',shares:100,price:0.86,date:'2026-10-11',
        executedAt:'2026-10-11T09:20:00.000Z',fees:0,totalAmount:86},
    ];
    const basePrices = {
      TEST:[
        {date:'2026-10-08',close:10},
        {date:'2026-10-11',close:10.2},
      ],
    };
    const before = buildUnifiedAnalyticsResult(orders, basePrices, 'ALL', {
      latestSessionDate:'2026-10-11',openingCapital:200,
    });
    expect(before.dataQuality.missingTickers).toContain('AIH');

    const withAlias = projectHistoricalPriceRows(['AIH'], [oct11]);
    const after = buildUnifiedAnalyticsResult(orders, {...basePrices,...withAlias}, 'ALL', {
      latestSessionDate:'2026-10-11',openingCapital:200,
    });
    expect(after.dataQuality.missingTickers).not.toContain('AIH');
    expect(after.points.some(point=>point.date==='2026-10-11')).toBe(true);
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
