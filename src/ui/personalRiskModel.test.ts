import { describe, expect, it } from 'vitest';
import type { ClosedTrade, Position } from '../types';
import { calculatePersonalRisk, realizedTradeDrawdown } from './personalRiskModel';

const position = (overrides: Partial<Position> = {}): Position => ({
  id:'one', ticker:'ARCC',companyName:'Arabian Cement',sector:'Building Materials & Cement',
  shares:100,avgBuyPrice:10,currentPrice:12,totalFees:5,buyDate:'2026-09-01',
  stopLoss:11,...overrides,
});
const closed = (date:string,pnl:number,id:string):ClosedTrade => ({
  id,ticker:'ARCC',companyName:'Arabian Cement',sector:'Building Materials & Cement',
  shares:10,buyPrice:10,sellPrice:11,buyDate:'2026-09-01',sellDate:date,
  holdingDays:1,realizedPnlEgp:pnl,realizedPnlPercent:5,tradeType:'Swing',
  outcome:pnl>0?'WIN':pnl<0?'LOSS':'BREAKEVEN',
});

describe('personal risk calculations (Stage 7.2)', () => {
  it('uses current portfolio NAV for cash weight and priced holdings for concentration', () => {
    const r=calculatePersonalRisk([
      position(),
      position({id:'two',ticker:'ACTF',sector:'Banking',shares:20,currentPrice:10,stopLoss:9}),
      position({id:'three',ticker:'ORHD',sector:'Real Estate & Construction',shares:40,currentPrice:10,stopLoss:8}),
    ],500,2400,[],100);
    expect(r.investedMarketValue).toBe(1800);
    expect(r.cashAllocationPercent).toBeCloseTo(500/2400*100);
    expect(r.pendingIpoValue).toBe(100);
    expect(r.largestPosition?.ticker).toBe('ARCC');
    expect(r.topThreeHoldingsPercent).toBeCloseTo(100);
    expect(r.largestSector?.holdingsPercent).toBeCloseTo(1200/1800*100);
  });

  it('separates entry-cost risk from downside at current quotes, net of buy fees only', () => {
    const r=calculatePersonalRisk([
      position({currentPrice:8,stopLoss:7}),
      position({id:'two',ticker:'ACTF',shares:10,avgBuyPrice:10,currentPrice:12,stopLoss:11,totalFees:0}),
    ],0,920);
    expect(r.stopCoverageCount).toBe(2);
    expect(r.stopCoverageValue).toBe(920);
    expect(r.currentDownsideToStops).toBe(110);
    expect(r.capitalLossAtStops).toBe(305);
    expect(r.currentDownsideToStopsNavPercent).toBeCloseTo(110/920*100);
  });

  it('never treats missing, breached, invalid or unpriced stops as covered', () => {
    const r=calculatePersonalRisk([
      position({id:'missing',stopLoss:undefined}),
      position({id:'breached',ticker:'ACTF',stopLoss:13}),
      position({id:'invalid',ticker:'ORHD',stopLoss:-3}),
      position({id:'unpriced',ticker:'NAPR',currentPrice:0,stopLoss:11}),
    ],300,3900);
    expect(r.stopCoverageCount).toBe(0);
    expect(r.missingStopCount).toBe(1);
    expect(r.breachedStopCount).toBe(1);
    expect(r.invalidStopCount).toBe(1);
    expect(r.unpricedCount).toBe(1);
    expect(r.uncoveredMarketValue).toBe(3600);
    expect(r.currentDownsideToStops).toBe(0);
    expect(r.holdings.find(h=>h.ticker==='NAPR')?.marketValue).toBeNull();
  });

  it('reports losing open holdings separately from winners', () => {
    const r=calculatePersonalRisk([
      position({currentPrice:9,stopLoss:8}),
      position({id:'win',ticker:'ACTF',currentPrice:14,stopLoss:13}),
    ],0,2300);
    expect(r.underwaterHoldingsLoss).toBeCloseTo(105);
    expect(r.underwaterHoldingsCount).toBe(1);
    expect(r.underwaterHoldingsValue).toBeCloseTo(900);
  });

  it('does not fabricate ratios or realized drawdowns with no positions/trades', () => {
    const r=calculatePersonalRisk([],100,100);
    expect(r.largestPosition).toBeNull();
    expect(r.topThreeHoldingsPercent).toBeNull();
    expect(r.stopCoveragePercent).toBeNull();
    expect(r.realizedPeakToTrough).toBeNull();
    expect(r.cashAllocationPercent).toBe(100);
  });

  it('groups same-day closes before measuring realized peak to trough', () => {
    const result=realizedTradeDrawdown([
      closed('2026-10-01',100,'a'),
      closed('2026-10-02',-200,'b'),
      closed('2026-10-02',150,'c'),
      closed('2026-10-03',-75,'d'),
    ]);
    // Day-end equity: 100 -> 50 -> -25; max 125 from the first peak.
    expect(result.amount).toBe(125);
    expect(result.fromDate).toBe('2026-10-01');
    expect(result.toDate).toBe('2026-10-03');
  });

  it('normalizes legacy day/month/year closes and ignores malformed dates', () => {
    const result=realizedTradeDrawdown([
      closed('01/10/2026',120,'a'),
      closed('02/10/2026',-30,'b'),
      closed('not-a-date',-500,'invalid'),
    ]);
    expect(result.amount).toBe(30);
    expect(result.fromDate).toBe('2026-10-01');
    expect(result.toDate).toBe('2026-10-02');
  });

  it('measures a first-day loss against the zero realized baseline', () => {
    const r=realizedTradeDrawdown([closed('2026-10-01',-50,'a')]);
    expect(r.amount).toBe(50);
    expect(r.fromDate).toBeNull();
    expect(r.toDate).toBe('2026-10-01');
  });
});
