import React, { useMemo, useState } from 'react';
import { ChevronDown, FilePenLine, ScanLine } from 'lucide-react';
import type { ClosedTrade, Position, TradeTransaction } from '../types';
import { StockLogo } from '../components/StockLogo';
import { TradingJournal, type JournalLedgerFocus } from '../components/TradingJournal';
import { formatEgp, formatPercent, formatSigned, toneClass } from './format';
import { ActivityDetail, ActivityEmpty, ActivityHeader, ActivityPills, ActivitySearch, ActivityStat, formatActivityDate } from './SimpleActivityShared';

type Filter = 'ALL' | 'BUY' | 'SELL' | 'OPEN' | 'WIN' | 'LOSS' | 'OTHER';
type Sort = 'newest' | 'oldest' | 'ticker';

interface Props {
  transactions: TradeTransaction[];
  closedTrades: ClosedTrade[];
  positions: Position[];
  onDeleteTransaction: (id: string, auditReason?: string) => Promise<boolean>;
  onEditTransaction?: (updatedTx: TradeTransaction, auditReason?: string) => Promise<boolean>;
  ledgerFocus?: JournalLedgerFocus | null;
  onClearLedgerFocus?: () => void;
  onOpenScreenshotModal?: () => void;
  onSyncToSheets?: () => void;
  isSyncingToSheets?: boolean;
}

export function SimpleTransactionsView(props: Props) {
  const { transactions, closedTrades, positions, ledgerFocus, onClearLedgerFocus, onOpenScreenshotModal } = props;
  const [filter, setFilter] = useState<Filter>('ALL');
  const [sort, setSort] = useState<Sort>('newest');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [limit, setLimit] = useState(30);
  const [advanced, setAdvanced] = useState(false);
  const [selectedFocus, setSelectedFocus] = useState<JournalLedgerFocus | null>(null);
  const openTickers = useMemo(() => new Set(positions.map(p => p.ticker.toUpperCase())), [positions]);
  const cycleBySell = useMemo(() => {
    const indexed = new Map<string, ClosedTrade>();
    for (const cycle of closedTrades) {
      for (const id of cycle.sellTransactionIds ?? []) indexed.set(id, cycle);
    }
    return indexed;
  }, [closedTrades]);
  const sellOutcome = (tx: TradeTransaction) => cycleBySell.get(tx.id)?.outcome ?? tx.outcome;
  const visible = useMemo(() => transactions.filter(tx => {
    const q = search.trim().toLowerCase();
    if (ledgerFocus) {
      const ids = ledgerFocus.transactionIds;
      if (ids.length ? !ids.includes(tx.id) : tx.ticker.toUpperCase() !== ledgerFocus.ticker.toUpperCase()) return false;
    }
    if (q && ![tx.ticker, tx.companyName, tx.sector, tx.notes ?? '', tx.corporateActionReference ?? '']
      .some(value => value.toLowerCase().includes(q))) return false;
    switch (filter) {
      case 'BUY': return tx.type === 'BUY' && tx.ticker !== 'CASH';
      case 'SELL': return tx.type === 'SELL' && tx.ticker !== 'CASH';
      case 'OPEN': return tx.type === 'BUY' && openTickers.has(tx.ticker.toUpperCase());
      case 'WIN': return tx.type === 'SELL' && sellOutcome(tx) === 'WIN';
      case 'LOSS': return tx.type === 'SELL' && sellOutcome(tx) === 'LOSS';
      case 'OTHER': return !['BUY','SELL'].includes(tx.type) || tx.ticker === 'CASH';
      default: return true;
    }
  }).sort((a,b) => {
    if (sort === 'ticker') return a.ticker.localeCompare(b.ticker) || a.id.localeCompare(b.id);
    const tA = Date.parse(a.executedAt || a.date) || 0;
    const tB = Date.parse(b.executedAt || b.date) || 0;
    return (sort === 'newest' ? tB-tA : tA-tB) ||
      String(a.tradeId ?? a.trade_id ?? a.id).localeCompare(String(b.tradeId ?? b.trade_id ?? b.id));
  }), [transactions,search,filter,sort,ledgerFocus,openTickers,cycleBySell]);
  const totals = useMemo(() => ({
    realized: closedTrades.reduce((sum,c) => sum + c.realizedPnlEgp, 0),
    fees: transactions.reduce((sum,t) => sum+(t.fees || 0),0),
  }), [closedTrades,transactions]);

  const openLedger = (tx?: TradeTransaction) => {
    setSelectedFocus(tx ? {
      key: `medium-ui-entry-${tx.id}`, source:'BROKER_RECONCILIATION',
      ticker:tx.ticker, transactionIds:[tx.id],
      title:`Review ${tx.ticker} transaction`, detail:'Edit or delete this source record using the audited ledger controls.',
    } : null);
    setAdvanced(true);
  };
  if (advanced) return <div className="ui-activity-native">
    <div className="ui-activity-back"><button type="button" className="ui-quiet-action" onClick={() => {setAdvanced(false);setSelectedFocus(null);}}>← Back to simple Transactions</button></div>
    <TradingJournal {...props} ledgerFocus={selectedFocus ?? ledgerFocus} onClearLedgerFocus={() => {setSelectedFocus(null);onClearLedgerFocus?.();}}/>
  </div>;

  return <section className="ui-activity-native" aria-label="Transactions">
    <ActivityHeader title="Transactions" detail="Executions, IPO subscriptions and corporate actions"
      action={<>{onOpenScreenshotModal && <button type="button" className="ui-quiet-action" onClick={onOpenScreenshotModal}><ScanLine size={16}/> Scan</button>}
        <button type="button" className="ui-quiet-action" onClick={() => openLedger()}><FilePenLine size={16}/> Ledger tools</button></>}/>
    <div className="ui-activity-stat-grid">
      <ActivityStat label="Records" value={transactions.length}/>
      <ActivityStat label="Realized P&L" value={totals.realized} amount/>
      <ActivityStat label="Fees paid" value={formatEgp(totals.fees)} note="EGP"/>
    </div>
    {ledgerFocus && <div className="ui-activity-focus">
      <div><strong>{ledgerFocus.title}</strong><p className="ui-sm">{ledgerFocus.detail}</p></div>
      <button type="button" className="ui-quiet-action" onClick={onClearLedgerFocus}>Show all records</button>
    </div>}
    <div className="ui-activity-controls">
      <ActivitySearch value={search} onChange={v => {setSearch(v);setLimit(30);}} placeholder="Find ticker, company or notes"/>
      <ActivityPills label="Filter" value={filter} onChange={v => {setFilter(v);setLimit(30);}} choices={[
        {value:'ALL',label:'All'}, {value:'BUY',label:'Buys'}, {value:'SELL',label:'Sells'},
        {value:'OPEN',label:'Open'}, {value:'WIN',label:'Wins'}, {value:'LOSS',label:'Losses'}, {value:'OTHER',label:'Other'},
      ]}/>
      <ActivityPills label="Sort" value={sort} onChange={setSort} choices={[
        {value:'newest',label:'Newest'}, {value:'oldest',label:'Oldest'}, {value:'ticker',label:'Ticker'},
      ]}/>
    </div>
    <div className="ui-activity-list" aria-label="Transaction records">
      {!visible.length && <ActivityEmpty>No transactions match these filters.</ActivityEmpty>}
      {visible.slice(0,limit).map(tx => {
        const isCash = tx.ticker === 'CASH';
        const isSell = tx.type === 'SELL' && !isCash;
        const isBuy = tx.type === 'BUY' && !isCash;
        const cycle = cycleBySell.get(tx.id);
        const pnl = cycle ? cycle.realizedPnlEgp : tx.realizedPnlEgp;
        const amount = tx.type === 'IPO_SUBSCRIPTION'
          ? tx.ipoSubscription?.requestedAmount ?? tx.totalAmount
          : isBuy || isSell ? (tx.totalAmount || tx.shares * tx.price) : null;
        const typeLabel = isCash ? (tx.cashFlowType ?? 'Cash') : tx.type === 'CORPORATE_ACTION'
          ? tx.corporateActionType?.replaceAll('_',' ') ?? 'Corporate action'
          : tx.type === 'IPO_SUBSCRIPTION' ? 'IPO subscription' : tx.type === 'OPENING_POSITION' ? 'Opening position' : tx.type;
        const open = expanded === tx.id;
        return <article key={tx.id} className="ui-activity-record">
          <button className="ui-activity-record-head" type="button" aria-expanded={open} onClick={() => setExpanded(open ? null : tx.id)}>
            <span className="ui-activity-record-avatar"><StockLogo ticker={tx.ticker} companyName={tx.companyName} sector={tx.sector} size="sm"/></span>
            <span className="ui-activity-record-label"><strong>{tx.ticker}</strong><span className="ui-sm">{typeLabel} · {formatActivityDate(tx.date)}</span></span>
            <span className="ui-activity-record-right">
              <strong className={`ui-mono ${pnl !== undefined && isSell ? toneClass(pnl) : ''}`}>{isSell && pnl !== undefined ? formatSigned(pnl) : amount === null ? '—' : formatEgp(amount)}</strong>
              <span className="ui-sm">{isSell && pnl !== undefined ? 'Realized EGP' : amount === null ? tx.shares.toLocaleString()+' shares' : 'EGP'}</span>
            </span>
            <ChevronDown className={`ui-activity-chevron ${open ? 'open' : ''}`} size={16} aria-hidden="true"/>
          </button>
          {open && <div className="ui-activity-record-details">
            <div className="ui-activity-detail-grid">
              <ActivityDetail label="Company" value={tx.companyName}/>
              <ActivityDetail label="Shares" value={tx.shares.toLocaleString()}/>
              <ActivityDetail label="Price" value={formatEgp(tx.price)}/>
              <ActivityDetail label="Fees" value={formatEgp(tx.fees || 0)}/>
              <ActivityDetail label="Executed" value={tx.executedAt ?? tx.date}/>
              {isSell && <ActivityDetail label="Return" value={pnl === undefined ? 'Not reported' : formatPercent(cycle?.realizedPnlPercent ?? tx.realizedPnlPercent)}/>}
              {!!tx.cycleTag && <ActivityDetail label="Cycle" value={tx.cycleTag}/>}
              {!!tx.ipoSubscription && <ActivityDetail label="IPO status" value={tx.ipoSubscription.status}/>}
            </div>
            {tx.notes && <p className="ui-sm ui-activity-notes">{tx.notes}</p>}
            <button type="button" className="ui-quiet-action" onClick={() => openLedger(tx)}>Edit / correct in ledger</button>
          </div>}
        </article>;
      })}
    </div>
    {visible.length > limit && <button type="button" className="ui-activity-load" onClick={() => setLimit(n => n+30)}>Show more ({visible.length-limit} remaining)</button>}
    <p className="ui-activity-footnote">Showing {Math.min(limit,visible.length)} of {visible.length} entries</p>
  </section>;
}
