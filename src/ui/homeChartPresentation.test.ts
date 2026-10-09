import {describe,expect,it} from 'vitest';
import type {TradeTransaction} from '../types';
import {chartCapitalEvents,chartReturnTooltipMetrics} from './homeChartPresentation';

const cash = (id:string,date:string,amount:number,type:'DEPOSIT'|'WITHDRAWAL'|'FEE'|'DIVIDEND'|'RECONCILIATION_ADJUSTMENT'):TradeTransaction => ({
  id,date,type:type==='WITHDRAWAL'?'SELL':'BUY',ticker:'CASH',
  companyName:'Cash',sector:'Liquid Buying Power',
  shares:Math.abs(amount),price:1,totalAmount:Math.abs(amount),fees:0,
  cashFlowType:type,cashFlowAmount:amount,
});

describe('Home NAV breakdown and financial event presentation',()=>{
  it('groups multiple deposits on one day into one marker, never labelling them profit',()=>{
    const events=chartCapitalEvents([
      cash('d1','2026-10-07',20000,'DEPOSIT'),
      cash('d2','2026-10-07',20000,'DEPOSIT'),
      cash('d3','2026-10-07',20000,'DEPOSIT'),
      cash('fee','2026-10-07',11,'FEE'),
      cash('div','2026-10-07',25,'DIVIDEND'),
      cash('recon','2026-10-07',3,'RECONCILIATION_ADJUSTMENT'),
      cash('withdraw','2026-10-08',500,'WITHDRAWAL'),
      {id:'ipo',type:'IPO_SUBSCRIPTION',ticker:'IPOX',companyName:'IPO',sector:'Other',
        date:'2026-10-07',shares:4000,price:25,totalAmount:100000,fees:0,netCashImpact:-25000,
        ipoSubscription:{status:'SUBMITTED',subscriptionDate:'2026-10-07',
          requestedShares:4000,offerPrice:25,requestedAmount:100000,reservedAmount:25000}},
    ]);
    expect(events).toEqual([
      {date:'2026-10-07',deposited:60000,withdrawn:0,netFlow:60000},
      {date:'2026-10-08',deposited:0,withdrawn:500,netFlow:-500},
    ]);
  });
  it('compares profit between sessions after subtracting the deposit, not the NAV jump',()=>{
    const prior={date:'2026-10-06',equity:70000,externalFlow:0,
      twrPercent:0,returnEgp:0};
    const next={date:'2026-10-07',equity:130200,externalFlow:60000,
      twrPercent:0.285714285714286,returnEgp:200};
    const metric=chartReturnTooltipMetrics(next,prior);
    expect(metric.nav).toBe(130200);
    expect(metric.cumulativeReturn).toBe(200);
    expect(metric.intervalReturn).toBe(200);
    expect(metric.intervalPercent).toBeCloseTo(200/70000*100,8);
  });
  it('shows a baseline as no previous-session P&L',()=>{
    const metric=chartReturnTooltipMetrics({
      date:'2026-10-06',equity:70000,externalFlow:0,twrPercent:0,returnEgp:0,
    });
    expect(metric.cumulativeReturn).toBe(0);
    expect(metric.intervalReturn).toBeNull();
    expect(metric.intervalPercent).toBeNull();
    expect(metric.hasPrevious).toBe(false);
  });
  it('keeps missing compounded return unverified instead of displaying a fabricated percent',()=>{
    const next=chartReturnTooltipMetrics(
      {date:'2026-10-07',equity:131000,externalFlow:60000,twrPercent:null,returnEgp:1000},
      {date:'2026-10-06',equity:70000,externalFlow:0,twrPercent:0,returnEgp:0},
    );
    expect(next.intervalReturn).toBe(1000);
    expect(next.intervalPercent).toBeNull();
  });
});
