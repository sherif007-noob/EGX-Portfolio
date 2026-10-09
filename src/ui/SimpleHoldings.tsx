import React, { useMemo, useState } from 'react';
import { PillGroup } from './Pill';
import type { Position } from '../types';
import { StockLogo } from '../components/StockLogo';
import { formatEgp, formatPercent, formatSigned, toneClass } from './format';
import { Search, Plus, Bell } from 'lucide-react';

type SortBy = 'value' | 'pnl' | 'ticker';
interface Props {
  positions: Position[];
  onSellPosition: (position: Position) => void;
  onBuyMore: (position: Position) => void;
  onEditPosition: (position: Position) => void;
  onCorrectLedger: (position: Position) => void;
  onOpenPriceAlerts: () => void;
  onAddNewTrade: () => void;
}
export function SimpleHoldings({ positions, onSellPosition, onBuyMore, onEditPosition, onCorrectLedger, onOpenPriceAlerts, onAddNewTrade }: Props) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortBy>('value');
  const [sector, setSector] = useState('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const sectors = useMemo(() => Array.from(new Set(positions.map(p => p.sector))).sort(), [positions]);
  const rows = useMemo(() => positions.filter(p => (sector === 'ALL' || p.sector === sector) &&
    (p.ticker.toLowerCase().includes(search.toLowerCase()) || p.companyName.toLowerCase().includes(search.toLowerCase())))
    .map(p => {
      const value = p.shares * (p.currentPrice > 0 ? p.currentPrice : p.avgBuyPrice);
      const cost = p.shares * p.avgBuyPrice + (p.totalFees ?? 0);
      return { p, value, pnl: value - cost, percent: cost > 0 ? ((value - cost) / cost) * 100 : 0 };
    }).sort((a,b) => sort === 'value' ? b.value - a.value : sort === 'pnl' ? b.pnl - a.pnl : a.p.ticker.localeCompare(b.p.ticker)), [positions,search,sort,sector]);
  const total = rows.reduce((acc,r)=>acc+r.value,0);
  const pnl = rows.reduce((acc,r)=>acc+r.pnl,0);
  return <section className="ui-holdings" aria-label="Open holdings">
    <header className="ui-holdings-header"><div><h2>Holdings</h2><p className="ui-sm">{rows.length} of {positions.length} positions</p></div><div className="ui-holdings-actions">
      <button type="button" className="ui-iconbtn" onClick={onOpenPriceAlerts} aria-label="Price alerts"><Bell size={18}/></button>
      <button type="button" className="ui-add-btn ui-holdings-add" onClick={onAddNewTrade}><Plus size={16}/> Add trade</button></div></header>
    <div className="ui-holdings-summary"><div><span className="ui-sm">Market value</span><strong className="ui-mono">{formatEgp(total)} EGP</strong></div><div><span className="ui-sm">Unrealized P&L</span><strong className={`ui-mono ${toneClass(pnl)}`}>{formatSigned(pnl)} EGP</strong></div></div>
    <div className="ui-holdings-filters">
      <label className="ui-holdings-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a stock" aria-label="Search holdings"/></label>
      <div className="ui-filter-group">
        <span className="ui-sm ui-filter-caption">Sector</span>
        <PillGroup label="Filter holdings by sector" value={sector} onChange={setSector}
          choices={['ALL', ...sectors].map(item => ({value:item,label:item === 'ALL' ? 'All sectors' : item}))}/>

      </div>
      <div className="ui-filter-group">
        <span className="ui-sm ui-filter-caption">Sort</span>
        <PillGroup label="Sort holdings" value={sort} onChange={setSort}
          choices={[{value:'value',label:'Value'},{value:'pnl',label:'P&L'},{value:'ticker',label:'Ticker'}]}/>

      </div>
    </div>
    <div className="ui-holdings-list">{rows.length === 0 ? <p className="ui-sm ui-holdings-empty">No holdings match your filters.</p> : rows.map(({p,value,pnl,percent})=><article key={p.id} className="ui-holding">
      <button type="button" className="ui-holding-main" aria-expanded={expanded===p.id} onClick={()=>setExpanded(expanded===p.id?null:p.id)}>
        <StockLogo ticker={p.ticker} companyName={p.companyName} sector={p.sector} logoUrl={p.logoUrl} size="md"/>
        <span className="ui-holding-name"><strong>{p.ticker}</strong><span className="ui-sm">{p.companyName}</span></span>
        <span className="ui-holding-numbers"><strong className="ui-mono">{formatEgp(value)}</strong><span className={`ui-mono ui-sm ${toneClass(pnl)}`}>{formatSigned(pnl)} · {formatPercent(percent)}</span></span>
      </button>{expanded===p.id && <div className="ui-holding-details"><div className="ui-holding-stats"><span>Shares <strong>{p.shares.toLocaleString()}</strong></span><span>Average buy <strong>{formatEgp(p.avgBuyPrice)}</strong></span><span>Last price <strong>{formatEgp(p.currentPrice)}</strong></span><span>Sector <strong>{p.sector}</strong></span></div>
        <div className="ui-holding-buttons"><button type="button" onClick={()=>onBuyMore(p)}>Buy more</button><button type="button" onClick={()=>onSellPosition(p)}>Sell</button><button type="button" onClick={()=>onEditPosition(p)}>Edit</button><button type="button" onClick={()=>onCorrectLedger(p)}>Correct ledger</button></div>
      </div>}</article>)}</div>
  </section>;
}
