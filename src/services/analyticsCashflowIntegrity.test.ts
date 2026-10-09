import { describe, expect, it } from 'vitest';
import type { TradeTransaction } from '../types';
import { buildHistoricalEquityCurve } from './portfolioPerformance';
import { buildUnifiedAnalyticsResult } from './unifiedAnalyticsEngine';
import { resolvedHistoricalPriceBasisBridges } from './historicalPriceBasis';
import { cashFlowNeutralReturn } from '../ui/cashFlowNeutralReturn';

const deposit=(date:string,amount:number,id:string):TradeTransaction=>({
  id,type:'BUY',ticker:'CASH',companyName:'Cash',sector:'Liquid Buying Power',
  date,shares:amount,price:1,fees:0,totalAmount:amount,cashFlowType:'DEPOSIT',cashFlowAmount:amount,
});
const buy=(ticker:string,date:string,shares:number,price:number):TradeTransaction=>({
  id:`buy-${ticker}`,type:'BUY',ticker,companyName:ticker,sector:'Other',
  date,shares,price,fees:0,totalAmount:shares*price,
});

const orhdBonus:TradeTransaction={
  id:'real-credit',type:'CORPORATE_ACTION',ticker:'ORHD',companyName:'ORHD',
  sector:'Other',date:'2026-10-07',shares:668,price:0,fees:0,totalAmount:0,
  corporateActionType:'BONUS_SHARES',corporateActionRatio:2.228,
  corporateActionSourceShares:300,
};

const orhdPriceHistory={
  ORHD:[
    {date:'2026-09-29',close:38.8},
    {date:'2026-09-30',close:11.641924},
    {date:'2026-10-06',close:12.029059},
    {date:'2026-10-07',close:12.00},
  ],
};

describe('historical cash flows and corporate-action price basis',()=>{
  it('eliminates phantom Sept 30 crash and Oct 7 bonus-share windfall without altering ledger dates',()=>{
    const transactions=[
      deposit('2026-09-29',70000,'opening-funds'),
      buy('ORHD','2026-09-29',300,38.8),
      deposit('2026-10-07',60000,'ipo-funding'),
      orhdBonus,
    ];
    const input=JSON.stringify(orhdPriceHistory);
    const prior=JSON.stringify(transactions);
    const resolved=resolvedHistoricalPriceBasisBridges(transactions,orhdPriceHistory);
    expect(resolved.unverified).toEqual([]);
    expect(resolved.bridges).toHaveLength(1);
    expect(resolved.bridges[0].factor).toBeCloseTo(968/300,9);
    const result=buildUnifiedAnalyticsResult(transactions,orhdPriceHistory,'ALL',{
      latestSessionDate:'2026-10-07',
    });
    const byDate=Object.fromEntries(result.points.map(p=>[p.date,p]));
    expect(byDate['2026-09-29'].equity).toBeCloseTo(70000,5);
    expect(byDate['2026-09-30'].equity).toBeGreaterThan(68000);
    expect(byDate['2026-09-30'].equity).toBeLessThan(71000);
    expect(byDate['2026-10-07'].equity).toBeCloseTo(129976,3);
    expect(byDate['2026-10-07'].netDeposits).toBe(130000);
    expect(result.summary.pnlEgp).toBeCloseTo(-24,5);
    expect(byDate['2026-10-07'].returnEgp).toBeCloseTo(-24,5);
    expect(JSON.stringify(orhdPriceHistory)).toBe(input);
    expect(JSON.stringify(transactions)).toBe(prior);
    expect(orhdBonus.date).toBe('2026-10-07');
  });

  it('flags unverified vendor price adjustment instead of manufacturing returns',()=>{
    const changedBonus={...orhdBonus,corporateActionRatio:0.9};
    const transactions=[deposit('2026-09-29',70000,'opening'),buy('ORHD','2026-09-29',300,38.8),changedBonus];
    const resolved=resolvedHistoricalPriceBasisBridges(transactions,orhdPriceHistory);
    expect(resolved.bridges).toHaveLength(0);
    expect(resolved.unverified).toHaveLength(1);
    const curve=buildHistoricalEquityCurve(transactions,orhdPriceHistory,'2026-09-29','2026-10-07');
    expect(curve.find(x=>x.date==='2026-09-30')?.complete).toBe(false);
    expect(curve.find(x=>x.date==='2026-10-07')?.complete).toBe(false);
  });

  it('depositing cash with no market movement changes NAV, not EGP return or drawdown',()=>{
    const transactions=[
      deposit('2026-09-27',1000,'initial'),
      buy('TEST','2026-09-27',10,50),
      deposit('2026-09-29',20000,'extra'),
    ];
    const prices={TEST:[
      {date:'2026-09-27',close:50},
      {date:'2026-09-28',close:50},
      {date:'2026-09-29',close:50},
      {date:'2026-09-30',close:50},
    ]};
    const result=buildUnifiedAnalyticsResult(transactions,prices,'ALL',{latestSessionDate:'2026-09-30'});
    expect(result.points.at(-1)?.equity).toBe(21000);
    expect(result.points.at(-1)?.netDeposits).toBe(21000);
    expect(result.summary.pnlEgp).toBe(0);
    expect(result.summary.twrPercent).toBe(0);
    expect(result.summary.maxEquityDrawdownEgp).toBe(0);
    expect(result.points.every(p=>Math.abs(p.returnEgp??0)<0.000001)).toBe(true);
    expect(cashFlowNeutralReturn(result.points).every(p=>Math.abs(p.value)<0.000001)).toBe(true);
  });

  it('keeps an actual broker IPO reservation out of return and in NAV',()=>{
    const transactions=[
      deposit('2026-09-27',100000,'funds'),
      {id:'ipo',type:'IPO_SUBSCRIPTION',ticker:'IPOX',companyName:'IPOX',sector:'Other',
        shares:4000,price:25,fees:0,totalAmount:100000,netCashImpact:-25000,
        date:'2026-09-29',ipoSubscription:{
          status:'SUBMITTED',requestedShares:4000,offerPrice:25,requestedAmount:100000,
          reservedAmount:25000,subscriptionDate:'2026-09-29',
        },
      } satisfies TradeTransaction,
    ];
    const result=buildUnifiedAnalyticsResult(transactions,{},'ALL',{latestSessionDate:'2026-09-30'});
    expect(result.summary.endEquity).toBe(100000);
    expect(result.summary.pnlEgp).toBe(0);
    expect(result.summary.maxEquityDrawdownEgp).toBe(0);
  });
});
