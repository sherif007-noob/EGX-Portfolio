import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { TradeTransaction } from '../types';
import { ActivityActionDialog, type ActivityAction } from './ActivityActionDialog';

const trade:TradeTransaction={
  id:'tx-security',type:'BUY',ticker:'TST',companyName:'Example',sector:'Other',
  shares:10,price:12,fees:1,totalAmount:121,date:'2026-10-07',
};
const cash:TradeTransaction={
  id:'tx-deposit',type:'BUY',ticker:'CASH',companyName:'Cash Balance',sector:'Other',
  shares:500,price:1,fees:0,totalAmount:500,cashFlowType:'DEPOSIT',cashFlowAmount:500,date:'2026-10-07',
};
const ipo:TradeTransaction={
  id:'tx-ipo',type:'IPO_SUBSCRIPTION',ticker:'IPOX',companyName:'Example IPO',
  sector:'Other',shares:4000,price:25,fees:0,totalAmount:100000,date:'2026-10-09',
  netCashImpact:-25000,
  ipoSubscription:{status:'SUBMITTED',requestedShares:4000,requestedAmount:100000,
    reservedAmount:25000,offerPrice:25,subscriptionDate:'2026-10-09'},
};
const noop=async()=>true;
const render=(record:TradeTransaction,action:ActivityAction)=>renderToStaticMarkup(
  <ActivityActionDialog record={record} action={action} transactions={[cash,record]}
    onClose={()=>{}} onSaveTrade={noop} onSaveCash={noop}
    onSaveIpo={noop} onAllocateIpo={noop} onDelete={noop}/>,
);

describe('one-step Activity actions',()=>{
  it('edits stocks as a direct record form, not via a trade-journal navigation',()=>{
    const html=render(trade,'edit');
    expect(html).toContain('Edit TST buy');
    expect(html).toContain('Execution price / share');
    expect(html).toContain('Trade date');
    expect(html).toContain('Save changes');
    expect(html).not.toContain('New subscription');
  });
  it('edits cash as an EGP event, never as stock shares',()=>{
    const html=render(cash,'edit');
    expect(html).toContain('Edit cash entry');
    expect(html).toContain('Cash amount (EGP)');
    expect(html).toContain('Cash event type');
    expect(html).not.toContain('Execution price / share');
    expect(html).not.toContain('Shares');
  });
  it('edits the same pending IPO order directly including shares, price, reserve and date',()=>{
    const html=render(ipo,'edit');
    expect(html).toContain('Edit IPOX subscription');
    expect(html).toContain('Requested shares');
    expect(html).toContain('Offer price per share');
    expect(html).toContain('Cash held by broker');
    expect(html).toContain('Actual subscription date');
    expect(html).toContain('Save changes');
    expect(html).not.toContain('New IPO subscription');
    expect(html).not.toContain('Record allocation');
  });
  it('allocation is separate and cannot be confused with editing',()=>{
    const html=render(ipo,'allocate');
    expect(html).toContain('Shares actually allocated');
    expect(html).toContain('Record allocation');
    expect(html).not.toContain('Requested shares');
  });
  it('IPO deletion explains that it does not cancel a real broker order',()=>{
    const html=render(ipo,'delete');
    expect(html).toContain('not a broker order');
    expect(html).toContain('does NOT cancel');
    expect(html).toContain('Audit reason');
  });
});
