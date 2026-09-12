import React, { useState, useEffect } from 'react';
import { googleSignIn, getAccessToken, logout } from '../services/firebaseAuth';
import { 
  extractSpreadsheetId, 
  fetchSpreadsheetMetadata, 
  appendTransactionToSheet,
  updateStockDirectoryInSheet,
  syncAllPortfolioToSheet,
  fetchUserSpreadsheets,
  GoogleDriveSpreadsheet
} from '../services/googleSheets';
import { Position, ClosedTrade, GoogleSheetsConfig, TradeTransaction, EGXTicker } from '../types';
import { User } from 'firebase/auth';
import { 
  FileSpreadsheet, 
  X, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  CheckCircle2, 
  Sparkles,
  TrendingUp,
  Receipt,
  FolderOpen,
  Database,
  LogOut,
  UploadCloud,
  ShieldCheck,
  Layers,
  ArrowRight
} from 'lucide-react';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportData: (
    positions: Position[],
    closedTrades: ClosedTrade[],
    config: GoogleSheetsConfig,
    transactions?: TradeTransaction[]
  ) => void;
  currentConfig?: GoogleSheetsConfig;
  authUser: User | null;
  onAuthSuccess: (user: User) => void;
  positions?: Position[];
  closedTrades?: ClosedTrade[];
  transactions?: TradeTransaction[];
  tickers?: EGXTicker[];
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  onImportData,
  currentConfig,
  authUser,
  onAuthSuccess,
  positions = [],
  closedTrades = [],
  transactions = [],
  tickers = [],
}) => {
  const [sheetUrl, setSheetUrl] = useState(
    currentConfig?.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${currentConfig.spreadsheetId}` : ''
  );
  const [sheetName, setSheetName] = useState(currentConfig?.sheetName || 'Transaction Logger');
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [sheetTitle, setSheetTitle] = useState<string>('');
  
  // Google Drive Spreadsheets List
  const [driveSpreadsheets, setDriveSpreadsheets] = useState<GoogleDriveSpreadsheet[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);

  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load user spreadsheets when modal opens or user logs in
  useEffect(() => {
    if (isOpen && authUser) {
      loadDriveSpreadsheets();
    }
  }, [isOpen, authUser]);

  // If we already have a spreadsheetId, load its tabs automatically
  useEffect(() => {
    if (isOpen && (sheetUrl || currentConfig?.spreadsheetId)) {
      const spId = extractSpreadsheetId(sheetUrl || currentConfig?.spreadsheetId || '');
      if (spId && authUser) {
        handleFetchTabs(spId);
      }
    }
  }, [isOpen]);

  const loadDriveSpreadsheets = async () => {
    setLoadingDrive(true);
    try {
      const token = await getAccessToken();
      if (token) {
        const files = await fetchUserSpreadsheets(token);
        setDriveSpreadsheets(files);
      }
    } catch (err) {
      console.warn('Could not list drive spreadsheets:', err);
    } finally {
      setLoadingDrive(false);
    }
  };

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const authResult = await googleSignIn();
      if (!authResult) {
        throw new Error('Sign-in cancelled or failed');
      }
      const { user, accessToken } = authResult;
      onAuthSuccess(user);
      setSuccessMsg(`Signed in as ${user.displayName || user.email}. Token stored for continuous sync!`);

      // Load user drive sheets
      if (accessToken) {
        const files = await fetchUserSpreadsheets(accessToken);
        setDriveSpreadsheets(files);
      }

      // Auto-detect available tabs if spreadsheet ID is already provided
      const spreadsheetId = extractSpreadsheetId(sheetUrl);
      if (spreadsheetId && accessToken) {
        await handleFetchTabs(spreadsheetId, accessToken);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate with Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDriveSpreadsheet = async (sp: GoogleDriveSpreadsheet) => {
    setSheetUrl(`https://docs.google.com/spreadsheets/d/${sp.id}`);
    setSheetTitle(sp.name);
    setError(null);
    setSuccessMsg(`Selected sheet: "${sp.name}"`);
    await handleFetchTabs(sp.id);
  };

  const handleFetchTabs = async (explicitId?: string, explicitToken?: string) => {
    const spreadsheetId = explicitId || extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      setError('Please provide a valid Google Spreadsheet URL or ID.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = explicitToken || (await getAccessToken());
      if (!token) {
        throw new Error('Please sign in with Google first to list spreadsheet tabs.');
      }

      const meta = await fetchSpreadsheetMetadata(spreadsheetId, token);
      setAvailableSheets(meta.sheets);
      setSheetTitle(meta.title);

      const txTab = meta.sheets.find(s => s.toLowerCase().includes('transaction'));
      if (txTab) {
        setSheetName(txTab);
      } else if (meta.sheets.length > 0) {
        setSheetName(meta.sheets[0]);
      }
      setSuccessMsg(`Spreadsheet "${meta.title}" loaded with ${meta.sheets.length} tabs.`);
    } catch (err: any) {
      setError(err.message || 'Could not retrieve spreadsheet metadata.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * One-Way Export: App -> Google Sheets
   * Pushes all transactions and stock directory prices to Google Sheet.
   */
  const handlePushAllToSheet = async () => {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      setError('Please select or enter a Google Sheet link / ID first.');
      return;
    }

    setIsExporting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Please sign in with Google to sync app data to your Google Sheet.');
        return;
      }

      const res = await syncAllPortfolioToSheet(
        spreadsheetId,
        positions,
        closedTrades,
        transactions,
        tickers,
        token
      );
      if (res.success) {
        setSuccessMsg(`One-Way Sync Successful! ${res.message}`);
        // Save config in app state
        onImportData([], [], {
          spreadsheetId,
          sheetName: sheetName || 'Transaction Logger',
          range: 'A1:Z500',
          lastSyncTime: new Date().toISOString(),
          connectedEmail: authUser?.email || undefined,
          autoSync: true,
        }, []);
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sync data to Google Sheet.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePushTransactionsToSheet = async () => {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      setError('Please enter your Google Sheet link or ID first.');
      return;
    }

    setIsExporting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Google Sign-In is required to write transactions directly to your Google Sheet.');
        return;
      }

      let count = 0;
      for (const tx of transactions) {
        await appendTransactionToSheet(spreadsheetId, tx, token, 'Transaction Logger');
        count++;
      }

      setSuccessMsg(`Successfully pushed ${count} transactions to "Transaction Logger" tab in your Google Sheet!`);
    } catch (err: any) {
      setError(err.message || 'Failed to push transactions to Google Sheet.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePushPricesToSheet = async () => {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      setError('Please enter your Google Sheet link or ID first.');
      return;
    }

    setIsExporting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Google Sign-In is required to update prices directly in your Google Sheet.');
        return;
      }

      const res = await updateStockDirectoryInSheet(spreadsheetId, tickers, token, 'Ticker Directory');
      if (res.success) {
        setSuccessMsg(res.message);
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update stock prices in Google Sheet.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveConnection = () => {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      setError('Please select or enter a Google Sheet link / ID first.');
      return;
    }

    onImportData([], [], {
      spreadsheetId,
      sheetName: sheetName || 'Transaction Logger',
      range: 'A1:Z500',
      lastSyncTime: new Date().toISOString(),
      connectedEmail: authUser?.email || undefined,
      autoSync: true,
    }, []);

    setSuccessMsg('Google Sheet connection saved! Automatic background sync is active.');
    setTimeout(() => onClose(), 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-6">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Google Sheets Sync
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  One-Way: App → Sheets
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                The app is your primary source of truth. Data flows one-way from the app into your Google Sheet.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* Status Banners */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Notice</p>
                <p className="mt-0.5 text-rose-300/90">{error}</p>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Status</p>
                <p className="mt-0.5 text-emerald-300/90">{successMsg}</p>
              </div>
            </div>
          )}

          {/* Persistent Google Account Connection Card */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold text-base">
                {authUser?.email ? authUser.email.charAt(0).toUpperCase() : <ShieldCheck className="w-5 h-5 text-emerald-400" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-white">
                    {authUser ? (authUser.displayName || authUser.email) : 'Google Account Sync'}
                  </p>
                  {authUser && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                      Persistent Token Active
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {authUser
                    ? `Connected: ${authUser.email} (Stay signed in across sessions)`
                    : 'Sign in with your Google Account to connect your Google Sheets ledger.'}
                </p>
              </div>
            </div>

            {authUser ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={loadDriveSpreadsheets}
                  disabled={loadingDrive}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingDrive ? 'animate-spin' : ''}`} />
                  Refresh Drive
                </button>
                <button
                  onClick={() => logout()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 text-xs font-medium transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                id="google-signin-btn"
                onClick={handleSignIn}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-900 font-semibold text-xs hover:bg-slate-100 transition shadow-md"
              >
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Sign in with Google
              </button>
            )}
          </div>

          {/* Drive Spreadsheets Browser (When signed in) */}
          {authUser && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-emerald-400" />
                  Select Spreadsheet from Google Drive
                </label>
                <span className="text-[11px] text-slate-400">
                  {driveSpreadsheets.length > 0 ? `${driveSpreadsheets.length} spreadsheets found` : loadingDrive ? 'Scanning...' : ''}
                </span>
              </div>

              {driveSpreadsheets.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                  {driveSpreadsheets.map((sp) => {
                    const isSelected = extractSpreadsheetId(sheetUrl) === sp.id;
                    return (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => handleSelectDriveSpreadsheet(sp)}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition ${
                          isSelected
                            ? 'bg-emerald-950/70 border-emerald-500/60 text-white'
                            : 'bg-slate-900 border-slate-800/80 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <FileSpreadsheet className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate">{sp.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">
                            ID: {sp.id.slice(0, 16)}...
                          </p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-2">
                  {loadingDrive ? 'Scanning your Google Drive for spreadsheets...' : 'No spreadsheets found or permission pending. You can paste the spreadsheet URL below.'}
                </p>
              )}
            </div>
          )}

          {/* Form Inputs for Spreadsheet URL */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Google Spreadsheet URL or ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="sheet-url-input"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
                />
                {authUser && (
                  <button
                    onClick={() => handleFetchTabs()}
                    disabled={loading || !sheetUrl}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Load Tabs
                  </button>
                )}
              </div>
            </div>

            {/* Target Tabs Info */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Target Sheet Tabs Layout
                </label>
                <span className="text-[11px] text-slate-400">
                  Strict schema mapping
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <Receipt className="w-4 h-4 text-emerald-400" />
                    Transaction Logger
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Stores all chronological BUY/SELL trade records with exact 14 columns (Trade ID, Date, Action, Ticker, Shares, Price, Net Cash Impact, etc.).
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    Ticker Directory
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Stores live market quotes &amp; stock information with 4 columns (Ticker, Company Name, Sector, Current Price EGP).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Primary One-Way Export Button */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/60 to-slate-950 border border-emerald-500/40 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-emerald-400" />
                  One-Way Sync (App → Google Sheets)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Export your current app portfolio state directly into your Google Sheet.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                {transactions.length} Trades • {tickers.length} Prices
              </span>
            </div>

            {/* Main Sync Button */}
            <button
              id="push-all-one-way-btn"
              onClick={handlePushAllToSheet}
              disabled={isExporting || !sheetUrl}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition transform active:scale-[0.99] disabled:opacity-50"
            >
              <UploadCloud className={`w-4 h-4 ${isExporting ? 'animate-spin' : ''}`} />
              <span>{isExporting ? 'Syncing to Google Sheets...' : '⚡ Sync App to Google Sheets Now (One-Way Export)'}</span>
            </button>

            {/* Sub-Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                id="push-tx-only-btn"
                onClick={handlePushTransactionsToSheet}
                disabled={isExporting || !sheetUrl}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold transition disabled:opacity-50"
              >
                <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                <span>Push Transactions (`Transaction Logger`)</span>
              </button>

              <button
                id="push-prices-only-btn"
                onClick={handlePushPricesToSheet}
                disabled={isExporting || !sheetUrl}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold transition disabled:opacity-50"
              >
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <span>Push Prices (`Ticker Directory`)</span>
              </button>
            </div>
          </div>

          {/* Automatic Background Sync Notice & Save Connection */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-xs text-slate-300">
                <strong className="text-white">Auto Background Sync:</strong> Trades logged in the app or scanned via AI receipts will automatically append to your connected sheet.
              </p>
            </div>
            <button
              onClick={handleSaveConnection}
              disabled={!sheetUrl}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition whitespace-nowrap disabled:opacity-50"
            >
              Save Connection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
