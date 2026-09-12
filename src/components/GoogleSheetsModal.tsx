import React, { useState, useEffect } from 'react';
import { googleSignIn, getAccessToken, logout } from '../services/firebaseAuth';
import { 
  extractSpreadsheetId, 
  fetchSpreadsheetMetadata, 
  fetchSheetValues, 
  parseSheetRows,
  fetchPublicSheetCsv,
  parseCsvText,
  appendTransactionToSheet,
  updateStockDirectoryInSheet,
  syncAllPortfolioToSheet,
  fetchUserSpreadsheets,
  fetchAndReconcileAllTabs,
  GoogleDriveSpreadsheet
} from '../services/googleSheets';
import { Position, ClosedTrade, GoogleSheetsConfig, TradeTransaction, EGXTicker } from '../types';
import { formatDateDDMMYYYY, formatDateVerbose } from '../utils/dateUtils';
import { User } from 'firebase/auth';
import { 
  FileSpreadsheet, 
  X, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  CheckCircle2, 
  Sparkles,
  Layers,
  Link,
  ClipboardPaste,
  FileText,
  TrendingUp,
  Receipt,
  Database,
  CheckCheck,
  FolderOpen,
  ArrowRight,
  Info
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

type SyncMethod = 'oauth' | 'public_link' | 'paste_csv';

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
  const [syncMethod, setSyncMethod] = useState<SyncMethod>(authUser ? 'oauth' : 'oauth');
  const [sheetUrl, setSheetUrl] = useState(
    currentConfig?.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${currentConfig.spreadsheetId}` : ''
  );
  const [sheetName, setSheetName] = useState(currentConfig?.sheetName || 'Transaction logger');
  const [range, setRange] = useState(currentConfig?.range || 'A1:Z500');
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [sheetTitle, setSheetTitle] = useState<string>('');
  const [pastedData, setPastedData] = useState<string>('');
  
  // Google Drive Spreadsheets List
  const [driveSpreadsheets, setDriveSpreadsheets] = useState<GoogleDriveSpreadsheet[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);

  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const [previewResult, setPreviewResult] = useState<{
    positions: Position[];
    closedTrades: ClosedTrade[];
    transactions: TradeTransaction[];
    rawRowsCount: number;
    detectedColumns: string[];
    sheetType?: 'transaction_logger' | 'ticker_directory' | 'generic';
    tickerQuotes?: Record<string, number>;
  } | null>(null);

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
      setSyncMethod('oauth');
      setSuccessMsg(`Signed in as ${user.displayName || user.email}`);

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
    setSuccessMsg(`Selected: "${sp.name}"`);
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

      // Prefer "Transaction logger" tab as source of truth
      const txTab = meta.sheets.find(s => s.toLowerCase().includes('transaction'));
      if (txTab) {
        setSheetName(txTab);
      } else {
        const nonIgnored = meta.sheets.find(s => !s.toLowerCase().includes('portfolio') && !s.toLowerCase().includes('dashboard'));
        if (nonIgnored) {
          setSheetName(nonIgnored);
        } else if (meta.sheets.length > 0) {
          setSheetName(meta.sheets[0]);
        }
      }
      setSuccessMsg(`Spreadsheet "${meta.title}" loaded with ${meta.sheets.length} tabs.`);
    } catch (err: any) {
      setError(err.message || 'Could not retrieve spreadsheet metadata.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Smart Multi-Tab Ingestion:
   * 1. Reads Ticker Directory (quotes)
   * 2. Reads Transaction logger (trade history)
   * 3. Neglects Portfolio dashboard
   * 4. Reconstructs full active holdings & closed trade cycles
   */
  const handleSmartMultiTabSync = async () => {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId && syncMethod !== 'paste_csv') {
      setError('Please select or enter a Google Spreadsheet first.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setPreviewResult(null);

    try {
      const livePriceMap: Record<string, number> = {};
      tickers.forEach((t) => {
        livePriceMap[t.ticker] = t.price;
      });

      const token = await getAccessToken();
      const result = await fetchAndReconcileAllTabs(
        spreadsheetId,
        syncMethod === 'oauth' ? token : null,
        syncMethod === 'public_link' ? sheetUrl : undefined,
        livePriceMap
      );

      setPreviewResult({
        positions: result.positions,
        closedTrades: result.closedTrades,
        transactions: result.transactions,
        rawRowsCount: result.rawRowsCount,
        detectedColumns: result.detectedColumns,
        sheetType: 'transaction_logger',
        tickerQuotes: result.tickerQuotes
      });

      setSuccessMsg(
        `Multi-Tab Ingestion Complete: Synchronized ${result.transactions.length} trade transactions -> Derived ${result.positions.length} active positions and ${result.closedTrades.length} closed trade cycles. (Portfolio dashboard tab was neglected).`
      );
    } catch (err: any) {
      setError(err.message || 'Failed to perform smart multi-tab sync.');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewSheet = async (overrideTabName?: string) => {
    const targetTab = overrideTabName || sheetName;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setPreviewResult(null);

    try {
      let rows: string[][] = [];

      if (syncMethod === 'paste_csv') {
        if (!pastedData.trim()) {
          setError('Please paste your CSV data or spreadsheet rows.');
          setLoading(false);
          return;
        }
        rows = parseCsvText(pastedData);
      } else if (syncMethod === 'public_link') {
        if (!sheetUrl.trim()) {
          setError('Please provide your Google Sheets sharing link.');
          setLoading(false);
          return;
        }
        rows = await fetchPublicSheetCsv(sheetUrl, targetTab || undefined);
      } else {
        // OAuth method
        const spreadsheetId = extractSpreadsheetId(sheetUrl);
        if (!spreadsheetId) {
          setError('Please select or provide a valid Google Spreadsheet.');
          setLoading(false);
          return;
        }

        const token = await getAccessToken();
        if (!token) {
          try {
            rows = await fetchPublicSheetCsv(sheetUrl, targetTab || undefined);
          } catch {
            setError('Please sign in with Google or use the Shareable Link method.');
            setLoading(false);
            return;
          }
        } else {
          const queryRange = targetTab ? `${targetTab}!${range}` : range;
          try {
            rows = await fetchSheetValues(spreadsheetId, queryRange, token);
          } catch {
            rows = await fetchSheetValues(spreadsheetId, `A1:Z500`, token);
          }
        }
      }

      if (!rows || rows.length < 2) {
        setError(`No tabular data detected in tab "${targetTab}". Please ensure header columns and data rows exist.`);
        return;
      }

      const livePriceMap: Record<string, number> = {};
      tickers.forEach((t) => {
        livePriceMap[t.ticker] = t.price;
      });

      const parsed = parseSheetRows(rows, targetTab, livePriceMap);

      if (parsed.sheetType === 'ticker_directory') {
        const quoteCount = Object.keys(parsed.tickerQuotes || {}).length;
        setPreviewResult({
          positions: [],
          closedTrades: [],
          transactions: [],
          rawRowsCount: parsed.rawRowsCount,
          detectedColumns: parsed.detectedColumns,
          sheetType: 'ticker_directory',
          tickerQuotes: parsed.tickerQuotes
        });
        setSuccessMsg(
          `"Ticker Directory" loaded successfully with ${quoteCount} EGX stock quotes. Note: Active holdings and trade records are driven from the "Transaction logger" tab.`
        );
        return;
      }

      if (parsed.positions.length === 0 && parsed.closedTrades.length === 0 && parsed.transactions.length === 0) {
        setError(
          `No trade records found in "${targetTab}". Ensure this tab contains your transaction log with Buy/Sell orders, shares, and prices.`
        );
        return;
      }

      setPreviewResult({
        positions: parsed.positions,
        closedTrades: parsed.closedTrades,
        transactions: parsed.transactions,
        rawRowsCount: parsed.rawRowsCount,
        detectedColumns: parsed.detectedColumns,
        sheetType: 'transaction_logger'
      });

      setSuccessMsg(
        `Parsed ${parsed.transactions.length} transactions from "${targetTab}" -> Reconstructed ${parsed.positions.length} active positions and ${parsed.closedTrades.length} closed cycles.`
      );
    } catch (err: any) {
      setError(err.message || 'Failed to read spreadsheet data. Make sure sheet is accessible.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyImport = () => {
    if (!previewResult) return;

    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    
    // Direct sync to active portfolio
    onImportData(
      previewResult.positions,
      previewResult.closedTrades,
      {
        spreadsheetId: spreadsheetId || 'direct-import',
        sheetName: sheetName || 'Transaction logger',
        range,
        lastSyncTime: new Date().toISOString(),
        connectedEmail: authUser?.email || undefined,
        autoSync: syncMethod === 'oauth',
      },
      previewResult.transactions
    );
    onClose();
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
        await appendTransactionToSheet(spreadsheetId, tx, token, 'Transaction logger');
        count++;
      }

      setSuccessMsg(`Successfully appended ${count} transactions to "Transaction logger" tab in your Google Sheet!`);
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

      const res = await updateStockDirectoryInSheet(spreadsheetId, tickers, token, 'ticker directory');
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

  const handlePushAllToSheet = async () => {
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
        setError('Google Sign-In is required for full 2-way sync with your Google Sheet.');
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
        setSuccessMsg(res.message);
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed full sync to Google Sheet.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl my-6">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Google Sheets Integration &amp; Multi-Tab Sync
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                  Direct Account Sync
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Driven strictly from your Transaction Logger, with real-time stock prices from Ticker Directory.
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

        {/* Content Body */}
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

          {/* Sync Method Selector */}
          <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-slate-950 border border-slate-800">
            <button
              onClick={() => setSyncMethod('oauth')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition ${
                syncMethod === 'oauth'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Google Account (Drive &amp; Sheets)
            </button>
            <button
              onClick={() => setSyncMethod('public_link')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition ${
                syncMethod === 'public_link'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Link className="w-3.5 h-3.5" />
              Spreadsheet Link
            </button>
            <button
              onClick={() => setSyncMethod('paste_csv')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition ${
                syncMethod === 'paste_csv'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              Paste Raw CSV / Text
            </button>
          </div>

          {/* Account Connection Status Bar */}
          {syncMethod === 'oauth' && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold text-sm">
                  {authUser?.email ? authUser.email.charAt(0).toUpperCase() : 'G'}
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">
                    {authUser ? (authUser.displayName || authUser.email) : 'Google Account Connection'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {authUser ? authUser.email : 'Sign in to browse all your Google Drive spreadsheets and enable 2-way sync.'}
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
                    Refresh Sheets
                  </button>
                  <button
                    onClick={() => logout()}
                    className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 text-xs font-medium transition"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  id="google-signin-btn"
                  onClick={handleSignIn}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-slate-900 font-semibold text-xs hover:bg-slate-100 transition shadow"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Sign in with Google
                </button>
              )}
            </div>
          )}

          {/* Drive Spreadsheets Browser (When signed in) */}
          {syncMethod === 'oauth' && authUser && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-emerald-400" />
                  Select Spreadsheet from your Google Drive
                </label>
                <span className="text-[11px] text-slate-400">
                  {driveSpreadsheets.length > 0 ? `${driveSpreadsheets.length} spreadsheets found` : 'Loading...'}
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
                  {loadingDrive ? 'Scanning Google Drive for spreadsheets...' : 'No spreadsheets found in Drive or list permission restricted. You can paste the link below.'}
                </p>
              )}
            </div>
          )}

          {/* Form Inputs for Spreadsheet URL & Tabs */}
          {syncMethod !== 'paste_csv' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Spreadsheet URL or ID
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

              {/* Tab Selector with Archetype Badges */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    Available Sheet Tabs ({availableSheets.length > 0 ? availableSheets.length : 'Preset'})
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Source of truth: <strong className="text-emerald-300">Transaction logger</strong>
                  </span>
                </div>

                {/* Tab Archetype Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Transaction Logger */}
                  <div
                    onClick={() => {
                      setSheetName('Transaction logger');
                      handlePreviewSheet('Transaction logger');
                    }}
                    className={`cursor-pointer p-3 rounded-xl border text-left transition ${
                      sheetName.toLowerCase().includes('transaction')
                        ? 'bg-emerald-950/80 border-emerald-500/60 shadow-md'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Receipt className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-white">Transaction logger</span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase">
                        Primary Data
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Contains 38 BUY/SELL executions. Open positions are automatically calculated here.
                    </p>
                  </div>

                  {/* Ticker Directory */}
                  <div
                    onClick={() => {
                      setSheetName('ticker directory');
                      handlePreviewSheet('ticker directory');
                    }}
                    className={`cursor-pointer p-3 rounded-xl border text-left transition ${
                      sheetName.toLowerCase().includes('ticker') || sheetName.toLowerCase().includes('directory')
                        ? 'bg-amber-950/60 border-amber-500/60 shadow-md'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-white">Ticker Directory</span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold uppercase">
                        Prices Only
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Strictly reference prices &amp; market quotes. Has no shares/trades.
                    </p>
                  </div>

                  {/* Portfolio Dashboard (Neglected) */}
                  <div
                    className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-left opacity-75"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-bold text-slate-400">Portfolio dashboard</span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-bold uppercase">
                        Ignored Tab
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Neglected by design. Our app recomputes active holdings directly from transaction lots.
                    </p>
                  </div>
                </div>

                {/* Dropdown if other custom sheet tabs exist */}
                {availableSheets.length > 0 && (
                  <div className="pt-2">
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Or select specific sheet tab from "{sheetTitle || 'Spreadsheet'}":
                    </label>
                    <select
                      value={sheetName}
                      onChange={(e) => {
                        setSheetName(e.target.value);
                        handlePreviewSheet(e.target.value);
                      }}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      {availableSheets.map((s) => (
                        <option key={s} value={s}>
                          {s} {s.toLowerCase().includes('transaction') ? '⭐ (Recommended Trade Ledger)' : s.toLowerCase().includes('ticker') ? '📊 (Stock Quotes)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Paste CSV or Tabular Stock Rows
              </label>
              <textarea
                value={pastedData}
                onChange={(e) => setPastedData(e.target.value)}
                rows={6}
                placeholder="Trade ID, Date, Action, Ticker, Company Name, Sector, Shares, Price / share, Brokerage Fee, Notes&#10;1, 2026-06-15, BUY, UEGC, Elsewedy Electric, Industrials, 1200, 48.50, 45.00, Swing buy&#10;2, 2026-06-20, BUY, ZMID, Zahraa Maadi, Real Estate, 3000, 14.20, 30.00, Breakout"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* Action Row: Smart Auto-Sync Button */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              id="smart-sync-btn"
              onClick={handleSmartMultiTabSync}
              disabled={loading}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition disabled:opacity-50 shadow-lg shadow-emerald-600/20"
            >
              <Sparkles className={`w-4 h-4 ${loading ? 'animate-spin' : 'text-emerald-200'}`} />
              {loading ? 'Processing Multi-Tab Sync...' : '⚡ Smart Auto-Sync (Logger + Directory Quotes)'}
            </button>

            <button
              id="preview-sheet-btn"
              onClick={() => handlePreviewSheet()}
              disabled={loading}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Preview Selected Tab ("{sheetName}")
            </button>
          </div>

          {/* Preview Results Display */}
          {previewResult && (
            <div className="space-y-4 p-4 rounded-xl bg-slate-950 border border-emerald-500/30">
              {/* Header Info */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCheck className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="text-xs font-bold text-white">
                      {previewResult.sheetType === 'ticker_directory' 
                        ? 'Ticker Directory Reference Prices' 
                        : 'Reconstructed Portfolio & Transactions'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {previewResult.sheetType === 'ticker_directory'
                        ? 'Reference quotes for EGX equities. Open positions are derived from the Transaction logger.'
                        : 'Accurately derived from chronological BUY/SELL trade lots with weighted average cost basis.'}
                    </p>
                  </div>
                </div>

                {previewResult.sheetType !== 'ticker_directory' ? (
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                      {previewResult.transactions.length} Transactions
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-teal-950/80 border border-teal-500/40 text-teal-300 text-xs font-bold">
                      {previewResult.positions.length} Active Positions
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-bold">
                      {previewResult.closedTrades.length} Closed Cycles
                    </span>
                  </div>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-500/40 text-amber-300 text-xs font-bold">
                    {Object.keys(previewResult.tickerQuotes || {}).length} Tickers with Quotes
                  </span>
                )}
              </div>

              {/* Ticker Directory View */}
              {previewResult.sheetType === 'ticker_directory' && previewResult.tickerQuotes && (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        Ticker Directory loaded {Object.keys(previewResult.tickerQuotes).length} reference prices. Click below to load your trade history from <strong>Transaction logger</strong>.
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setSheetName('Transaction logger');
                        handlePreviewSheet('Transaction logger');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition"
                    >
                      Load Transaction logger
                    </button>
                  </div>

                  <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-400 sticky top-0">
                        <tr>
                          <th className="p-2">Ticker Symbol</th>
                          <th className="p-2">Reference Market Price (EGP)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-950">
                        {Object.entries(previewResult.tickerQuotes).slice(0, 10).map(([ticker, price], idx) => (
                          <tr key={idx} className="hover:bg-slate-900/50">
                            <td className="p-2 font-bold text-amber-300">{ticker}</td>
                            <td className="p-2 text-slate-200 font-semibold">{Number(price).toFixed(2)} EGP</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Active Holdings Table Preview */}
              {previewResult.positions.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold text-teal-300 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                    <span>Reconstructed Active Holdings ({previewResult.positions.length})</span>
                    <span className="text-[10px] text-slate-400 normal-case font-normal">
                      Calculated from remaining unclosed shares
                    </span>
                  </h4>
                  <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-400 sticky top-0">
                        <tr>
                          <th className="p-2">Ticker</th>
                          <th className="p-2">Company</th>
                          <th className="p-2">Shares</th>
                          <th className="p-2">Avg Buy Price</th>
                          <th className="p-2">Current Price</th>
                          <th className="p-2">Sector</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-950">
                        {previewResult.positions.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/50">
                            <td className="p-2 font-bold text-emerald-400">{p.ticker}</td>
                            <td className="p-2 text-slate-300 truncate max-w-[140px]">{p.companyName}</td>
                            <td className="p-2 text-slate-200 font-semibold">{p.shares.toLocaleString()}</td>
                            <td className="p-2 text-slate-200">{p.avgBuyPrice.toFixed(2)} EGP</td>
                            <td className="p-2 text-emerald-300 font-semibold">{p.currentPrice.toFixed(2)} EGP</td>
                            <td className="p-2 text-slate-400">{p.sector}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Transactions Preview */}
              {previewResult.transactions.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold text-emerald-300 mb-1.5 uppercase tracking-wider">
                    Chronological Transactions ({previewResult.transactions.length})
                  </h4>
                  <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-400 sticky top-0">
                        <tr>
                          <th className="p-2">Date</th>
                          <th className="p-2">Type</th>
                          <th className="p-2">Ticker</th>
                          <th className="p-2">Shares</th>
                          <th className="p-2">Price</th>
                          <th className="p-2">Total (EGP)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-950">
                        {previewResult.transactions.slice(0, 8).map((tx, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/50">
                            <td className="p-2 text-slate-300 font-mono text-[11px]" title={`Parsed as: ${formatDateVerbose(tx.date, true)}`}>
                              {formatDateDDMMYYYY(tx.date)}
                            </td>
                            <td className="p-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                tx.type === 'BUY' ? 'bg-teal-500/20 text-teal-300' : 'bg-rose-500/20 text-rose-300'
                              }`}>
                                {tx.type}
                              </span>
                            </td>
                            <td className="p-2 font-bold text-white">{tx.ticker}</td>
                            <td className="p-2 text-slate-300">{tx.shares.toLocaleString()}</td>
                            <td className="p-2 text-slate-300">{tx.price.toFixed(2)}</td>
                            <td className="p-2 text-slate-200 font-semibold">{tx.totalAmount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {previewResult.transactions.length > 8 && (
                    <p className="text-[10px] text-slate-500 mt-1 text-right">
                      + {previewResult.transactions.length - 8} additional transactions ready to apply
                    </p>
                  )}
                </div>
              )}

              {/* Direct Apply Button */}
              {previewResult.transactions.length > 0 && (
                <button
                  id="apply-sheet-import-btn"
                  onClick={handleApplyImport}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition transform active:scale-[0.99]"
                >
                  <Check className="w-4 h-4" />
                  Apply &amp; Sync to Active Portfolio ({previewResult.positions.length} Active Positions, {previewResult.closedTrades.length} Closed Cycles, {previewResult.transactions.length} Transactions)
                </button>
              )}
            </div>
          )}

          {/* 2-Way Sync & Push Controls (When Connected via OAuth) */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                2-Way Google Sheet Push Controls
              </h3>
              <span className="text-[11px] text-slate-400">
                Write app state back to Google Sheet
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                id="push-prices-to-sheet-btn"
                onClick={handlePushPricesToSheet}
                disabled={isExporting}
                className="flex items-center justify-center gap-1.5 p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition disabled:opacity-50"
                title="Updates the ticker directory tab with live EGX prices"
              >
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <span>Sync Prices (`ticker directory`)</span>
              </button>

              <button
                id="push-tx-to-sheet-btn"
                onClick={handlePushTransactionsToSheet}
                disabled={isExporting}
                className="flex items-center justify-center gap-1.5 p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition disabled:opacity-50"
                title="Appends transactions to Transaction logger tab"
              >
                <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sync Transactions (`Transaction logger`)</span>
              </button>

              <button
                id="push-all-to-sheet-btn"
                onClick={handlePushAllToSheet}
                disabled={isExporting}
                className="flex items-center justify-center gap-1.5 p-2.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Full 2-Way Sync All</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
