import React, { useState, useEffect, useRef } from 'react';
import { runVisualTransition } from '../utils/visualTransition';
import { NumberStepperInput } from './NumberStepperInput';
import { PremiumModalMotion } from './PremiumMotion';
import { Position } from '../types';
import { X, Target, ShieldAlert, FileText, Save, CheckCircle2 } from 'lucide-react';

interface EditPositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: Position | null;
  onSave: (updated: {
    id: string;
    targetPrice?: number;
    stopLoss?: number;
    notes?: string;
  }) => void;
}

export const EditPositionModal: React.FC<EditPositionModalProps> = ({
  isOpen,
  onClose,
  position,
  onSave,
}) => {
  const requestClose = () => runVisualTransition('modal-close', onClose);
  const lastPositionRef = useRef<Position | null>(position);
  if (position) lastPositionRef.current = position;
  const displayPosition = position ?? lastPositionRef.current;

  const [targetPrice, setTargetPrice] = useState<string>('');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (position) {
      setTargetPrice(position.targetPrice !== undefined ? String(position.targetPrice) : '');
      setStopLoss(position.stopLoss !== undefined ? String(position.stopLoss) : '');
      setNotes(position.notes || '');
    }
  }, [position]);

  if (!displayPosition) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tpNum = targetPrice ? parseFloat(targetPrice) : undefined;
    const slNum = stopLoss ? parseFloat(stopLoss) : undefined;

    onSave({
      id: displayPosition.id,
      targetPrice: tpNum && !isNaN(tpNum) && tpNum > 0 ? tpNum : undefined,
      stopLoss: slNum && !isNaN(slNum) && slNum > 0 ? slNum : undefined,
      notes: notes.trim() || undefined,
    });
    requestClose();
  };

  const currentPrice = displayPosition.currentPrice || displayPosition.avgBuyPrice;
  const targetProfitPct = targetPrice && parseFloat(targetPrice) > 0
    ? ((parseFloat(targetPrice) - displayPosition.avgBuyPrice) / displayPosition.avgBuyPrice) * 100
    : null;
  const stopLossPct = stopLoss && parseFloat(stopLoss) > 0
    ? ((parseFloat(stopLoss) - displayPosition.avgBuyPrice) / displayPosition.avgBuyPrice) * 100
    : null;

  return (
    <PremiumModalMotion
      isOpen={isOpen}
      backdropClassName="premium-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      panelClassName="premium-modal premium-modal-viewport w-full max-w-md rounded-2xl p-4 sm:p-6 space-y-5"
      onBackdropClick={requestClose}
      panelAriaLabel={`Edit ${displayPosition.ticker} position targets`}
    >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Target className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white flex flex-wrap items-center gap-2">
                Edit Position Targets
                <span className="premium-chip text-xs px-2 py-0.5 rounded-lg font-mono text-emerald-400">
                  {displayPosition.ticker}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {displayPosition.companyName} • Avg Cost: {displayPosition.avgBuyPrice.toFixed(2)} EGP
              </p>
            </div>
          </div>
          <button
            onClick={requestClose}
            className="premium-icon-action p-1.5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Metrics Reference */}
        <div className="premium-subpanel grid grid-cols-2 gap-3 p-3 rounded-xl text-xs">
          <div>
            <span className="text-slate-500 block">Current Market Price</span>
            <span className="font-mono font-bold text-white text-sm">
              {currentPrice.toFixed(2)} EGP
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Shares Held</span>
            <span className="font-mono font-bold text-slate-200 text-sm">
              {displayPosition.shares.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Price */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-emerald-400" />
                Target Price (EGP)
              </label>
              {targetProfitPct !== null && (
                <span className={`font-mono text-[11px] font-semibold ${targetProfitPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {targetProfitPct >= 0 ? '+' : ''}{targetProfitPct.toFixed(1)}% from cost
                </span>
              )}
            </div>
            <NumberStepperInput
              step={0.01}
              value={targetPrice}
              onValueChange={setTargetPrice}
              accent="emerald"
              placeholder="e.g. 120.00"
              className="premium-field w-full px-3 py-2 rounded-xl text-white font-mono focus:outline-none text-sm"
            />
          </div>

          {/* Stop Loss */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                Stop Loss (EGP)
              </label>
              {stopLossPct !== null && (
                <span className={`font-mono text-[11px] font-semibold ${stopLossPct <= 0 ? 'text-rose-400' : 'text-amber-400'}`}>
                  {stopLossPct >= 0 ? '+' : ''}{stopLossPct.toFixed(1)}% from cost
                </span>
              )}
            </div>
            <NumberStepperInput
              step={0.01}
              value={stopLoss}
              onValueChange={setStopLoss}
              accent="rose"
              placeholder="e.g. 95.00"
              className="premium-field w-full px-3 py-2 rounded-xl text-white font-mono focus:outline-none text-sm"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300 text-xs flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Strategy &amp; Position Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Thesis, catalyst, resistance levels, or risk limits..."
              className="premium-field w-full px-3 py-2 rounded-xl bg-slate-900/72 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-cyan-500/60 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-2 sm:flex sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={requestClose}
              className="premium-action w-full justify-center px-4 py-2 rounded-xl text-xs font-semibold sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="premium-action premium-action-primary flex w-full items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold sm:w-auto"
            >
              <Save className="w-3.5 h-3.5" />
              Save Targets
            </button>
          </div>
        </form>
    </PremiumModalMotion>
  );
};
