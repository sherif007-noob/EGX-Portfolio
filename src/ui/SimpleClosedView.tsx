import React, { useMemo, useState } from 'react';
import { ChevronDown, Receipt } from 'lucide-react';
import type { ClosedTrade, TradeTransaction } from '../types';
import { StockLogo } from '../components/StockLogo';
import { formatEgp, formatPercent, formatSigned, toneClass } from './format';
import { ActivityDetail, ActivityEmpty, ActivityHeader, ActivityPills, ActivitySearch, ActivityStat, formatActivityDate } from './SimpleActivityShared';

type Outcome = 'ALL' | 'WIN' | 'LOSS' | 'BREAKEVEN';
type Sort = 'newest' | 'highest' | 'lowest' | 'percent';

interface Props {
  closedTrades: ClosedTrade[];
  transactions: TradeTransaction[];
  onCorrectLedger: (cycle: ClosedTrade, transactionIds: string[]) => void;
}

/** Preserve canonical execution links; only use the original bounded fallback for old records. */
export function cycleSourceIds(cycle: ClosedTrade, transactions: TradeTransaction[]): string[] {
  const linkedBuys = new Set(cycle.buyTransactionIds ?? []);
  const linkedSells = new Set(cycle.sellTransactionIds ?? []);
  const buyTime = Date.parse(cycle.buyDate);
  const sellTime = Date.parse(cycle.sellDate);
  // Resolve BUY and SELL independently: a cycle may have only one side
  // explicitly linked, which must not hide the missing side's executions.
  const matching = transactions.filter(tx => {
    if (tx.type !== 'BUY' && tx.type !== 'SELL') return false;
    const linked = tx.type === 'BUY' ? linkedBuys : linkedSells;
    if (linked.size > 0) return linked.has(tx.id);
    if (tx.ticker.toUpperCase() !== cycle.ticker.toUpperCase()) return false;
    if (cycle.cycleTag && tx.cycleTag && cycle.cycleTag === tx.cycleTag) return true;
    if (cycle.tradeCycle && tx.tradeCycle && cycle.tradeCycle === tx.tradeCycle) return true;
    const when = Date.parse(tx.date);
    return tx.type === 'BUY'
      ? when >= buyTime - 86400000 && when <= sellTime
      : Math.abs(when - sellTime) <= 86400000;
  });
  return [...new Set([...linkedBuys, ...linkedSells, ...matching.map(tx => tx.id)])];
}

export function SimpleClosedView({closedTrades,transactions,onCorrectLedger}: Props) {
  const [filter,setFilter] = useState<Outcome>('ALL');
  const [sort,setSort] = useState<Sort>('newest');
  const [search,setSearch] = useState('');
  const [expanded,setExpanded] = useState<string|null>(null);
  const [limit,setLimit] = useState(30);
  const summary = useMemo(() => ({
    pnl:closedTrades.reduce((sum,c) => sum + c.realizedPnlEgp,0),
    wins:closedTrades.filter(c => c.outcome === 'WIN').length,
    losses:closedTrades.filter(c => c.outcome === 'LOSS').length,
    fees:closedTrades.reduce((sum,c) => sum + (c.totalFees ?? 0),0),
  }),[closedTrades]);
  const visible = useMemo(() => closedTrades.filter(c => {
    const q=search.toLowerCase().trim();
    return (filter === 'ALL' || c.outcome === filter) &&
      (!q || [c.ticker,c.companyName,c.sector,c.cycleTag ?? '',c.notes ?? ''].some(s => s.toLowerCase().includes(q)));
  }).sort((a,b) => {
    switch(sort) {
      case 'highest': return b.realizedPnlEgp-a.realizedPnlEgp;
      case 'lowest': return a.realizedPnlEgp-b.realizedPnlEgp;
      case 'percent': return b.realizedPnlPercent-a.realizedPnlPercent;
      default: return (Date.parse(b.sellDate)||0)-(Date.parse(a.sellDate)||0);
    }
  }),[closedTrades,filter,sort,search]);
  return <section className="ui-activity-native" aria-label="Closed trades">
    <ActivityHeader title="Closed trades" detail="Completed positions and realized results"/>
    <div className="ui-activity-stat-grid">
      <ActivityStat label="Realized P&L" value={summary.pnl} amount/>
      <ActivityStat label="Completed" value={closedTrades.length}/>
      <ActivityStat label="Win rate" value={closedTrades.length ? `${(summary.wins/closedTrades.length*100).toFixed(1)}%` : '—'}
        note={`${summary.wins} wins · ${summary.losses} losses`}/>
    </div>
    <div className="ui-activity-controls">
      <ActivitySearch value={search} onChange={v => {setSearch(v);setLimit(30);}} placeholder="Find a closed position"/>
      <ActivityPills label="Outcome" value={filter} onChange={v => {setFilter(v);setLimit(30);}} choices={[
        {value:'ALL',label:'All'}, {value:'WIN',label:'Wins'}, {value:'LOSS',label:'Losses'},{value:'BREAKEVEN',label:'Breakeven'},
      ] as const}/>
      <ActivityPills label="Sort" value={sort} onChange={setSort} choices={[
        {value:'newest',label:'Newest'},{value:'highest',label:'Highest P&L'},
        {value:'lowest',label:'Lowest P&L'},{value:'percent',label:'Best %'},
      ] as const}/>
    </div>
    <div className="ui-activity-list">
      {!visible.length && <ActivityEmpty>No closed trades match these filters.</ActivityEmpty>}
      {visible.slice(0,limit).map(cycle => {
        const open=expanded===cycle.id;
        const ids=cycleSourceIds(cycle,transactions);
        return <article key={cycle.id} className="ui-activity-record">
          <button className="ui-activity-record-head" type="button" aria-expanded={open} onClick={() => setExpanded(open ? null : cycle.id)}>
            <span className="ui-activity-record-avatar"><StockLogo ticker={cycle.ticker} companyName={cycle.companyName} sector={cycle.sector} size="sm"/></span>
            <span className="ui-activity-record-label"><strong>{cycle.ticker}</strong><span className="ui-sm">{formatActivityDate(cycle.sellDate)} · {cycle.shares.toLocaleString()} shares</span></span>
            <span className="ui-activity-record-right">
              <strong className={`ui-mono ${toneClass(cycle.realizedPnlEgp)}`}>{formatSigned(cycle.realizedPnlEgp)}</strong>
              <span className={`ui-sm ${toneClass(cycle.realizedPnlEgp)}`}>{formatPercent(cycle.realizedPnlPercent)}</span>
            </span>
            <ChevronDown className={`ui-activity-chevron ${open ? 'open' : ''}`} size={16} aria-hidden="true"/>
          </button>
          {open && <div className="ui-activity-record-details">
            <div className="ui-activity-detail-grid">
              <ActivityDetail label="Company" value={cycle.companyName}/>
              <ActivityDetail label="Buy price" value={formatEgp(cycle.buyPrice)}/>
              <ActivityDetail label="Sell price" value={formatEgp(cycle.sellPrice)}/>
              <ActivityDetail label="Holding" value={`${cycle.holdingDays} days`}/>
              <ActivityDetail label="Entry" value={formatActivityDate(cycle.buyDate)}/>
              <ActivityDetail label="Exit" value={formatActivityDate(cycle.sellDate)}/>
              <ActivityDetail label="Fees" value={formatEgp(cycle.totalFees ?? (cycle.buyFees ?? 0)+(cycle.sellFees ?? 0))}/>
              <ActivityDetail label="Outcome" value={cycle.outcome}/>
              {cycle.cycleTag && <ActivityDetail label="Cycle" value={cycle.cycleTag}/>}
            </div>
            {cycle.notes && <p className="ui-sm ui-activity-notes">{cycle.notes}</p>}
            <button type="button" className="ui-quiet-action" onClick={() => onCorrectLedger(cycle,ids)}>
              <Receipt size={16}/> Review source executions
            </button>
          </div>}
        </article>;
      })}
    </div>
    {visible.length>limit && <button className="ui-activity-load" type="button" onClick={() => setLimit(n=>n+30)}>Show more ({visible.length-limit} remaining)</button>}
    <p className="ui-activity-footnote">Showing {Math.min(visible.length,limit)} of {visible.length} closed trades · {formatEgp(summary.fees)} EGP fees across all cycles</p>
  </section>;
}
