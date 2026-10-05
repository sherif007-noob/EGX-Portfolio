import React, { useMemo, useState } from 'react';
import { Gift, Info, X } from 'lucide-react';
import type { Position } from '../types';
import { AnalyticsSelect } from './AnalyticsSelect';
import { DateInput } from './DateInput';
import { NumberStepperInput } from './NumberStepperInput';
import { PremiumModalMotion } from './PremiumMotion';
import { getTodayISO } from '../utils/dateUtils';
import { runVisualTransition } from '../utils/visualTransition';

export interface BonusSharesSubmission {
  ticker: string;
  creditedShares: number;
  effectiveDate: string;
  notes?: string;
}

interface CorporateActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  positions: Position[];
  onAddBonusShares: (input: BonusSharesSubmission) => Promise<boolean>;
  initialTicker?: string;
}

export const CorporateActionsModal: React.FC<CorporateActionsModalProps> = ({
  isOpen,
  onClose,
  positions,
  onAddBonusShares,
  initialTicker,
}) => {
  const normalizedInitialTicker = String(initialTicker || '').trim().toUpperCase();
  const fallbackTicker = positions.find((position) => position.ticker.toUpperCase() === normalizedInitialTicker)?.ticker
    ?? positions[0]?.ticker
    ?? '';
  const [ticker, setTicker] = useState(fallbackTicker);
  const [announcedRatio, setAnnouncedRatio] = useState<number>(0);
  const [creditedShares, setCreditedShares] = useState<number>(0);
  const [effectiveDate, setEffectiveDate] = useState(getTodayISO());
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const sortedPositions = useMemo(
    () => [...positions].sort((a, b) => a.ticker.localeCompare(b.ticker)),
    [positions],
  );
  const selectedPosition = useMemo(
    () => sortedPositions.find((position) => position.ticker === ticker) ?? sortedPositions[0],
    [sortedPositions, ticker],
  );
  const expectedBonusShares = selectedPosition && announcedRatio > 0
    ? selectedPosition.shares * announcedRatio
    : 0;
  const projectedShares = selectedPosition && creditedShares > 0
    ? selectedPosition.shares + creditedShares
    : selectedPosition?.shares ?? 0;
  const currentGrossCost = selectedPosition
    ? selectedPosition.shares * selectedPosition.avgBuyPrice
    : 0;
  const projectedAvgBuyPrice = projectedShares > 0 ? currentGrossCost / projectedShares : 0;
  const today = getTodayISO();

  const requestClose = () => {
    if (isSaving) return;
    runVisualTransition('modal-close', onClose);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    setFeedback(null);

    if (!selectedPosition) {
      setFeedback('No open position is available for a bonus-share action.');
      return;
    }
    if (!Number.isFinite(creditedShares) || creditedShares <= 0) {
      setFeedback('Enter the exact number of shares actually credited by the broker.');
      return;
    }
    if (!effectiveDate) {
      setFeedback('Select the effective/credit date.');
      return;
    }
    if (effectiveDate > today) {
      setFeedback('Future corporate actions are not applied early. Record the bonus on or after the actual credit date.');
      return;
    }

    setIsSaving(true);
    try {
      const ratioNote = announcedRatio > 0
        ? `Announced bonus ratio: ${announcedRatio} share(s) per original share. `
        : '';
      const saved = await onAddBonusShares({
        ticker: selectedPosition.ticker,
        creditedShares,
        effectiveDate,
        notes: `${ratioNote}${notes.trim()}`.trim() || 'Bonus shares corporate action',
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
      panelClassName="premium-modal premium-modal-viewport w-full max-w-xl rounded-2xl p-4 sm:p-6 text-slate-100 space-y-4"
      onBackdropClick={requestClose}
      panelAriaLabel="Corporate actions"
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-purple-300" />
          <div>
            <h3 className="text-base font-bold text-white">Corporate Actions</h3>
            <p className="premium-type-helper mt-0.5">Bonus Shares</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close corporate actions"
          onClick={requestClose}
          className="premium-icon-action p-1.5 rounded-lg"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="premium-subpanel rounded-xl p-3 text-xs text-slate-300">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
          <p>
            Record the <strong className="text-white">actual shares credited by your broker</strong>.
            The announced ratio is preview-only because fractional entitlements may be rounded or allocated by the issuer.
            Bonus shares change quantity and average cost, but do not create cash flow or realized P&amp;L.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4 text-xs">
        <div>
          <label className="mb-1 block font-semibold text-slate-300">Holding</label>
          <AnalyticsSelect
            value={selectedPosition?.ticker ?? ''}
            onChange={(value) => {
              setTicker(String(value));
              setCreditedShares(0);
              setAnnouncedRatio(0);
            }}
            options={sortedPositions.map((position) => ({
              value: position.ticker,
              label: `${position.ticker} — ${position.shares.toLocaleString()} shares`,
              description: position.companyName,
            }))}
            ariaLabel="Corporate action holding"
            accent="purple"
          />
        </div>

        {selectedPosition && (
          <div className="grid grid-cols-2 gap-2.5">
            <div className="premium-subpanel rounded-xl p-3">
              <span className="premium-type-metric-label block">Current Shares</span>
              <span className="premium-type-metric premium-type-metric-dense font-mono text-white">
                {selectedPosition.shares.toLocaleString(undefined, { maximumFractionDigits: 8 })}
              </span>
            </div>
            <div className="premium-subpanel rounded-xl p-3">
              <span className="premium-type-metric-label block">Current Avg Cost</span>
              <span className="premium-type-metric premium-type-metric-dense font-mono text-white">
                {selectedPosition.avgBuyPrice.toFixed(4)} EGP
              </span>
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block font-semibold text-slate-300">
            Announced Bonus Ratio <span className="font-normal text-slate-500">(optional preview)</span>
          </label>
          <NumberStepperInput
            min={0}
            step={0.0000000001}
            value={announcedRatio}
            onValueChange={(value) => setAnnouncedRatio(Number(value) || 0)}
            accent="purple"
            className="premium-field w-full rounded-xl px-3 py-2.5 font-mono text-white"
          />
          {expectedBonusShares > 0 && (
            <p className="premium-type-helper mt-1">
              Theoretical entitlement: <strong className="font-mono text-purple-200">
                {expectedBonusShares.toLocaleString(undefined, { maximumFractionDigits: 10 })}
              </strong> bonus shares. Do not auto-round this value.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block font-semibold text-slate-300">Actual Credited Shares</label>
          <NumberStepperInput
            min={0}
            step={0.00000001}
            value={creditedShares}
            onValueChange={(value) => setCreditedShares(Number(value) || 0)}
            accent="emerald"
            className="premium-field w-full rounded-xl px-3 py-2.5 font-mono text-white"
          />
        </div>

        <DateInput
          id="corporate-action-effective-date"
          value={effectiveDate}
          onChange={setEffectiveDate}
          label="Effective / Credit Date"
          required
        />

        {selectedPosition && creditedShares > 0 && (
          <div className="premium-inset-glass grid grid-cols-2 gap-3 rounded-xl p-3">
            <div>
              <span className="premium-type-metric-label block">Projected Shares</span>
              <span className="premium-type-metric premium-type-metric-dense font-mono text-emerald-300">
                {projectedShares.toLocaleString(undefined, { maximumFractionDigits: 8 })}
              </span>
            </div>
            <div>
              <span className="premium-type-metric-label block">Projected Avg Cost</span>
              <span className="premium-type-metric premium-type-metric-dense font-mono text-cyan-300">
                {projectedAvgBuyPrice.toFixed(4)} EGP
              </span>
            </div>
            <div className="col-span-2 premium-type-helper">
              Gross cost basis remains {currentGrossCost.toFixed(2)} EGP; cash impact = 0.00 EGP.
            </div>
          </div>
        )}

        <div>
          <label htmlFor="corporate-action-notes" className="mb-1 block font-semibold text-slate-300">Notes</label>
          <textarea
            id="corporate-action-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Issuer announcement, entitlement details, broker credit note..."
            className="premium-field w-full resize-y rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
          />
        </div>

        {feedback && (
          <div className="premium-status-surface premium-status-warning rounded-xl px-3 py-2 text-xs text-amber-200">
            {feedback}
          </div>
        )}

        <button
          type="submit"
          disabled={isSaving || !selectedPosition}
          className="premium-action premium-action-success premium-shimmer-border w-full rounded-xl py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Applying Corporate Action…' : 'Apply Bonus Shares'}
        </button>
      </form>
    </PremiumModalMotion>
  );
};
