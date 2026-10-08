import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Position, TradeTransaction, PortfolioMetrics } from '../types';
import { isCashLedgerRecord, filterExecutions, filterInvestmentActivity } from '../services/ledgerRecordTypes';
import { cashFlowNeutralReturn } from './cashFlowNeutralReturn';
import { SimpleTransactionsView } from './SimpleTransactionsView';
import { NavReconciliation, navBreakdown } from './NavReconciliation';

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
  it('does not render cash entries or pseudo-shares in the transaction journal',()=>{
    const html=renderToStaticMarkup(
      <SimpleTransactionsView transactions={[cash('deposit',20000,'DEPOSIT'),buy]}
        positions={[position]} closedTrades={[]} onDeleteTransaction={async()=>true}/>,
    );
    expect(html).toContain('ARCC');
    expect(html).not.toContain('20,000 shares');
    expect(html).not.toContain('Cash Balance');
    expect(html).toContain('cash transfers are in Cash');
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
