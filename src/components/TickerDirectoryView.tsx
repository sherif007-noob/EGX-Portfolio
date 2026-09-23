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

  const sectors = Array.from(new Set(tickers.map((t) => t.sector)));

  const filteredTickers = tickers.filter((t) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      t.ticker.toLowerCase().includes(query) ||
      t.nameEn.toLowerCase().includes(query) ||
      t.nameAr.toLowerCase().includes(query);
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
    <div className="space-y-4">
      {/* Header Info */}
      <div className="premium-glass flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-teal-400" />
            EGX Ticker Directory &amp; Market Data Feed
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
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
      <div className="premium-panel flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-2xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by ticker (COMI, ESRS, ABUK), English or Arabic name..."
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
              { value: 'ALL', label: `All Sectors (${tickers.length})` },
              ...sectors.map((sector) => ({ value: sector, label: sector })),
            ]}
          />
        </div>
      </div>

      {/* Grid of Tickers */}
      <MotionSwap motionKey={selectedSector} variant="state" className="premium-directory-results grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredTickers.map((ticker) => {
          const isPositive = ticker.changePercent >= 0;

          return (
            <div
              key={ticker.ticker}
              className="premium-card premium-radial p-3.5 sm:p-4 rounded-2xl space-y-3"
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
                      <span className="text-base font-black text-white">{ticker.ticker}</span>
                      <span className="premium-chip text-[10px] px-2 py-0.5 rounded-full text-slate-300 font-medium shrink-0">
                        {ticker.trendStatus}
                      </span>
                    </div>
                    <h3 className="text-xs text-slate-300 font-medium line-clamp-1" title={ticker.nameEn}>
                      {ticker.nameEn}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-arabic line-clamp-1" dir="rtl">
                      {ticker.nameAr}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-base text-white">
                    {ticker.lastPrice.toFixed(2)} EGP
                  </div>
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
              <div className="premium-subpanel flex items-center justify-between text-[11px] text-slate-400 px-2 py-1 rounded-lg">
                <span>{ticker.sector}</span>
                <span>Vol: {(ticker.volume / 1000000).toFixed(2)}M shrs</span>
              </div>

              {/* Technical Levels */}
              <div className="premium-subpanel grid grid-cols-3 gap-1.5 p-2 rounded-xl text-[11px]">
                <div>
                  <span className="text-slate-400 text-[10px] block">RSI(14)</span>
                  <span className={`font-mono font-bold ${ticker.rsi14 >= 70 ? 'text-rose-400' : ticker.rsi14 <= 35 ? 'text-emerald-400' : 'text-slate-200'}`}>
                    {ticker.rsi14.toFixed(1)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Support</span>
                  <span className="font-mono text-slate-300">{ticker.support.toFixed(2)}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] block">Target</span>
                  <span className="font-mono font-bold text-emerald-400">{ticker.targetPrice.toFixed(2)}</span>
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
