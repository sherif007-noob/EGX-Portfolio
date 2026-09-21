import React, { useState, useEffect, useMemo, useRef } from 'react';
import { runVisualTransition } from '../utils/visualTransition';
import { ExpandPresence, PremiumModalMotion } from './PremiumMotion';
import { EGXTicker, Position, Sector, TradeTransaction } from '../types';
import { StockLogo } from './StockLogo';
import { PlusCircle, X, Search, Layers, DollarSign, Calculator, AlertCircle, Sparkles, Zap, Clock } from 'lucide-react';
import { DateInput } from './DateInput';
import { NumberStepperInput } from './NumberStepperInput';
import { combineExecutionDateTime } from '../utils/executionTime';
import { estimateBrokerageFee, estimateBrokerageFeeRate } from '../utils/brokerageFeeEstimator';

interface AddTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPosition: (
    positionData: {
      ticker: string;
      companyName: string;
      sector: Sector;
      shares: number;
      buyPrice: number;
      buyDate: string;
      executedAt?: string;
      brokerageFee: number;
      targetPrice?: number;
      stopLoss?: number;
      notes?: string;
    },
    deductFromCash: boolean
  ) => void;
  tickers: EGXTicker[];
  preselectedTicker?: EGXTicker | null;
  cashBalance: number;
  existingPositions?: Position[];
  transactions?: TradeTransaction[];
  onOpenScreenshotModal?: () => void;
}

export const AddTradeModal: React.FC<AddTradeModalProps> = ({
  isOpen,
  onClose,
  onAddPosition,
  tickers,
  preselectedTicker,
  cashBalance,
  existingPositions = [],
  transactions = [],
  onOpenScreenshotModal,
}) => {
  const requestClose = () => runVisualTransition('modal-close', onClose);
  const [tickerInput, setTickerInput] = useState<string>('');
  const [selectedTickerData, setSelectedTickerData] = useState<EGXTicker | null>(null);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [companyName, setCompanyName] = useState('');
  const [sector, setSector] = useState<Sector>('Banking');
  const [shares, setShares] = useState<number>(1000);
  const [buyPrice, setBuyPrice] = useState<number>(0);
  const [isManualPrice, setIsManualPrice] = useState<boolean>(false);
  const [buyDate, setBuyDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [executionTime, setExecutionTime] = useState<string>('');
  const [brokerageFee, setBrokerageFee] = useState<number>(0);
  const [isManualFee, setIsManualFee] = useState<boolean>(false);
  const [targetPrice, setTargetPrice] = useState<number>(0);
  const [stopLoss, setStopLoss] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [deductFromCash, setDeductFromCash] = useState<boolean>(true);

  const feeEstimate = useMemo(() => estimateBrokerageFeeRate(transactions), [transactions]);
  const learnedFeePercent = feeEstimate.rate * 100;

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsManualPrice(false);
    setIsManualFee(false);
  }, [isOpen]);

  // Check if ticker is already in active portfolio
  const activeExistingPosition = existingPositions.find(
    (p) => p.ticker.toUpperCase() === tickerInput.trim().toUpperCase()
  );

  // Set default / preselected ticker
  useEffect(() => {
    if (preselectedTicker) {
      applySelectedTicker(preselectedTicker);
    } else if (tickers.length > 0 && !tickerInput) {
      const defaultT = tickers.find((t) => t.ticker === 'COMI') || tickers[0];
      applySelectedTicker(defaultT);
    }
  }, [preselectedTicker, isOpen]);

  // Click outside suggestions dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update the default fee from this portfolio's observed execution history.
  useEffect(() => {
    if (!isManualFee) {
      setBrokerageFee(estimateBrokerageFee(shares * buyPrice, feeEstimate));
    }
  }, [shares, buyPrice, isManualFee, feeEstimate]);

  // Keep an auto-filled quote current when the live ticker directory refreshes.
  useEffect(() => {
    if (isManualPrice || !selectedTickerData?.ticker) return;
    const latest = tickers.find(
      (ticker) => ticker.ticker.toUpperCase() === selectedTickerData.ticker.toUpperCase(),
    );
    if (!latest || !Number.isFinite(latest.lastPrice) || latest.lastPrice <= 0) return;
    setSelectedTickerData(latest);
    setBuyPrice(latest.lastPrice);
  }, [tickers, selectedTickerData?.ticker, isManualPrice]);

  const applySelectedTicker = (t: EGXTicker) => {
    setTickerInput(t.ticker);
    setSelectedTickerData(t);
    setCompanyName(t.nameEn);
    setSector(t.sector);
    setIsManualPrice(false);
    setBuyPrice(t.lastPrice);
    if (t.targetPrice) setTargetPrice(t.targetPrice);
    if (t.stopLoss) setStopLoss(t.stopLoss);
    setShowSuggestions(false);
  };

  const handleTickerInputChange = (val: string) => {
    setTickerInput(val);
    setShowSuggestions(true);

    const match = tickers.find((t) => t.ticker.toUpperCase() === val.trim().toUpperCase());
    if (match) {
      setCompanyName(match.nameEn);
      setSector(match.sector);
      setIsManualPrice(false);
      setBuyPrice(match.lastPrice);
      if (match.targetPrice) setTargetPrice(match.targetPrice);
      if (match.stopLoss) setStopLoss(match.stopLoss);
      setSelectedTickerData(match);
    }
  };

  // Filtered suggestions based on letters entered (matches ticker code or English/Arabic company name)
  const suggestions = tickerInput.trim()
    ? tickers
        .filter(
          (t) =>
            t.ticker.toLowerCase().includes(tickerInput.toLowerCase()) ||
            t.nameEn.toLowerCase().includes(tickerInput.toLowerCase()) ||
            (t.nameAr && t.nameAr.includes(tickerInput))
        )
        .slice(0, 10)
    : tickers.slice(0, 8);

  const grossCost = shares * buyPrice;
  const netTotalCost = grossCost + (brokerageFee || 0);

  // DCA preview calculation if already owned
  const combinedShares = activeExistingPosition ? activeExistingPosition.shares + shares : shares;
  const existingCost = activeExistingPosition ? activeExistingPosition.shares * activeExistingPosition.avgBuyPrice : 0;
  const newBlendedAvgBuy = combinedShares > 0 ? (existingCost + grossCost) / combinedShares : buyPrice;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTicker = tickerInput.trim().toUpperCase();
    if (!cleanTicker || shares <= 0 || buyPrice <= 0) return;

    onAddPosition(
      {
        ticker: cleanTicker,
        companyName: companyName || cleanTicker,
        sector,
        shares,
        buyPrice,
        buyDate,
        executedAt: combineExecutionDateTime(buyDate, executionTime),
        brokerageFee: Math.max(0, brokerageFee || 0),
        targetPrice: targetPrice > 0 ? targetPrice : undefined,
        stopLoss: stopLoss > 0 ? stopLoss : undefined,
        notes: notes.trim() || undefined,
      },
      deductFromCash
    );
    requestClose();
  };

  return (
    <PremiumModalMotion
      isOpen={isOpen}
      backdropClassName="premium-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      panelClassName="premium-modal w-full max-w-lg my-6 rounded-2xl p-5 sm:p-6 text-slate-100 space-y-4"
      onBackdropClick={requestClose}
      panelAriaLabel="Add trade"
    >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {activeExistingPosition ? `Buy More ${activeExistingPosition.ticker} (DCA)` : 'Add EGX Position'}
              </h3>
              <p className="text-xs text-slate-400">
                {activeExistingPosition
                  ? 'Accumulate additional shares into your existing open position'
                  : 'Record a new stock trade or position into your portfolio'}
              </p>
            </div>
          </div>
          <button onClick={requestClose} className="premium-icon-action p-1.5 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Screenshot Banner Shortcut */}
        {onOpenScreenshotModal && (
          <div className="premium-modal-section p-3 rounded-xl border-emerald-500/30 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-emerald-200">
              <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Have a broker receipt or screenshot?</span>
            </div>
            <button
              type="button"
              onClick={() => {
                runVisualTransition('modal-close', () => {
                  onClose();
                  onOpenScreenshotModal();
                });
              }}
              className="premium-action premium-action-success px-3 py-1.5 rounded-lg font-bold text-[11px] shrink-0"
            >
              Scan &amp; Auto-Fill
            </button>
          </div>
        )}

        {/* Existing Position DCA Banner */}
        <ExpandPresence isOpen={!!activeExistingPosition}>
          {activeExistingPosition && (
          <div className="premium-modal-section p-3 rounded-xl border-amber-500/30 text-xs text-amber-200 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-amber-300">
              <Layers className="w-4 h-4" />
              <span>Existing Position Detected (DCA Mode)</span>
            </div>
            <p className="text-slate-300 text-[11px]">
              You currently hold <strong className="text-white font-mono">{activeExistingPosition.shares.toLocaleString()}</strong> shares @ <strong className="text-white font-mono">{activeExistingPosition.avgBuyPrice.toFixed(2)} EGP</strong>.
            </p>
            <p className="text-slate-300 text-[11px]">
              Adding this trade will adjust your open position to <strong className="text-emerald-400 font-mono">{combinedShares.toLocaleString()}</strong> total shares with a new average price of <strong className="text-emerald-400 font-mono">{newBlendedAvgBuy.toFixed(2)} EGP</strong>.
            </p>
          </div>
          )}
        </ExpandPresence>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Ticker Autocomplete Input */}
          <div className="relative" ref={wrapperRef}>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-300">EGX Stock Ticker</label>
              <span className="text-[10px] text-slate-400">Type letters to search 200+ EGX stocks</span>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={tickerInput}
                onChange={(e) => handleTickerInputChange(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Type ticker symbol (e.g. COMI, ESRS, TMGH) or company name..."
                className="premium-field w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold tracking-wide focus:outline-none focus:border-blue-500 uppercase placeholder:normal-case placeholder:font-normal placeholder:tracking-normal"
                autoComplete="off"
                required
              />
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="premium-floating premium-dropdown absolute left-0 right-0 top-full mt-1.5 z-50 max-h-64 overflow-y-auto rounded-xl border p-1.5">
                {suggestions.map((t) => (
                  <button
                    key={t.ticker}
                    type="button"
                    onClick={() => applySelectedTicker(t)}
                    className="premium-menu-item flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-slate-300 hover:text-white"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <StockLogo
                        ticker={t.ticker}
                        companyName={t.nameEn}
                        sector={t.sector}
                        logoUrl={t.logoUrl}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white tracking-wider">{t.ticker}</span>
                          <span className="premium-chip text-[10px] px-1.5 py-0.5 rounded text-slate-300">
                            {t.sector}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate max-w-[240px]">
                          {t.nameEn} {t.nameAr ? `• ${t.nameAr}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-emerald-400 block">
                        {t.lastPrice.toFixed(2)} EGP
                      </span>
                      <span className={`text-[10px] ${t.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {t.changePercent >= 0 ? '+' : ''}{t.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Company Name & Sector */}
          <div className="premium-form-section grid grid-cols-2 gap-3 p-3 rounded-xl">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="premium-field w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Sector</label>
              <input
                type="text"
                value={sector}
                readOnly
                className="premium-field w-full px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-400"
              />
            </div>
          </div>

          {/* Shares & Buy Price */}
          <div className="premium-form-section grid grid-cols-2 gap-3 p-3 rounded-xl">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Number of Shares</label>
              <NumberStepperInput
                min={1}
                step={1}
                value={shares || ''}
                onValueChange={(value) => setShares(Number(value))}
                accent="blue"
                className="premium-field w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-300">Buy Price (EGP)</label>
                {selectedTickerData && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualPrice(false);
                      setBuyPrice(selectedTickerData.lastPrice);
                    }}
                    className="premium-action px-2 py-1 rounded-lg text-[10px] text-blue-300"
                  >
                    Use latest fetched ({selectedTickerData.lastPrice.toFixed(2)})
                  </button>
                )}
              </div>
              <NumberStepperInput
                min={0.001}
                step={0.001}
                value={buyPrice || ''}
                onValueChange={(value) => {
                  setIsManualPrice(true);
                  setBuyPrice(Number(value));
                }}
                accent="blue"
                className="premium-field w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono"
                placeholder="Enter executed buy price..."
                required
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Auto-filled from the latest fetched quote; editable if your executed price differs.
              </span>
            </div>
          </div>

          {/* Brokerage Fees */}
          <div className="premium-inset-glass p-3 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                Brokerage Fees &amp; Commission (EGP)
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsManualFee(false);
                  setBrokerageFee(estimateBrokerageFee(shares * buyPrice, feeEstimate));
                }}
                className="premium-action premium-action-warning px-2 py-1 rounded-lg text-[10px]"
              >
                Reset to learned avg ({learnedFeePercent.toFixed(3)}%)
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 items-center">
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
                  placeholder="0.00"
                />
              </div>
              <div className="text-[11px] text-slate-400">
                {grossCost > 0 ? (
                  <span>
                    Effective Fee Rate: <strong className="text-white">{((brokerageFee / grossCost) * 100).toFixed(3)}%</strong>
                  </span>
                ) : (
                  <span>
                    {feeEstimate.source === 'fallback'
                      ? 'Using 0.25% fallback until fee history is available'
                      : `Learned from ${feeEstimate.sampleSize} execution${feeEstimate.sampleSize === 1 ? '' : 's'}`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Targets & Stop Loss */}
          <div className="premium-form-section grid grid-cols-2 gap-3 p-3 rounded-xl">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Target Price (EGP)</label>
              <NumberStepperInput
                min={0}
                step={0.01}
                value={targetPrice || ''}
                onValueChange={(value) => setTargetPrice(Number(value))}
                accent="emerald"
                placeholder="Optional target..."
                className="premium-field w-full px-3 py-2 rounded-xl text-emerald-400 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Stop Loss (EGP)</label>
              <NumberStepperInput
                min={0}
                step={0.01}
                value={stopLoss || ''}
                onValueChange={(value) => setStopLoss(Number(value))}
                accent="rose"
                placeholder="Optional stop loss..."
                className="premium-field w-full px-3 py-2 rounded-xl text-rose-400 font-mono"
              />
            </div>
          </div>

          {/* Execution date and time */}
          <div className="premium-form-section grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl">
            <DateInput
              id="trade-execution-date"
              label="Trade Execution Date"
              value={buyDate}
              onChange={setBuyDate}
              required
            />
            <div>
              <label htmlFor="trade-execution-time" className="block font-semibold text-slate-300 mb-1">
                Execution Time
              </label>
              <div className="premium-time-wrap">
                <input
                  id="trade-execution-time"
                  type="time"
                  value={executionTime}
                  onChange={(e) => setExecutionTime(e.target.value)}
                  className="premium-field premium-time-input w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono"
                />
                <span className="premium-icon-action premium-time-trigger-visual p-1 rounded-lg">
                  <Clock className="w-3.5 h-3.5" />
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Optional, but recommended when matching broker receipts.
              </span>
            </div>
          </div>

          {/* Financial Breakdown Ribbon */}
          <div className="premium-inset-glass p-3 rounded-xl grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <span className="text-slate-400 text-[10px] block">Gross Equities</span>
              <span className="font-mono font-bold text-white">
                {grossCost.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">Brokerage Fee</span>
              <span className="font-mono font-bold text-amber-400">
                {(brokerageFee || 0).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">Total Outlay</span>
              <span className="font-mono font-bold text-blue-400">
                {netTotalCost.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Trade Notes &amp; Strategy</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Rationale, technical triggers, resistance breakouts..."
              className="premium-field premium-textarea-surface w-full px-3 py-2 rounded-xl border border-slate-700 text-white text-xs"
            />
          </div>

          {/* Cash Deduction Option */}
          <div className="premium-modal-section flex items-center gap-2 p-3 rounded-xl">
            <input
              type="checkbox"
              id="deductCash"
              checked={deductFromCash}
              onChange={(e) => setDeductFromCash(e.target.checked)}
              className="premium-checkbox"
            />
            <label htmlFor="deductCash" className="text-slate-300 text-xs select-none">
              Deduct <strong className="text-white font-mono">{netTotalCost.toLocaleString('en-EG', { minimumFractionDigits: 2 })} EGP</strong> (including fees) from cash balance ({cashBalance.toLocaleString('en-EG', { minimumFractionDigits: 2 })} EGP available)
            </label>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={requestClose}
              className="premium-action px-4 py-2 rounded-xl font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="premium-action premium-action-primary premium-shimmer-border px-5 py-2 rounded-xl font-semibold"
            >
              {activeExistingPosition ? 'Accumulate (DCA)' : 'Add Position'}
            </button>
          </div>
        </form>
    </PremiumModalMotion>
  );
};
