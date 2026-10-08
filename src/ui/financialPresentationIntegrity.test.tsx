import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Position, TradeTransaction, PortfolioMetrics } from '../types';
import { isCashLedgerRecord, filterExecutions, filterInvestmentActivity } from '../services/ledgerRecordTypes';
import { cashFlowNeutralReturn } from './cashFlowNeutralReturn';
import { SimpleTransactionsView } from './SimpleTransactionsView';
import { NavReconciliation, navBreakdown } from './NavReconciliation';
import { activityRecordView } from './activityRecordModel';

const cash=(id:string,amount:number,kind:'DEPOSIT'|'WITHDRAWAL'|'RECONCILIATION_ADJUSTMENT'):TradeTransaction=>({
  id,type:kind==='WITHDRAWAL'?'SELL':'BUY',ticker:'CASH',
  companyName:'Cash Balance', sector:'Liquid Buying Power',
  shares:Math.abs(amount),price:1,fees:0,totalAmount:Math.abs(amount),
  cashFlowType:kind,cashFlowAmount:amount,date:'2026-10-07',
});
const buy:TradeTransaction={id:'buy-1',type:'BUY',ticker:'ARCC',companyName:'Arabian Cement',
  sector:'Building Materials & Cement',shares:10,price:20,fees:1,totalAmount:201,date:'2026-10-07'};
const position:Position={id:'p',ticker:'ARCC',companyName:'Arabian Cement',sector:'Building Materials & Cement',
  shares:10,avgBuyPrice:20,currentPrice:25,totalFees:1,buyDate:'2026-10-07'};
const metrics={totalValue:350, cashBalance:100, pendingIpoSubscriptionsEgp:0} as PortfolioMetrics;

describe('cash ledger versus investment activity separation',()=>{
  it('treats pseudo BUY CASH shares as cash events, not equity trades',()=>{
    const rows=[cash('a',20000,'DEPOSIT'),cash('b',3000,'WITHDRAWAL'),cash('c',100,'RECONCILIATION_ADJUSTMENT'),buy];
    expect(rows.slice(0,3).every(isCashLedgerRecord)).toBe(true);
    expect(filterInvestmentActivity(rows).map(tx=>tx.id)).toEqual(['buy-1']);
    expect(filterExecutions(rows).map(tx=>tx.id)).toEqual(['buy-1']);
  });
  it('shows cash in Activity without inventing equity shares',()=>{
    const html=renderToStaticMarkup(
      <SimpleTransactionsView transactions={[cash('deposit',20000,'DEPOSIT'),buy]}
        positions={[position]} closedTrades={[]} onDeleteTransaction={async()=>true}/>,
    );
    expect(html).toContain('ARCC');
    expect(html).not.toContain('20,000 shares');
    expect(html).toContain('Deposit');
    expect(html).toContain('Cash events');
    expect(html).toContain('All recorded portfolio events');
  });
  it('uses the correct details for deposit, dividend and bonus shares',()=>{
    const deposit=activityRecordView(cash('dep',20000,'DEPOSIT'));
    expect(deposit.details.some(x=>x.label==='Shares')).toBe(false);
    expect(deposit.details.some(x=>x.label==='Amount')).toBe(true);
    const dividend=activityRecordView({
      ...cash('div',50,'DEPOSIT'), cashFlowType:'DIVIDEND',
    });
    expect(dividend.title).toBe('Dividend');
    expect(dividend.positive).toBe(true);
    const bonus=activityRecordView({
      ...buy,type:'CORPORATE_ACTION',corporateActionType:'BONUS_SHARES',
      shares:668,price:0,totalAmount:0,corporateActionSourceShares:300,
    });
    expect(bonus.details).toContainEqual({label:'Shares received',value:'668'});
    expect(bonus.details.some(x=>x.label==='Price / share')).toBe(false);
  });

  it('distinguishes full IPO commitment from its held cash and unallocated shares',()=>{
    const ipo=activityRecordView({...buy,id:'ipo',type:'IPO_SUBSCRIPTION',ticker:'HALN',
      shares:6600,price:24.50,totalAmount:161700,
      ipoSubscription:{status:'SUBMITTED',requestedAmount:161700,reservedAmount:40425,
        requestedShares:6600,offerPrice:24.50,subscriptionDate:'2026-10-07'},
    });
    expect(ipo.amount).toBe(40425);
    expect(ipo.details).toContainEqual({label:'Full order',value:'161,700.00 EGP'});
    expect(ipo.details).toContainEqual({label:'Broker cash hold',value:'40,425.00 EGP'});
    expect(ipo.details).toContainEqual({label:'Shares requested',value:'6,600'});
    expect(ipo.details.some(x=>x.label==='Shares allocated')).toBe(false);
  });
});

describe('cash-flow-neutral Return chart EGP series',()=>{
  it('does not turn deposits, withdrawals or audited capital adjustments into gains',()=>{
    const rows=cashFlowNeutralReturn([
      {date:'2026-10-05',equity:1000,externalFlow:0},
      {date:'2026-10-06',equity:61000,externalFlow:60000},
      {date:'2026-10-07',equity:41000,externalFlow:-20000},
      {date:'2026-10-08',equity:41200,externalFlow:200},
    ]);
    expect(rows.map(x=>x.value)).toEqual([0,0,0,0]);
  });
  it('retains genuine investment movement while neutralizing cash flows',()=>{
    const rows=cashFlowNeutralReturn([
      {date:'2026-10-06',equity:1000,externalFlow:0},
      {date:'2026-10-07',equity:1610,externalFlow:500},
      {date:'2026-10-08',equity:1460,externalFlow:-200},
    ]);
    expect(rows.map(x=>x.value)).toEqual([0,110,160]);
  });
});

describe('NAV investigation is read-only',()=>{
  it('makes cash, holdings and IPO components explicit without double counting',()=>{
    const result=navBreakdown([position],100,500);
    expect(result.marketValue).toBe(250);
    expect(result.reconstructedNav).toBe(850);
    expect(result.reservedIpo).toBe(500);
  });
  it('flags stored quotes restamped during a verified holiday',()=>{
    const result=navBreakdown([{...position,priceUpdatedAt:'2026-10-08T20:49:20.072Z'}],100);
    expect(result.lastQuoteByTicker[0].timestampOnClosedDay).toBe(true);
  });
  it('renders the comparison without writing the ledger',()=>{
    const html=renderToStaticMarkup(<NavReconciliation metrics={metrics} positions={[position]}/>);
    expect(html).toContain('Reconcile NAV with Telda');
    expect(html).not.toContain('premium-card');
  });
});
