import React, { useMemo, useState } from 'react';
import { ChevronDown, Settings2 } from 'lucide-react';
import type { CashTransaction, ClosedTrade, Position, TradeTransaction } from '../types';
import { CashBalanceView } from '../components/CashBalanceView';
import { buildCashHistory } from '../services/cashLedger';
import { getCairoTodayISO } from '../utils/dateUtils';
import { formatEgp } from './format';
import { ActivityDetail, ActivityEmpty, ActivityHeader, ActivityPills, ActivityStat, formatActivityDate } from './SimpleActivityShared';

type Kind = 'DEPOSIT' | 'WITHDRAWAL';
type Filter = 'ALL' | Kind;
type Props = {
  cashBalance: number;
  totalPortfolioValue: number;
  onUpdateCashBalance: (newBalance: number, auditReason?: string) => Promise<boolean>;
  positions?: Position[];
  closedTrades?: ClosedTrade[];
  tradeTransactions?: TradeTransaction[];
  capitalDeposits?: number;
  onAddCashTransaction: (amount: number, type: 'DEPOSIT' | 'WITHDRAW' | 'DIVIDEND', notes?: string, date?: string) => Promise<boolean>;
  onEditCashTransaction: (tx: CashTransaction, auditReason?: string) => Promise<boolean>;
  onDeleteCashTransaction: (id: string, auditReason?: string) => Promise<boolean>;
  onReconcileLedger?: (auditReason?: string) => Promise<boolean>;
};

export function SimpleCashView(props: Props) {
  const { cashBalance, totalPortfolioValue, positions = [], tradeTransactions = [], capitalDeposits = 0,
    onAddCashTransaction, onEditCashTransaction, onDeleteCashTransaction } = props;
  const [kind, setKind] = useState<Kind>('DEPOSIT');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => getCairoTodayISO());
  const [notes, setNotes] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [edit, setEdit] = useState<CashTransaction | null>(null);
  const [deleting, setDeleting] = useState<CashTransaction | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const history = useMemo(() => buildCashHistory({
    transactions: tradeTransactions, positions, tickers: [], capitalDeposits,
  }), [tradeTransactions,positions,capitalDeposits]);
  const totalDeposits = useMemo(() => history.filter(tx => tx.type === 'DEPOSIT').reduce((sum,tx) => sum+tx.amount,0),[history]);
  const totalWithdrawals = useMemo(() => history.filter(tx => tx.type === 'WITHDRAWAL').reduce((sum,tx) => sum+tx.amount,0),[history]);
  const visible = history.filter(tx => filter === 'ALL' || tx.type === filter);
  const cashPercent = totalPortfolioValue > 0 ? (cashBalance / totalPortfolioValue * 100).toFixed(1) : '0.0';

  const submitCash = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 0.01 || Math.abs(Math.round(parsed * 100) - parsed * 100) > 0.00001) {
      setFeedback('Enter a valid amount in EGP with up to two decimal places.'); return;
    }
    if (kind === 'WITHDRAWAL' && parsed > cashBalance) {
      setFeedback('Withdrawal exceeds available cash.'); return;
    }
    setBusy(true); setFeedback(null);
    try {
      const saved = await onAddCashTransaction(parsed, kind === 'DEPOSIT' ? 'DEPOSIT' : 'WITHDRAW', notes.trim(), date);
      if (!saved) { setFeedback('The transfer was not saved.'); return; }
      setAmount(''); setNotes('');
      setFeedback(kind === 'DEPOSIT' ? 'Deposit recorded.' : 'Withdrawal recorded.');
    } catch(e) { setFeedback(e instanceof Error ? e.message : 'Unable to save cash transfer.'); }
    finally { setBusy(false); }
  };
  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault(); if(!edit || busy) return;
    if (!Number.isFinite(edit.amount) || edit.amount < .01) { setFeedback('Amount must be positive.');return; }
    setBusy(true); setFeedback(null);
    try {
      const saved = await onEditCashTransaction(edit, reason.trim() || undefined);
      if(!saved) {setFeedback('Cash entry was not updated.');return;}
      setEdit(null);setReason('');setFeedback('Cash entry updated.');
    } catch(e) {setFeedback(e instanceof Error ? e.message : 'Unable to edit cash entry.');}
    finally {setBusy(false);}
  };
  const deleteEntry = async () => {
    if(!deleting || busy) return;
    setBusy(true);setFeedback(null);
    try {
      const saved=await onDeleteCashTransaction(deleting.id,reason.trim() || undefined);
      if(!saved) {setFeedback('Cash entry was not deleted.');return;}
      setDeleting(null);setReason('');setFeedback('Cash entry deleted.');
    } catch(e) {setFeedback(e instanceof Error ? e.message : 'Unable to delete cash entry.');}
    finally {setBusy(false);}
  };
  if (advanced) return <div className="ui-activity-native">
    <button type="button" className="ui-quiet-action ui-activity-back" onClick={() => setAdvanced(false)}>← Back to simple Cash</button>
    <CashBalanceView {...props}/>
  </div>;

  return <section className="ui-activity-native" aria-label="Cash">
    <ActivityHeader title="Cash" detail="Balance, transfers and capital movements"
      action={<button type="button" className="ui-quiet-action" onClick={() => setAdvanced(true)}><Settings2 size={16}/> Reconciliation tools</button>}/>
    <div className="ui-activity-stat-grid">
      <ActivityStat label="Available cash" value={formatEgp(cashBalance)} note={`EGP · ${cashPercent}% of NAV`}/>
      <ActivityStat label="Deposits recorded" value={formatEgp(totalDeposits)} note="EGP"/>
      <ActivityStat label="Withdrawals recorded" value={formatEgp(totalWithdrawals)} note="EGP"/>
    </div>
    <section className="ui-activity-transfer" aria-label="New cash transfer">
      <div className="ui-activity-section-title"><h3>Transfer cash</h3><span className="ui-sm">Recorded in your portfolio ledger</span></div>
      <ActivityPills label="Transfer type" value={kind} onChange={setKind} choices={[
        {value:'DEPOSIT',label:'Deposit'}, {value:'WITHDRAWAL',label:'Withdraw'},
      ]}/>
      <form onSubmit={submitCash} className="ui-activity-transfer-form">
        <label>Amount (EGP)<input type="number" inputMode="decimal" min=".01" step=".01" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"/></label>
        <label>Date<input type="date" required value={date} onChange={e => setDate(e.target.value)}/></label>
        <label className="ui-activity-field-wide">Notes (optional)<input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Bank transfer or broker reference"/></label>
        <button type="submit" className="ui-activity-primary" disabled={busy}>{busy ? 'Saving…' : kind === 'DEPOSIT' ? 'Record deposit' : 'Record withdrawal'}</button>
      </form>
    </section>
    {feedback && <p className="ui-activity-feedback" role="status">{feedback}</p>}
    <section className="ui-activity-history" aria-label="Cash transfers">
      <div className="ui-activity-section-title"><h3>Transfer history</h3><span className="ui-sm">{history.length} entries</span></div>
      <ActivityPills label="Show" value={filter} onChange={setFilter} choices={[
        {value:'ALL',label:'All'}, {value:'DEPOSIT',label:'Deposits'}, {value:'WITHDRAWAL',label:'Withdrawals'},
      ]}/>
      <div className="ui-activity-list">
        {!visible.length && <ActivityEmpty>No cash transfers for this filter.</ActivityEmpty>}
        {visible.map(tx => {
          const open = expanded === tx.id;
          return <article key={tx.id} className="ui-activity-record">
            <button type="button" className="ui-activity-record-head" aria-expanded={open} onClick={() => setExpanded(open ? null : tx.id)}>
              <span className={`ui-cash-direction ${tx.type === 'DEPOSIT' ? 'in' : 'out'}`}>{tx.type === 'DEPOSIT' ? '↓' : '↑'}</span>
              <span className="ui-activity-record-label"><strong>{tx.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'}</strong><span className="ui-sm">{formatActivityDate(tx.date)}</span></span>
              <span className="ui-activity-record-right"><strong className={`ui-mono ${tx.type === 'DEPOSIT' ? 'ui-pos' : ''}`}>{tx.type === 'DEPOSIT' ? '+' : '−'}{formatEgp(tx.amount)}</strong><span className="ui-sm">EGP</span></span>
              <ChevronDown className={`ui-activity-chevron ${open ? 'open' : ''}`} size={16} aria-hidden="true"/>
            </button>
            {open && <div className="ui-activity-record-details">
              <div className="ui-activity-detail-grid">
                <ActivityDetail label="Balance after" value={`${formatEgp(tx.balanceAfter)} EGP`}/>
                <ActivityDetail label="Date" value={formatActivityDate(tx.date)}/>
              </div>
              {tx.notes && <p className="ui-sm ui-activity-notes">{tx.notes}</p>}
              <div className="ui-activity-inline-actions">
                <button type="button" className="ui-quiet-action" onClick={() => {setEdit({...tx});setDeleting(null);setReason('');}}>Edit</button>
                <button type="button" className="ui-quiet-action ui-danger" onClick={() => {setDeleting(tx);setEdit(null);setReason('');}}>Delete</button>
              </div>
            </div>}
          </article>;
        })}
      </div>
    </section>
    {edit && <div className="ui-activity-dialog-backdrop" role="presentation">
      <div className="ui-activity-dialog" role="dialog" aria-modal="true" aria-label="Edit cash transaction">
        <h3>Edit cash entry</h3>
        <form onSubmit={saveEdit} className="ui-activity-dialog-form">
          <label>Type<select value={edit.type} onChange={e => setEdit({...edit,type:e.target.value as Kind})}><option value="DEPOSIT">Deposit</option><option value="WITHDRAWAL">Withdrawal</option></select></label>
          <label>Amount (EGP)<input type="number" min=".01" step=".01" required value={edit.amount} onChange={e => setEdit({...edit,amount:Number(e.target.value)})}/></label>
          <label>Date<input type="date" required value={edit.date} onChange={e => setEdit({...edit,date:e.target.value})}/></label>
          <label>Notes<input type="text" value={edit.notes ?? ''} onChange={e => setEdit({...edit,notes:e.target.value})}/></label>
          <label>Audit reason (optional)<input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Why are you updating this?"/></label>
          <div className="ui-activity-inline-actions"><button type="button" className="ui-quiet-action" disabled={busy} onClick={() => setEdit(null)}>Cancel</button><button type="submit" className="ui-activity-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
        </form>
      </div>
    </div>}
    {deleting && <div className="ui-activity-dialog-backdrop" role="presentation">
      <div className="ui-activity-dialog" role="alertdialog" aria-modal="true" aria-label="Delete cash record">
        <h3>Delete cash entry?</h3>
        <p className="ui-sm">Remove the {formatEgp(deleting.amount)} EGP {deleting.type.toLowerCase()} from the ledger? This will recalculate your cash and contributed capital.</p>
        <label>Audit reason (optional)<input type="text" value={reason} onChange={e=>setReason(e.target.value)}/></label>
        <div className="ui-activity-inline-actions"><button type="button" className="ui-quiet-action" disabled={busy} onClick={() => setDeleting(null)}>Cancel</button><button type="button" className="ui-activity-primary ui-danger" disabled={busy} onClick={() => void deleteEntry()}>{busy ? 'Deleting…' : 'Delete record'}</button></div>
      </div>
    </div>}
  </section>;
}
