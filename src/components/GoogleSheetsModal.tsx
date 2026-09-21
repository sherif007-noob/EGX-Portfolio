import React, { useState, useEffect } from 'react';
import { googleSignIn, getAccessToken, logout } from '../services/firebaseAuth';
import { 
  extractSpreadsheetId, 
  fetchSpreadsheetMetadata, 
  appendTransactionToSheet,
  updateStockDirectoryInSheet,
  syncActivePositionsToSheet,
  syncStockPricesToSheet,
  syncAllPortfolioToSheet,
  fetchUserSpreadsheets,
  fetchAndReconcileAllTabs,
  fetchServiceAccountStatus,
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
  LogOut,
  UploadCloud,
  DownloadCloud,
  ShieldCheck,
  Layers,
  Wrench,
  Zap,
  KeyRound,
  Copy,
  Info
} from 'lucide-react';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveConfig: (config: GoogleSheetsConfig) => void;
  onImportData: (
    positions: Position[],
    closedTrades: ClosedTrade[],
    config: GoogleSheetsConfig,
    transactions?: TradeTransaction[]
  ) => void;
  currentConfig?: GoogleSheetsConfig;
  authUser: User | null;
  onAuthSuccess: (user: User) => void;
  onLogout?: () => void;
  positions?: Position[];
  closedTrades?: ClosedTrade[];
  transactions?: TradeTransaction[];
  tickers?: EGXTicker[];
  onReconcileFromLedger?: () => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  onSaveConfig,
  onImportData,
  currentConfig,
  authUser,
  onAuthSuccess,
  onLogout,
  positions = [],
  closedTrades = [],
  transactions = [],
  tickers = [],
  onReconcileFromLedger,
}) => {
  const [sheetUrl, setSheetUrl] = useState(
    currentConfig?.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${currentConfig.spreadsheetId}` : ''
  );
  const [sheetName, setSheetName] = useState(currentConfig?.sheetName || 'Transaction Logger');
  const [autoSync, setAutoSync] = useState<boolean>(
    currentConfig?.autoSync !== undefined ? currentConfig.autoSync : true
  );
  
  // Google Drive Spreadsheets List
  const [driveSpreadsheets, setDriveSpreadsheets] = useState<GoogleDriveSpreadsheet[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);

  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Service Account Status
  const [serviceAccountStatus, setServiceAccountStatus] = useState<{
    configured: boolean;
    clientEmail?: string;
  }>({ configured: false });

  // Sync autoSync state if currentConfig changes
  useEffect(() => {
    if (currentConfig?.autoSync !== undefined) {
      setAutoSync(currentConfig.autoSync);
    }
  }, [currentConfig]);

  // Check Service Account status and load sheets
  useEffect(() => {
    if (isOpen) {
      fetchServiceAccountStatus().then((status) => {
        setServiceAccountStatus(status);
      });
      if (authUser) {
        loadDriveSpreadsheets();
      }
    }
  }, [isOpen, authUser]);

  // If we already have a spreadsheetId, load its tabs automatically
  useEffect(() => {
    if (isOpen && (sheetUrl || currentConfig?.spreadsheetId)) {
      const spId = extractSpreadsheetId(sheetUrl || currentConfig?.spreadsheetId || '');
      if (spId) {
        handleFetchTabs(spId);
      }
    }
  }, [isOpen]);

  const loadDriveSpreadsheets = async (showFeedback = false) => {
    setLoadingDrive(true);
    if (showFeedback) {
      setError(null);
    }
    try {
      let token = await getAccessToken();
      if (!token && !serviceAccountStatus.configured) {
        // Attempt fresh sign-in if token is missing and no service account
        const authResult = await googleSignIn();
        if (authResult?.accessToken) {
          token = authResult.accessToken;
          onAuthSuccess(authResult.user);
        }
      }
      const files = await fetchUserSpreadsheets(token);
      setDriveSpreadsheets(files || []);
      if (showFeedback) {
        setSuccessMsg(`Refreshed Google Drive: found ${files.length} spreadsheet${files.length === 1 ? '' : 's'}.`);
      }
    } catch (err: any) {
      console.warn('Could not list drive spreadsheets:', err);
      if (showFeedback) {
        setError(err.message || 'Could not fetch spreadsheets from Google Drive.');
      }
    } finally {
      setLoadingDrive(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    setError(null);
    try {
      if (onLogout) {
        await onLogout();
      } else {
        await logout();
      }
      setDriveSpreadsheets([]);
      setSuccessMsg('Successfully signed out of Google Account.');
    } catch (err: any) {
      console.error('Sign out error:', err);
      setError(err.message || 'Failed to sign out.');
    } finally {
      setLoading(false);
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

      if (accessToken) {
        const files = await fetchUserSpreadsheets(accessToken);
        setDriveSpreadsheets(files || []);
      }

      const spreadsheetId = extractSpreadsheetId(sheetUrl);
      if (spreadsheetId) {
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
      const meta = await fetchSpreadsheetMetadata(spreadsheetId, token);
      const txTab = (meta.sheets || []).find((s) => s.toLowerCase().includes('transaction'));
      if (txTab) {
        setSheetName(txTab);
      }
      setSuccessMsg(`Spreadsheet "${meta.title}" detected with ${(meta.sheets || []).length} tabs.`);
    } catch (err: any) {
      setError(err.message || 'Could not retrieve spreadsheet metadata.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyServiceEmail = () => {
    if (serviceAccountStatus.clientEmail) {
      navigator.clipboard.writeText(serviceAccountStatus.clientEmail);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  /**
   * Save Connection ONLY: Does NOT touch or clear portfolio data.
   */
  const handleSaveConnection = () => {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      setError('Please select or enter a Google Sheet link / ID first.');
      return;
    }

    const config: GoogleSheetsConfig = {
      spreadsheetId,
      sheetName: sheetName || 'Transaction Logger',
      range: 'A1:Z500',
      lastSyncTime: new Date().toISOString(),
      connectedEmail: authUser?.email || serviceAccountStatus.clientEmail || undefined,
      autoSync,
    };

    onSaveConfig(config);
    setSuccessMsg(`Google Sheet connection saved! Auto Background Sync is ${autoSync ? 'ON' : 'OFF'}. Portfolio data remains intact.`);
    setTimeout(() => onClose(), 1200);
  };

  /**
   * Import Data: Reads sheet ledger ("Transaction Logger") and reconstructs app state.
   */
  const handleImportDataFromSheet = async () => {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      setError('Please select or enter a Google Sheet link / ID first.');
      return;
    }

    setIsImporting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const token = await getAccessToken();

      // Read spreadsheet tabs & parse transaction ledger via server proxy
      const result = await fetchAndReconcileAllTabs(spreadsheetId, token);
      const importedTxs = result.transactions || [];

      if (importedTxs.length === 0) {
        setError('No transaction rows found in "Transaction Logger" tab of the connected Google Sheet.');
        return;
      }

      const config: GoogleSheetsConfig = {
        spreadsheetId,
        sheetName: result.sheetTitle || 'Transaction Logger',
        range: 'A1:Z500',
        lastSyncTime: new Date().toISOString(),
        connectedEmail: authUser?.email || serviceAccountStatus.clientEmail || undefined,
        autoSync,
      };

      onImportData(
        result.positions || [],
        result.closedTrades || [],
        config,
        importedTxs
      );

      setSuccessMsg(
        `Successfully imported ${importedTxs.length} transactions from "${result.sheetTitle}". Portfolio positions & metrics reconstructed!`
      );
    } catch (err: any) {
      setError(err.message || 'Failed to import data from Google Sheet.');
    } finally {
      setIsImporting(false);
    }
  };

  /**
   * One-Way Export: App -> Google Sheets
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
        onSaveConfig({
          spreadsheetId,
          sheetName: sheetName || 'Transaction Logger',
          range: 'A1:Z500',
          lastSyncTime: new Date().toISOString(),
          connectedEmail: authUser?.email || serviceAccountStatus.clientEmail || undefined,
          autoSync,
        });
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

      const res = await syncStockPricesToSheet(spreadsheetId, tickers, positions, token);
      if (res.success) {
        setSuccessMsg(`Successfully synced live market prices! ${res.message}`);
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update stock prices in Google Sheet.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="premium-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="premium-modal rounded-2xl w-full max-w-3xl overflow-hidden my-6">
        {/* Header */}
        <div className="premium-modal-section flex items-center justify-between p-5 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Google Sheets Sync
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${
                  autoSync 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                    : 'premium-chip text-slate-400'
                }`}>
                  Auto Sync: {autoSync ? 'ON (Default)' : 'OFF'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Connect your Google Sheet ledger. Server-side proxy guarantees zero hourly token expiry.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="premium-icon-action p-1.5 rounded-lg"
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

          {/* Server-Side Service Account Status Card */}
          {serviceAccountStatus.configured ? (
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-white">Google Cloud Service Account Active</p>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                      24/7 Persistent Sync
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-200/80 mt-0.5">
                    Server uses its own credentials. No hourly browser token expiry! Share your sheet with:
                  </p>
                  <p className="text-[11px] font-mono text-emerald-300 mt-0.5 break-all">
                    {serviceAccountStatus.clientEmail}
                  </p>
                </div>
              </div>
              {serviceAccountStatus.clientEmail && (
                <button
                  type="button"
                  onClick={handleCopyServiceEmail}
                  className="premium-action premium-action-success flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0"
                >
                  {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedEmail ? 'Copied!' : 'Copy Email'}
                </button>
              )}
            </div>
          ) : (
            <div className="premium-modal-section p-3.5 rounded-xl text-slate-300 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div className="text-[11px] space-y-1">
                <p className="font-semibold text-slate-200">
                  Zero Hourly Expiry Tip: Service Account Setup
                </p>
                <p className="text-slate-400">
                  To eliminate OAuth token renewal entirely, set <code className="text-cyan-300">GOOGLE_SERVICE_ACCOUNT_KEY</code> in your Environment Settings and share your sheet with the service account email as Editor. The server handles all synchronization automatically.
                </p>
              </div>
            </div>
          )}

          {/* Persistent Google Account Connection Card */}
          <div className="premium-modal-section p-4 rounded-xl flex items-center justify-between">
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
                      Connected
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {authUser
                    ? `Connected: ${authUser.email}`
                    : 'Sign in with your Google Account to connect your personal Google Sheets & Drive.'}
                </p>
              </div>
            </div>

            {authUser ? (
              <div className="flex items-center gap-2">
                <button
                  id="sheets-refresh-drive-btn"
                  onClick={() => loadDriveSpreadsheets(true)}
                  disabled={loadingDrive}
                  className="premium-action flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                  title="Refresh spreadsheets from your Google Drive"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingDrive ? 'animate-spin text-emerald-400' : 'text-slate-300'}`} />
                  {loadingDrive ? 'Refreshing...' : 'Refresh'}
                </button>
                <button
                  id="sheets-signout-btn"
                  onClick={handleSignOut}
                  disabled={loading}
                  className="premium-action premium-action-danger flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                  title="Sign out from Google Account"
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
                className="premium-action premium-action-primary flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs"
              >
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Sign in with Google
              </button>
            )}
          </div>

          {/* Drive Spreadsheets Browser (When signed in) */}
          {authUser && (
            <div className="premium-modal-section p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-emerald-400" />
                  Select Spreadsheet from Google Drive
                </label>
                <span className="text-[11px] text-slate-400">
                  {(driveSpreadsheets || []).length > 0 ? `${(driveSpreadsheets || []).length} spreadsheets found` : loadingDrive ? 'Scanning...' : ''}
                </span>
              </div>

              {(driveSpreadsheets || []).length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                  {(driveSpreadsheets || []).map((sp) => {
                    const isSelected = extractSpreadsheetId(sheetUrl) === sp.id;
                    return (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => handleSelectDriveSpreadsheet(sp)}
                        className={`premium-filter-pill flex items-start gap-2.5 p-2.5 rounded-xl text-left ${isSelected ? 'premium-filter-active-emerald' : ''}`}
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
                  className="premium-field flex-1 px-3.5 py-2.5 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none font-mono text-[11px]"
                />
                <button
                  onClick={() => handleFetchTabs()}
                  disabled={loading || !sheetUrl}
                  className="premium-action px-3.5 py-2 rounded-xl text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Inspect Tabs
                </button>
              </div>
            </div>

            {/* Auto Background Sync Toggle Switch */}
            <div className="premium-modal-section p-4 rounded-xl flex items-center justify-between">
              <div className="space-y-0.5 pr-4">
                <div className="flex items-center gap-2">
                  <Zap className={`w-4 h-4 ${autoSync ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span className="text-xs font-bold text-white">Auto Background Sync</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    autoSync ? 'bg-emerald-500/20 text-emerald-300' : 'premium-chip text-slate-400'
                  }`}>
                    {autoSync ? 'ON (Default)' : 'OFF'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Automatically append new transactions and update stock prices in your Google Sheet whenever trades or live prices update.
                </p>
              </div>

              {/* Toggle switch button */}
              <button
                type="button"
                id="auto-sync-toggle"
                onClick={() => setAutoSync(!autoSync)}
                className={`premium-filter-pill relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full p-0.5 focus:outline-none ${autoSync ? 'premium-filter-active-emerald' : ''}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-100 shadow-lg ring-0 transition duration-200 ease-in-out ${autoSync ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>

            {/* Target Tabs Info */}
            <div className="premium-modal-section p-4 rounded-xl space-y-3">
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
                <div className="premium-inset-glass p-3 rounded-xl">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <Receipt className="w-4 h-4 text-emerald-400" />
                    Transaction Logger
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Stores all chronological BUY/SELL trade records with exact 14 columns (Trade ID, Date, Action, Ticker, Shares, Price, Net Cash Impact, etc.).
                  </p>
                </div>

                <div className="premium-inset-glass p-3 rounded-xl">
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

          {/* Primary Action Buttons Section */}
          <div className="space-y-3">
            {/* 1. Save Connection Button (Preserves App State) */}
            <div className="premium-modal-section p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Save Connection Settings
                </h4>
                <p className="text-[11px] text-slate-400">
                  Saves your Google Sheet link &amp; auto sync settings. <strong className="text-slate-300">Does not wipe or touch portfolio data.</strong>
                </p>
              </div>
              <button
                id="save-connection-btn"
                onClick={handleSaveConnection}
                disabled={!sheetUrl}
                className="premium-action premium-action-success premium-shimmer-border w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap disabled:opacity-50"
              >
                Save Connection
              </button>
            </div>

            {/* 2. Import Data from Google Sheet Button */}
            <div className="premium-modal-section p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <DownloadCloud className="w-4 h-4 text-indigo-400" />
                  Import Data from Google Sheet
                </h4>
                <p className="text-[11px] text-slate-400">
                  Reads <code className="text-indigo-300">Transaction Logger</code> from your sheet and reconstructs active positions, closed trades, and metrics.
                </p>
              </div>
              <button
                id="import-sheet-data-btn"
                onClick={handleImportDataFromSheet}
                disabled={isImporting || !sheetUrl}
                className="premium-action premium-action-purple w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap disabled:opacity-50"
              >
                <DownloadCloud className={`w-4 h-4 ${isImporting ? 'animate-spin' : ''}`} />
                <span>{isImporting ? 'Importing Ledger...' : 'Import Data from Sheet'}</span>
              </button>
            </div>

            {/* 3. Export to Google Sheet Section */}
            <div className="premium-modal-section p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <UploadCloud className="w-4 h-4 text-emerald-400" />
                    Export App to Google Sheet (One-Way)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Pushes current app transactions to <code className="text-emerald-300">Transaction Logger</code> and live prices to <code className="text-amber-300">Ticker Directory</code>.
                  </p>
                </div>
                <span className="premium-chip text-[10px] px-2 py-0.5 rounded-lg text-slate-300 font-semibold">
                  {(transactions || []).length} Txs • {(tickers || []).length} Prices
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  id="push-all-one-way-btn"
                  onClick={handlePushAllToSheet}
                  disabled={isExporting || !sheetUrl}
                  className="premium-action premium-action-success py-2.5 px-3 rounded-lg text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <UploadCloud className={`w-3.5 h-3.5 ${isExporting ? 'animate-spin' : ''}`} />
                  Export All
                </button>

                <button
                  id="push-tx-only-btn"
                  onClick={handlePushTransactionsToSheet}
                  disabled={isExporting || !sheetUrl}
                  className="premium-action py-2.5 px-3 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                  Push Txs Only
                </button>

                <button
                  id="push-prices-only-btn"
                  onClick={handlePushPricesToSheet}
                  disabled={isExporting || !sheetUrl}
                  className="premium-action py-2.5 px-3 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                  Push Prices Only
                </button>
              </div>
            </div>

            {/* 4. Utility: Rebuild Portfolio from Local App Ledger */}
            {onReconcileFromLedger && (transactions || []).length > 0 && (
              <div className="premium-modal-section p-3.5 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Wrench className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    Have missing open positions? <strong className="text-slate-300">Rebuild state</strong> from your local {(transactions || []).length} trade records.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onReconcileFromLedger}
                  className="premium-action premium-filter-active-cyan px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
                >
                  Rebuild Portfolio
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
