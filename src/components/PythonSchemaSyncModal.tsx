import React, { useState } from 'react';
import { EGXTicker, SchemaValidationResult } from '../types';
import {
  generatePythonSyncScript,
  validateTickerDirectoryPayload,
  SCHEMA_URL,
} from '../services/schemaSync';
import {
  Code2,
  X,
  Copy,
  Check,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Play,
} from 'lucide-react';

interface PythonSchemaSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateTickers: (newTickers: EGXTicker[]) => void;
}

export const PythonSchemaSyncModal: React.FC<PythonSchemaSyncModalProps> = ({
  isOpen,
  onClose,
  onUpdateTickers,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'script' | 'paste' | 'schema'>('script');
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [pastePayload, setPastePayload] = useState('');
  const [validationResult, setValidationResult] = useState<SchemaValidationResult | null>(null);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const schemaUrl = `${origin}/schema/ticker-directory.json`;
  const pythonScript = generatePythonSyncScript(origin);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(pythonScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(schemaUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleDownloadScript = () => {
    const blob = new Blob([pythonScript], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sync_egx.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleValidateAndApply = () => {
    try {
      const parsed = JSON.parse(pastePayload);
      const result = validateTickerDirectoryPayload(parsed);
      setValidationResult(result);

      if (result.valid && Array.isArray(parsed.tickers)) {
        onUpdateTickers(parsed.tickers);
      }
    } catch (err: any) {
      setValidationResult({
        valid: false,
        errors: [`Invalid JSON: ${err.message}`],
        itemCount: 0,
      });
    }
  };

  const handleLoadSamplePythonOutput = () => {
    const sample = {
      version: '1.0.0',
      lastSync: new Date().toISOString(),
      market: 'EGX',
      currency: 'EGP',
      count: 2,
      tickers: [
        {
          ticker: 'COMI',
          nameEn: 'Commercial International Bank (Egypt)',
          nameAr: 'البنك التجاري الدولي - مصر',
          isin: 'EGS60121C018',
          sector: 'Banking',
          lastPrice: 89.20,
          change: 1.95,
          changePercent: 2.23,
          dayLow: 87.10,
          dayHigh: 89.60,
          yearLow: 62.00,
          yearHigh: 94.50,
          volume: 4210000,
          valueEgp: 375532000,
          trendStatus: 'Strong Uptrend',
          rsi14: 67.2,
          support: 85.50,
          resistance: 91.50,
          targetPrice: 99.00,
          stopLoss: 83.50,
          notes: 'Updated via Python sync: Bullish institutional accumulation breakout.',
          lastUpdated: new Date().toISOString()
        },
        {
          ticker: 'ESRS',
          nameEn: 'Ezz Steel',
          nameAr: 'حديد عز',
          isin: 'EGS30021C013',
          sector: 'Basic Resources & Steel',
          lastPrice: 121.50,
          change: 3.30,
          changePercent: 2.79,
          dayLow: 118.00,
          dayHigh: 122.50,
          yearLow: 68.00,
          yearHigh: 125.00,
          volume: 2450000,
          valueEgp: 297675000,
          trendStatus: 'Strong Uptrend',
          rsi14: 73.5,
          support: 115.00,
          resistance: 126.00,
          targetPrice: 140.00,
          stopLoss: 112.00,
          notes: 'Updated via Python sync: Higher rebar prices and export surge.',
          lastUpdated: new Date().toISOString()
        }
      ]
    };
    setPastePayload(JSON.stringify(sample, null, 2));
  };

  return (
    <div
      id="schema-sync-modal"
      className="premium-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="premium-modal w-full max-w-3xl my-6 rounded-2xl p-6 text-slate-100 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Python Script &amp; Schema Synchronization Hub
              </h3>
              <p className="text-xs text-slate-400">
                Automate your EGX market updates with Python, GitHub Actions, or local scrapers
              </p>
            </div>
          </div>
          <button onClick={onClose} className="premium-icon-action p-1.5 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Schema URL Banner */}
        <div className="premium-modal-section p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <span className="text-[11px] text-slate-400 block">Open API / JSON Schema Link:</span>
            <span className="font-mono text-xs text-indigo-300 select-all break-all">{schemaUrl}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyUrl}
              className="premium-action px-2.5 py-1 rounded-lg text-xs flex items-center gap-1"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedUrl ? 'Copied' : 'Copy URL'}
            </button>
            <a
              href="/schema/ticker-directory.json"
              target="_blank"
              rel="noopener noreferrer"
              className="premium-action px-2.5 py-1 rounded-lg text-xs flex items-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Schema
            </a>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b border-slate-800 text-xs">
          <button
            onClick={() => setActiveSubTab('script')}
            className={`premium-filter-pill pb-2.5 px-3 font-semibold rounded-t-lg ${
              activeSubTab === 'script'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Python Automation Script (sync_egx.py)
          </button>
          <button
            onClick={() => setActiveSubTab('paste')}
            className={`premium-filter-pill pb-2.5 px-3 font-semibold rounded-t-lg ${
              activeSubTab === 'paste'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Ingest / Paste Scraped Output
          </button>
          <button
            onClick={() => setActiveSubTab('schema')}
            className={`premium-filter-pill pb-2.5 px-3 font-semibold rounded-t-lg ${
              activeSubTab === 'schema'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Schema Reference
          </button>
        </div>

        {/* Tab 1: Python Script */}
        {activeSubTab === 'script' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300">
                Ready-to-use Python script with schema verification:
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyScript}
                  className="premium-action premium-action-purple flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold"
                >
                  {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedScript ? 'Copied Script!' : 'Copy Python Code'}
                </button>
                <button
                  onClick={handleDownloadScript}
                  className="premium-action flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .py
                </button>
              </div>
            </div>

            <pre className="premium-inset-glass p-3.5 rounded-xl font-mono text-[11px] text-slate-200 max-h-72 overflow-y-auto overflow-x-auto select-all">
              {pythonScript}
            </pre>

            <div className="premium-modal-section p-3 rounded-xl text-xs text-slate-300 space-y-1">
              <span className="font-semibold text-white">How GitHub Automation Works:</span>
              <p className="text-slate-400 text-[11px]">
                1. Place this script in your GitHub repo as <code className="text-indigo-300">sync_egx.py</code>.
                <br />
                2. Set up a GitHub Actions workflow that runs every trading day at 15:00 Cairo time (EGX market close).
                <br />
                3. The script validates against the schema link, fetches live market quotes, and outputs structured JSON.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Payload Ingestion / Test */}
        {activeSubTab === 'paste' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium">
                Paste the JSON generated by your Python script:
              </span>
              <button
                onClick={handleLoadSamplePythonOutput}
                className="premium-action premium-action-purple px-2 py-1 rounded-lg text-xs font-medium"
              >
                Load Sample Payload
              </button>
            </div>

            <textarea
              value={pastePayload}
              onChange={(e) => setPastePayload(e.target.value)}
              placeholder="Paste JSON schema payload here..."
              rows={8}
              className="premium-field w-full p-3 rounded-xl font-mono text-xs text-slate-200 focus:outline-none"
            />

            <div className="flex items-center justify-between">
              <button
                id="validate-payload-btn"
                onClick={handleValidateAndApply}
                disabled={!pastePayload.trim()}
                className="premium-action premium-action-purple premium-shimmer-border px-4 py-2 rounded-xl disabled:opacity-50 font-semibold text-xs sm:text-sm flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                Validate &amp; Sync to App
              </button>

              {validationResult && (
                <div className="text-xs">
                  {validationResult.valid ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      Valid! {validationResult.itemCount} tickers synchronized.
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1 font-semibold">
                      <AlertTriangle className="w-4 h-4" />
                      Validation Failed ({validationResult.errors.length} error)
                    </span>
                  )}
                </div>
              )}
            </div>

            {validationResult && !validationResult.valid && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-600/40 text-xs text-rose-300 max-h-32 overflow-y-auto space-y-1">
                {validationResult.errors.map((err, i) => (
                  <div key={i}>• {err}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Schema Details */}
        {activeSubTab === 'schema' && (
          <div className="space-y-3">
            <div className="premium-modal-section p-3 rounded-xl text-xs space-y-2">
              <span className="font-bold text-white">Required Ticker Directory Fields:</span>
              <ul className="grid grid-cols-2 gap-2 text-slate-300 text-[11px]">
                <li><code className="text-indigo-300">ticker</code> (e.g. &quot;COMI&quot;)</li>
                <li><code className="text-indigo-300">nameEn</code> (e.g. &quot;Commercial International Bank&quot;)</li>
                <li><code className="text-indigo-300">sector</code> (e.g. &quot;Banking&quot;)</li>
                <li><code className="text-indigo-300">lastPrice</code> (number in EGP)</li>
                <li><code className="text-indigo-300">changePercent</code> (number % change)</li>
                <li><code className="text-indigo-300">trendStatus</code> (e.g. &quot;Strong Uptrend&quot;)</li>
                <li><code className="text-indigo-300">support</code> (Key price support)</li>
                <li><code className="text-indigo-300">resistance</code> (Key breakout resistance)</li>
                <li><code className="text-indigo-300">targetPrice</code> (Technical swing target)</li>
                <li><code className="text-indigo-300">stopLoss</code> (Capital protection level)</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
