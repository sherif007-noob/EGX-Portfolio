import React, { useState, useRef } from 'react';
import { NumberStepperInput } from './NumberStepperInput';
import { EGXTicker, Sector } from '../types';
import { StockLogo } from './StockLogo';
import { 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  RefreshCw,
  Trash2,
  Plus,
  Zap
} from 'lucide-react';
import { DateInput } from './DateInput';
import { recognizeTradeScreenshot, parseTradeText } from '../services/ocrParser';
import { getTodayISO } from '../utils/dateUtils';

export interface ParsedTradeItem {
  id: string;
  ticker: string;
  companyName: string;
  sector: Sector;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  fees: number;
  date: string;
  executedAt?: string;
  brokerName?: string;
  notes?: string;
  confidenceScore?: number;
  imagePreview?: string;
}

interface TradeScreenshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickers: EGXTicker[];
  onAddTransaction: (tx: {
    ticker: string;
    companyName: string;
    sector: Sector;
    type: 'BUY' | 'SELL';
    shares: number;
    price: number;
    date: string;
    executedAt?: string;
    fees: number;
    notes?: string;
  }) => void;
  onAddBatchTransactions?: (txs: Array<{
    ticker: string;
    companyName: string;
    sector: Sector;
    type: 'BUY' | 'SELL';
    shares: number;
    price: number;
    date: string;
    executedAt?: string;
    fees: number;
    notes?: string;
  }>) => void;
}

export const TradeScreenshotModal: React.FC<TradeScreenshotModalProps> = ({
  isOpen,
  onClose,
  tickers,
  onAddTransaction,
  onAddBatchTransactions,
}) => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number } | null>(null);
  const [batchTrades, setBatchTrades] = useState<ParsedTradeItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Single item edit state when viewing 1 trade
  const [activeSingleIndex, setActiveSingleIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resolveTickerData = (rawTicker: string, companyName?: string) => {
    const clean = (rawTicker || '').trim().toUpperCase();
    const match = tickers.find((t) => t.ticker.toUpperCase() === clean);
    return {
      ticker: match ? match.ticker : clean,
      name: match ? match.nameEn : companyName || clean,
      sector: (match?.sector as Sector) || 'Banking',
    };
  };

  const handleFilesSelect = async (files: FileList | File[]) => {
    const fileList = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileList.length === 0) {
      setErrorMsg('Please select valid image screenshots (PNG, JPG, WEBP).');
      return;
    }

    setErrorMsg(null);
    setIsScanning(true);
    setScanProgress({ current: 0, total: fileList.length });

    try {
      // 1. Convert all files to base64 for image preview attachments
      const base64List: Array<{ base64: string; mime: string; name: string; file: File }> = [];
      for (const file of fileList) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        base64List.push({ base64, mime: file.type || 'image/jpeg', name: file.name, file });
      }

      const parsedItems: ParsedTradeItem[] = [];

      // FREE CLIENT-SIDE OCR ENGINE (Tesseract.js)
      for (let i = 0; i < base64List.length; i++) {
        setScanProgress({ current: i + 1, total: base64List.length });
        const item = base64List[i];
        try {
          const ocrText = await recognizeTradeScreenshot(item.file);
          const parsed = parseTradeText(ocrText, tickers);

          if (parsed && (parsed.ticker || parsed.shares || parsed.price)) {
            const { ticker, name, sector } = resolveTickerData(parsed.ticker || '', parsed.companyName);
            parsedItems.push({
              id: `ocr-${Date.now()}-${i}`,
              ticker,
              companyName: name,
              sector,
              type: parsed.type || 'BUY',
              shares: parsed.shares || 0,
              price: parsed.price || 0,
              fees: parsed.fees || 0,
              date: parsed.date || getTodayISO(),
              executedAt: parsed.executedAt,
              brokerName: parsed.brokerName || 'Telda',
              notes: parsed.notes || `${parsed.brokerName || 'Telda'} ${parsed.type === 'BUY' ? 'Buy' : 'Sell'} • OCR Scanned`,
              confidenceScore: parsed.confidenceScore || 92,
              imagePreview: item.base64,
            });
          } else {
            // Unparsed item without fake templates
            parsedItems.push({
              id: `ocr-unparsed-${Date.now()}-${i}`,
              ticker: '',
              companyName: 'Unrecognized Trade',
              sector: 'Other',
              type: 'BUY',
              shares: 0,
              price: 0,
              fees: 0,
              date: getTodayISO(),
              brokerName: 'Telda',
              notes: 'Trade details could not be detected from image. Please verify.',
              confidenceScore: 40,
              imagePreview: item.base64,
            });
          }
        } catch (ocrErr) {
          console.error('OCR processing error on file', i, ocrErr);
          parsedItems.push({
            id: `ocr-err-${Date.now()}-${i}`,
            ticker: '',
            companyName: 'Scan Error',
            sector: 'Other',
            type: 'BUY',
            shares: 0,
            price: 0,
            fees: 0,
            date: getTodayISO(),
            brokerName: 'Telda',
            notes: 'Failed to read image. Please enter details manually.',
            confidenceScore: 30,
            imagePreview: item.base64,
          });
        }
      }

      setBatchTrades((prev) => [...prev, ...parsedItems]);
      if (parsedItems.length === 1 && batchTrades.length === 0) {
        setActiveSingleIndex(0);
      } else {
        setActiveSingleIndex(null);
      }
    } catch (err: any) {
      console.error('Error scanning screenshot batch:', err);
      setErrorMsg(err.message || 'Failed to analyze screenshots.');
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  };

  const updateTradeItem = (index: number, updates: Partial<ParsedTradeItem>) => {
    setBatchTrades((prev) => {
      const next = [...prev];
      const curr = { ...next[index], ...updates };
      if (updates.ticker && updates.ticker !== next[index].ticker) {
        const info = resolveTickerData(updates.ticker, curr.companyName);
        curr.ticker = info.ticker;
        curr.companyName = info.name;
        curr.sector = info.sector;
      }
      next[index] = curr;
      return next;
    });
  };

  const removeTradeItem = (index: number) => {
    setBatchTrades((prev) => prev.filter((_, i) => i !== index));
    if (activeSingleIndex !== null) {
      setActiveSingleIndex(null);
    }
  };

  const handleConfirmAll = () => {
    if (batchTrades.length === 0) return;

    // A single failed OCR image must not block valid screenshots in the same batch.
    // Keep failed/unparsed items visible for manual correction and submit only the
    // valid transactions.
    const validTrades = batchTrades.filter(
      (t) => Boolean(t.ticker.trim()) && Number.isFinite(Number(t.shares)) && Number(t.shares) > 0 && Number.isFinite(Number(t.price)) && Number(t.price) > 0
    );
    const invalidTrades = batchTrades.filter((t) => !validTrades.includes(t));

    if (validTrades.length === 0) {
      setErrorMsg('None of the screenshots contain a valid trade yet. Please correct the failed OCR items first.');
      return;
    }

    const payload = validTrades.map((t) => ({
      ticker: t.ticker.toUpperCase().trim(),
      companyName: t.companyName || t.ticker,
      sector: t.sector,
      type: t.type,
      shares: Number(t.shares),
      price: Number(t.price),
      date: t.date,
      executedAt: t.executedAt,
      fees: Number(t.fees) || 0,
      notes: t.notes || `Imported via ${t.brokerName || 'Telda'}`,
    }));

    if (onAddBatchTransactions && validTrades.length > 1) {
      onAddBatchTransactions(payload);
    } else {
      payload.forEach((t) => onAddTransaction(t));
    }

    if (invalidTrades.length > 0) {
      setBatchTrades(invalidTrades);
      setErrorMsg(`${invalidTrades.length} screenshot(s) could not be read. The ${validTrades.length} valid trade(s) were logged; please correct the remaining item(s) and log them separately.`);
      return;
    }

    resetModal();
    onClose();
  };

  const resetModal = () => {
    setBatchTrades([]);
    setErrorMsg(null);
    setIsScanning(false);
    setActiveSingleIndex(null);
  };

  const totalTradedValue = batchTrades.reduce((acc, t) => {
    const gross = t.shares * t.price;
    return acc + (t.type === 'BUY' ? gross + (t.fees || 0) : gross - (t.fees || 0));
  }, 0);

  const totalFees = batchTrades.reduce((acc, t) => acc + (t.fees || 0), 0);

  return (
    <div className="premium-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="premium-modal rounded-2xl w-full max-w-3xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  Trade Screenshot Scanner
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                  Telda &amp; EGX
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold">
                  <Zap className="w-3 h-3 text-emerald-400" />
                  Free Client OCR (Offline)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Extracts Order Reviews &amp; Receipts from Telda, Thndr, Mubasher &amp; Egyptian brokers
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              resetModal();
              onClose();
            }}
            className="premium-icon-action p-1.5 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="premium-icon-action premium-icon-delete p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Dropzone for 1 or multiple screenshots */}
          {batchTrades.length === 0 && !isScanning && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleFilesSelect(e.dataTransfer.files);
                }
              }}
              className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl p-8 text-center cursor-pointer bg-slate-950/40 hover:bg-slate-800/20 transition group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesSelect(e.target.files);
                  }
                }}
              />
              <div className="w-14 h-14 rounded-2xl bg-slate-800/80 group-hover:bg-emerald-500/20 border border-slate-700 group-hover:border-emerald-500/40 text-slate-400 group-hover:text-emerald-400 flex items-center justify-center mx-auto mb-4 transition">
                <UploadCloud className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-semibold text-white mb-1">
                Click to upload or drag &amp; drop Telda screenshots
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto mb-3">
                Processed 100% locally with fast client-side OCR. Instant recognition with zero server dependencies or timeouts.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500 font-medium">
                <span>Multiple Images Supported</span>
                <span>•</span>
                <span>Order Reviews &amp; Receipts</span>
                <span>•</span>
                <span>Extracts Ticker, Action, Qty &amp; Price</span>
              </div>
            </div>
          )}

          {/* Scanning Animation */}
          {isScanning && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2 justify-center">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  Running Client-Side OCR Character Recognition...
                </h4>
                {scanProgress && (
                  <p className="text-xs text-slate-400 mt-1">
                    Processing image {scanProgress.current} of {scanProgress.total}...
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Batch Trades Review List */}
          {batchTrades.length > 0 && !isScanning && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">
                    Parsed Transactions ({batchTrades.length})
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                    Ready to Log
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="premium-action premium-action-purple px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Upload More
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={resetModal}
                    className="premium-action premium-action-danger px-2.5 py-1 rounded-lg text-xs font-semibold"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Individual Transaction Review Cards */}
              <div className="space-y-3 max-h-[48vh] overflow-y-auto pr-1">
                {batchTrades.map((trade, idx) => {
                  const grossAmount = trade.shares * trade.price;
                  const totalNet = trade.type === 'BUY' ? grossAmount + trade.fees : Math.max(0, grossAmount - trade.fees);

                  return (
                    <div
                      key={trade.id}
                      className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition space-y-3"
                    >
                      {/* Top Row: Logo, Ticker, Type, Confidence & Delete */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <StockLogo ticker={trade.ticker} size="sm" />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={trade.ticker}
                                onChange={(e) => updateTradeItem(idx, { ticker: e.target.value.toUpperCase() })}
                                className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-xs font-black text-white uppercase focus:outline-none focus:border-indigo-500"
                              />
                              <span className="text-xs text-slate-400 font-medium truncate max-w-[150px] sm:max-w-[220px]">
                                {trade.companyName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                              <span className="text-indigo-400 font-medium">{trade.brokerName || 'Telda'}</span>
                              <span>•</span>
                              <span>{trade.notes || 'Order Review'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Buy / Sell Toggle */}
                          <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
                            <button
                              type="button"
                              onClick={() => updateTradeItem(idx, { type: 'BUY' })}
                              className={`premium-filter-pill px-2.5 py-1 rounded-md text-[11px] font-bold ${trade.type === 'BUY' ? 'premium-filter-active-emerald' : ''}`}
                            >
                              BUY
                            </button>
                            <button
                              type="button"
                              onClick={() => updateTradeItem(idx, { type: 'SELL' })}
                              className={`premium-filter-pill px-2.5 py-1 rounded-md text-[11px] font-bold ${trade.type === 'SELL' ? 'premium-filter-active-rose' : ''}`}
                            >
                              SELL
                            </button>
                          </div>

                          {/* Delete Item */}
                          <button
                            type="button"
                            onClick={() => removeTradeItem(idx)}
                            className="premium-icon-action premium-icon-delete p-1.5 rounded-lg"
                            title="Remove transaction"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Middle Row: Editable Inputs */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                        <div>
                          <label className="block text-[10px] font-medium text-slate-400 mb-1">
                            Shares
                          </label>
                          <NumberStepperInput
                            min={1}
                            step={1}
                            value={trade.shares || ''}
                            onValueChange={(value) => updateTradeItem(idx, { shares: Number(value) })}
                            accent="indigo"
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-medium text-slate-400 mb-1">
                            Price (EGP)
                          </label>
                          <NumberStepperInput
                            step={0.01}
                            min={0.01}
                            value={trade.price || ''}
                            onValueChange={(value) => updateTradeItem(idx, { price: Number(value) })}
                            accent="indigo"
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-medium text-slate-400 mb-1">
                            Date
                          </label>
                          <DateInput
                            value={trade.date}
                            onChange={(d) => updateTradeItem(idx, { date: d })}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-medium text-slate-400 mb-1">
                            Fees (EGP)
                          </label>
                          <NumberStepperInput
                            step={0.01}
                            min={0}
                            value={trade.fees || ''}
                            onValueChange={(value) => updateTradeItem(idx, { fees: Number(value) })}
                            accent="amber"
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Total Net Value Banner */}
                      <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-900/90 text-slate-400">
                        <span>
                          {trade.type === 'BUY' ? 'Total Cost (incl. fees):' : 'Net Proceeds (after fees):'}
                        </span>
                        <span className="font-bold text-white">
                          {new Intl.NumberFormat('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalNet)}{' '}
                          EGP
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {batchTrades.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/95 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-slate-400 text-center sm:text-left">
              <span>Logging </span>
              <strong className="text-white">{batchTrades.length} transactions</strong>
              <span> • Total Net: </span>
              <strong className="text-emerald-400">
                {new Intl.NumberFormat('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalTradedValue)}{' '}
                EGP
              </strong>
              {totalFees > 0 && (
                <span className="text-slate-500 ml-1">
                  (Fees: {totalFees.toFixed(2)} EGP)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => {
                  resetModal();
                  onClose();
                }}
                className="premium-action px-4 py-2 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAll}
                className="premium-action premium-action-success premium-shimmer-border px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {batchTrades.length > 1
                    ? `Log All ${batchTrades.length} Trades to Portfolio`
                    : 'Log Trade to Portfolio'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
