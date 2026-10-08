import React, { useMemo, useState } from 'react';
import type { Position, PortfolioMetrics } from '../types';
import { cairoDateKey, isEgxTradingDay } from '../services/egxTradingCalendar';
import { formatEgp, formatSigned, toneClass } from './format';

interface Props { metrics: PortfolioMetrics; positions: Position[]; }
export interface NavBreakdown {
  marketValue: number;
  cash: number;
  reservedIpo: number;
  reconstructedNav: number;
  nonFiniteQuoteTickers: string[];
  lastQuoteByTicker: Array<{ticker:string;quote:string;marketValue:number;timestampOnClosedDay:boolean}>;
}
export function navBreakdown(positions: Position[],cashBalance:number,pendingIpo=0): NavBreakdown {
  let marketValue=0;
  const nonFiniteQuoteTickers:string[]=[];
  const lastQuoteByTicker:NavBreakdown['lastQuoteByTicker']=[];
  for(const p of positions) {
    const valid=Number.isFinite(p.shares) && p.shares>=0 && Number.isFinite(p.currentPrice) && p.currentPrice>0;
    if(!valid) { nonFiniteQuoteTickers.push(p.ticker); continue; }
    const value=p.shares*p.currentPrice;
    marketValue+=value;
    const quoteTimestamp = Date.parse(p.priceUpdatedAt ?? '');
    const closedDayStamp = Number.isFinite(quoteTimestamp) && !isEgxTradingDay(cairoDateKey(new Date(quoteTimestamp)));
    lastQuoteByTicker.push({ticker:p.ticker,quote:p.priceUpdatedAt || 'Unknown',marketValue:value,timestampOnClosedDay:closedDayStamp});
  }
  return {marketValue,cash:cashBalance,reservedIpo:pendingIpo,reconstructedNav:marketValue+cashBalance+pendingIpo,
    nonFiniteQuoteTickers,lastQuoteByTicker:lastQuoteByTicker.sort((a,b)=>b.marketValue-a.marketValue)};
}

/** Never stores Telda numbers in the application ledger or silently adjusts cash. */
export function NavReconciliation({metrics,positions}:Props) {
  const [open,setOpen]=useState(false);
  const [brokerNav,setBrokerNav]=useState('');
  const [brokerCash,setBrokerCash]=useState('');
  const data=useMemo(()=>navBreakdown(positions,metrics.cashBalance,metrics.pendingIpoSubscriptionsEgp??0),
    [positions,metrics.cashBalance,metrics.pendingIpoSubscriptionsEgp]);
  const navInput=brokerNav.trim()?Number(brokerNav):null;
  const cashInput=brokerCash.trim()?Number(brokerCash):null;
  const navDiff=navInput!==null && Number.isFinite(navInput) && navInput>=0? navInput-metrics.totalValue:null;
  const cashDiff=cashInput!==null && Number.isFinite(cashInput)? cashInput-metrics.cashBalance:null;
  const internalDiff=data.reconstructedNav-metrics.totalValue;
  return <section className="ui-nav-audit">
    <button type="button" className="ui-nav-audit-toggle" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
      <span>Reconcile NAV with Telda</span><span className="ui-sm">{open?'Hide':'Inspect'} breakdown {open?'−':'+'}</span>
    </button>
    {open&&<div className="ui-nav-audit-body">
      <p className="ui-sm">Enter the figures shown by Telda from the same moment. Nothing here changes your ledger.</p>
      <div className="ui-nav-audit-inputs">
        <label>Telda total NAV (EGP)<input type="number" inputMode="decimal" min="0" step=".01"
          value={brokerNav} onChange={e=>setBrokerNav(e.target.value)} placeholder="Broker NAV"/></label>
        <label>Telda available cash (optional)<input type="number" inputMode="decimal" step=".01"
          value={brokerCash} onChange={e=>setBrokerCash(e.target.value)} placeholder="Broker cash"/></label>
      </div>
      <div className="ui-nav-audit-lines">
        <div><span>Open holdings × last prices</span><strong className="ui-mono">{formatEgp(data.marketValue)}</strong></div>
        <div><span>Available cash</span><strong className="ui-mono">{formatEgp(data.cash)}</strong></div>
        <div><span>Pending IPO reservation asset</span><strong className="ui-mono">{formatEgp(data.reservedIpo)}</strong></div>
        <div><span>Calculated NAV</span><strong className="ui-mono">{formatEgp(data.reconstructedNav)}</strong></div>
        <div><span>Internal NAV arithmetic difference</span><strong className={`ui-mono ${toneClass(-Math.abs(internalDiff))}`}>{formatSigned(internalDiff)}</strong></div>
        {navDiff!==null&&<div><span>Telda NAV − app NAV</span><strong className={`ui-mono ${toneClass(-Math.abs(navDiff))}`}>{formatSigned(navDiff)}</strong></div>}
        {cashDiff!==null&&<div><span>Telda cash − app cash</span><strong className="ui-mono">{formatSigned(cashDiff)}</strong></div>}
        {navDiff!==null&&cashDiff!==null&&<div><span>Unexplained outside cash difference</span><strong className="ui-mono">{formatSigned(navDiff-cashDiff)}</strong></div>}
      </div>
      {data.nonFiniteQuoteTickers.length>0&&<p className="ui-note" role="status">
        Missing/unusable prices for: {data.nonFiniteQuoteTickers.join(', ')}. NAV may be incomplete.</p>}
      <details className="ui-nav-audit-quotes"><summary>Price timestamps and holding values</summary>
        {data.lastQuoteByTicker.map(p=><div key={p.ticker}>
          <strong>{p.ticker}</strong><span className="ui-mono">{formatEgp(p.marketValue)}</span>
          <span className="ui-sm">{p.quote}{p.timestampOnClosedDay ? ' · Refreshed on a closed market day; not a new session quote' : ''}</span>
        </div>)}
      </details>
      <p className="ui-sm">A gap may come from stale prices, broker valuation conventions, missing corporate actions, unsettled cash, or IPO treatment. The breakdown identifies the category; it cannot establish broker parity without Telda holdings and cash evidence.</p>
    </div>}
  </section>;
}
