import React, { useState, useRef } from 'react';
import { runVisualTransition } from '../utils/visualTransition';
import { Position, ClosedTrade, TradeTransaction, EGXTicker, GoogleSheetsConfig } from '../types';
import {
  Download,
  Upload,
  RefreshCw,
  X,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  FileSpreadsheet,
  Database,
  ArrowRight,
  Sparkles,
  Loader2,
} from 'lucide-react';

interface ParsedBackupData {
  positions: Position[];
  closedTrades: ClosedTrade[];
  transactions: TradeTransaction[];
  cashBalance: number;
  capitalDeposits?: number;
  tickers?: EGXTicker[];
  exportDate?: string;
  sourceType?: string;
}

interface PortfolioBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  positions: Position[];
  closedTrades: ClosedTrade[];
  transactions: TradeTransaction[];
  cashBalance: number;
  capitalDeposits?: number;
  tickers: EGXTicker[];
  sheetsConfig?: GoogleSheetsConfig | null;
  onRestoreBackup: (backup: {
    positions: Position[];
    closedTrades: ClosedTrade[];
    transactions: TradeTransaction[];
    cashBalance: number;
    capitalDeposits?: number;
    tickers?: EGXTicker[];
  }) => Promise<void> | void;
  onReconcileLedger: () => void;
}

/**
 * Intelligent JSON normalizer that extracts portfolio records
 * from standard backups, Firestore document dumps, and legacy exports.
 */
function parsePortfolioBackupJson(jsonString: string): ParsedBackupData {
  const root = JSON.parse(jsonString);

  // Unwrap potential wrapper objects (e.g. { data: ... }, { portfolio: ... }, { backup: ... })
  const source = root?.portfolio || root?.data || root?.backup || root;

  // 1. Extract Cash Balance
  let cashBalance = 0;
  if (typeof source.cashBalance === 'number') {
    cashBalance = source.cashBalance;
  } else if (typeof source.cashBalance === 'string' && !isNaN(parseFloat(source.cashBalance))) {
    cashBalance = parseFloat(source.cashBalance);
  }

  // 2. Extract Capital Deposits
  let capitalDeposits: number | undefined = undefined;
  if (typeof source.capitalDeposits === 'number') {
    capitalDeposits = source.capitalDeposits;
  } else if (typeof source.capitalDeposits === 'string' && !isNaN(parseFloat(source.capitalDeposits))) {
    capitalDeposits = parseFloat(source.capitalDeposits);
  }

  // 3. Extract Transactions
  const rawTx = source.transactions || source.trades || source.tradeHistory || source.ledger || [];
  const transactions: TradeTransaction[] = Array.isArray(rawTx) ? rawTx : [];

  // 4. Extract Positions
  const rawPos = source.positions || source.openPositions || [];
  const positions: Position[] = Array.isArray(rawPos) ? rawPos : [];

  // 5. Extract Closed Trades
  const rawClosed = source.closedTrades || source.closed || source.tradeCycles || [];
  const closedTrades: ClosedTrade[] = Array.isArray(rawClosed) ? rawClosed : [];

  // 6. Extract Tickers
  const rawTickers = source.tickers || root?.tickers || [];
  const tickers: EGXTicker[] | undefined = Array.isArray(rawTickers) && rawTickers.length > 0 ? rawTickers : undefined;

  // Validation: at least one meaningful element must be present
  const hasData =
    positions.length > 0 ||
    transactions.length > 0 ||
    closedTrades.length > 0 ||
    cashBalance > 0 ||
    (capitalDeposits !== undefined && capitalDeposits > 0);

  if (!hasData) {
    throw new Error(
      'The file does not appear to contain valid portfolio data (positions, transactions, or cash balance are missing).'
    );
  }

  return {
    positions,
    closedTrades,
    transactions,
    cashBalance,
    capitalDeposits,
    tickers,
    exportDate: source.exportDate || source.updatedAt || root.exportDate || undefined,
    sourceType: source.appName || (source.updatedAt ? 'Cloud Sync' : 'JSON Export'),
  };
}

export const PortfolioBackupModal: React.FC<PortfolioBackupModalProps> = ({
  isOpen,
  onClose,
  positions,
  closedTrades,
  transactions,
  cashBalance,
  capitalDeposits = 0,
  tickers,
  sheetsConfig,
  onRestoreBackup,
  onReconcileLedger,
}) => {
  const requestClose = () => runVisualTransition('modal-close', onClose);
  const [importPreview, setImportPreview] = useState<ParsedBackupData | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExportJson = () => {
    const payload = {
      appName: 'EGX Portfolio Tracker',
      exportDate: new Date().toISOString(),
      schemaVersion: 3,
      cashBalance,
      capitalDeposits,
      positions,
      closedTrades,
      transactions,
      tickers,
      sheetsConfig,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `egx-portfolio-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setSuccessMsg('Portfolio backup exported successfully!');
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleExportCsv = (type: 'positions' | 'transactions') => {
    if (type === 'positions') {
      const headers = ['Ticker', 'Company Name', 'Sector', 'Shares', 'Avg Buy Price (EGP)', 'Current Price (EGP)', 'Cost Basis (EGP)', 'Market Value (EGP)', 'Unrealized Gain (EGP)', 'Return %'];
      const rows = positions.map((p) => {
        const costBasis = p.shares * p.avgBuyPrice;
        const mktValue = p.shares * p.currentPrice;
        const gain = mktValue - costBasis;
        const returnPct = costBasis > 0 ? ((gain / costBasis) * 100).toFixed(2) : '0.00';
        return [
          `"${p.ticker}"`,
          `"${(p.companyName || '').replace(/"/g, '""')}"`,
          `"${(p.sector || '').replace(/"/g, '""')}"`,
          p.shares,
          p.avgBuyPrice.toFixed(2),
          p.currentPrice.toFixed(2),
          costBasis.toFixed(2),
          mktValue.toFixed(2),
          gain.toFixed(2),
          `"${returnPct}%"`,
        ].join(',');
      });
      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `EGX_Active_Positions_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ['ID', 'Date', 'Ticker', 'Type', 'Shares', 'Price (EGP)', 'Fees (EGP)', 'Total Amount (EGP)', 'Notes'];
      const rows = transactions.map((t) => {
        return [
          `"${t.id}"`,
          `"${t.date}"`,
          `"${t.ticker}"`,
          `"${t.type}"`,
          t.shares,
          t.price.toFixed(2),
          t.fees.toFixed(2),
          t.totalAmount.toFixed(2),
          `"${(t.notes || '').replace(/"/g, '""')}"`,
        ].join(',');
      });
      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `EGX_Transactions_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
    setSuccessMsg(`Exported ${type === 'positions' ? 'Active Holdings' : 'Transaction Ledger'} CSV for Excel!`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const processFile = (file: File) => {
    setImportError(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parsePortfolioBackupJson(text);
        setImportPreview(parsed);
      } catch (err: any) {
        setImportError(err.message || 'Failed to parse JSON backup file. Please ensure it is a valid format.');
        setImportPreview(null);
      }
    };
    reader.onerror = () => {
      setImportError('Unable to read selected file.');
      setImportPreview(null);
    };
    reader.readAsText(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleConfirmRestore = async () => {
    if (!importPreview) return;
    setIsRestoring(true);
    setImportError(null);

    try {
      await onRestoreBackup({
        positions: importPreview.positions,
        closedTrades: importPreview.closedTrades,
        transactions: importPreview.transactions,
        cashBalance: importPreview.cashBalance,
        capitalDeposits: importPreview.capitalDeposits,
        tickers: importPreview.tickers || tickers,
      });

      setSuccessMsg('Portfolio state restored and synced with Firebase successfully!');
      setImportPreview(null);
      setTimeout(() => {
        setIsRestoring(false);
        requestClose();
      }, 1400);
    } catch (err: any) {
      setIsRestoring(false);
      setImportError(err.message || 'Failed to apply backup to application state.');
    }
  };

  return (
    <div className="premium-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="premium-modal relative w-full max-w-lg p-6 rounded-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Backup, Sync & Integrity</h3>
              <p className="text-xs text-slate-400">Manage data persistence, cloud sync & restore backups</p>
            </div>
          </div>
          <button
            onClick={requestClose}
            className="premium-icon-action p-1.5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Option 1: Reconcile Ledger */}
        <div className="premium-modal-section p-4 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-white text-xs">Reconcile Ledger & Portfolio Math</span>
            </div>
            <button
              onClick={onReconcileLedger}
              className="premium-action premium-filter-active-cyan px-3 py-1.5 rounded-lg text-xs font-semibold"
            >
              Run Reconciliation
            </button>
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            Recomputes open positions, closed trade P&L, and available cash balance directly from your chronological transaction ledger to fix any state discrepancies.
          </p>
        </div>

        {/* Option 2: Export JSON Backup */}
        <div className="premium-modal-section p-4 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-white text-xs">Export Full Portfolio Backup (JSON)</span>
            </div>
            <button
              onClick={handleExportJson}
              className="premium-action premium-action-warning px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Backup</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            Saves your active positions ({positions.length}), transactions ({transactions.length}), closed cycles ({closedTrades.length}), and cash balance ({cashBalance.toLocaleString()} EGP) to a local JSON file.
          </p>
        </div>

        {/* Option 3: Export to Excel Spreadsheets (CSV) */}
        <div className="premium-modal-section p-4 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-white text-xs">Export to Excel Spreadsheets (CSV)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportCsv('positions')}
                className="premium-action premium-action-success px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1"
                title="Download Active Holdings for Excel"
              >
                <Download className="w-3 h-3" />
                <span>Holdings CSV</span>
              </button>
              <button
                onClick={() => handleExportCsv('transactions')}
                className="premium-action premium-action-success px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1"
                title="Download Transaction Ledger for Excel"
              >
                <Download className="w-3 h-3" />
                <span>Ledger CSV</span>
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            Download your portfolio directly as UTF-8 encoded CSV spreadsheets compatible with Microsoft Excel, Apple Numbers, and Google Sheets.
          </p>
        </div>

        {/* Option 3: Restore Backup */}
        <div className="premium-modal-section p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-white text-xs">Restore Portfolio from Backup File</span>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="premium-action px-2.5 py-1 rounded-lg text-xs font-semibold"
            >
              Choose File
            </button>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Drag & Drop Target */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`p-4 rounded-xl border border-dashed transition cursor-pointer flex flex-col items-center justify-center text-center gap-2 ${
              isDragging
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                : 'premium-choice text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-5 h-5 text-slate-400" />
            <div className="text-xs">
              <span className="font-semibold text-slate-200">Click to upload</span> or drag and drop your backup JSON file
            </div>
            <div className="text-[10px] text-slate-500">Supports standard .json backups & Cloud Sync exports</div>
          </div>

          {importError && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{importError}</span>
            </div>
          )}

          {importPreview && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Backup Verified & Ready to Restore</span>
                </div>
                {importPreview.exportDate && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(importPreview.exportDate).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="premium-inset-glass grid grid-cols-2 gap-2 text-[11px] font-mono p-2.5 rounded-lg">
                <div className="text-slate-300">
                  Positions: <span className="font-bold text-white">{importPreview.positions.length}</span>
                </div>
                <div className="text-slate-300">
                  Transactions: <span className="font-bold text-white">{importPreview.transactions.length}</span>
                </div>
                <div className="text-slate-300">
                  Closed Trades: <span className="font-bold text-white">{importPreview.closedTrades.length}</span>
                </div>
                <div className="text-slate-300">
                  Cash: <span className="font-bold text-emerald-400">{importPreview.cashBalance.toLocaleString()} EGP</span>
                </div>
                {importPreview.capitalDeposits !== undefined && (
                  <div className="text-slate-300 col-span-2">
                    Capital Deposits: <span className="font-bold text-white">{importPreview.capitalDeposits.toLocaleString()} EGP</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="premium-action premium-action-success premium-shimmer-border w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Applying Backup & Syncing to Cloud...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Restore Portfolio & Sync Now</span>
                    <ArrowRight className="w-4 h-4 ml-auto" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
