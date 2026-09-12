import React, { useState } from 'react';
import { Position, ClosedTrade, TradeTransaction, EGXTicker, GoogleSheetsConfig } from '../types';
import { Download, Upload, RefreshCw, X, ShieldCheck, CheckCircle2, AlertTriangle, FileJson, Database } from 'lucide-react';

interface PortfolioBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  positions: Position[];
  closedTrades: ClosedTrade[];
  transactions: TradeTransaction[];
  cashBalance: number;
  tickers: EGXTicker[];
  sheetsConfig?: GoogleSheetsConfig | null;
  onRestoreBackup: (backup: {
    positions: Position[];
    closedTrades: ClosedTrade[];
    transactions: TradeTransaction[];
    cashBalance: number;
    tickers?: EGXTicker[];
  }) => void;
  onReconcileLedger: () => void;
}

export const PortfolioBackupModal: React.FC<PortfolioBackupModalProps> = ({
  isOpen,
  onClose,
  positions,
  closedTrades,
  transactions,
  cashBalance,
  tickers,
  sheetsConfig,
  onRestoreBackup,
  onReconcileLedger,
}) => {
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExportJson = () => {
    const payload = {
      appName: 'EGX Portfolio Tracker',
      exportDate: new Date().toISOString(),
      schemaVersion: 3,
      cashBalance,
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (
          typeof parsed.cashBalance === 'number' &&
          Array.isArray(parsed.positions) &&
          Array.isArray(parsed.transactions)
        ) {
          setImportPreview(parsed);
          setImportError(null);
        } else {
          setImportError('Invalid backup file structure. File must contain positions, transactions, and cashBalance.');
          setImportPreview(null);
        }
      } catch (err) {
        setImportError('Failed to parse JSON file. Please ensure it is a valid portfolio backup.');
        setImportPreview(null);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = () => {
    if (!importPreview) return;
    onRestoreBackup({
      positions: importPreview.positions || [],
      closedTrades: importPreview.closedTrades || [],
      transactions: importPreview.transactions || [],
      cashBalance: importPreview.cashBalance ?? 0,
      tickers: importPreview.tickers || tickers,
    });
    setImportPreview(null);
    setSuccessMsg('Portfolio state restored successfully from backup!');
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Backup, Sync & Integrity</h3>
              <p className="text-xs text-slate-400">Manage data persistence, offline backups & ledger reconciliation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
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
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-white text-xs">Reconcile Ledger & Portfolio Math</span>
            </div>
            <button
              onClick={onReconcileLedger}
              className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 text-xs font-semibold transition"
            >
              Run Reconciliation
            </button>
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            Recomputes open positions, closed trade P&L, and available cash balance directly from your chronological transaction ledger to fix any state discrepancies.
          </p>
        </div>

        {/* Option 2: Export JSON Backup */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-white text-xs">Export Full Portfolio Backup (JSON)</span>
            </div>
            <button
              onClick={handleExportJson}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Backup</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            Saves your active positions ({positions.length}), transactions ({transactions.length}), closed cycles ({closedTrades.length}), and cash balance to a local JSON file.
          </p>
        </div>

        {/* Option 3: Restore Backup */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-white text-xs">Restore Portfolio from Backup</span>
          </div>

          <input
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
          />

          {importError && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{importError}</span>
            </div>
          )}

          {importPreview && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Backup Verified & Ready to Restore</span>
              </div>
              <ul className="text-slate-300 text-[11px] space-y-1 font-mono">
                <li>• Positions: {importPreview.positions?.length || 0}</li>
                <li>• Transactions: {importPreview.transactions?.length || 0}</li>
                <li>• Closed Trades: {importPreview.closedTrades?.length || 0}</li>
                <li>• Cash Balance: {importPreview.cashBalance} EGP</li>
              </ul>
              <button
                onClick={handleConfirmRestore}
                className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
              >
                Confirm & Overwrite Current Portfolio
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
