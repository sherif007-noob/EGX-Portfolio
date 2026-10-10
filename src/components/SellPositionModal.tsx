import React, { useState, useEffect, useRef } from 'react';
import { runVisualTransition } from '../utils/visualTransition';
import { NumberStepperInput } from './NumberStepperInput';
import { PremiumModalMotion } from './PremiumMotion';
import { Position } from '../types';
import { X, DollarSign, Calculator } from 'lucide-react';
import { DateInput } from './DateInput';
import { StockLogo } from './StockLogo';
import { combineExecutionDateTime } from '../utils/executionTime';

interface SellPositionModalProps {
  position: Position | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmSell: (
    positionId: string,
    soldShares: number,
    sellPrice: number,
    sellDate: string,
    executedAt: string | undefined,
    brokerageFee: number,
    notes: string,
    remainingShares: number
  ) => Promise<boolean>;
}

export const SellPositionModal: React.FC<SellPositionModalProps> = ({
  position,
  isOpen,
  onClose,
  onConfirmSell,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requestClose = () => {
    if (isSubmitting) return;
    runVisualTransition('modal-close', onClose);
  };
  const lastPositionRef = useRef<Position | null>(position);
  if (position) lastPositionRef.current = position;
  const displayPosition = position ?? lastPositionRef.current;

  const [sharesToSell, setSharesToSell] = useState<number>(position?.shares ?? 0);
  const [sellPrice, setSellPrice] = useState<number>(position?.currentPrice || position?.avgBuyPrice || 0);
  const [sellDate, setSellDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [executionTime, setExecutionTime] = useState<string>('');
  const [brokerageFee, setBrokerageFee] = useState<number>(0);
  const [isManualFee, setIsManualFee] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('Target reached / booked profits');

  // Reset values when position changes
  useEffect(() => {
    if (position) {
      setSharesToSell(position.shares);
      setSellPrice(position.currentPrice || position.avgBuyPrice);
      setIsManualFee(false);
    }
  }, [position]);

  // Default fee auto-calculation (0.25% standard broker commission)
  useEffect(() => {
    if (!isManualFee) {
      const grossProceeds = sharesToSell * sellPrice;
      const calculated = Math.round(grossProceeds * 0.0025 * 100) / 100;
      setBrokerageFee(calculated);
    }
  }, [sharesToSell, sellPrice, isManualFee]);

  if (!displayPosition) return null;

  // Financial calculations
  const grossProceeds = sharesToSell * sellPrice;
  const netProceeds = Math.max(0, grossProceeds - (brokerageFee || 0));

  // Cost basis for sold shares
  const costBasis = sharesToSell * displayPosition.avgBuyPrice;
  // Allocated buy fees for sold shares
  const allocatedBuyFees = displayPosition.totalFees ? (sharesToSell / displayPosition.shares) * displayPosition.totalFees : 0;
  const totalCostIncludingBuyFees = costBasis + allocatedBuyFees;

  // Realized Net P&L: Net proceeds from sale minus total cost basis (including buy fee + sell fee)
  const realizedPnlEgp = netProceeds - totalCostIncludingBuyFees;
  const realizedPnlPercent = totalCostIncludingBuyFees > 0 ? (realizedPnlEgp / totalCostIncludingBuyFees) * 100 : 0;
  const isProfit = realizedPnlEgp >= 0;
  const remainingShares = Math.max(0, displayPosition.shares - sharesToSell);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (sharesToSell <= 0 || sharesToSell > displayPosition.shares || sellPrice <= 0) return;

    setIsSubmitting(true);
    try {
      const shouldClose = await onConfirmSell(
        displayPosition.id,
        sharesToSell,
        sellPrice,
        sellDate,
        combineExecutionDateTime(sellDate, executionTime),
        Math.max(0, brokerageFee || 0),
        notes,
        remainingShares
      );
      if (shouldClose) runVisualTransition('modal-close', onClose);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PremiumModalMotion
      isOpen={isOpen}
      backdropClassName="premium-modal-backdrop premium-modal-backdrop-panel-scroll ui-trade-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      panelClassName="premium-modal premium-modal-viewport ui-trade-modal ui-trade-modal--sell w-full max-w-md my-0 sm:my-6 rounded-2xl p-4 sm:p-6 text-slate-100 space-y-4"
      onBackdropClick={requestClose}
      panelAriaLabel={`Sell ${displayPosition.ticker} position`}
    >
        <div className="ui-trade-modal-header flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white">Sell / Exit Position</h3>
              <p className="text-xs text-slate-400">
                {displayPosition.ticker} • {displayPosition.companyName}
              </p>
            </div>
          </div>
          <button type="button" aria-label="Close sell position" onClick={requestClose} className="premium-icon-action ui-trade-modal-close p-1.5 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="ui-trade-modal-identity">
          <StockLogo ticker={displayPosition.ticker} companyName={displayPosition.companyName}
            sector={displayPosition.sector} size="md"/>
          <div className="ui-trade-modal-symbol">
            <strong>{displayPosition.ticker}</strong><span>{displayPosition.companyName}</span>
          </div>
          <div className="ui-trade-modal-quote">
            <span>Latest quote</span>
            <strong>{Number.isFinite(displayPosition.currentPrice) && displayPosition.currentPrice > 0
              ? `${displayPosition.currentPrice.toFixed(3)} EGP` : 'Unavailable'}</strong>
          </div>
        </div>
        <form id="ui-sell-position-form" onSubmit={handleSubmit} className="ui-trade-modal-form space-y-3.5 text-xs">
          {/* Summary Box */}
          <div className="premium-subpanel ui-trade-modal-stats p-3 rounded-xl flex justify-between">
            <div>
              <span className="text-slate-400 block text-[10px]">Held Shares</span>
              <span className="font-mono font-bold text-white">{displayPosition.shares.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Average Buy</span>
              <span className="font-mono font-bold text-slate-200">{displayPosition.avgBuyPrice.toFixed(2)} EGP</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Current Quote</span>
              <span className="font-mono font-bold text-emerald-400">
                {(displayPosition.currentPrice || displayPosition.avgBuyPrice).toFixed(2)} EGP
              </span>
            </div>
          </div>

          {/* Shares to Sell */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-300">Shares to Sell</label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setSharesToSell(Math.floor(displayPosition.shares / 2))}
                  className="premium-action px-2 py-1 rounded-lg text-[10px] font-medium"
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => setSharesToSell(displayPosition.shares)}
                  className="premium-action px-2 py-1 rounded-lg text-[10px] font-medium"
                >
                  100% (All)
                </button>
              </div>
            </div>
            <NumberStepperInput
              min={1}
              max={displayPosition.shares}
              step={1}
              value={sharesToSell || ''}
              onValueChange={(value) => setSharesToSell(Number(value))}
              accent="blue"
              className="premium-field w-full px-3 py-2 rounded-xl bg-slate-900/72 border border-slate-700/80 text-white font-mono"
              required
            />
          </div>

          {/* Sell Price & Date */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Sell Price (EGP)</label>
              <NumberStepperInput
                min={0.001}
                step={0.001}
                value={sellPrice || ''}
                onValueChange={(value) => setSellPrice(Number(value))}
                accent="blue"
                className="premium-field w-full px-3 py-2 rounded-xl bg-slate-900/72 border border-slate-700/80 text-white font-mono"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DateInput
                id="sell-execution-date"
                label="Sale Date"
                value={sellDate}
                onChange={setSellDate}
                required
              />
              <div>
                <label htmlFor="sell-execution-time" className="block font-semibold text-slate-300 mb-1">
                  Execution Time
                </label>
                <input
                  id="sell-execution-time"
                  type="time"
                  value={executionTime}
                  onChange={(e) => setExecutionTime(e.target.value)}
                  className="premium-field w-full px-3 py-2 rounded-xl bg-slate-900/72 border border-slate-700/80 text-white font-mono"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Optional, but recommended when matching broker receipts.
                </span>
              </div>
            </div>
          </div>

          {/* Brokerage Fees on Sale */}
          <div className="premium-subpanel p-3 rounded-xl space-y-2">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                Exit Brokerage Fees (EGP)
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsManualFee(false);
                  const gross = sharesToSell * sellPrice;
                  setBrokerageFee(Math.round(gross * 0.0025 * 100) / 100);
                }}
                className="premium-action premium-action-warning px-2 py-1 rounded-lg text-[10px]"
              >
                Reset to 0.25%
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <NumberStepperInput
                  min={0}
                  step={0.01}
                  value={brokerageFee}
                  onValueChange={(value) => {
                    setIsManualFee(true);
                    setBrokerageFee(Math.max(0, Number(value)));
                  }}
                  accent="amber"
                  className="premium-field w-full px-3 py-1.5 rounded-xl text-amber-300 font-mono text-xs"
                />
              </div>
              <div className="text-[11px] text-slate-400">
                Gross Proceeds: <strong className="text-white">{grossProceeds.toLocaleString('en-EG', { minimumFractionDigits: 2 })} EGP</strong>
              </div>
            </div>
          </div>

          {/* P&L Preview Ribbon */}
          <div className="premium-subpanel ui-trade-modal-financials p-3.5 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Net Cash Inflow (After Sell Fee):</span>
              <span className="font-mono font-bold text-white text-sm">
                {netProceeds.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Total Fees Accounted (Buy + Sell):</span>
              <span className="font-mono text-amber-300">
                {(allocatedBuyFees + (brokerageFee || 0)).toLocaleString('en-EG', { minimumFractionDigits: 2 })} EGP
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 pt-2">
              <span className="font-semibold text-slate-300">Net Realized Profit / Loss:</span>
              <div className="text-right">
                <span
                  className={`font-mono font-bold text-sm ${
                    isProfit ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {isProfit ? '+' : ''}{realizedPnlEgp.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
                </span>
                <span
                  className={`block text-[11px] font-semibold ${
                    isProfit ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  ({isProfit ? '+' : ''}{realizedPnlPercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Exit Rationale / Journal Note</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="premium-field w-full px-3 py-2 rounded-xl bg-slate-900/72 border border-slate-700/80 text-white text-xs"
            />
          </div>

        </form>
          {/* Actions */}
          <div className="ui-trade-modal-actions grid grid-cols-2 gap-2.5 pt-2 sm:flex sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={requestClose}
              disabled={isSubmitting}
              className="premium-action w-full justify-center px-4 py-2 rounded-xl font-semibold sm:w-auto disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="ui-sell-position-form"
              disabled={isSubmitting}
              className="premium-action premium-action-warning w-full justify-center px-5 py-2 rounded-xl font-semibold sm:w-auto disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Saving Sale…' : 'Confirm Sale & Book Net P&L'}
            </button>
          </div>
    </PremiumModalMotion>
  );
};
