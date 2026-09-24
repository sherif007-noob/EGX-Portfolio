import React, { useEffect, useRef } from 'react';
import { 
  FileSpreadsheet, 
  PlusCircle, 
  TrendingUp, 
  Layers, 
  BarChart3, 
  BookOpen, 
  ListOrdered,
  Check,
  RefreshCw,
  Wallet,
  RotateCcw,
  Zap,
  Database,
  AlertTriangle,
  Bell,
  BellRing,
} from 'lucide-react';

export type NavigationTab = 'overview' | 'positions' | 'closed_cycles' | 'journal' | 'cash' | 'reports' | 'directory';

interface HeaderProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  onOpenGoogleSheets: () => void;
  onOpenAddTrade: () => void;
  onOpenBackupModal?: () => void;
  onOpenScreenshotModal?: () => void;
  onOpenPriceAlerts?: () => void;
  unreadAlertCount?: number;
  isAlertsActive?: boolean;
  isSheetsConnected: boolean;
  isTokenExpired?: boolean;
  onSyncLivePrices?: () => void;
  isSyncingPrices?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenGoogleSheets,
  onOpenAddTrade,
  onOpenBackupModal,
  onOpenScreenshotModal,
  onOpenPriceAlerts,
  unreadAlertCount = 0,
  isAlertsActive = true,
  isSheetsConnected,
  isTokenExpired = false,
  onSyncLivePrices,
  isSyncingPrices = false,
}) => {
  const navScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = navScrollRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [activeTab]);

  return (
    <header className="premium-header sticky top-0 z-40 w-full border-b">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between min-h-[4rem] py-2 gap-y-2.5 gap-x-2">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="premium-inset-glass relative w-10 h-10 rounded-xl flex items-center justify-center p-1.5 shrink-0">
              <img src="/icon.svg" alt="EGX Logo" className="w-full h-full object-contain" />
              <span className="absolute -bottom-1 -right-1 inline-flex h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.32)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  EGX Portfolio
                </h1>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  EGX Equities • EGP
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Live Prices, Analytics &amp; Automated Schema Sync
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="premium-header-action-rail flex w-full min-w-0 items-center flex-nowrap justify-center gap-1.5 overflow-x-auto overscroll-x-contain pb-1 scrollbar-none sm:w-auto sm:flex-1 sm:min-w-[200px] sm:flex-wrap sm:justify-end sm:overflow-visible sm:pb-0 sm:gap-2.5">
            {/* Price Target & Push Notifications Trigger */}
            {onOpenPriceAlerts && (
              <button
                id="header-price-alerts-btn"
                onClick={onOpenPriceAlerts}
                className="premium-action relative flex shrink-0 items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold group"
                title="Price Target Web Push Notifications & Alerts"
              >
                {unreadAlertCount > 0 ? (
                  <BellRing className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                ) : (
                  <Bell className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 transition" />
                )}
                <span className="hidden lg:inline">Price Alerts</span>
                {unreadAlertCount > 0 ? (
                  <>
                    <span className="absolute -right-1 -top-1 inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-slate-950 font-mono md:hidden">
                      {unreadAlertCount}
                    </span>
                    <span className="hidden md:inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 font-mono">
                      {unreadAlertCount}
                    </span>
                  </>
                ) : isAlertsActive ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 hidden sm:inline-block" title="Alerts active" />
                ) : null}
              </button>
            )}

            {/* Live Prices Sync Button */}
            {onSyncLivePrices && (
              <button
                id="header-live-sync-btn"
                onClick={onSyncLivePrices}
                disabled={isSyncingPrices}
                className="premium-action premium-filter-active-cyan flex shrink-0 items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                title="Sync live EGX prices from TradingView Egypt Scanner"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isSyncingPrices ? 'animate-spin' : ''}`} />
                <span className="hidden md:inline">{isSyncingPrices ? 'Syncing...' : 'Sync Prices'}</span>
              </button>
            )}

            {/* Google Sheets Trigger */}
            <button
              id="header-google-sheets-btn"
              onClick={onOpenGoogleSheets}
              className={`premium-action relative flex shrink-0 items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold ${
                isTokenExpired
                  ? 'premium-action-warning'
                  : isSheetsConnected
                  ? 'premium-action-success'
                  : ''
              }`}
              title={isTokenExpired ? 'Google Sheets token expired. Click to reconnect' : 'Connect or sync Google Sheets'}
            >
              {isTokenExpired ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span className="hidden md:inline">
                {isTokenExpired ? 'Reconnect Sheets' : isSheetsConnected ? 'Sheets Synced' : 'Google Sheets'}
              </span>
              {isSheetsConnected && !isTokenExpired && (
                <>
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-400 md:hidden" title="Google Sheets connected" />
                  <Check className="hidden md:block w-3 h-3 text-emerald-400 ml-0.5" />
                </>
              )}
            </button>

            {/* Backup & Ledger Reconcile Modal Trigger */}
            {onOpenBackupModal && (
              <button
                id="header-backup-reconcile-btn"
                onClick={onOpenBackupModal}
                className="premium-action flex shrink-0 items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold"
                title="Backup JSON, restore database, or reconcile portfolio ledger"
              >
                <Database className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden lg:inline">Backup &amp; Reconcile</span>
              </button>
            )}

            {/* Scan Screenshot Button */}
            {onOpenScreenshotModal && (
              <button
                id="header-scan-btn"
                onClick={onOpenScreenshotModal}
                className="premium-action premium-action-success flex shrink-0 items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                title="Upload trade screenshot or receipt to scan and log"
              >
                <Zap className="w-3.5 h-3.5 text-emerald-200" />
                <span className="hidden lg:inline">Scan Receipt</span>
              </button>
            )}

            {/* Add Trade Button */}
            <button
              id="header-add-trade-btn"
              onClick={onOpenAddTrade}
              className="premium-action premium-action-primary premium-shimmer-border flex shrink-0 items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Add Trade</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div ref={navScrollRef} className="relative max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 border-t border-slate-700/40 bg-slate-950/15 overflow-x-auto overscroll-x-contain scrollbar-none">
        <nav className="flex space-x-1 sm:space-x-3 py-2 min-w-max">
          <button
            id="tab-overview"
            aria-current={activeTab === 'overview' ? 'page' : undefined}
            onClick={() => setActiveTab('overview')}
            className={`premium-nav flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border ${
              activeTab === 'overview'
                ? 'premium-nav-active text-white font-semibold border-slate-600/60'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/[0.035]'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="2xl:hidden">Overview</span><span className="hidden 2xl:inline">Overview</span>
          </button>

          <button
            id="tab-positions"
            aria-current={activeTab === 'positions' ? 'page' : undefined}
            onClick={() => setActiveTab('positions')}
            className={`premium-nav flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border ${
              activeTab === 'positions'
                ? 'premium-nav-active text-white font-semibold border-slate-600/60'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/[0.035]'
            }`}
          >
            <Layers className="w-4 h-4 text-blue-400" />
            <span className="2xl:hidden">Positions</span><span className="hidden 2xl:inline">Open Positions</span>
          </button>

          <button
            id="tab-closed-cycles"
            aria-current={activeTab === 'closed_cycles' ? 'page' : undefined}
            onClick={() => setActiveTab('closed_cycles')}
            className={`premium-nav flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border ${
              activeTab === 'closed_cycles'
                ? 'premium-nav-active text-white font-semibold border-slate-600/60'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/[0.035]'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-purple-400" />
            <span className="2xl:hidden">Cycles</span><span className="hidden 2xl:inline">Closed Cycles</span>
          </button>

          <button
            id="tab-transactions"
            aria-current={activeTab === 'journal' ? 'page' : undefined}
            onClick={() => setActiveTab('journal')}
            className={`premium-nav flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border ${
              activeTab === 'journal'
                ? 'premium-nav-active text-white font-semibold border-slate-600/60'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/[0.035]'
            }`}
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span className="2xl:hidden">Transactions</span><span className="hidden 2xl:inline">Transactions</span>
          </button>

          <button
            id="tab-cash-ledger"
            aria-current={activeTab === 'cash' ? 'page' : undefined}
            onClick={() => setActiveTab('cash')}
            className={`premium-nav flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border ${
              activeTab === 'cash'
                ? 'premium-nav-active text-white font-semibold border-slate-600/60'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/[0.035]'
            }`}
          >
            <Wallet className="w-4 h-4 text-amber-400" />
            <span className="2xl:hidden">Cash</span><span className="hidden 2xl:inline">Cash Ledger</span>
          </button>

          <button
            id="tab-reports"
            aria-current={activeTab === 'reports' ? 'page' : undefined}
            onClick={() => setActiveTab('reports')}
            className={`premium-nav flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border ${
              activeTab === 'reports'
                ? 'premium-nav-active text-white font-semibold border-slate-600/60'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/[0.035]'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-purple-400" />
            <span className="2xl:hidden">Reports</span><span className="hidden 2xl:inline">Reports & Performance</span>
          </button>

          <button
            id="tab-directory"
            aria-current={activeTab === 'directory' ? 'page' : undefined}
            onClick={() => setActiveTab('directory')}
            className={`premium-nav flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border ${
              activeTab === 'directory'
                ? 'premium-nav-active text-white font-semibold border-slate-600/60'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/[0.035]'
            }`}
          >
            <ListOrdered className="w-4 h-4 text-teal-400" />
            <span className="2xl:hidden">Stocks</span><span className="hidden 2xl:inline">Stocks &amp; Prices</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
