import React, { useEffect, useState } from 'react';
import type { EGXTicker, Sector } from '../types';
import { currentCairoDateKey } from '../services/corporateActions';
import { calculateIpoOrderQuote } from '../services/ipoOrderQuote';
import { parseUserCalendarDate } from '../utils/dateUtils';
import { formatEgp } from './format';

export interface NewIpoOrder {
  ticker:string;
  companyName:string;
  sector:Sector;
  requestedShares:number;
  requestedAmount:number;
  reservedAmount:number;
  offerPrice:number;
  subscriptionDate:string;
  reference?:string;
  notes?:string;
}

interface Props {
  isOpen:boolean;
  onClose:()=>void;
  tickers:EGXTicker[];
  cashBalance:number;
  onSubmit:(order:NewIpoOrder)=>Promise<boolean>;
}

/** IPO creation is a SINGLE task. Corrections/allocations/deletion live on Activity records. */
export function SimpleIpoCreateModal({isOpen,onClose,tickers,cashBalance,onSubmit}:Props){
  const [ticker,setTicker]=useState('');
  const [companyName,setCompanyName]=useState('');
  const [sector,setSector]=useState<Sector>('Other');
  const [shares,setShares]=useState('');
  const [price,setPrice]=useState('');
  const [heldPercent,setHeldPercent]=useState('100');
  const [date,setDate]=useState(currentCairoDateKey());
  const [reference,setReference]=useState('');
  const [notes,setNotes]=useState('');
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    if(!isOpen)return;
    setTicker('');setCompanyName('');setSector('Other');setShares('');setPrice('');
    setHeldPercent('100');setDate(currentCairoDateKey());setReference('');setNotes('');
    setSaving(false);setError('');
  },[isOpen]);

  let quote:ReturnType<typeof calculateIpoOrderQuote>|null=null;
  try {quote=calculateIpoOrderQuote(Number(shares),Number(price),Number(heldPercent));}
  catch { /* Inputs are optional until Save; never show a fabricated total. */ }

  const updateTicker=(raw:string)=>{
    const code=raw.trim().toUpperCase().replace(/^EGX:/,'').replace(/\.CA$/,'');
    setTicker(code);
    const found=tickers.find(item=>item.ticker.toUpperCase()===code);
    if(found){setCompanyName(found.nameEn||code);setSector(found.sector);}
  };

  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(saving)return;
    setError('');
    let order:NonNullable<typeof quote>;
    try {order=calculateIpoOrderQuote(Number(shares),Number(price),Number(heldPercent));}
    catch(err){setError(err instanceof Error?err.message:'Invalid IPO order.');return;}
    if(!ticker.trim()||!companyName.trim()){setError('Enter the ticker and company name.');return;}
    const validDate=parseUserCalendarDate(date);
    if(!validDate){setError('Select a valid subscription date.');return;}
    if(order.reservedAmount>cashBalance+0.005){
      setError(`Broker hold ${formatEgp(order.reservedAmount)} EGP exceeds available cash ${formatEgp(cashBalance)} EGP.`);
      return;
    }
    setSaving(true);
    try {
      const saved=await onSubmit({
        ticker:ticker.trim(),companyName:companyName.trim(),sector,
        requestedShares:order.requestedShares,offerPrice:order.offerPrice,
        requestedAmount:order.requestedAmount,reservedAmount:order.reservedAmount,
        subscriptionDate:validDate,reference:reference.trim()||undefined,notes:notes.trim()||undefined,
      });
      if(saved)onClose();
      else setError('Subscription was not saved. No additional cash was held.');
    }catch(err){setError(err instanceof Error?err.message:'Unable to record the subscription.');}
    finally{setSaving(false);}
  };

  if(!isOpen)return null;
  return <div className="ui-activity-dialog-backdrop" role="presentation">
    <div className="ui-activity-dialog" role="dialog" aria-modal="true" aria-label="New IPO subscription">
      <h3>New IPO subscription</h3>
      <p className="ui-sm">For an existing order, use its Edit or Allocation action in Activity instead.</p>
      <form className="ui-activity-dialog-form" onSubmit={submit}>
        <label>Ticker<input value={ticker} onChange={e=>updateTicker(e.target.value)}
          list="ipo-ticker-list" placeholder="e.g. IPOX" autoCapitalize="characters" required/></label>
        <datalist id="ipo-ticker-list">{tickers.map(t=><option key={t.ticker} value={t.ticker}>{t.nameEn}</option>)}</datalist>
        <label>Company<input value={companyName} onChange={e=>setCompanyName(e.target.value)} required/></label>
        <label>Requested shares<input type="number" min="1" step="1" inputMode="numeric"
          value={shares} onChange={e=>setShares(e.target.value)} required/></label>
        <label>Offer price per share (EGP)<input type="number" min="0.000001" step="any" inputMode="decimal"
          value={price} onChange={e=>setPrice(e.target.value)} required/></label>
        <label>Broker cash hold (%)<input type="number" min="0.01" max="100" step="0.01" inputMode="decimal"
          value={heldPercent} onChange={e=>setHeldPercent(e.target.value)} required/></label>
        <div className="ui-ipo-create-summary" aria-live="polite">
          <span>Order value <strong>{quote?`${formatEgp(quote.requestedAmount)} EGP`:'—'}</strong></span>
          <span>Held cash <strong>{quote?`${formatEgp(quote.reservedAmount)} EGP`:'—'}</strong></span>
          <span>Available after hold <strong>{quote?`${formatEgp(cashBalance-quote.reservedAmount)} EGP`:'—'}</strong></span>
        </div>
        <label>Subscription date<input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label>
        <label>Broker reference (optional)<input value={reference} onChange={e=>setReference(e.target.value)}/></label>
        <label>Notes (optional)<input value={notes} onChange={e=>setNotes(e.target.value)}/></label>
        <p className="ui-sm">Saving reserves the actual held cash, not the full order amount. Requested shares are not owned until allocation.</p>
        {error&&<p className="ui-activity-feedback" role="alert">{error}</p>}
        <div className="ui-activity-inline-actions">
          <button type="button" disabled={saving} className="ui-quiet-action" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="ui-activity-primary">
            {saving?'Saving…':'Record subscription'}
          </button>
        </div>
      </form>
    </div>
  </div>;
}
