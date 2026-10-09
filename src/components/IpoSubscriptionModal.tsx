import React, { useEffect, useMemo, useState } from 'react';
import type { EGXTicker, Sector, TradeTransaction } from '../types';
import { AnalyticsSelect } from './AnalyticsSelect';
import { DateInput } from './DateInput';
import { NumberStepperInput } from './NumberStepperInput';
import { PremiumModalMotion } from './PremiumMotion';
import { currentCairoDateKey } from '../services/corporateActions';
import { calculateIpoOrderQuote } from '../services/ipoOrderQuote';
import { runVisualTransition } from '../utils/visualTransition';
import { ArrowLeft, CircleDollarSign, ShieldCheck, X } from 'lucide-react';

export interface IpoSubscriptionFormValue {
  ticker: string;
  companyName: string;
  sector: Sector;
  requestedShares: number;
  requestedAmount: number;
  reservedAmount?: number;
  offerPrice: number;
  subscriptionDate: string;
  reference?: string;
  listingDate?: string;
  notes?: string;
}

export interface IpoSubscriptionCorrectionFormValue {
  transactionId: string;
  subscriptionDate: string;
  executionTimeCairo?: string;
  auditReason: string;
}

export interface IpoAllocationFormValue {
  transactionId: string;
  allocatedShares: number;
  allocationDate: string;
  fees?: number;
}

interface IpoSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickers: EGXTicker[];
  transactions: TradeTransaction[];
  cashBalance: number;
  onSubmit: (value: IpoSubscriptionFormValue) => Promise<boolean>;
  onCorrectSubscription: (value: IpoSubscriptionCorrectionFormValue) => Promise<boolean>;
  onAllocate: (value: IpoAllocationFormValue) => Promise<boolean>;
  onCancelSubscription: (transactionId: string) => Promise<boolean>;
}

const formatEgp = (value: number) =>
  new Intl.NumberFormat('en-EG', { maximumFractionDigits: 2 }).format(value);

export const IpoSubscriptionModal: React.FC<IpoSubscriptionModalProps> = ({
  isOpen,
  onClose,
  tickers,
  transactions,
  cashBalance,
  onSubmit,
  onCorrectSubscription,
  onAllocate,
  onCancelSubscription,
}) => {
  const pending = useMemo(
    () => transactions.filter(
      (tx) => tx.type === 'IPO_SUBSCRIPTION' && tx.ipoSubscription?.status === 'SUBMITTED',
    ),
    [transactions],
  );
  const sectorOptions = useMemo(() => {
    const sectors = [...new Set(tickers.map((ticker) => ticker.sector).filter(Boolean))].sort();
    if (!sectors.includes('Other')) sectors.push('Other');
    return sectors.map((sector) => ({ value: sector, label: sector }));
  }, [tickers]);

  const [ticker, setTicker] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [sector, setSector] = useState<Sector>('Other');
  const [requestedSharesInput, setRequestedSharesInput] = useState('');
  const [holdPercent, setHoldPercent] = useState('100');
  const [offerPrice, setOfferPrice] = useState('');
  const [subscriptionDate, setSubscriptionDate] = useState(currentCairoDateKey());
  const [listingDate, setListingDate] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  type IpoView = 'list' | 'create' | 'edit' | 'allocate' | 'cancel';
  const [view, setView] = useState<IpoView>('list');
  const [selectedPendingId, setSelectedPendingId] = useState('');
  const [editingPendingId, setEditingPendingId] = useState<string | null>(null);
  const [correctionDate, setCorrectionDate] = useState('');
  const [correctionTime, setCorrectionTime] = useState('');
  const [correctionReason, setCorrectionReason] = useState('Correct broker IPO order date');
  const [allocatedShares, setAllocatedShares] = useState('');
  const [allocationDate, setAllocationDate] = useState(currentCairoDateKey());
  const [allocationFees, setAllocationFees] = useState('0');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const pendingSelection = pending.find((tx) => tx.id === selectedPendingId);
  const fundingOnCorrectedDate=!!pendingSelection && correctionDate!==pendingSelection.date &&
    transactions.some(tx=>tx.id!==pendingSelection.id && tx.date.slice(0,10)===correctionDate &&
      (tx.cashFlowType==='DEPOSIT' || (tx.ticker.toUpperCase()==='CASH' && tx.type==='BUY' && !tx.cashFlowType)));
  const requestedSharesNumber = requestedSharesInput.trim() ? Number(requestedSharesInput) : 0;
  const holdPercentNumber = Number(holdPercent);
  const offerPriceNumber = offerPrice.trim() ? Number(offerPrice) : 0;
  const orderQuote = (() => {
    try {
      return calculateIpoOrderQuote(requestedSharesNumber, offerPriceNumber, holdPercentNumber);
    } catch {
      return null; // Do not display misleading partial amounts while the user types.
    }
  })();
  const requestedAmountNumber = orderQuote?.requestedAmount ?? 0;
  const heldAmount = orderQuote?.reservedAmount ?? 0;

  useEffect(() => {
    if (!isOpen) return;
    setTicker('');
    setCompanyName('');
    setSector('Other');
    setRequestedSharesInput('');
    setHoldPercent('100');
    setOfferPrice('');
    setSubscriptionDate(currentCairoDateKey());
    setListingDate('');
    setReference('');
    setNotes('');
    setSelectedPendingId(pending[0]?.id ?? '');
    setView('list');
    setEditingPendingId(null);
    setCorrectionDate('');
    setCorrectionTime('');
    setCorrectionReason('Correct broker IPO order date');
    setAllocatedShares('');
    setAllocationDate(currentCairoDateKey());
    setAllocationFees('0');
    setFeedback(null);
    setIsSaving(false);
  }, [isOpen]);

  // Do not discard the user's in-progress form on a background portfolio refresh.
  useEffect(() => {
    if (!isOpen) return;
    if (pending.length && !pending.some(tx => tx.id === selectedPendingId)) {
      setSelectedPendingId(pending[0].id);
      if (view !== 'create') setView('list');
    }
    if (!pending.length && selectedPendingId) {
      setSelectedPendingId('');
      if (view !== 'create') setView('list');
    }
  }, [isOpen, pending, selectedPendingId, view]);

  const requestClose = () => {
    if (isSaving) return;
    runVisualTransition('modal-close', onClose);
  };

  const applyTickerMetadata = (value: string) => {
    const clean = value.toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
    setTicker(clean);
    const match = tickers.find((item) => item.ticker.toUpperCase() === clean);
    if (match) {
      setCompanyName(match.nameEn || clean);
      setSector(match.sector);
    }
    setFeedback(null);
  };

  const submitSubscription = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;

    const cleanTicker = ticker.trim().toUpperCase();
    if (!cleanTicker) return setFeedback('Enter the IPO ticker.');
    if (!companyName.trim()) return setFeedback('Enter the company name.');
    if (!orderQuote) {
      try {
        calculateIpoOrderQuote(requestedSharesNumber, offerPriceNumber, holdPercentNumber);
      } catch (error) {
        return setFeedback(error instanceof Error ? error.message : 'Invalid IPO order.');
      }
      return setFeedback('Enter valid IPO order details.');
    }
    if (heldAmount > cashBalance + 0.005) {
      return setFeedback(`Broker hold of ${formatEgp(heldAmount)} EGP exceeds ${formatEgp(cashBalance)} EGP available cash.`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(subscriptionDate)) {
      return setFeedback('Enter a valid subscription date.');
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const saved = await onSubmit({
        ticker: cleanTicker,
        companyName: companyName.trim(),
        sector,
        requestedShares: orderQuote.requestedShares,
        requestedAmount: orderQuote.requestedAmount,
        reservedAmount: orderQuote.reservedAmount,
        offerPrice: offerPriceNumber,
        subscriptionDate,
        reference: reference.trim() || undefined,
        listingDate: listingDate || undefined,
        notes: notes.trim() || undefined,
      });
      if (saved) {
        setView('list');
        setRequestedSharesInput('');
        setReference('');
        setNotes('');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const beginCorrection = (tx: TradeTransaction) => {
    if (isSaving || tx.type !== 'IPO_SUBSCRIPTION' || tx.ipoSubscription?.status !== 'SUBMITTED') return;
    setSelectedPendingId(tx.id);
    setEditingPendingId(tx.id);
    setView('edit');
    setCorrectionDate(tx.ipoSubscription.subscriptionDate || tx.date);
    setCorrectionTime(tx.executedAt
      ? new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(tx.executedAt))
      : '');
    setCorrectionReason('Correct broker IPO order date');
    setFeedback(null);
  };

  const submitCorrection = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingPendingId || !pendingSelection || pendingSelection.id !== editingPendingId || isSaving) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(correctionDate)) {
      setFeedback('Enter the correct subscription date.'); return;
    }
    if (fundingOnCorrectedDate && !correctionTime.trim()) {
      setFeedback('Enter the broker placement time, because you funded this subscription on the same date.'); return;
    }
    if (!correctionReason.trim()) {
      setFeedback('Please enter a reason for the audited correction.'); return;
    }
    if (correctionTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(correctionTime)) {
      setFeedback('Enter a valid Cairo time in HH:MM format.'); return;
    }
    setIsSaving(true);
    setFeedback(null);
    try {
      const saved = await onCorrectSubscription({
        transactionId: editingPendingId,
        subscriptionDate: correctionDate,
        executionTimeCairo: correctionTime.trim() || undefined,
        auditReason: correctionReason.trim(),
      });
      if (saved) {
        setEditingPendingId(null);
        setView('list');
        setCorrectionDate('');
        setCorrectionTime('');
      } else {
        setFeedback('The correction was not saved. The original subscription remains unchanged. If funding occurred on the same date, enter the actual order placement time.');
      }
    } finally { setIsSaving(false); }
  };

  const submitAllocation = async () => {
    if (!pendingSelection || isSaving) return;
    const shares = Number(allocatedShares);
    const fees = Number(allocationFees || 0);
    if (!Number.isFinite(shares) || shares <= 0) {
      setFeedback('Allocated shares must be greater than zero.');
      return;
    }
    if (!Number.isFinite(fees) || fees < 0) {
      setFeedback('Allocation fees cannot be negative.');
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const saved = await onAllocate({
        transactionId: pendingSelection.id,
        allocatedShares: shares,
        allocationDate,
        fees,
      });
      if (saved) {
        setView('list');
        setAllocatedShares('');
        setAllocationFees('0');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const startAllocation = (tx: TradeTransaction) => {
    if (isSaving) return;
    setSelectedPendingId(tx.id);
    setAllocatedShares('');
    setAllocationDate(currentCairoDateKey());
    setAllocationFees('0');
    setFeedback(null);
    setView('allocate');
  };

  const startCancel = (tx: TradeTransaction) => {
    if (isSaving) return;
    setSelectedPendingId(tx.id);
    setFeedback(null);
    setView('cancel');
  };

  const cancelPending = async () => {
    if (!pendingSelection || isSaving) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      const saved = await onCancelSubscription(pendingSelection.id);
      if (saved) setView('list');
    } finally {
      setIsSaving(false);
    }
  };

  const viewTitle = view === 'list' ? 'IPO subscriptions'
    : view === 'create' ? 'New IPO subscription'
    : view === 'edit' ? 'Edit pending subscription'
    : view === 'allocate' ? 'Record IPO allocation'
    : 'Cancel subscription';

  return (
    <PremiumModalMotion
      isOpen={isOpen}
      backdropClassName="premium-modal-backdrop premium-modal-backdrop-panel-scroll fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      panelClassName="premium-modal premium-modal-viewport w-full max-w-3xl rounded-2xl p-4 sm:p-6 text-slate-100 space-y-4"
      onBackdropClick={requestClose}
      panelAriaLabel={viewTitle}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex min-w-0 items-start gap-3">
          {view !== 'list' && <button type="button" aria-label="Back to IPO subscriptions"
            onClick={() => { if (!isSaving) {setView('list');setFeedback(null);} }} disabled={isSaving}
            className="premium-icon-action rounded-lg p-2 shrink-0"><ArrowLeft className="h-5 w-5"/></button>}
          <div className="premium-inset-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <CircleDollarSign className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white">{viewTitle}</h3>
            <p className="premium-type-helper mt-1">
              {view === 'list' ? 'Review pending orders and choose one action at a time.'
                : view === 'create' ? 'Enter shares and offer price; cash hold is calculated.'
                : view === 'edit' ? 'Correct the existing order without reserving cash again.'
                : view === 'allocate' ? 'Only record actual allocated shares when confirmed by your broker.'
                : 'Release the original held amount only if the broker cancelled the order.'}
            </p>
          </div>
        </div>
        <button type="button" aria-label="Close IPO subscription" onClick={requestClose} className="premium-icon-action shrink-0 rounded-lg p-1.5">
          <X className="h-5 w-5" />
        </button>
      </div>

      {view === 'create' && <form onSubmit={submitSubscription} className="space-y-4 text-xs">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-white">New subscription</h4>
            <p className="premium-type-helper mt-0.5">Available cash: {formatEgp(cashBalance)} EGP</p>
          </div>

        </div>

        <div className="premium-form-section grid grid-cols-1 gap-3 rounded-xl p-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block font-semibold text-slate-300">Ticker</label>
            <input
              value={ticker}
              onChange={(event) => applyTickerMetadata(event.target.value)}
              className="premium-field w-full rounded-xl px-3 py-2 font-mono font-bold uppercase text-white focus:outline-none"
              placeholder="e.g. HALN"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="block font-semibold text-slate-300">Company</label>
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              className="premium-field w-full rounded-xl px-3 py-2 text-white focus:outline-none"
              placeholder="Company name"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="block font-semibold text-slate-300">Sector</label>
            <AnalyticsSelect
              value={sector}
              onChange={(value) => setSector(value as Sector)}
              accent="blue"
              ariaLabel="IPO sector"
              className="w-full"
              options={sectorOptions}
            />
          </div>
          <DateInput
            value={subscriptionDate}
            onChange={setSubscriptionDate}
            label="Subscription Date"
            required
            showVerbosePreview={false}
          />
        </div>

        <div className="premium-form-section grid grid-cols-1 gap-3 rounded-xl p-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block font-semibold text-slate-300">Number of shares</label>
            <NumberStepperInput
              min={1}
              step={1}
              required
              value={requestedSharesInput}
              onValueChange={(value) => { setRequestedSharesInput(value); setFeedback(null); }}
              accent="blue"
              className="premium-field w-full rounded-xl px-3 py-2 font-mono font-bold text-white focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="block font-semibold text-slate-300">Offer price / share (EGP)</label>
            <NumberStepperInput
              min={0}
              step={0.01}
              required
              value={offerPrice}
              onValueChange={(value) => { setOfferPrice(value); setFeedback(null); }}
              accent="blue"
              className="premium-field w-full rounded-xl px-3 py-2 font-mono font-bold text-white focus:outline-none"
            />
          </div>
        </div>

        <div className="premium-form-section grid grid-cols-1 gap-3 rounded-xl p-3 sm:grid-cols-2">
          <label className="block space-y-1 font-semibold text-slate-300">Cash held by broker (% of order)
            <input type="number" min="0.01" max="100" step="0.01" inputMode="decimal"
              value={holdPercent} onChange={event => { setHoldPercent(event.target.value); setFeedback(null); }}
              className="premium-field w-full rounded-xl px-3 py-2 font-mono text-white" required/>
          </label>
          <p className="premium-type-helper self-center">Enter the percentage your broker holds from the order (for example, 25%).</p>
        </div>

        <div className="premium-inset-glass grid grid-cols-1 gap-3 rounded-xl p-3 sm:grid-cols-3" aria-label="Calculated IPO order summary" aria-live="polite">
          <div>
            <span className="premium-type-metric-label block">Shares requested</span>
            <span className="premium-type-metric premium-type-metric-dense font-mono text-slate-100">
              {orderQuote ? orderQuote.requestedShares.toLocaleString('en-EG') : '—'}
            </span>
          </div>
          <div>
            <span className="premium-type-metric-label block">Total order value</span>
            <span className="premium-type-metric premium-type-metric-dense font-mono text-slate-100">
              {orderQuote ? `${formatEgp(requestedAmountNumber)} EGP` : '—'}
            </span>
          </div>
          <div>
            <span className="premium-type-metric-label block">Cash held by broker</span>
            <span className="premium-type-metric premium-type-metric-dense font-mono text-cyan-300">
              {orderQuote ? `${formatEgp(heldAmount)} EGP` : '—'}
            </span>
          </div>
          <p className="premium-type-helper sm:col-span-3">
            Available after hold: {orderQuote ? `${formatEgp(cashBalance - heldAmount)} EGP` : '—'}.
            This hold changes buying power, not portfolio NAV or return.
          </p>
        </div>

        <div className="premium-form-section grid grid-cols-1 gap-3 rounded-xl p-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block font-semibold text-slate-300">Broker / Offer Reference</label>
            <input value={reference} onChange={(event) => setReference(event.target.value)} className="premium-field w-full rounded-xl px-3 py-2 text-white focus:outline-none" placeholder="Optional reference" />
          </div>
          <DateInput
            value={listingDate}
            onChange={setListingDate}
            label="Expected Listing Date"
            showVerbosePreview={false}
          />
          <div className="space-y-1 sm:col-span-2">
            <label className="block font-semibold text-slate-300">Notes</label>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="premium-field w-full resize-none rounded-xl px-3 py-2 text-white focus:outline-none" />
          </div>
        </div>

        <div className="premium-subpanel flex items-start gap-2 rounded-xl border-cyan-500/25 p-3 text-slate-300">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
          <p>
            Submission reserves only the broker-held amount, not necessarily the entire order commitment.
            It does not create shares or P&amp;L until allocation is recorded.
          </p>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={isSaving} className="premium-action premium-action-primary premium-shimmer-border rounded-xl px-4 py-2 font-bold disabled:opacity-50">
            {isSaving ? 'Saving…' : 'Record IPO Subscription'}
          </button>
        </div>
      </form>}

      {view === 'list' && <div className="space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-white">Pending orders</h4>
            <p className="premium-type-helper mt-1">{pending.length} awaiting allocation · available cash {formatEgp(cashBalance)} EGP</p>
          </div>
          <button type="button" onClick={() => {setView('create');setFeedback(null);}}
            className="premium-action premium-action-primary rounded-xl px-4 py-2 font-semibold">
            + New subscription
          </button>
        </div>
        {pending.length === 0 && <div className="premium-form-section rounded-xl p-4 text-slate-300">
          No pending subscriptions. Create one only for a new broker order.
        </div>}
        {pending.map(tx => <div key={tx.id} className="premium-form-section rounded-xl p-3 space-y-3">
          <div className="flex justify-between gap-3">
            <div>
              <strong className="text-white text-sm">{tx.ticker}</strong>
              <p className="premium-type-helper mt-1">Pending · {tx.ipoSubscription?.subscriptionDate || tx.date}</p>
            </div>
            <div className="text-right">
              <strong className="font-mono text-cyan-200">{formatEgp(Number(tx.ipoSubscription?.reservedAmount ?? tx.ipoSubscription?.requestedAmount ?? 0))} EGP</strong>
              <p className="premium-type-helper mt-1">Broker hold</p>
            </div>
          </div>
          <p className="premium-type-helper">
            {Number(tx.ipoSubscription?.requestedShares ?? tx.shares).toLocaleString('en-EG')} shares requested ·
            {formatEgp(Number(tx.ipoSubscription?.requestedAmount ?? tx.totalAmount))} EGP full order
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={isSaving} onClick={() => beginCorrection(tx)}
              className="premium-action rounded-xl px-3 py-3 font-semibold">Edit order details</button>
            <button type="button" disabled={isSaving} onClick={() => startAllocation(tx)}
              className="premium-action premium-action-success rounded-xl px-3 py-3 font-semibold">Record allocation</button>
          </div>
          <button type="button" disabled={isSaving} onClick={() => startCancel(tx)}
            className="text-rose-300 text-xs text-left py-1">Cancel subscription…</button>
        </div>)}
      </div>}

      {view === 'edit' && pendingSelection && (
        <section className="premium-form-section space-y-3 rounded-xl p-3 text-xs" aria-label="Edit existing pending IPO order">
          <div className="space-y-1">
            <h4 className="font-bold text-white">{pendingSelection.ticker} · Correct subscription details</h4>
            <p className="premium-type-helper">
              {Number(pendingSelection.ipoSubscription?.requestedShares ?? pendingSelection.shares).toLocaleString('en-EG')} requested shares ·
              {formatEgp(Number(pendingSelection.ipoSubscription?.reservedAmount ?? pendingSelection.ipoSubscription?.requestedAmount ?? 0))} EGP already held.
            </p>
          </div>
          <form className="space-y-3 border-t border-slate-700/40 pt-3" onSubmit={submitCorrection}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DateInput id="ipo-correction-date" value={correctionDate}
                onChange={value => {setCorrectionDate(value);setFeedback(null);}}
                label="Actual subscription date" required showVerbosePreview={false}/>
              <label className="block space-y-1 font-semibold text-slate-300">
                <span>Order time (Cairo){fundingOnCorrectedDate?' · required':' · optional'}</span>
                <input type="time" value={correctionTime} required={fundingOnCorrectedDate}
                  onChange={event=>{setCorrectionTime(event.target.value);setFeedback(null);}}
                  className="premium-field w-full rounded-xl px-3 py-2 font-mono text-white"/>
              </label>
            </div>
            <p className="premium-type-helper">
              Use the actual broker order time if you deposited cash on the same date.
              This edits the original order, with no additional cash hold.
            </p>
            <label className="block space-y-1 font-semibold text-slate-300">
              <span>Audit reason</span>
              <input value={correctionReason} required
                onChange={event=>setCorrectionReason(event.target.value)}
                className="premium-field w-full rounded-xl px-3 py-2 text-white"
                placeholder="Reason for correcting this order"/>
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" disabled={isSaving} className="premium-action rounded-xl px-4 py-3"
                onClick={()=>{setView('list');setEditingPendingId(null);setFeedback(null);}}>Discard</button>
              <button type="submit" disabled={isSaving || !correctionDate || !correctionReason.trim()}
                className="premium-action premium-action-primary rounded-xl px-4 py-3 font-semibold disabled:opacity-40">
                {isSaving?'Saving correction…':'Save changes'}
              </button>
            </div>
          </form>
        </section>
      )}

      {view === 'allocate' && pendingSelection && (
        <section className="premium-form-section space-y-3 rounded-xl p-3 text-xs" aria-label="Record confirmed IPO allocation">
          <div>
            <h4 className="font-bold text-white">{pendingSelection.ticker} · Record allocation</h4>
            <p className="premium-type-helper mt-1">
              {Number(pendingSelection.ipoSubscription?.requestedShares ?? pendingSelection.shares).toLocaleString('en-EG')} shares requested.
              Record only the shares your broker actually allocated.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="block font-semibold text-slate-300">Allocated shares</label>
              <NumberStepperInput min={1} step={1} value={allocatedShares}
                onValueChange={setAllocatedShares} accent="blue"
                className="premium-field w-full rounded-xl px-3 py-2 font-mono font-bold text-white"/>
            </div>
            <DateInput value={allocationDate} onChange={setAllocationDate}
              label="Allocation date" required showVerbosePreview={false}/>
            <div className="space-y-1">
              <label className="block font-semibold text-slate-300">Allocation fees</label>
              <NumberStepperInput min={0} step={0.01} value={allocationFees}
                onValueChange={setAllocationFees} accent="blue"
                className="premium-field w-full rounded-xl px-3 py-2 font-mono text-white"/>
            </div>
          </div>
          <div className="premium-inset-glass rounded-xl p-3 space-y-1">
            <p className="premium-type-helper">Estimated allocation cost · {formatEgp(Math.max(0,Number(allocatedShares)||0)*Number(pendingSelection.ipoSubscription?.offerPrice||0)+Math.max(0,Number(allocationFees)||0))} EGP</p>
            <p className="premium-type-helper">Broker cash already held · {formatEgp(Number(pendingSelection.ipoSubscription?.reservedAmount??pendingSelection.ipoSubscription?.requestedAmount??0))} EGP</p>
            <p className="premium-type-helper">Unused hold will be released; any extra allocation cost requires available cash.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={isSaving} className="premium-action rounded-xl px-4 py-3"
              onClick={()=>{setView('list');setFeedback(null);}}>Back</button>
            <button type="button" onClick={submitAllocation} disabled={isSaving || !allocatedShares || Number(allocatedShares)<=0}
              className="premium-action premium-action-success rounded-xl px-4 py-3 font-bold disabled:opacity-40">
              {isSaving?'Saving allocation…':'Confirm allocation'}
            </button>
          </div>
        </section>
      )}

      {view === 'cancel' && pendingSelection && (
        <section className="premium-form-section space-y-4 rounded-xl p-4 text-xs" aria-label="Confirm IPO subscription cancellation">
          <h4 className="font-bold text-white">Cancel {pendingSelection.ticker} subscription?</h4>
          <p className="premium-type-helper">
            Only do this after your broker confirms the subscription has been cancelled.
            This will release {formatEgp(Number(pendingSelection.ipoSubscription?.reservedAmount ?? pendingSelection.ipoSubscription?.requestedAmount ?? 0))} EGP
            back to available cash. No shares will be recorded.
          </p>
          <div className="flex flex-wrap gap-2 justify-end">
            <button type="button" disabled={isSaving} className="premium-action rounded-xl px-4 py-3"
              onClick={()=>{setView('list');setFeedback(null);}}>Keep subscription</button>
            <button type="button" disabled={isSaving} className="premium-action rounded-xl px-4 py-3 font-semibold text-rose-300"
              onClick={cancelPending}>{isSaving?'Cancelling…':'Confirm cancellation'}</button>
          </div>
        </section>
      )}

      {feedback && (
        <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {feedback}
        </div>
      )}
    </PremiumModalMotion>
  );
};
