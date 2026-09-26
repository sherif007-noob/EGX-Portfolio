import React, { useState } from 'react';
import { runVisualTransition } from '../utils/visualTransition';
import { MotionSwap, SurfacePresence } from './PremiumMotion';
import { EGXTicker } from '../types';
import { StockLogo } from './StockLogo';
import { AnalyticsSelect } from './AnalyticsSelect';
import {
  Search,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Layers,
  Download,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react';

interface TickerDirectoryViewProps {
  tickers: EGXTicker[];
  onSelectTickerForTrade: (ticker: EGXTicker) => void;
  onOpenSchemaSync?: () => void;
  onSyncLivePrices?: () => void;
  isSyncingPrices?: boolean;
  lastPriceSyncTime?: string | null;
  onPushPricesToSheet?: () => Promise<void>;
  isSheetsConnected?: boolean;
}

export const TickerDirectoryView: React.FC<TickerDirectoryViewProps> = ({
  tickers,
  onSelectTickerForTrade,
  onOpenSchemaSync,
  onSyncLivePrices,
  isSyncingPrices = false,
  lastPriceSyncTime,
  onPushPricesToSheet,
  isSheetsConnected = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [isPushingSheet, setIsPushingSheet] = useState(false);
  const [sheetSyncSuccess, setSheetSyncSuccess] = useState<string | null>(null);

  const changeSelectedSector = (next: string) => {
    if (next === selectedSector) return;
    runVisualTransition('directory-filter', () => setSelectedSector(next));
  };

  const visibleTickers = tickers.filter(
    (ticker) =>
      ticker.directoryStatus !== 'inactive' &&
      ticker.directoryStatus !== 'retired' &&
      ticker.directoryStatus !== 'unresolved',
  );
  const sectors = Array.from(new Set(visibleTickers.map((t) => t.sector)));

  const filteredTickers = visibleTickers.filter((t) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      t.ticker.toLowerCase().includes(query) ||
      t.isin?.toLowerCase().includes(query) ||
      t.nameEn.toLowerCase().includes(query) ||
      t.nameAr.toLowerCase().includes(query) ||
      (t.aliases || []).some((alias) => alias.toLowerCase().includes(query));
    const matchesSector = selectedSector === 'ALL' || t.sector === selectedSector;
    return matchesSearch && matchesSector;
  });

  const handleDownloadJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      lastSync: new Date().toISOString(),
      market: 'EGX',
      currency: 'EGP',
      count: tickers.length,
      tickers: tickers,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `egx_tickers_directory_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePushSheetClick = async () => {
    if (!onPushPricesToSheet) return;
    setIsPushingSheet(true);
    setSheetSyncSuccess(null);
    try {
      await onPushPricesToSheet();
      setSheetSyncSuccess(`Synchronized ${tickers.length} stock quotes to Google Sheets "ticker directory"!`);
      setTimeout(() => setSheetSyncSuccess(null), 4000);
    } catch {
      // Handled in parent
    } finally {
      setIsPushingSheet(false);
    }
  };

  return (
    <div className="premium-dense-workflow premium-flow-related">
      {/* Header Info */}
      <div className="premium-hierarchy-h3 premium-dense-summary premium-pad-h3 premium-gap-control flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl" data-hierarchy="h3">
        <div>
          <h2 className="premium-type-section-title flex items-center gap-2">
            <Layers className="w-5 h-5 text-teal-400" />
            EGX Ticker Directory &amp; Market Data Feed
          </h2>
          <p className="premium-type-helper mt-0.5">
            Directory of active Egyptian Exchange equities with live market quotes, technical levels, and Google Sheet sync.
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:flex-wrap">
          {onSyncLivePrices && (
            <button
              id="sync-directory-prices-btn"
              onClick={onSyncLivePrices}
              disabled={isSyncingPrices}
              className="premium-action premium-action-primary col-span-2 flex w-full items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 sm:col-auto sm:w-auto"
              title="Sync latest prices directly from TradingView Egypt Scanner"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isSyncingPrices ? 'animate-spin' : ''}`} />
              <span>{isSyncingPrices ? 'Syncing...' : 'Sync EGX Prices'}</span>
            </button>
          )}

          {onPushPricesToSheet && (
            <button
              id="push-prices-to-sheet-btn"
              onClick={handlePushSheetClick}
              disabled={isPushingSheet}
              className="premium-action premium-action-success flex w-full items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 sm:w-auto"
              title="Push live quotes into ticker directory tab in Google Sheets"
            >
              <FileSpreadsheet className={`w-3.5 h-3.5 text-emerald-400 ${isPushingSheet ? 'animate-spin' : ''}`} />
              <span>{isPushingSheet ? 'Pushing...' : 'Push to Google Sheet'}</span>
            </button>
          )}

          <button
            id="download-directory-json-btn"
            onClick={handleDownloadJson}
            className="premium-action flex w-full items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold sm:w-auto"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </button>
        </div>
      </div>

      <SurfacePresence isOpen={!!sheetSyncSuccess}>
        {sheetSyncSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{sheetSyncSuccess}</span>
        </div>
        )}
      </SurfacePresence>

      {/* Filter Bar */}
      <div className="premium-panel premium-hierarchy-h4 premium-dense-toolbar premium-pad-h4 premium-gap-control flex flex-col sm:flex-row items-stretch sm:items-center justify-between rounded-2xl" data-hierarchy="h4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by ticker, old ticker, ISIN, English or Arabic name..."
            className="premium-field w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900/72 text-slate-100 placeholder-slate-500 text-xs sm:text-sm border border-slate-700/80 focus:outline-none focus:border-teal-500/60"
          />
        </div>

        <div className="w-full min-w-0 sm:w-auto">
          <AnalyticsSelect
            value={selectedSector}
            onChange={(value) => changeSelectedSector(String(value))}
            compact
            accent="teal"
            ariaLabel="Filter ticker directory by sector"
            className="w-full min-w-0 sm:w-auto sm:min-w-[170px]"
            options={[
              { value: 'ALL', label: `All Sectors (${visibleTickers.length})` },
              ...sectors.map((sector) => ({ value: sector, label: sector })),
            ]}
          />
        </div>
      </div>

      {/* Grid of Tickers */}
      <MotionSwap motionKey={selectedSector} variant="state" className="premium-directory-results premium-gap-control grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {filteredTickers.map((ticker) => {
          const isPositive = ticker.changePercent >= 0;

          return (
            <div
              key={ticker.ticker}
              className="premium-card premium-hierarchy-h5 premium-dense-row premium-radial premium-pad-h5 premium-flow-control rounded-2xl"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <StockLogo
                    ticker={ticker.ticker}
                    companyName={ticker.nameEn}
                    sector={ticker.sector}
                    logoUrl={ticker.logoUrl}
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="premium-type-metric-dense text-white">{ticker.ticker}</span>
                      <span className="premium-chip text-[10px] px-2 py-0.5 rounded-full text-slate-300 font-medium shrink-0">
                        {ticker.trendStatus}
                      </span>
                      {ticker.metadataSource === 'registry' && (
                        <span
                          className="premium-chip text-[10px] px-2 py-0.5 rounded-full text-cyan-300 font-medium shrink-0"
                          title={[
                            ticker.historyResolutionMethod ? `History: ${ticker.historyResolutionMethod}` : '',
                            ticker.aliases?.length ? `Aliases: ${ticker.aliases.join(', ')}` : '',
                          ].filter(Boolean).join(' • ')}
                        >
                          Registry
                        </span>
                      )}
                    </div>
                    <h3 className="premium-type-helper text-slate-300 line-clamp-1" title={ticker.nameEn}>
                      {ticker.nameEn}
                    </h3>
                    <p className="premium-type-metadata font-arabic line-clamp-1" dir="rtl">
                      {ticker.nameAr}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="premium-type-metric premium-type-metric-dense font-mono text-white">{ticker.lastPrice.toFixed(2)} <span className="premium-type-unit">EGP</span></div>
                  <div
                    className={`text-xs font-semibold flex items-center justify-end gap-0.5 ${
                      isPositive ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {isPositive ? '+' : ''}{ticker.changePercent.toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Sector & Volume */}
              <div className="premium-subpanel premium-hierarchy-h4 flex items-center justify-between text-[11px] text-slate-400 px-2 py-1 rounded-lg">
                <span>{ticker.sector}</span>
                <span>Vol: {(ticker.volume / 1000000).toFixed(2)}M shrs</span>
              </div>

              {/* Technical Levels */}
              <div className="premium-subpanel premium-hierarchy-h4 grid grid-cols-3 gap-1.5 p-2 rounded-xl text-[11px]">
                <div>
                  <span className="premium-type-metric-label block">RSI(14)</span>
                  <span className={`premium-type-metric-dense font-mono ${ticker.rsi14 >= 70 ? 'text-rose-400' : ticker.rsi14 <= 35 ? 'text-emerald-400' : 'text-slate-200'}`}>
                    {ticker.rsi14.toFixed(1)}
                  </span>
                </div>
                <div>
                  <span className="premium-type-metric-label block">Support</span>
                  <span className="premium-type-metric-dense font-mono text-slate-300">{ticker.support.toFixed(2)}</span>
                </div>
                <div className="text-right">
                  <span className="premium-type-metric-label block">Target</span>
                  <span className="premium-type-metric-dense font-mono text-emerald-400">{ticker.targetPrice.toFixed(2)}</span>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => onSelectTickerForTrade(ticker)}
                className="premium-action premium-action-primary w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />
                Add to Portfolio / Log Trade
              </button>
            </div>
          );
        })}
      </MotionSwap>
    </div>
  );
};
