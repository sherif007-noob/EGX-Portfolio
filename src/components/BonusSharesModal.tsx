import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Gift, X } from 'lucide-react';
import type { Position } from '../types';
import { NumberStepperInput } from './NumberStepperInput';
import { PremiumModalMotion } from './PremiumMotion';
import { runVisualTransition } from '../utils/visualTransition';

export interface BonusSharesSubmission {
  position: Position;
  awardedShares: number;
  effectiveDate: string;
  ratio?: number;
  reference?: string;
  notes?: string;
}

interface BonusSharesModalProps {
  isOpen: boolean;
  position: Position | null;
  onClose: () => void;
  onApply: (input: BonusSharesSubmission) => Promise<boolean>;
}

function cairoDateKey(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${read('year')}-${read('month')}-${read('day')}`;
}

function formatShares(value: number): string {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 6 }).format(value);
}

export const BonusSharesModal: React.FC<BonusSharesModalProps> = ({
  isOpen,
  position,
  onClose,
  onApply,
}) => {
  const lastPositionRef = useRef<Position | null>(position);
  if (position) lastPositionRef.current = position;
  const displayPosition = position ?? lastPositionRef.current;

  const [ratio, setRatio] = useState('');
  const [awardedShares, setAwardedShares] = useState('');
  const [actualSharesEdited, setActualSharesEdited] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(cairoDateKey());
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!position) return;
    setRatio('');
    setAwardedShares('');
    setActualSharesEdited(false);
    setEffectiveDate(cairoDateKey());
    setReference('');
    setNotes('');
  }, [position?.id]);

  const ratioValue = Number(ratio);
  const expectedAward = displayPosition && Number.isFinite(ratioValue) && ratioValue > 0
    ? displayPosition.shares * ratioValue
    : 0;

  useEffect(() => {
    if (!actualSharesEdited && expectedAward > 0) {
      setAwardedShares(String(Number(expectedAward.toFixed(8))));
    }
  }, [actualSharesEdited, expectedAward]);

  const awarded = Number(awardedShares);
  const preview = useMemo(() => {
    if (!displayPosition || !Number.isFinite(awarded) || awarded <= 0 || displayPosition.shares <= 0) return null;
    const factor = (displayPosition.shares + awarded) / displayPosition.shares;
    return {
      factor,
      totalShares: displayPosition.shares + awarded,
      avgBuyPrice: displayPosition.avgBuyPrice / factor,
      targetPrice: displayPosition.targetPrice != null ? displayPosition.targetPrice / factor : undefined,
      stopLoss: displayPosition.stopLoss != null ? displayPosition.stopLoss / factor : undefined,
      costBasis: displayPosition.shares * displayPosition.avgBuyPrice,
    };
  }, [awarded, displayPosition]);

  if (!displayPosition) return null;

  const requestClose = () => {
    if (isSaving) return;
    runVisualTransition('modal-close', onClose);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving || !preview || !effectiveDate) return;

    setIsSaving(true);
    try {
      const saved = await onApply({
        position: displayPosition,
        awardedShares: awarded,
        effectiveDate,
        ratio: Number.isFinite(ratioValue) && ratioValue > 0 ? ratioValue : undefined,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      if (saved) runVisualTransition('modal-close', onClose);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PremiumModalMotion
      isOpen={isOpen}
      backdropClassName="premium-modal-backdrop premium-modal-backdrop-panel-scroll fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      panelClassName="premium-modal premium-modal-viewport w-full max-w-lg rounded-2xl p-4 sm:p-6 space-y-5"
      onBackdropClick={requestClose}
      panelAriaLabel={`Apply bonus shares for ${displayPosition.ticker}`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            <Gift className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 text-base font-bold text-white">
              Bonus Shares
              <span className="premium-chip rounded-lg px-2 py-0.5 font-mono text-xs text-emerald-300">
                {displayPosition.ticker}
              </span>
            </h3>
            <p className="premium-type-helper mt-0.5">
              Corporate action · no cash flow and no new cost basis
            </p>
          </div>
        </div>
        <button type="button" aria-label="Close bonus shares" onClick={requestClose} className="premium-icon-action rounded-lg p-1.5">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="premium-subpanel grid grid-cols-2 gap-3 rounded-xl p-3 text-xs">
        <div>
          <span className="premium-type-metric-label block">Current shares</span>
          <span className="premium-type-metric premium-type-metric-dense font-mono text-white">
            {formatShares(displayPosition.shares)}
          </span>
        </div>
        <div>
          <span className="premium-type-metric-label block">Current avg cost</span>
          <span className="premium-type-metric premium-type-metric-dense font-mono text-white">
            {displayPosition.avgBuyPrice.toFixed(4)} EGP
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300">Bonus shares per original share</label>
            <NumberStepperInput
              min={0}
              step={0.000001}
              value={ratio}
              onValueChange={(value) => {
                setRatio(value);
                setActualSharesEdited(false);
              }}
              accent="emerald"
              placeholder="e.g. 2.222885"
              className="premium-field w-full rounded-xl px-3 py-2 font-mono text-white"
            />
            <p className="premium-type-helper">
              Expected entitlement: {expectedAward > 0 ? formatShares(expectedAward) : '—'} shares
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300">Actual credited shares</label>
            <NumberStepperInput
              min={0}
              step={0.000001}
              value={awardedShares}
              onValueChange={(value) => {
                setActualSharesEdited(true);
                setAwardedShares(value);
              }}
              accent="emerald"
              placeholder="Enter credited amount"
              className="premium-field w-full rounded-xl px-3 py-2 font-mono text-white"
            />
            <p className="premium-type-helper">
              Override the expected value if the broker/depository handles fractions differently.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300">Effective date</label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
              className="premium-field w-full rounded-xl px-3 py-2 font-mono text-white"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300">Disclosure / reference</label>
            <input
              type="text"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Optional reference"
              className="premium-field w-full rounded-xl px-3 py-2 text-white"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="font-semibold text-slate-300">Notes</label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            placeholder="Optional corporate-action notes"
            className="premium-field w-full resize-none rounded-xl px-3 py-2 text-white"
          />
        </div>

        {preview && (
          <div className="premium-inset-glass space-y-2 rounded-xl p-3">
            <div className="premium-type-metric-label">Accounting preview</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
              <div>
                <span className="premium-type-helper block">New shares</span>
                <span className="font-mono font-semibold text-white">{formatShares(preview.totalShares)}</span>
              </div>
              <div>
                <span className="premium-type-helper block">New avg cost</span>
                <span className="font-mono font-semibold text-white">{preview.avgBuyPrice.toFixed(4)} EGP</span>
              </div>
              <div>
                <span className="premium-type-helper block">Cost basis</span>
                <span className="font-mono font-semibold text-emerald-300">{preview.costBasis.toFixed(2)} EGP unchanged</span>
              </div>
              {preview.targetPrice != null && (
                <div>
                  <span className="premium-type-helper block">Adjusted target</span>
                  <span className="font-mono text-slate-200">{preview.targetPrice.toFixed(4)} EGP</span>
                </div>
              )}
              {preview.stopLoss != null && (
                <div>
                  <span className="premium-type-helper block">Adjusted stop</span>
                  <span className="font-mono text-slate-200">{preview.stopLoss.toFixed(4)} EGP</span>
                </div>
              )}
            </div>
            <p className="premium-type-helper border-t border-slate-700/60 pt-2">
              Live/current price is not divided here. Market data remains the price authority; sync prices after the action is saved.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSaving || !preview || !effectiveDate}
          className="premium-action premium-action-success premium-shimmer-border w-full rounded-xl py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Applying…' : 'Apply Bonus Shares'}
        </button>
      </form>
    </PremiumModalMotion>
  );
};
