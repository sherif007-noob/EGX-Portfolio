import React, { useState, useEffect } from 'react';
import { NumberStepperInput } from './NumberStepperInput';
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

  if (!isOpen || !position) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tpNum = targetPrice ? parseFloat(targetPrice) : undefined;
    const slNum = stopLoss ? parseFloat(stopLoss) : undefined;

    onSave({
      id: position.id,
      targetPrice: tpNum && !isNaN(tpNum) && tpNum > 0 ? tpNum : undefined,
      stopLoss: slNum && !isNaN(slNum) && slNum > 0 ? slNum : undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  const currentPrice = position.currentPrice || position.avgBuyPrice;
  const targetProfitPct = targetPrice && parseFloat(targetPrice) > 0
    ? ((parseFloat(targetPrice) - position.avgBuyPrice) / position.avgBuyPrice) * 100
    : null;
  const stopLossPct = stopLoss && parseFloat(stopLoss) > 0
    ? ((parseFloat(stopLoss) - position.avgBuyPrice) / position.avgBuyPrice) * 100
    : null;

  return (
    <div className="premium-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="premium-modal w-full max-w-md rounded-2xl p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Edit Position Targets
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 font-mono text-emerald-400 border border-slate-700">
                  {position.ticker}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {position.companyName} • Avg Cost: {position.avgBuyPrice.toFixed(2)} EGP
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
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
              {position.shares.toLocaleString()}
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
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono focus:outline-none focus:border-emerald-500 text-sm"
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
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono focus:outline-none focus:border-rose-500 text-sm"
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
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="premium-control px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="premium-control premium-shimmer-border flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/25"
            >
              <Save className="w-3.5 h-3.5" />
              Save Targets
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
