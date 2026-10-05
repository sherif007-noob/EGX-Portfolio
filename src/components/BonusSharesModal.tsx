import React, { useEffect, useMemo, useState } from 'react';
import type { Position } from '../types';
import { AnalyticsSelect } from './AnalyticsSelect';
import { DateInput } from './DateInput';
import { NumberStepperInput } from './NumberStepperInput';
import { PremiumModalMotion } from './PremiumMotion';
import { currentCairoDateKey, expectedBonusShares } from '../services/corporateActions';
import { runVisualTransition } from '../utils/visualTransition';
import { Gift, ShieldCheck, X } from 'lucide-react';

export interface BonusSharesFormValue {
  ticker: string;
  bonusShares: number;
  officialRatio: number;
  effectiveDate: string;
  reference?: string;
  notes?: string;
}

interface BonusSharesModalProps {
  isOpen: boolean;
  onClose: () => void;
  positions: Position[];
  onSubmit: (value: BonusSharesFormValue) => Promise<boolean>;
}

function formatShares(value: number): string {
  return new Intl.NumberFormat('en-EG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(value);
}

export const BonusSharesModal: React.FC<BonusSharesModalProps> = ({
  isOpen,
  onClose,
  positions,
  onSubmit,
}) => {
  const sortedPositions = useMemo(
    () => [...positions].sort((a, b) => a.ticker.localeCompare(b.ticker)),
    [positions],
  );
  const [ticker, setTicker] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(currentCairoDateKey());
  const [officialRatio, setOfficialRatio] = useState('0');
  const [bonusShares, setBonusShares] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [bonusSharesEdited, setBonusSharesEdited] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedPosition = useMemo(
    () => sortedPositions.find((position) => position.ticker.toUpperCase() === ticker.toUpperCase()),
    [sortedPositions, ticker],
  );
  const ratioNumber = Number(officialRatio);
  const theoreticalShares = selectedPosition && Number.isFinite(ratioNumber)
    ? expectedBonusShares(selectedPosition.shares, ratioNumber)
    : 0;
  const creditedSharesNumber = Number(bonusShares);
  const projectedShares = selectedPosition && Number.isFinite(creditedSharesNumber)
    ? selectedPosition.shares + creditedSharesNumber
    : selectedPosition?.shares ?? 0;

  useEffect(() => {
    if (!isOpen) return;
    const defaultTicker = sortedPositions[0]?.ticker ?? '';
    setTicker(defaultTicker);
    setEffectiveDate(currentCairoDateKey());
    setOfficialRatio('0');
    setBonusShares('');
    setReference('');
    setNotes('');
    setBonusSharesEdited(false);
    setFeedback(null);
    setIsSaving(false);
  }, [isOpen, sortedPositions]);

  useEffect(() => {
    if (!isOpen || bonusSharesEdited || !selectedPosition) return;
    if (!Number.isFinite(ratioNumber) || ratioNumber <= 0) {
      setBonusShares('');
      return;
    }
    setBonusShares(String(expectedBonusShares(selectedPosition.shares, ratioNumber)));
  }, [isOpen, selectedPosition, ratioNumber, bonusSharesEdited]);

  const requestClose = () => {
    if (isSaving) return;
    runVisualTransition('modal-close', onClose);
  };

  const handleTickerChange = (value: string) => {
    setTicker(value);
    setBonusSharesEdited(false);
    setFeedback(null);
  };

  const handleRatioChange = (value: string) => {
    setOfficialRatio(value);
    setBonusSharesEdited(false);
    setFeedback(null);
  };

  const handleBonusSharesChange = (value: string) => {
    setBonusShares(value);
    setBonusSharesEdited(true);
    setFeedback(null);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;

    if (!selectedPosition) {
      setFeedback('Choose an open position before recording the corporate action.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) || !Number.isFinite(Date.parse(effectiveDate))) {
      setFeedback('Enter a valid effective / credit date.');
      return;
    }
    if (effectiveDate > currentCairoDateKey()) {
      setFeedback('Bonus shares cannot be applied before their effective / credit date.');
      return;
    }
    if (!Number.isFinite(ratioNumber) || ratioNumber <= 0) {
      setFeedback('Official bonus-share ratio must be greater than zero.');
      return;
    }
    if (!Number.isFinite(creditedSharesNumber) || creditedSharesNumber <= 0) {
      setFeedback('Actual shares credited must be greater than zero.');
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const saved = await onSubmit({
        ticker: selectedPosition.ticker,
        bonusShares: creditedSharesNumber,
        officialRatio: ratioNumber,
        effectiveDate,
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
      panelClassName="premium-modal premium-modal-viewport w-full max-w-2xl rounded-2xl p-4 sm:p-6 text-slate-100 space-y-4"
      onBackdropClick={requestClose}
      panelAriaLabel="Record bonus shares corporate action"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="premium-inset-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <Gift className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white">Record Bonus / Free Shares</h3>
            <p className="premium-type-helper mt-1">
              Canonical corporate action — not a BUY. Cash and total invested cost stay unchanged.
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close bonus shares"
          onClick={requestClose}
          className="premium-icon-action shrink-0 rounded-lg p-1.5"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {sortedPositions.length === 0 ? (
        <div className="premium-subpanel rounded-xl p-4 text-sm text-slate-300">
          No open positions are available for a bonus-share action.
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="premium-form-section grid grid-cols-1 gap-3 rounded-xl p-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block font-semibold text-slate-300">Open Position</label>
              <AnalyticsSelect
                value={ticker}
                onChange={handleTickerChange}
                accent="cyan"
                ariaLabel="Select position for bonus shares"
                className="w-full"
                options={sortedPositions.map((position) => ({
                  value: position.ticker,
                  label: position.ticker,
                  description: `${formatShares(position.shares)} shares · avg ${position.avgBuyPrice.toFixed(4)} EGP`,
                }))}
              />
            </div>
            <DateInput
              value={effectiveDate}
              onChange={(value) => {
                setEffectiveDate(value);
                setFeedback(null);
              }}
              label="Effective / Credit Date"
              required
              showVerbosePreview={false}
            />
          </div>

          <div className="premium-form-section grid grid-cols-1 gap-3 rounded-xl p-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block font-semibold text-slate-300">
                Official Ratio
                <span className="ml-1 font-normal text-slate-500">(extra shares per 1 old share)</span>
              </label>
              <NumberStepperInput
                min={0}
                step={0.000001}
                required
                value={officialRatio}
                onValueChange={handleRatioChange}
                accent="cyan"
                className="premium-field w-full rounded-xl px-3 py-2 font-mono font-bold text-white focus:outline-none"
                placeholder="e.g. 2.222885"
              />
            </div>
            <div className="space-y-1">
              <label className="block font-semibold text-slate-300">
                Actual Shares Credited
                <span className="ml-1 font-normal text-slate-500">(broker quantity wins)</span>
              </label>
              <NumberStepperInput
                min={0}
                step={0.000001}
                required
                value={bonusShares}
                onValueChange={handleBonusSharesChange}
                accent="cyan"
                className="premium-field w-full rounded-xl px-3 py-2 font-mono font-bold text-white focus:outline-none"
                placeholder="Actual credited quantity"
              />
            </div>
          </div>

          {selectedPosition && (
            <div className="premium-inset-glass grid grid-cols-1 gap-2 rounded-xl p-3 sm:grid-cols-3">
              <div>
                <span className="premium-type-metric-label block">Current Open Shares</span>
                <span className="premium-type-metric premium-type-metric-dense font-mono text-slate-100">
                  {formatShares(selectedPosition.shares)}
                </span>
              </div>
              <div>
                <span className="premium-type-metric-label block">Theoretical Entitlement</span>
                <span className="premium-type-metric premium-type-metric-dense font-mono text-cyan-300">
                  {ratioNumber > 0 ? formatShares(theoreticalShares) : '—'}
                </span>
              </div>
              <div>
                <span className="premium-type-metric-label block">Projected Shares</span>
                <span className="premium-type-metric premium-type-metric-dense font-mono text-emerald-300">
                  {creditedSharesNumber > 0 ? formatShares(projectedShares) : '—'}
                </span>
              </div>
            </div>
          )}

          <div className="premium-form-section grid grid-cols-1 gap-3 rounded-xl p-3">
            <div className="space-y-1">
              <label className="block font-semibold text-slate-300">Disclosure / Broker Reference</label>
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                className="premium-field w-full rounded-xl px-3 py-2 text-white focus:outline-none"
                placeholder="Optional EGX disclosure, company notice, or broker reference"
              />
            </div>
            <div className="space-y-1">
              <label className="block font-semibold text-slate-300">Notes</label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="premium-field w-full resize-none rounded-xl px-3 py-2 text-white focus:outline-none"
                placeholder="Optional notes"
              />
            </div>
          </div>

          <div className="premium-subpanel flex items-start gap-2 rounded-xl border-cyan-500/25 p-3 text-slate-300">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
            <p>
              Eligible source shares are rebuilt from the ledger immediately before the effective date.
              Saving adds units at zero cost, does not move cash, and recalculates weighted average cost automatically.
            </p>
          </div>

          {feedback && (
            <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-rose-300">
              {feedback}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={requestClose}
              disabled={isSaving}
              className="premium-action rounded-xl px-4 py-2 font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || sortedPositions.length === 0}
              className="premium-action premium-action-primary premium-shimmer-border rounded-xl px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Recording…' : 'Record Bonus Shares'}
            </button>
          </div>
        </form>
      )}
    </PremiumModalMotion>
  );
};
