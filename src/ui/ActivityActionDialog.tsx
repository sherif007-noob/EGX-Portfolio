import React, { useState } from 'react';
import type { CanonicalCashFlowType, TradeTransaction } from '../types';
import { cashFlowSignedImpact, normalizeCashFlowType } from '../services/cashFlowSemantics';
import { isCashLedgerRecord, isSecurityTrade } from '../services/ledgerRecordTypes';
import { calculateIpoOrderQuote } from '../services/ipoOrderQuote';
import { formatEgp } from './format';

export type ActivityAction = 'edit' | 'allocate' | 'delete';
export type IpoOrderCorrection = {
  transactionId:string;subscriptionDate:string;executionTimeCairo?:string;
  requestedShares?:number;offerPrice?:number;reservedAmount?:number;
  reference?:string;notes?:string;auditReason:string;
};
export type IpoAllocation = {transactionId:string;allocatedShares:number;allocationDate:string;fees?:number};
interface Props {
  record:TradeTransaction;
  action:ActivityAction;
  transactions:TradeTransaction[];
  onClose:()=>void;
  onSaveTrade:(record:TradeTransaction,reason:string)=>Promise<boolean>;
  onSaveCash:(record:TradeTransaction,reason:string)=>Promise<boolean>;
  onSaveIpo:(record:IpoOrderCorrection)=>Promise<boolean>;
  onAllocateIpo:(record:IpoAllocation)=>Promise<boolean>;
  onDelete:(id:string,reason:string)=>Promise<boolean>;
}
const cashTypes:CanonicalCashFlowType[] = ['DEPOSIT','WITHDRAWAL','DIVIDEND','FEE','OTHER_INCOME','OTHER_EXPENSE','RECONCILIATION_ADJUSTMENT'];
const words=(value:string)=>value.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,x=>x.toUpperCase());
const cairoClock=(timestamp?:string):string=>{
  if(!timestamp || !Number.isFinite(Date.parse(timestamp)))return '';
  return new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(timestamp));
};

export function ActivityActionDialog({record,action,transactions,onClose,onSaveTrade,onSaveCash,onSaveIpo,onAllocateIpo,onDelete}:Props) {
  const ipo=record.ipoSubscription;
  const isIpo=record.type==='IPO_SUBSCRIPTION';
  const isCash=isCashLedgerRecord(record);
  const isTrade=isSecurityTrade(record);
  const [date,setDate]=useState(ipo?.subscriptionDate || record.date);
  const [clock,setClock]=useState(cairoClock(record.executedAt));
  const [shares,setShares]=useState(String(isIpo?(ipo?.requestedShares??record.shares):record.shares));
  const [price,setPrice]=useState(String(isIpo?(ipo?.offerPrice??record.price):record.price));
  const [fees,setFees]=useState(String(record.fees||0));
  const [cashKind,setCashKind]=useState<CanonicalCashFlowType>(
    normalizeCashFlowType(record.cashFlowType) || (record.type==='SELL'?'WITHDRAWAL':'DEPOSIT'));
  const [cashAmount,setCashAmount]=useState(String(
    normalizeCashFlowType(record.cashFlowType)==='RECONCILIATION_ADJUSTMENT'
      ? record.cashFlowAmount??record.totalAmount : Math.abs(record.cashFlowAmount??record.totalAmount)));
  const [held,setHeld]=useState(String(ipo?.reservedAmount??ipo?.requestedAmount??0));
  const [reference,setReference]=useState(ipo?.reference??'');
  const [notes,setNotes]=useState(record.notes??'');
  const [allocationShares,setAllocationShares]=useState('');
  const [allocationDate,setAllocationDate]=useState('');
  const [allocationFees,setAllocationFees]=useState('0');
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const isPending=isIpo && ipo?.status==='SUBMITTED';
  const fundedSameDay=isIpo && date!==record.date && transactions.some(tx=>
    tx.id!==record.id && tx.date===date && (tx.cashFlowType==='DEPOSIT' || (tx.ticker.toUpperCase()==='CASH' && tx.type==='BUY'&&!tx.cashFlowType)));
  const title=action==='delete'? `Delete ${isCash?'cash':isIpo?'IPO':'trade'} record?`
    :action==='allocate'?`Record ${record.ticker} allocation`
    :isCash?'Edit cash entry':isIpo?`Edit ${record.ticker} subscription`:`Edit ${record.ticker} ${record.type.toLowerCase()}`;
  const input=(label:string,value:string,set:(value:string)=>void,type='text',opts?:{step?:string;min?:string})=>
    <label className="ui-activity-action-field">{label}<input type={type} value={value}
      min={opts?.min} step={opts?.step} onChange={e=>set(e.target.value)} required/></label>;
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(busy)return;
    setError('');
    if(!reason.trim()){setError('Enter a reason for this audited ledger change.');return;}
    let run:()=>Promise<boolean>;
    try {
      if(action==='delete'){
        if(record.type==='OPENING_POSITION' || (isIpo && !isPending)){
          throw new Error('This lifecycle record cannot be deleted directly.');
        }
        run=()=>onDelete(record.id,reason.trim());
      } else if(action==='allocate'){
        if(!isPending)throw new Error('Only pending IPO orders can be allocated.');
        const number=Number(allocationShares),fee=Number(allocationFees);
        if(!Number.isSafeInteger(number)||number<1 || number>(ipo?.requestedShares??0))throw new Error('Allocated shares must be a positive whole number within the order.');
        if(!Number.isFinite(fee)||fee<0)throw new Error('Enter valid allocation fees.');
        if(!/^\d{4}-\d{2}-\d{2}$/.test(allocationDate))throw new Error('Select the actual allocation date.');
        run=()=>onAllocateIpo({transactionId:record.id,allocatedShares:number,allocationDate,fees:fee});
      } else if(isTrade){
        const number=Number(shares),unit=Number(price),fee=Number(fees);
        if(!Number.isFinite(number)||number<=0||!Number.isFinite(unit)||unit<=0||!Number.isFinite(fee)||fee<0)throw new Error('Enter valid shares, price and fees.');
        if(!date)throw new Error('Enter the trade date.');
        const modified:TradeTransaction={...record,shares:number,price:unit,fees:fee,date,
          executedAt:date===record.date?record.executedAt:undefined,notes:notes.trim()||undefined};
        run=()=>onSaveTrade(modified,reason.trim());
      } else if(isCash){
        const amount=Number(cashAmount);
        if(!Number.isFinite(amount)||(!(['RECONCILIATION_ADJUSTMENT'].includes(cashKind))&&amount<=0)||amount===0)throw new Error('Enter a valid cash amount.');
        if(!date)throw new Error('Enter the cash event date.');
        const signed=cashFlowSignedImpact(cashKind,amount);
        if(signed===null)throw new Error('Invalid cash flow.');
        const modified:TradeTransaction={...record,cashFlowType:cashKind,cashFlowAmount:cashKind==='RECONCILIATION_ADJUSTMENT'?signed:Math.abs(amount),
          type:signed<0?'SELL':'BUY',date,executedAt:date===record.date?record.executedAt:undefined,
          shares:Math.abs(signed),price:1,fees:0,totalAmount:Math.abs(signed),netCashImpact:signed,
          notes:notes.trim()||undefined};
        run=()=>onSaveCash(modified,reason.trim());
      } else if(isIpo && isPending && ipo){
        const quote=calculateIpoOrderQuote(Number(shares),Number(price),100);
        const reserve=Number(held);
        if(!Number.isFinite(reserve)||reserve<=0||reserve>quote.requestedAmount+0.01)throw new Error('Held cash must be positive and cannot exceed the full order.');
        if(!date)throw new Error('Select the subscription date.');
        if(fundedSameDay&&!clock)throw new Error('Enter the actual broker order time for the funding date.');
        run=()=>onSaveIpo({transactionId:record.id,requestedShares:quote.requestedShares,offerPrice:quote.offerPrice,
          reservedAmount:reserve,subscriptionDate:date,executionTimeCairo:clock||undefined,
          reference,notes,auditReason:reason.trim()});
      } else throw new Error('This record cannot be edited using this form.');
    } catch(e){setError(e instanceof Error?e.message:'Invalid entry.');return;}
    setBusy(true);
    try {const success=await run();if(success)onClose();else setError('The audited ledger rejected this change; the record was not modified.');}
    catch(e){setError(e instanceof Error?e.message:'The change could not be saved.');}
    finally{setBusy(false);}
  };
  return <div className="ui-activity-dialog-backdrop" role="presentation">
    <div className="ui-activity-dialog" role="dialog" aria-modal="true" aria-label={title}>
      <h3>{title}</h3>
      <form className="ui-activity-dialog-form" onSubmit={submit}>
        {action==='delete'&&<p className="ui-sm">
          This deletes the <strong>app ledger record</strong>, not a broker order.
          {isIpo?' Deleting an erroneous pending IPO entry releases its recorded held cash; it does NOT cancel the real broker subscription.':''}
          {' '}Cash, holdings and performance will be recalculated. This action is audited.
        </p>}
        {action==='allocate'&&ipo&&<>
          <p className="ui-sm">{ipo.requestedShares.toLocaleString()} shares requested · {formatEgp(ipo.reservedAmount??ipo.requestedAmount)} EGP already held.</p>
          {input('Shares actually allocated',allocationShares,setAllocationShares,'number',{min:'1',step:'1'})}
          {input('Allocation date',allocationDate,setAllocationDate,'date')}
          {input('Allocation fees (EGP)',allocationFees,setAllocationFees,'number',{min:'0',step:'.01'})}
        </>}
        {action==='edit'&&isTrade&&<>
          {input('Shares',shares,setShares,'number',{min:'0.000001',step:'any'})}
          {input('Execution price / share (EGP)',price,setPrice,'number',{min:'0.000001',step:'any'})}
          {input('Fees (EGP)',fees,setFees,'number',{min:'0',step:'.01'})}
          {input('Trade date',date,setDate,'date')}
          {input('Notes',notes,setNotes)}
        </>}
        {action==='edit'&&isCash&&<>
          <label className="ui-activity-action-field">Cash event type<select value={cashKind}
            onChange={e=>setCashKind(e.target.value as CanonicalCashFlowType)}>
            {cashTypes.map(kind=><option key={kind} value={kind}>{words(kind)}</option>)}
          </select></label>
          {input(cashKind==='RECONCILIATION_ADJUSTMENT'?'Signed adjustment (EGP)':'Cash amount (EGP)',cashAmount,setCashAmount,'number',{step:'.01'})}
          {input('Cash event date',date,setDate,'date')}
          {input('Notes',notes,setNotes)}
        </>}
        {action==='edit'&&isIpo&&ipo&&<>
          <p className="ui-sm">Edit the existing pending broker order. No new order or hold will be created.</p>
          {input('Requested shares',shares,setShares,'number',{min:'1',step:'1'})}
          {input('Offer price per share (EGP)',price,setPrice,'number',{min:'0.000001',step:'any'})}
          {input('Cash held by broker (EGP)',held,setHeld,'number',{min:'.01',step:'.01'})}
          {input('Actual subscription date',date,setDate,'date')}
          {input(`Order time Cairo ${fundedSameDay?'(required)':'(optional)'}`,clock,setClock,'time')}
          {input('Broker reference',reference,setReference)}
          {input('Notes',notes,setNotes)}
        </>}
        <label className="ui-activity-action-field">Audit reason<input required value={reason}
          onChange={e=>setReason(e.target.value)} placeholder="Why are you changing this record?"/></label>
        {error&&<p className="ui-activity-feedback" role="alert">{error}</p>}
        <div className="ui-activity-inline-actions">
          <button type="button" className="ui-quiet-action" disabled={busy} onClick={onClose}>Back</button>
          <button type="submit" disabled={busy} className={`ui-activity-primary ${action==='delete'?'ui-danger':''}`}>
            {busy?'Saving…':action==='delete'?'Delete record':action==='allocate'?'Record allocation':'Save changes'}
          </button>
        </div>
      </form>
    </div>
  </div>;
}
