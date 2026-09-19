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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 text-slate-100 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Adjust Cash Reserve</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
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
              className="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-[11px]"
            >
              +10k
            </button>
            <button
              type="button"
              onClick={() => handleAdjust(50000)}
              className="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-[11px]"
            >
              +50k
            </button>
            <button
              type="button"
              onClick={() => handleAdjust(-10000)}
              className="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-[11px]"
            >
              -10k
            </button>
            <button
              type="button"
              onClick={() => handleAdjust(-50000)}
              className="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-[11px]"
            >
              -50k
            </button>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow transition"
          >
            Update Cash Balance
          </button>
        </form>
      </div>
    </div>
  );
};
