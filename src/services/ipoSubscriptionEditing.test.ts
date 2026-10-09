import { describe, expect, it } from 'vitest';
import type { TradeTransaction } from '../types';
import { calculatePortfolioMetrics } from '../utils/portfolioMetrics';
import { cairoOrderTimeToUtcIso } from './ipoSubscriptionEditing';
import { prepareIpoSubscriptionMutation, prepareIpoSubscriptionCorrectionMutation, prepareIpoCancellationMutation } from './ledgerWorkflowMutations';
import { reconcilePortfolioFromLedger } from './portfolioReconciliation';
import { pendingIpoSubscriptionValue } from './ipoSubscriptions';

const cash: TradeTransaction = {id:'tx-cash-z',type:'BUY',ticker:'CASH',companyName:'Cash',
  sector:'Other',shares:100000,price:1,fees:0,totalAmount:100000,
  cashFlowType:'DEPOSIT',cashFlowAmount:100000,date:'2026-10-07'};
const order = () => {
  const initial = {transactions:[cash],positions:[],closedTrades:[],cashBalance:100000,capitalDeposits:100000,tickers:[]};
  return prepareIpoSubscriptionMutation(initial,{
    transactionId:'tx-0-ipo',ticker:'IPOX',companyName:'Example IPO',sector:'Other',
    requestedShares:4000,requestedAmount:100000,reservedAmount:25000,offerPrice:25,subscriptionDate:'2026-10-09',
  });
};
const source=()=>{
  const transactions=order().transactions;
  const a=reconcilePortfolioFromLedger(transactions,[],100000);
  return {transactions,positions:a.reconciledPositions,closedTrades:a.reconciledClosedTrades,
    cashBalance:a.reconciledCashBalance,capitalDeposits:100000,tickers:[]};
};

describe('pending IPO date corrections',()=>{
  it('converts Cairo clocks across daylight saving time',()=>{
    expect(cairoOrderTimeToUtcIso('2026-10-07','10:51')).toBe('2026-10-07T07:51:00.000Z');
    expect(cairoOrderTimeToUtcIso('2026-01-07','10:51')).toBe('2026-01-07T08:51:00.000Z');
  });
  it('preserves the order and NAV when correcting its date with the broker time',()=>{
    const prior=source();
    const correction=prepareIpoSubscriptionCorrectionMutation(prior,{
      transactionId:'tx-0-ipo',subscriptionDate:'2026-10-07',executionTimeCairo:'10:51'});
    expect(correction.transactions).toHaveLength(prior.transactions.length);
    const tx=correction.transactions.find(t=>t.id==='tx-0-ipo')!;
    expect(tx.date).toBe('2026-10-07');
    expect(tx.executedAt).toBe('2026-10-07T07:51:00.000Z');
    expect(tx.ipoSubscription?.reservedAmount).toBe(25000);
    expect(tx.ipoSubscription?.requestedShares).toBe(4000);
    const report=reconcilePortfolioFromLedger(correction.transactions,[],100000);
    expect(report.discrepanciesFound).toEqual([]);
    expect(report.reconciledCashBalance).toBe(75000);
    expect(pendingIpoSubscriptionValue(correction.transactions)).toBe(25000);
    expect(calculatePortfolioMetrics([],75000,[],[],correction.transactions).totalValue).toBe(100000);
  });
  it('requires the placement time when deposits share the corrected date',()=>{
    expect(()=>prepareIpoSubscriptionCorrectionMutation(source(),{
      transactionId:'tx-0-ipo',subscriptionDate:'2026-10-07'})).toThrow(/actual Cairo placement time/);
  });
  it('rejects changes to cancelled subscriptions',()=>{
    const cancelled=prepareIpoCancellationMutation(source(),'tx-0-ipo');
    const input={...source(),transactions:cancelled.transactions};
    expect(()=>prepareIpoSubscriptionCorrectionMutation(input,{
      transactionId:'tx-0-ipo',subscriptionDate:'2026-10-07',executionTimeCairo:'10:51'
    })).toThrow(/Only pending/);
  });
});
