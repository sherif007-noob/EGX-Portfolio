import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BarChart3, ChevronRight, LineChart, PieChart, TableProperties } from 'lucide-react';
import type { ClosedTrade, PerformanceStats, PortfolioMetrics, Position, TradeTransaction } from '../types';
import type { HistoricalPriceSeries } from '../services/historicalPriceStore';
import { calculateEquityBridge, isEquityBridgeBalanced } from '../services/portfolioPerformance';
import { readPersistedReportsMode, persistReportsMode, type ReportsMode } from '../services/reportsWorkspace';
import { PerformanceReports } from '../features/reports';
import { HomeChart } from './HomeChart';
import { ActivityPills, ActivityStat } from './SimpleActivityShared';
import { formatEgp, formatPercent, formatSigned, toneClass } from './format';
import { buildSimpleAllocation, buildSimpleMonths } from './simpleReportsModel';

interface Props {
  stats: PerformanceStats;
  closedTrades: ClosedTrade[];
  positions: Position[];
  metrics?: PortfolioMetrics;
  cashBalance?: number;
  capitalDeposits?: number;
  transactions: TradeTransaction[];
  historicalPrices: HistoricalPriceSeries;
  historicalLoading?: boolean;
  chartsReady?: boolean;
}
const MODES: Array<{value:ReportsMode,label:string}> = [
  {value:'overview',label:'Overview'}, {value:'analytics',label:'Charts'},
  {value:'trading',label:'Trading'}, {value:'allocation',label:'Allocation'},
  {value:'monthly',label:'Monthly'},
];

function Metric({label,amount,sub}: {label:string;amount:number;sub?:string}) {
  return <div className="ui-report-metric">
    <span className="ui-sm">{label}</span>
    <strong className={`ui-mono ${toneClass(amount)}`}>{formatSigned(amount)} <small>EGP</small></strong>
    {sub && <span className="ui-sm">{sub}</span>}
  </div>;
}
function Info({label,value,notice}: {label:string;value:React.ReactNode;notice?:boolean}) {
  return <div className={`ui-report-info ${notice ? 'ui-report-info-notice':''}`}>
    <span className="ui-sm">{label}</span><strong>{value}</strong>
  </div>;
}
function SectionTitle({title,detail}: {title:string;detail?:string}) {
  return <header className="ui-report-section-title"><h3>{title}</h3>{detail&&<p className="ui-sm">{detail}</p>}</header>;
}

export function SimpleReportsView(props: Props) {
  const {stats,closedTrades,positions,metrics,cashBalance=0,capitalDeposits=0,transactions,
    historicalPrices,historicalLoading=false,chartsReady=true}=props;
  const [mode,setMode]=useState<ReportsMode>(()=>readPersistedReportsMode());
  const [advanced,setAdvanced]=useState(false);
  const [allocationMode,setAllocationMode]=useState<'sector'|'stock'>('sector');
  const [includeCash,setIncludeCash]=useState(true);
  const [month,setMonth]=useState('ALL');
  const [showAllMonths,setShowAllMonths]=useState(false);
  const bridge=useMemo(()=>calculateEquityBridge(
    capitalDeposits,closedTrades,positions,cashBalance,transactions,
  ),[capitalDeposits,closedTrades,positions,cashBalance,transactions]);
  const bridgeValid=isEquityBridgeBalanced(bridge);
  const allocation=useMemo(()=>buildSimpleAllocation(positions,cashBalance,allocationMode,includeCash),
    [positions,cashBalance,allocationMode,includeCash]);
  const months=useMemo(()=>buildSimpleMonths(closedTrades,positions),[closedTrades,positions]);
  const selectedMonths=month==='ALL'?months:months.filter(item=>item.key===month);
  const shownMonths=month==='ALL'&&!showAllMonths ? selectedMonths.slice(0,8):selectedMonths;
  const changeMode=(next:ReportsMode)=>{setMode(next);persistReportsMode(next);};
  const winners=stats.winningTrades??closedTrades.filter(c=>c.outcome==='WIN').length;
  const losers=stats.losingTrades??closedTrades.filter(c=>c.outcome==='LOSS').length;
  const sortedClosed=useMemo(()=>[...closedTrades].sort(
    (a,b)=>(Date.parse(b.sellDate)||0)-(Date.parse(a.sellDate)||0),
  ).slice(0,5),[closedTrades]);

  if(advanced) return <div className="ui-report-page">
    <button type="button" className="ui-quiet-action ui-activity-back" onClick={()=>setAdvanced(false)}>
      <ArrowLeft size={16}/> Back to simple Reports
    </button>
    <PerformanceReports {...props}/>
  </div>;

  return <section className="ui-report-page" aria-label="Portfolio reports">
    <header className="ui-report-header">
      <div><h2>Reports</h2><p className="ui-sm">Portfolio performance and trading results</p></div>
      <button type="button" className="ui-quiet-action" onClick={()=>setAdvanced(true)}>
        <TableProperties size={16}/> Detailed workspace
      </button>
    </header>
    <ActivityPills label="Report view" value={mode} onChange={changeMode} choices={MODES}/>
    <div className="ui-report-content">
    {mode==='overview' && <>
      <div className="ui-report-summary">
        <Metric label="Total P&L" amount={bridge.realizedPnl+bridge.unrealizedPnl} sub="Realized + unrealized (including cash events)"/>
        <Metric label="Realized P&L" amount={bridge.realizedPnl} sub="Including cash performance"/>
        <Metric label="Unrealized P&L" amount={bridge.unrealizedPnl} sub="Current holdings net of entry fees"/>
      </div>
      <section className="ui-report-section">
        <SectionTitle title="Portfolio equity" detail="Reconciled accounting bridge, including pending IPO subscriptions."/>
        <div className="ui-report-info-grid">
          <Info label="Net contributed capital" value={`${formatEgp(bridge.netCapitalContributed)} EGP`}/>
          <Info label="Ending equity / NAV" value={`${formatEgp(bridge.endingEquity)} EGP`}/>
          <Info label="Open positions" value={positions.length}/>
          <Info label="Completed trades" value={stats.totalTrades}/>
        </div>
        {!bridgeValid && <div className="ui-report-warning" role="status">
          <strong>Accounting reconciliation difference: {formatEgp(bridge.reconciliationDelta)} EGP</strong>
          <p>Portfolio equity does not match capital + P&L + adjustments. Values are shown as recorded; no balancing capital was invented.</p>
        </div>}
      </section>
      <section className="ui-report-section">
        <SectionTitle title="Quick insights"/>
        <div className="ui-report-info-grid">
          <Info label="Win rate" value={Number.isFinite(stats.winRate) ? formatPercent(stats.winRate,1) : '—'}/>
          <Info label="Profit factor" value={Number.isFinite(stats.profitFactor)?stats.profitFactor.toFixed(2):'—'}/>
          <Info label="Available cash" value={`${formatEgp(cashBalance)} EGP`}/>
          <Info label="Today's change" value={<span className={toneClass(metrics?.dayChangeEgp)}>{metrics?formatSigned(metrics.dayChangeEgp)+' EGP':'—'}</span>}/>
        </div>
      </section>
      <div className="ui-report-shortcuts">
        {([{value:'analytics',label:'Performance charts',icon:LineChart},{value:'allocation',label:'Portfolio allocation',icon:PieChart},{value:'monthly',label:'Monthly results',icon:BarChart3}] as const).map(item=>{
          const Icon=item.icon;return <button type="button" key={item.value} onClick={()=>changeMode(item.value)}>
            <Icon size={17}/>{item.label}<ChevronRight size={16}/>
          </button>;
        })}
      </div>
    </>}

    {mode==='analytics' && <>
      <SectionTitle title="Portfolio performance" detail="Same shared analytical chart used on Home, including market-session rules."/>
      {chartsReady ? <HomeChart
        positions={positions} transactions={transactions} historicalPrices={historicalPrices}
        capitalDeposits={capitalDeposits} currentCashBalance={cashBalance}
        historicalLoading={historicalLoading}
      /> : <p className="ui-report-note">Preparing performance chart…</p>}
      <div className="ui-report-info-grid ui-report-followup">
        <Info label="Maximum drawdown" value={Number.isFinite(stats.maxDrawdownPercent)?formatPercent(-(stats.maxDrawdownPercent??0)):'—'}/>
        <Info label="Average cycle return" value={Number.isFinite(stats.avgReturnPercent)?formatPercent(stats.avgReturnPercent):'—'}/>
        <Info label="Closed trade fees" value={`${formatEgp(stats.totalBrokerageFeesPaid)} EGP`}/>
        <Info label="Trade count" value={stats.totalTrades}/>
      </div>
      <p className="ui-report-note">For full realized trajectory, cash-flow benchmarks and equity-bridge diagnostics, use Detailed workspace.</p>
    </>}

    {mode==='trading' && <>
      <div className="ui-report-summary">
        <ActivityStat label="Win rate" value={Number.isFinite(stats.winRate)?formatPercent(stats.winRate,1):'—'} note={`${winners} wins · ${losers} losses`}/>
        <ActivityStat label="Completed trades" value={stats.totalTrades}/>
        <ActivityStat label="Profit factor" value={Number.isFinite(stats.profitFactor)?stats.profitFactor.toFixed(2):'—'}/>
      </div>
      <section className="ui-report-section">
        <SectionTitle title="Trading statistics"/>
        <div className="ui-report-info-grid">
          <Info label="Average trade return" value={formatPercent(stats.avgReturnPercent)}/>
          <Info label="Average hold" value={`${stats.avgHoldDays} days`}/>
          <Info label="Best cycle" value={formatPercent(stats.bestTradePercent)}/>
          <Info label="Worst cycle" value={formatPercent(stats.worstTradePercent)}/>
          <Info label="Gross realized gains" value={`${formatEgp(stats.totalRealizedGainEgp)} EGP`}/>
          <Info label="Gross realized losses" value={`${formatEgp(stats.totalRealizedLossEgp)} EGP`}/>
        </div>
      </section>
      <section className="ui-report-section">
        <SectionTitle title="Recent completed trades" detail="Results use the reconciled closed-trade records."/>
        <div className="ui-report-list">
          {!sortedClosed.length && <p className="ui-activity-empty">No completed trades yet.</p>}
          {sortedClosed.map(c=><div className="ui-report-list-row" key={c.id}>
            <div><strong>{c.ticker}</strong><span className="ui-sm">{c.sellDate} · {c.shares.toLocaleString()} shares</span></div>
            <div className="ui-report-list-number"><strong className={`ui-mono ${toneClass(c.realizedPnlEgp)}`}>{formatSigned(c.realizedPnlEgp)}</strong>
              <span className="ui-sm">{formatPercent(c.realizedPnlPercent)}</span></div>
          </div>)}
        </div>
      </section>
    </>}

    {mode==='allocation' && <>
      <SectionTitle title="Portfolio allocation" detail="Current market value across holdings and cash."/>
      <ActivityPills label="Group by" value={allocationMode} onChange={setAllocationMode} choices={[
        {value:'sector',label:'Sector'},{value:'stock',label:'Stock'},
      ]}/>
      <label className="ui-report-check"><input type="checkbox" checked={includeCash} onChange={e=>setIncludeCash(e.target.checked)}/> Include available cash</label>
      <div className="ui-report-list ui-report-allocations">
        {!allocation.length && <p className="ui-activity-empty">No positions in this allocation.</p>}
        {allocation.map((row,i)=><div className="ui-report-allocation" key={row.label}>
          <div className="ui-report-allocation-head">
            <span><strong>{row.label}</strong><span className="ui-sm">{row.count ? `${row.count} holdings`:'Available balance'}</span></span>
            <span><strong className="ui-mono">{formatEgp(row.value)} EGP</strong><span className="ui-sm">{row.percent.toFixed(1)}%</span></span>
          </div>
          <div className="ui-report-track"><span style={{width:`${Math.max(0,Math.min(100,row.percent))}%`,background:`var(--ui-allocation-${i%5})`}}/></div>
        </div>)}
      </div>
      <p className="ui-report-note">Allocation percentages are relative to the displayed categories, not historical prices.</p>
    </>}

    {mode==='monthly' && <>
      <SectionTitle title="Monthly results" detail="Realized exits by month; the current month also includes today's open-holdings snapshot."/>
      <ActivityPills label="Month" value={month} onChange={setMonth} choices={[
        {value:'ALL',label:'Recent months'},
        ...months.map(m=>({value:m.key,label:m.label})),
      ]}/>
      <div className="ui-report-months">
        {shownMonths.map(m=><article className="ui-report-month" key={m.key}>
          <div className="ui-report-month-heading">
            <strong>{m.label}</strong>
            <span className={`ui-mono ${toneClass(m.snapshotTotal??m.realized)}`}>
              {formatSigned(m.snapshotTotal??m.realized)} EGP
            </span>
          </div>
          <div className="ui-report-info-grid">
            <Info label="Realized exits" value={<span className={toneClass(m.realized)}>{formatSigned(m.realized)} EGP</span>}/>
            <Info label="Closed trades" value={m.closed}/>
            {m.openSnapshot!==null && <Info label="Current holdings snapshot" value={<span className={toneClass(m.openSnapshot)}>{formatSigned(m.openSnapshot)} EGP</span>}/>}
            {m.openSnapshot!==null && <Info label="Combined snapshot" value={<span className={toneClass(m.snapshotTotal)}>{formatSigned(m.snapshotTotal??0)} EGP</span>}/>}
            <Info label="Closed-trade wins" value={m.wins}/>
            <Info label="Closed-trade fees" value={`${formatEgp(m.fees)} EGP`}/>
          </div>
          <p className="ui-report-note">{m.openSnapshot===null
            ? 'Historical realized results only; historical holdings values require verified month-end prices.'
            : 'Current snapshot includes open holdings regardless of purchase month. It is not a month-to-date return.'}</p>
        </article>)}
        {!shownMonths.length && <p className="ui-activity-empty">No monthly records available.</p>}
      </div>
      {month==='ALL' && months.length>8 && <button type="button" className="ui-activity-load" onClick={()=>setShowAllMonths(v=>!v)}>
        {showAllMonths?'Show fewer months':`Show all ${months.length} months`}
      </button>}
      <p className="ui-report-note">Detailed workspace retains the existing complete monthly audit report and filters.</p>
    </>}
    </div>
  </section>;
}
