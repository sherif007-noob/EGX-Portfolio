import React, { useMemo, useState } from 'react';
import { ChevronDown, FilePenLine, ScanLine, Wallet, Gift, Receipt, Landmark, Pencil, Trash2, Plus, ArrowDownToLine } from 'lucide-react';
import { ActivityActionDialog, type ActivityAction, type IpoOrderCorrection, type IpoAllocation } from './ActivityActionDialog';
import type { ClosedTrade, Position, TradeTransaction } from '../types';
import { StockLogo } from '../components/StockLogo';
import { sortPerformanceTransactions } from '../services/portfolioPerformance';
import { filterInvestmentActivity, isCashLedgerRecord, isSecurityTrade } from '../services/ledgerRecordTypes';
import { TradingJournal, type JournalLedgerFocus } from '../components/TradingJournal';
import { formatEgp, formatPercent, formatSigned, toneClass } from './format';
import { activityRecordView } from './activityRecordModel';
import { ActivityDetail, ActivityEmpty, ActivityHeader, ActivityPills, ActivitySearch, ActivityStat, formatActivityDate } from './SimpleActivityShared';

type Filter = 'ALL'|'BUY'|'SELL'|'CASH'|'DIVIDEND'|'CORPORATE'|'IPO'|'WIN'|'LOSS'|'OPEN';
type Sort = 'newest'|'oldest'|'ticker';

interface Props {
  transactions: TradeTransaction[];
  closedTrades: ClosedTrade[];
  positions: Position[];
  onDeleteTransaction: (id: string, auditReason?: string) => Promise<boolean>;
  onEditTransaction?: (updatedTx: TradeTransaction, auditReason?: string) => Promise<boolean>;
  ledgerFocus?: JournalLedgerFocus | null;
  onClearLedgerFocus?: () => void;
  onOpenScreenshotModal?: () => void;
  onSaveCashRecord: (record:TradeTransaction,reason:string)=>Promise<boolean>;
  onSaveIpo: (record:IpoOrderCorrection)=>Promise<boolean>;
  onAllocateIpo: (record:IpoAllocation)=>Promise<boolean>;
  onBuyMoreTicker: (ticker:string)=>void;
  onSellPosition: (position:Position)=>void;
  onSyncToSheets?: () => void;
  isSyncingToSheets?: boolean;
}

/**
 * Activity is the complete timeline. CASH pseudo-trades are displayed here
 * with cash semantics, but the advanced equity editor still receives equity
 * records only. A cash action navigates to the dedicated audited cash ledger.
 */
export function SimpleTransactionsView(props: Props) {
  const { transactions,closedTrades,positions,ledgerFocus,onClearLedgerFocus,onOpenScreenshotModal }=props;
  const [filter,setFilter]=useState<Filter>('ALL');
  const [sort,setSort]=useState<Sort>('newest');
  const [search,setSearch]=useState('');
  const [expanded,setExpanded]=useState<string|null>(null);
  const [limit,setLimit]=useState(30);
  const [advanced,setAdvanced]=useState(false);
  const [selectedFocus,setSelectedFocus]=useState<JournalLedgerFocus|null>(null);
  const [action,setAction]=useState<{id:string;kind:ActivityAction}|null>(null);
  const openTickers=useMemo(()=>new Set(positions.map(p=>p.ticker.toUpperCase())),[positions]);
  const cycleBySell=useMemo(()=>{
    const result=new Map<string,ClosedTrade>();
    for(const cycle of closedTrades)for(const id of cycle.sellTransactionIds??[])result.set(id,cycle);
    return result;
  },[closedTrades]);
  const investmentRecords=useMemo(()=>filterInvestmentActivity(transactions),[transactions]);
  const securityCount=useMemo(()=>transactions.filter(isSecurityTrade).length,[transactions]);
  const cashCount=useMemo(()=>transactions.filter(isCashLedgerRecord).length,[transactions]);
  const sellOutcome=(tx:TradeTransaction)=>cycleBySell.get(tx.id)?.outcome??tx.outcome;

  const visible=useMemo(()=>{
    const chronological=sortPerformanceTransactions(transactions);
    const order=new Map(chronological.map((tx,i)=>[tx.id,i]));
    const q=search.trim().toLowerCase();
    return chronological.filter(tx=>{
      const info=activityRecordView(tx);
      if(ledgerFocus){
        const ids=ledgerFocus.transactionIds;
        if(ids.length?!ids.includes(tx.id):tx.ticker.toUpperCase()!==ledgerFocus.ticker.toUpperCase())return false;
      }
      if(q && ![tx.ticker,tx.companyName,tx.sector,tx.notes??'',tx.corporateActionReference??'',info.subtitle,info.title]
        .some(value=>value.toLowerCase().includes(q)))return false;
      switch(filter){
        case 'BUY':return isSecurityTrade(tx)&&tx.type==='BUY';
        case 'SELL':return isSecurityTrade(tx)&&tx.type==='SELL';
        case 'CASH':return isCashLedgerRecord(tx);
        case 'DIVIDEND':return isCashLedgerRecord(tx)&&tx.cashFlowType==='DIVIDEND';
        case 'CORPORATE':return tx.type==='CORPORATE_ACTION'||tx.type==='OPENING_POSITION';
        case 'IPO':return tx.type==='IPO_SUBSCRIPTION';
        case 'WIN':return isSecurityTrade(tx)&&tx.type==='SELL'&&sellOutcome(tx)==='WIN';
        case 'LOSS':return isSecurityTrade(tx)&&tx.type==='SELL'&&sellOutcome(tx)==='LOSS';
        case 'OPEN':return isSecurityTrade(tx)&&tx.type==='BUY'&&openTickers.has(tx.ticker.toUpperCase());
        default:return true;
      }
    }).sort((a,b)=>{
      if(sort==='ticker')return a.ticker.localeCompare(b.ticker);
      const delta=(order.get(a.id)??0)-(order.get(b.id)??0);
      return sort==='newest'?-delta:delta;
    });
  },[transactions,search,filter,sort,ledgerFocus,openTickers,cycleBySell]);

  const openLedger=(tx?:TradeTransaction)=>{
    setSelectedFocus(tx?{
      key:`medium-ui-entry-${tx.id}`,source:'BROKER_RECONCILIATION',
      ticker:tx.ticker,transactionIds:[tx.id],
      title:`Review ${tx.ticker} record`,
      detail:'Inspect the original ledger event. Financial corrections use the audited dedicated editor.',
    }:null);
    setAdvanced(true);
  };

  if(advanced)return <div className="ui-activity-native">
    <div className="ui-activity-back"><button type="button" className="ui-quiet-action" onClick={()=>{setAdvanced(false);setSelectedFocus(null);}}>← Back to Activity</button></div>
    <TradingJournal {...props} transactions={investmentRecords} ledgerFocus={selectedFocus??ledgerFocus}
      onClearLedgerFocus={()=>{setSelectedFocus(null);onClearLedgerFocus?.();}}/>
  </div>;

  return <section className="ui-activity-native" aria-label="All portfolio activity">
    <ActivityHeader title="Activity" detail="All recorded portfolio events, with details appropriate to each type"
      action={<>{onOpenScreenshotModal && <button type="button" className="ui-quiet-action" onClick={onOpenScreenshotModal}><ScanLine size={16}/> Scan</button>}
        <button type="button" className="ui-quiet-action" onClick={()=>openLedger()}><FilePenLine size={16}/> Trade ledger</button></>}/>
    <div className="ui-activity-stat-grid">
      <ActivityStat label="Ledger events" value={transactions.length}/>
      <ActivityStat label="Trade executions" value={securityCount}/>
      <ActivityStat label="Cash events" value={cashCount}/>
    </div>
    {ledgerFocus && <div className="ui-activity-focus">
      <div><strong>{ledgerFocus.title}</strong><p className="ui-sm">{ledgerFocus.detail}</p></div>
      <button type="button" className="ui-quiet-action" onClick={onClearLedgerFocus}>Show all events</button>
    </div>}
    <div className="ui-activity-controls">
      <ActivitySearch value={search} onChange={value=>{setSearch(value);setLimit(30);}} placeholder="Search activity, type, ticker or notes"/>
      <ActivityPills label="Filter" value={filter} onChange={value=>{setFilter(value);setLimit(30);}} choices={[
        {value:'ALL',label:'All'}, {value:'BUY',label:'Buys'}, {value:'SELL',label:'Sells'},
        {value:'CASH',label:'Cash'}, {value:'DIVIDEND',label:'Dividends'},
        {value:'CORPORATE',label:'Corporate'}, {value:'IPO',label:'IPOs'},
        {value:'OPEN',label:'Open'}, {value:'WIN',label:'Wins'}, {value:'LOSS',label:'Losses'},
      ] as const}/>
      <ActivityPills label="Sort" value={sort} onChange={setSort} choices={[
        {value:'newest',label:'Newest'}, {value:'oldest',label:'Oldest'}, {value:'ticker',label:'Ticker'},
      ] as const}/>
    </div>
    <div className="ui-activity-list" aria-label="Portfolio events">
      {!visible.length&&<ActivityEmpty>No events match these filters.</ActivityEmpty>}
      {visible.slice(0,limit).map(tx=>{
        const info=activityRecordView(tx);
        const isSell=info.category==='TRADE'&&tx.type==='SELL';
        const cycle=cycleBySell.get(tx.id);
        // Multi-sell cycles cannot attribute their entire realized result to each sale.
        const pnl=Number.isFinite(tx.realizedPnlEgp)?tx.realizedPnlEgp:
          cycle&&(cycle.sellTransactionIds?.length??0)===1?cycle.realizedPnlEgp:undefined;
        const showPnl=isSell&&pnl!==undefined;
        const amount=info.amount===null?'—':info.positive===null?formatEgp(info.amount):formatSigned(info.amount);
        const mainAmount=showPnl?formatSigned(pnl!):info.category==='CORPORATE'&&
          (tx.corporateActionType==='BONUS_SHARES'||tx.corporateActionType==='STOCK_DIVIDEND')
          ?`+${tx.shares.toLocaleString()} shares`:amount;
        const mainCaption=showPnl?'Realized P&L':info.category==='CORPORATE'&&
          (tx.corporateActionType==='BONUS_SHARES'||tx.corporateActionType==='STOCK_DIVIDEND')
          ?'Shares received':info.amountCaption;
        const open=expanded===tx.id;
        const isCash=info.category==='CASH';
        const isIpo=info.category==='IPO';
        const isAction=info.category==='CORPORATE'||info.category==='OPENING';
        const Icon=isCash?Wallet:isIpo?Landmark:isAction?Gift:Receipt;
        return <article key={tx.id} className="ui-activity-record">
          <button className="ui-activity-record-head" type="button" aria-expanded={open}
            onClick={()=>setExpanded(open?null:tx.id)}>
            <span className="ui-activity-record-avatar">
              {info.category==='TRADE'?<StockLogo ticker={tx.ticker} companyName={tx.companyName}
                sector={tx.sector} size="sm"/>:<span className="ui-activity-event-icon"><Icon size={19}/></span>}
            </span>
            <span className="ui-activity-record-label">
              <strong>{info.category==='CASH'?info.title:tx.ticker}</strong>
              <span className="ui-sm">{info.category==='CASH'?'Cash · ':''}{info.subtitle} · {formatActivityDate(tx.date)}</span>
            </span>
            <span className="ui-activity-record-right">
              <strong className={`ui-mono ${showPnl?toneClass(pnl):info.positive===null?'':toneClass(info.amount)}`}>{mainAmount}</strong>
              <span className="ui-sm">{mainCaption}</span>
            </span>
            <ChevronDown className={`ui-activity-chevron ${open?'open':''}`} size={16} aria-hidden="true"/>
          </button>
          {open&&<div className="ui-activity-record-details">
            <div className="ui-activity-detail-grid">
              {info.category!=='CASH'&&<ActivityDetail label="Company" value={tx.companyName}/>}
              {info.details.map(detail=><ActivityDetail key={detail.label} label={detail.label} value={detail.value}/>)}
              {showPnl&&<ActivityDetail label="Realized P&L" value={<span className={toneClass(pnl)}>{formatSigned(pnl!)} EGP</span>}/>}
              {showPnl&&<ActivityDetail label="Return" value={<span className={toneClass(cycle?.realizedPnlPercent??tx.realizedPnlPercent)}>{formatPercent(cycle?.realizedPnlPercent??tx.realizedPnlPercent)}</span>}/>}
            </div>
            {tx.notes&&<p className="ui-sm ui-activity-notes">{tx.notes}</p>}
            <div className="ui-activity-record-actions">
              {isCash&&<>
                <button type="button" className="ui-quiet-action" onClick={()=>setAction({id:tx.id,kind:'edit'})}><Pencil size={15}/> Edit</button>
                <button type="button" className="ui-quiet-action ui-danger" onClick={()=>setAction({id:tx.id,kind:'delete'})}><Trash2 size={15}/> Delete</button>
              </>}
              {isIpo&&tx.ipoSubscription?.status==='SUBMITTED'&&<>
                <button type="button" className="ui-quiet-action" onClick={()=>setAction({id:tx.id,kind:'allocate'})}><ArrowDownToLine size={15}/> Allocation</button>
                <button type="button" className="ui-quiet-action" onClick={()=>setAction({id:tx.id,kind:'edit'})}><Pencil size={15}/> Edit</button>
                <button type="button" className="ui-quiet-action ui-danger" onClick={()=>setAction({id:tx.id,kind:'delete'})}><Trash2 size={15}/> Delete</button>
              </>}
              {isIpo&&tx.ipoSubscription?.status!=='SUBMITTED'&&<span className="ui-sm">Settled IPO — lifecycle history protected</span>}
              {info.category==='TRADE'&&<>
                <button type="button" className="ui-quiet-action" onClick={()=>setAction({id:tx.id,kind:'edit'})}><Pencil size={15}/> Edit</button>
                <button type="button" className="ui-quiet-action ui-danger" onClick={()=>setAction({id:tx.id,kind:'delete'})}><Trash2 size={15}/> Delete</button>
                <button type="button" className="ui-quiet-action" onClick={()=>props.onBuyMoreTicker(tx.ticker)}><Plus size={15}/> Buy more</button>
                {positions.find(p=>p.ticker.toUpperCase()===tx.ticker.toUpperCase())&&
                  <button type="button" className="ui-quiet-action" onClick={()=>{
                    const position=positions.find(p=>p.ticker.toUpperCase()===tx.ticker.toUpperCase());
                    if(position)props.onSellPosition(position);
                  }}>Sell</button>}
              </>}
              {isAction&&<button type="button" className="ui-quiet-action" onClick={()=>openLedger(tx)}>View source ledger</button>}
            </div>
          </div>}
        </article>;
      })}
    </div>
    {visible.length>limit&&<button type="button" className="ui-activity-load" onClick={()=>setLimit(n=>n+30)}>Show more ({visible.length-limit} remaining)</button>}
    <p className="ui-activity-footnote">Showing {Math.min(limit,visible.length)} of {visible.length} events</p>
    {action&&transactions.some(tx=>tx.id===action.id)&&(()=>{
      const record=transactions.find(tx=>tx.id===action.id)!;
      return <ActivityActionDialog key={`${action.id}-${action.kind}`}
        record={record} action={action.kind} transactions={transactions}
        onClose={()=>setAction(null)}
        onSaveTrade={(updated,reason)=>props.onEditTransaction?.(updated,reason)??Promise.resolve(false)}
        onSaveCash={props.onSaveCashRecord}
        onSaveIpo={props.onSaveIpo}
        onAllocateIpo={props.onAllocateIpo}
        onDelete={props.onDeleteTransaction}/>;
    })()}
  </section>;
}
