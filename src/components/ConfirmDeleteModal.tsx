import React from 'react';
import { runVisualTransition } from '../utils/visualTransition';
import { AlertTriangle, Trash2, X, ShieldAlert } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  itemDetails?: {
    ticker?: string;
    type?: string;
    shares?: number;
    amount?: string;
    date?: string;
  };
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemDetails,
}) => {
  const requestClose = () => runVisualTransition('modal-close', onClose);
  if (!isOpen) return null;

  return (
    <div className="premium-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="premium-modal relative w-full max-w-md p-6 rounded-2xl space-y-4">
        {/* Close Button */}
        <button
          onClick={requestClose}
          className="premium-icon-action absolute top-4 right-4 p-1.5 rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Destructive action confirmation</p>
          </div>
        </div>

        {/* Description */}
        <p className="premium-modal-section text-xs text-slate-300 leading-relaxed p-3 rounded-xl">
          {description}
        </p>

        {/* Item Details Summary */}
        {itemDetails && (
          <div className="premium-modal-section p-3 rounded-xl border-rose-500/20 text-xs space-y-1.5 font-mono">
            {itemDetails.ticker && (
              <div className="flex justify-between">
                <span className="text-slate-400">Target Ticker:</span>
                <span className="font-bold text-white">{itemDetails.ticker}</span>
              </div>
            )}
            {itemDetails.type && (
              <div className="flex justify-between">
                <span className="text-slate-400">Record Type:</span>
                <span className="font-bold text-amber-400">{itemDetails.type}</span>
              </div>
            )}
            {itemDetails.shares !== undefined && (
              <div className="flex justify-between">
                <span className="text-slate-400">Shares:</span>
                <span className="font-bold text-slate-200">{itemDetails.shares.toLocaleString()}</span>
              </div>
            )}
            {itemDetails.amount && (
              <div className="flex justify-between">
                <span className="text-slate-400">Amount:</span>
                <span className="font-bold text-emerald-400">{itemDetails.amount}</span>
              </div>
            )}
            {itemDetails.date && (
              <div className="flex justify-between">
                <span className="text-slate-400">Date:</span>
                <span className="text-slate-300">{itemDetails.date}</span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            onClick={requestClose}
            className="premium-action px-4 py-2 rounded-xl text-xs font-semibold"
          >
            Cancel
          </button>

          <button
            onClick={() => {
              onConfirm();
              requestClose();
            }}
            className="premium-action premium-action-danger premium-shimmer-border px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Confirm & Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
