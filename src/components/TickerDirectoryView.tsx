import React, { useState } from 'react';
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-teal-400" />
            EGX Ticker Directory &amp; Market Data Feed
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Directory of active Egyptian Exchange equities with live market quotes, technical levels, and Google Sheet sync.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {onSyncLivePrices && (
            <button
              id="sync-directory-prices-btn"
              onClick={onSyncLivePrices}
              disabled={isSyncingPrices}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 text-xs font-semibold transition hover:border-cyan-400 disabled:opacity-50"
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition hover:border-emerald-400 disabled:opacity-50"
              title="Push live quotes into ticker directory tab in Google Sheets"
            >
              <FileSpreadsheet className={`w-3.5 h-3.5 text-emerald-400 ${isPushingSheet ? 'animate-spin' : ''}`} />
              <span>{isPushingSheet ? 'Pushing...' : 'Push to Google Sheet'}</span>
            </button>
          )}

          <button
            id="download-directory-json-btn"
            onClick={handleDownloadJson}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </button>
        </div>
      </div>

      {sheetSyncSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{sheetSyncSuccess}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by ticker (COMI, ESRS, ABUK), English or Arabic name..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-800 text-slate-100 placeholder-slate-400 text-xs sm:text-sm border border-slate-700 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <AnalyticsSelect
            value={selectedSector}
            onChange={setSelectedSector}
            compact
            accent="teal"
            ariaLabel="Filter ticker directory by sector"
            className="min-w-[170px]"
            options={[
              { value: 'ALL', label: `All Sectors (${tickers.length})` },
              ...sectors.map((sector) => ({ value: sector, label: sector })),
            ]}
          />
        </div>
      </div>

      {/* Grid of Tickers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredTickers.map((ticker) => {
          const isPositive = ticker.changePercent >= 0;

          return (
            <div
              key={ticker.ticker}
              className="p-4 rounded-xl bg-slate-900 border border-slate-800/90 hover:border-slate-700 transition shadow-sm space-y-3"
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
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium shrink-0">
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
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-2 py-1 rounded bg-slate-950/40">
                <span>{ticker.sector}</span>
                <span>Vol: {(ticker.volume / 1000000).toFixed(2)}M shrs</span>
              </div>

              {/* Technical Levels */}
              <div className="grid grid-cols-3 gap-1.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px]">
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
                className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />
                Add to Portfolio / Log Trade
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
