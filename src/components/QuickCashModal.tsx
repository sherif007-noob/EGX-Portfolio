import React, { useState } from 'react';
import { NumberStepperInput } from './NumberStepperInput';
import { X, Wallet, Plus, Minus } from 'lucide-react';

interface QuickCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCash: number;
  onUpdateCash: (newAmount: number) => void;
}

export const QuickCashModal: React.FC<QuickCashModalProps> = ({
  isOpen,
  onClose,
  currentCash,
  onUpdateCash,
}) => {
  const [amount, setAmount] = useState<number>(currentCash);

  if (!isOpen) return null;

  const handleAdjust = (delta: number) => {
    setAmount((prev) => Math.max(0, prev + delta));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateCash(amount);
    onClose();
  };

  return (
    <div
      id="quick-cash-modal"
      className="premium-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="premium-modal w-full max-w-sm rounded-2xl p-5 sm:p-6 text-slate-100 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Adjust Cash Reserve</h3>
          </div>
          <button onClick={onClose} className="premium-icon-action p-1.5 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Available Trading Cash (EGP)
            </label>
            <NumberStepperInput
              min={0}
              step={1000}
              value={amount}
              onValueChange={(value) => setAmount(parseFloat(value) || 0)}
              accent="emerald"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 font-mono text-base font-bold text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => handleAdjust(10000)}
              className="premium-action py-1.5 rounded-lg font-medium text-[11px]"
            >
              +10k
            </button>
            <button
              type="button"
              onClick={() => handleAdjust(50000)}
              className="premium-action py-1.5 rounded-lg font-medium text-[11px]"
            >
              +50k
            </button>
            <button
              type="button"
              onClick={() => handleAdjust(-10000)}
              className="premium-action py-1.5 rounded-lg font-medium text-[11px]"
            >
              -10k
            </button>
            <button
              type="button"
              onClick={() => handleAdjust(-50000)}
              className="premium-action py-1.5 rounded-lg font-medium text-[11px]"
            >
              -50k
            </button>
          </div>

          <button
            type="submit"
            className="premium-action premium-action-success premium-shimmer-border w-full py-2.5 rounded-xl font-bold text-sm"
          >
            Update Cash Balance
          </button>
        </form>
      </div>
    </div>
  );
};
