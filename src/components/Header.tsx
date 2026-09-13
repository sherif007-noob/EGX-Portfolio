import React from 'react';
import { 
  FileSpreadsheet, 
  PlusCircle, 
  TrendingUp, 
  Layers, 
  BarChart3, 
  BookOpen, 
  ListOrdered,
  LogOut,
  User as UserIcon,
  Check,
  RefreshCw,
  Wallet,
  RotateCcw,
  Sparkles,
  Zap,
  Database,
  AlertTriangle,
  Bell,
  BellRing
} from 'lucide-react';
import { User } from 'firebase/auth';

export type NavigationTab = 'overview' | 'positions' | 'closed_cycles' | 'journal' | 'cash' | 'reports' | 'directory';

interface HeaderProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  onOpenGoogleSheets: () => void;
  onOpenSchemaSync?: () => void;
  onOpenAddTrade: () => void;
  onOpenBackupModal?: () => void;
  onOpenScreenshotModal?: () => void;
  onOpenPriceAlerts?: () => void;
  unreadAlertCount?: number;
  isAlertsActive?: boolean;
  isSheetsConnected: boolean;
  sheetsTitle?: string;
  isTokenExpired?: boolean;
  authUser: User | null;
  onLogout: () => void;
  onSyncLivePrices?: () => void;
  isSyncingPrices?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenGoogleSheets,
  onOpenSchemaSync,
  onOpenAddTrade,
  onOpenBackupModal,
  onOpenScreenshotModal,
  onOpenPriceAlerts,
  unreadAlertCount = 0,
  isAlertsActive = true,
  isSheetsConnected,
  sheetsTitle,
  isTokenExpired = false,
  authUser,
  onLogout,
  onSyncLivePrices,
  isSyncingPrices = false,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between min-h-[4rem] py-2 gap-y-3 gap-x-2">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/80 flex items-center justify-center p-1.5 shadow-md shadow-black/50 shrink-0">
              <img src="/icon.svg" alt="EGX Logo" className="w-full h-full object-contain" />
              <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
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
          <div className="flex items-center flex-wrap justify-end gap-1.5 sm:gap-2.5 flex-1 min-w-[200px]">
            {/* Price Target & Push Notifications Trigger */}
            {onOpenPriceAlerts && (
              <button
                id="header-price-alerts-btn"
                onClick={onOpenPriceAlerts}
                className="relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-slate-200 border border-slate-700 hover:bg-slate-800 hover:border-amber-500/50 transition group"
                title="Price Target Web Push Notifications & Alerts"
              >
                {unreadAlertCount > 0 ? (
                  <BellRing className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                ) : (
                  <Bell className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 transition" />
                )}
                <span className="hidden lg:inline">Price Alerts</span>
                {unreadAlertCount > 0 ? (
                  <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 font-mono">
                    {unreadAlertCount}
                  </span>
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
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 transition hover:border-cyan-400 disabled:opacity-50"
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
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                isTokenExpired
                  ? 'bg-amber-950/50 text-amber-300 border-amber-500/50 hover:bg-amber-900/50 animate-pulse'
                  : isSheetsConnected
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-600/40 hover:bg-emerald-900/40'
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
              }`}
              title={isTokenExpired ? 'Google Sheets token expired. Click to reconnect' : 'Connect or sync Google Sheets'}
            >
              {isTokenExpired ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span className="hidden md:inline">
                {isTokenExpired ? 'Reconnect Sheets' : isSheetsConnected ? 'Sheets Synced' : 'Google Sheets'}
              </span>
              {isSheetsConnected && !isTokenExpired && <Check className="w-3 h-3 text-emerald-400 ml-0.5" />}
            </button>

            {/* Offline Backup & Ledger Reconcile Modal Trigger */}
            {onOpenBackupModal && (
              <button
                id="header-backup-reconcile-btn"
                onClick={onOpenBackupModal}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800 hover:text-white transition"
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-900/30 transition active:scale-95"
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-900/30 transition active:scale-95"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Add Trade</span>
            </button>

            {/* User Profile / Auth */}
            {authUser && (
              <div className="flex items-center gap-1.5 pl-1.5 border-l border-slate-800 shrink-0">
                <div 
                  className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-xs overflow-hidden"
                  title={authUser.email || 'User'}
                >
                  {authUser.photoURL ? (
                    <img src={authUser.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon className="w-3.5 h-3.5" />
                  )}
                </div>
                <button
                  id="logout-btn"
                  onClick={onLogout}
                  className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-800/60 overflow-x-auto scrollbar-none">
        <nav className="flex space-x-1 sm:space-x-3 py-2 min-w-max">
          <button
            id="tab-overview"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
              activeTab === 'overview'
                ? 'bg-slate-800 text-white font-semibold shadow-inner border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Overview
          </button>

          <button
            id="tab-positions"
            onClick={() => setActiveTab('positions')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
              activeTab === 'positions'
                ? 'bg-slate-800 text-white font-semibold shadow-inner border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-blue-400" />
            Open Positions
          </button>

          <button
            id="tab-closed-cycles"
            onClick={() => setActiveTab('closed_cycles')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
              activeTab === 'closed_cycles'
                ? 'bg-slate-800 text-white font-semibold shadow-inner border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-purple-400" />
            Closed Cycles
          </button>

          <button
            id="tab-transactions"
            onClick={() => setActiveTab('journal')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
              activeTab === 'journal'
                ? 'bg-slate-800 text-white font-semibold shadow-inner border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            Transactions
          </button>

          <button
            id="tab-cash-ledger"
            onClick={() => setActiveTab('cash')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
              activeTab === 'cash'
                ? 'bg-slate-800 text-white font-semibold shadow-inner border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Wallet className="w-4 h-4 text-amber-400" />
            Cash Ledger
          </button>

          <button
            id="tab-reports"
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
              activeTab === 'reports'
                ? 'bg-slate-800 text-white font-semibold shadow-inner border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-purple-400" />
            Reports and performance
          </button>

          <button
            id="tab-directory"
            onClick={() => setActiveTab('directory')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
              activeTab === 'directory'
                ? 'bg-slate-800 text-white font-semibold shadow-inner border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <ListOrdered className="w-4 h-4 text-teal-400" />
            Stocks &amp; Prices
          </button>
        </nav>
      </div>
    </header>
  );
};
