import React, { useState } from 'react';
import { googleSignIn, getAccessToken, logout } from '../services/firebaseAuth';
import { 
  extractSpreadsheetId, 
  fetchSpreadsheetMetadata, 
  fetchSheetValues, 
  parseSheetRows,
  generateSampleCsv,
  fetchPublicSheetCsv,
  parseCsvText,
  appendTransactionToSheet,
  updateStockDirectoryInSheet,
  syncAllPortfolioToSheet
} from '../services/googleSheets';
import { Position, ClosedTrade, GoogleSheetsConfig, TradeTransaction, EGXTicker } from '../types';
import { User } from 'firebase/auth';
import { 
  FileSpreadsheet, 
  X, 
  Check, 
  AlertCircle, 
  Download, 
  ExternalLink, 
  RefreshCw, 
  CheckCircle2, 
  Sparkles,
  Layers,
  ArrowRight,
  Link,
  ClipboardPaste,
  FileText,
  UploadCloud,
  TrendingUp,
  Receipt
} from 'lucide-react';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportData: (positions: Position[], closedTrades: ClosedTrade[], config: GoogleSheetsConfig) => void;
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
  const [syncMethod, setSyncMethod] = useState<SyncMethod>(authUser ? 'oauth' : 'public_link');
  const [sheetUrl, setSheetUrl] = useState(
    currentConfig?.spreadsheetId || ''
  );
  const [sheetName, setSheetName] = useState(currentConfig?.sheetName || 'Sheet1');
  const [range, setRange] = useState(currentConfig?.range || 'A1:Z200');
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [sheetTitle, setSheetTitle] = useState<string>('');
  const [pastedData, setPastedData] = useState<string>('');
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
  } | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const result = await googleSignIn();
      if (result) {
        onAuthSuccess(result.user);
        setSyncMethod('oauth');
        setSuccessMsg(`Signed in successfully as ${result.user.email}`);
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      setError(
        err.message || 
        'Google Sign-In failed. If you see "request is malformed", please switch to the "Shareable Link" or "Paste Spreadsheet Data" tab below.'
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleFetchMetadata = async () => {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      setError('Please provide a valid Google Spreadsheet URL or ID.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Authentication required to inspect private sheet structure. Sign in with Google or use the "Shareable Link" option.');
        return;
      }

      const meta = await fetchSpreadsheetMetadata(spreadsheetId, token);
      setSheetTitle(meta.title);
      setAvailableSheets(meta.sheets);
      if (meta.sheets.length > 0 && !meta.sheets.includes(sheetName)) {
        setSheetName(meta.sheets[0]);
      }
      setSuccessMsg(`Found sheet "${meta.title}" with tabs: ${meta.sheets.join(', ')}`);
    } catch (err: any) {
      setError(err.message || 'Failed to inspect Google Sheet. If this sheet is public, use the Shareable Link tab.');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewAndParse = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      let rows: string[][] = [];

      if (syncMethod === 'paste_csv') {
        if (!pastedData.trim()) {
          setError('Please paste your spreadsheet or CSV text first.');
          setLoading(false);
          return;
        }
        // Handle TSV (copied from Google Sheets) or CSV
        if (pastedData.includes('\t')) {
          rows = pastedData.split(/\r?\n/).map(line => line.split('\t').map(c => c.trim()));
        } else {
          rows = parseCsvText(pastedData);
        }
      } else if (syncMethod === 'public_link') {
        const spreadsheetId = extractSpreadsheetId(sheetUrl);
        if (!spreadsheetId) {
          setError('Please enter your Google Sheet link or ID.');
          setLoading(false);
          return;
        }
        rows = await fetchPublicSheetCsv(sheetUrl, sheetName || undefined);
        setSheetTitle('Imported from Shareable Link');
      } else {
        // OAuth method
        const spreadsheetId = extractSpreadsheetId(sheetUrl);
        if (!spreadsheetId) {
          setError('Please provide a valid Google Spreadsheet URL or ID.');
          setLoading(false);
          return;
        }

        const token = await getAccessToken();
        if (!token) {
          // Fallback to public fetch if no token
          try {
            rows = await fetchPublicSheetCsv(sheetUrl, sheetName || undefined);
          } catch {
            setError('Please sign in with Google or switch to the Shareable Link tab.');
            setLoading(false);
            return;
          }
        } else {
          const queryRange = sheetName ? `${sheetName}!${range}` : range;
          try {
            rows = await fetchSheetValues(spreadsheetId, queryRange, token);
          } catch {
            // If named range failed, try first sheet fallback
            rows = await fetchSheetValues(spreadsheetId, `A1:Z200`, token);
          }
        }
      }

      if (!rows || rows.length < 2) {
        setError('No tabular data detected. Please ensure your sheet has header columns and rows.');
        return;
      }

      const parsed = parseSheetRows(rows);
      if (parsed.positions.length === 0 && parsed.closedTrades.length === 0 && parsed.transactions.length === 0) {
        setError(
          `Could not detect valid stock rows in "${sheetName || 'Sheet'}". Ensure columns include stock ticker (e.g. COMI, ESRS), shares, and price.`
        );
        return;
      }

      setPreviewResult({
        positions: parsed.positions,
        closedTrades: parsed.closedTrades,
        transactions: parsed.transactions,
        rawRowsCount: parsed.rawRowsCount,
        detectedColumns: parsed.detectedColumns,
      });
      setSuccessMsg(`Successfully parsed ${parsed.positions.length} active positions and ${parsed.closedTrades.length} closed trades.`);
    } catch (err: any) {
      setError(err.message || 'Failed to read spreadsheet data. Make sure link is set to "Anyone with the link can view/edit".');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyImport = () => {
    if (!previewResult) return;

    const confirmed = window.confirm(
      `Synchronize ${previewResult.positions.length} active positions and ${previewResult.closedTrades.length} closed trades into your portfolio?`
    );
    if (!confirmed) return;

    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    onImportData(previewResult.positions, previewResult.closedTrades, {
      spreadsheetId: spreadsheetId || 'direct-import',
      sheetName: sheetName || 'Sheet1',
      range,
      lastSyncTime: new Date().toISOString(),
      connectedEmail: authUser?.email || undefined,
      autoSync: syncMethod === 'oauth',
    });
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

      // Sync all transactions to "Transaction Logger"
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

      const res = await updateStockDirectoryInSheet(spreadsheetId, tickers, token, 'Stock Directory');
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

  const handleLoadSampleTemplate = () => {
    const sampleRows = [
      ['Ticker', 'Company Name', 'Sector', 'Shares', 'Buy Price', 'Current Price', 'Buy Date', 'Target Price', 'Stop Loss', 'Cycle Stage', 'Status', 'Sell Price', 'Notes'],
      ['COMI', 'Commercial International Bank (CIB)', 'Banking', '2500', '76.40', '88.50', '2026-06-15', '98.00', '83.50', 'Stage 1 - Accumulation Base', 'Open', '', 'Core banking allocation'],
      ['ESRS', 'Ezz Steel', 'Basic Resources & Steel', '1800', '98.50', '118.20', '2026-07-20', '135.00', '109.00', 'Stage 2 - Markup (Bullish Trend)', 'Open', '', 'Export revenue momentum'],
      ['SWDY', 'Elsewedy Electric', 'Industrial Goods & Services', '3200', '48.00', '54.20', '2026-08-05', '62.00', '49.50', 'Stage 2 - Markup (Bullish Trend)', 'Open', '', 'Heavy cable backlog'],
      ['ABUK', 'Abu Qir Fertilizers', 'Petrochemicals & Fertilizers', '2000', '74.20', '72.80', '2026-08-28', '84.00', '68.00', 'Stage 1 - Accumulation Base', 'Open', '', 'Bottom range support accumulation'],
      ['FWRY', 'Fawry Payments', 'Non-Bank Financial Services & Fintech', '12000', '8.10', '8.75', '2026-08-12', '10.50', '8.10', 'Stage 2 - Markup (Bullish Trend)', 'Open', '', 'Fintech scale'],
      ['TMGH', 'Talaat Moustafa Group', 'Real Estate & Construction', '3000', '48.20', '68.50', '2026-04-10', '75.00', '58.50', 'Stage 1 - Accumulation Base', 'Closed', '68.50', 'Booked profit into Stage 3 topping'],
      ['EAST', 'Eastern Company', 'Food, Beverage & Agribusiness', '2500', '24.50', '29.80', '2026-05-18', '33.00', '26.80', 'Stage 2 - Markup (Bullish Trend)', 'Closed', '29.80', 'Swing target reached']
    ];

    const parsed = parseSheetRows(sampleRows);
    setSheetTitle('EGX Trading Portfolio (Template Reference)');
    setPreviewResult({
      positions: parsed.positions,
      closedTrades: parsed.closedTrades,
      transactions: parsed.transactions,
      rawRowsCount: parsed.rawRowsCount,
      detectedColumns: parsed.detectedColumns,
    });
  };

  const handleDownloadTemplateCsv = () => {
    const csv = generateSampleCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'egx_portfolio_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      id="google-sheets-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl my-6 rounded-2xl bg-slate-900 border border-slate-700/80 p-6 text-slate-100 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Google Sheets 2-Way Portfolio Synchronization
              </h3>
              <p className="text-xs text-slate-400">
                Import positions, push transaction logs to <em>Transaction Logger</em>, and synchronize <em>Stock Directory</em> prices.
              </p>
            </div>
          </div>
          <button
            id="close-sheets-modal-btn"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sync Method Tabs */}
        <div className="flex gap-2 border-b border-slate-800 pb-3">
          <button
            type="button"
            onClick={() => setSyncMethod('public_link')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              syncMethod === 'public_link'
                ? 'bg-blue-600/30 border border-blue-500/40 text-blue-300'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            <span>Shareable Link (Public Sheet)</span>
          </button>

          <button
            type="button"
            onClick={() => setSyncMethod('oauth')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              syncMethod === 'oauth'
                ? 'bg-emerald-600/30 border border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Google Account (2-Way Write &amp; Read)</span>
          </button>

          <button
            type="button"
            onClick={() => setSyncMethod('paste_csv')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              syncMethod === 'paste_csv'
                ? 'bg-purple-600/30 border border-purple-500/40 text-purple-300'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>Paste / Upload CSV</span>
          </button>
        </div>

        {/* Option 1: Shareable Link */}
        {syncMethod === 'public_link' && (
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-start gap-2 text-xs text-slate-300">
              <span className="p-1 rounded bg-blue-500/20 text-blue-400 font-mono text-[10px] uppercase">Public</span>
              <span>
                Works with any Google Sheet shared as <strong>"Anyone with the link can view/edit"</strong>.
                Our smart parser automatically handles header names in Arabic and English.
              </span>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                Google Sheet Link or ID
              </label>
              <input
                type="text"
                placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Sheet Tab Name (optional)</label>
                <input
                  type="text"
                  placeholder="Portfolio, Active Positions, or Sheet1"
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handlePreviewAndParse}
                  disabled={loading || !sheetUrl.trim()}
                  className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>{loading ? 'Reading Sheet...' : 'Fetch & Import Data'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Option 2: Google Account OAuth */}
        {syncMethod === 'oauth' && (
          <div className="space-y-4">
            {!authUser ? (
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-center space-y-3">
                <p className="text-xs text-slate-300 max-w-md mx-auto">
                  Sign in with Google to enable <strong>direct 2-way synchronization</strong> (automatic transaction logging &amp; directory price updating):
                </p>

                <div className="flex justify-center">
                  <button
                    type="button"
                    id="gsi-login-btn"
                    onClick={handleSignIn}
                    disabled={isSigningIn}
                    className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-white hover:bg-gray-100 text-gray-800 font-medium text-sm shadow-md transition active:scale-95 disabled:opacity-60"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    <span>{isSigningIn ? 'Connecting...' : 'Sign in with Google'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Authorizes Sheets API read and write access for logging trades and updating prices.
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-slate-300">Connected Google Account:</span>
                  <span className="font-semibold text-emerald-300">{authUser.email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="text-xs text-slate-400 hover:text-rose-400 underline"
                >
                  Disconnect
                </button>
              </div>
            )}

            {authUser && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Target Google Spreadsheet URL or ID
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleFetchMetadata}
                      disabled={loading || !sheetUrl.trim()}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium transition"
                    >
                      Inspect Tabs
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Sheet Tab</label>
                    {availableSheets.length > 0 ? (
                      <select
                        value={sheetName}
                        onChange={(e) => setSheetName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                      >
                        {availableSheets.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="Sheet1"
                        value={sheetName}
                        onChange={(e) => setSheetName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Cell Range</label>
                    <input
                      type="text"
                      placeholder="A1:Z200"
                      value={range}
                      onChange={(e) => setRange(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handlePreviewAndParse}
                    disabled={loading || !sheetUrl.trim()}
                    className="py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span>{loading ? 'Reading...' : 'Import from Sheet'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePushAllToSheet}
                    disabled={isExporting || !sheetUrl.trim()}
                    className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
                  >
                    <UploadCloud className={`w-3.5 h-3.5 ${isExporting ? 'animate-spin' : ''}`} />
                    <span>{isExporting ? 'Syncing...' : 'Sync All (Positions, Logs & Prices)'}</span>
                  </button>
                </div>

                {/* Granular Sync Buttons */}
                <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handlePushTransactionsToSheet}
                    disabled={isExporting || !sheetUrl.trim()}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Push to "Transaction Logger" ({transactions.length} tx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePushPricesToSheet}
                    disabled={isExporting || !sheetUrl.trim()}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Push to "Stock Directory" ({tickers.length} stocks)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Option 3: Direct Paste or Upload CSV/TSV */}
        {syncMethod === 'paste_csv' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Paste copied cells from Google Sheets (Ctrl+C / Cmd+C) or raw CSV:</span>
              <button
                type="button"
                onClick={handleDownloadTemplateCsv}
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                <span>Download Sample CSV</span>
              </button>
            </div>

            <textarea
              rows={5}
              placeholder="Ticker, Shares, Buy Price, Current Price, Buy Date, Sector&#10;COMI, 2500, 76.40, 88.50, 2026-06-15, Banking&#10;ESRS, 1800, 98.50, 118.20, 2026-07-20, Basic Resources"
              value={pastedData}
              onChange={(e) => setPastedData(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500"
            />

            <button
              type="button"
              onClick={handlePreviewAndParse}
              disabled={loading || !pastedData.trim()}
              className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition"
            >
              Parse Pasted Data
            </button>
          </div>
        )}

        {/* Success notification */}
        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 flex items-start gap-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>{successMsg}</p>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{error}</p>
              {error.includes('malformed') && (
                <p className="mt-1 text-[11px] text-rose-200">
                  Tip: Switch to the <strong>"Shareable Link"</strong> tab above, or paste rows directly into <strong>"Paste / Upload CSV"</strong>!
                </p>
              )}
            </div>
          </div>
        )}

        {/* Preview & Confirmation */}
        {previewResult && (
          <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">Parsed Data Preview</span>
              </div>
              <span className="text-[11px] text-slate-400">
                Found {previewResult.rawRowsCount} row(s)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase block">Active Positions</span>
                <span className="text-base font-bold text-emerald-400">{previewResult.positions.length}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase block">Closed Cycles</span>
                <span className="text-base font-bold text-blue-400">{previewResult.closedTrades.length}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 col-span-2 sm:col-span-1">
                <span className="text-slate-400 text-[10px] uppercase block">Columns Detected</span>
                <span className="text-xs font-mono text-slate-300">{previewResult.detectedColumns.slice(0, 4).join(', ')}</span>
              </div>
            </div>

            {/* Quick list preview */}
            <div className="max-h-36 overflow-y-auto rounded-lg bg-slate-900/80 p-2 text-[11px] space-y-1 font-mono border border-slate-800">
              {previewResult.positions.slice(0, 4).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-slate-300 py-0.5 px-1 hover:bg-slate-800 rounded">
                  <span className="font-bold text-white">{p.ticker}</span>
                  <span>{p.shares.toLocaleString()} shares</span>
                  <span>@ {p.avgBuyPrice.toFixed(2)} EGP</span>
                  <span className="text-emerald-400">{p.sector}</span>
                </div>
              ))}
              {previewResult.positions.length > 4 && (
                <p className="text-[10px] text-slate-500 text-center pt-1">
                  ...and {previewResult.positions.length - 4} more stocks
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleApplyImport}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Apply &amp; Sync to Active Portfolio</span>
            </button>
          </div>
        )}

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
          <button
            type="button"
            onClick={handleLoadSampleTemplate}
            className="text-slate-400 hover:text-amber-400 flex items-center gap-1 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load EGX Reference Template</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadTemplateCsv}
            className="text-slate-400 hover:text-white flex items-center gap-1 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV Template</span>
          </button>
        </div>
      </div>
    </div>
  );
};
