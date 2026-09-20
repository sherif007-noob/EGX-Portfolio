import React, { useState } from 'react';
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
  BellRing,
  LogIn,
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
  onLogin?: () => Promise<any>;
  onLogout: () => void;
  onSyncLivePrices?: () => void;
  isSyncingPrices?: boolean;
  forceSyncToFirestore?: () => Promise<boolean>;
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
  onLogin,
  onLogout,
  onSyncLivePrices,
  isSyncingPrices = false,
  forceSyncToFirestore,
}) => {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  const handleForceSync = async () => {
    if (syncStatus === 'syncing' || !forceSyncToFirestore) return;

    if (!authUser && onLogin) {
      try {
        setSyncStatus('syncing');
        const loginRes = await onLogin();
        if (loginRes?.user) {
          const success = await forceSyncToFirestore();
          setSyncStatus(success ? 'success' : 'error');
          setTimeout(() => setSyncStatus('idle'), 3000);
          return;
        }
      } catch (err) {
        console.warn('Sign-in on force sync cancelled or failed:', err);
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 4000);
        return;
      }
    }

    setSyncStatus('syncing');
    try {
      const success = await forceSyncToFirestore();
      if (success) {
        setSyncStatus('success');
        setTimeout(() => setSyncStatus('idle'), 3000);
      } else {
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 4000);
      }
    } catch (err) {
      console.error('Manual sync failed:', err);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 4000);
    }
  };
  return (
    <header className="premium-header sticky top-0 z-40 w-full border-b">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between min-h-[4rem] py-2 gap-y-3 gap-x-2">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-slate-900/95 to-slate-800/80 border border-slate-700/70 flex items-center justify-center p-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.32),0_0_26px_rgba(34,211,238,0.08)] shrink-0">
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
                className="premium-action relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold group"
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
                className="premium-action premium-filter-active-cyan flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
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
              className={`premium-action flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold ${
                isTokenExpired
                  ? 'premium-action-warning animate-pulse'
                  : isSheetsConnected
                  ? 'premium-action-success'
                  : ''
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

            {/* Force Sync Firebase Button */}
            {forceSyncToFirestore && (
              <button
                id="header-force-sync-btn"
                onClick={handleForceSync}
                disabled={syncStatus === 'syncing'}
                className={`premium-action flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  syncStatus === 'syncing'
                    ? 'premium-action-warning cursor-wait'
                    : syncStatus === 'success'
                    ? 'premium-action-success'
                    : syncStatus === 'error'
                    ? 'premium-action-danger'
                    : ''
                }`}
                title="Force bidirectional sync with Firebase (pulls newest trades from phone & pushes local updates)"
              >
                {syncStatus === 'syncing' ? (
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                ) : syncStatus === 'success' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Database className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span className="hidden sm:inline">
                  {syncStatus === 'syncing'
                    ? 'Syncing...'
                    : syncStatus === 'success'
                    ? 'Synced!'
                    : syncStatus === 'error'
                    ? 'Sync Failed'
                    : 'Force Sync'}
                </span>
              </button>
            )}

            {/* Offline Backup & Ledger Reconcile Modal Trigger */}
            {onOpenBackupModal && (
              <button
                id="header-backup-reconcile-btn"
                onClick={onOpenBackupModal}
                className="premium-action flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold"
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
                className="premium-action premium-action-success flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
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
              className="premium-action premium-action-primary premium-shimmer-border flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Add Trade</span>
            </button>

            {/* User Profile / Auth */}
            {authUser ? (
              <div className="flex items-center gap-1.5 pl-1.5 border-l border-slate-800 shrink-0">
                <div 
                  className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-xs overflow-hidden ring-1 ring-emerald-500/40"
                  title={`Signed in: ${authUser.email || 'User'} (Cloud Synced)`}
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
                  className="premium-icon-action premium-icon-delete p-1.5 rounded-md"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : onLogin ? (
              <button
                id="header-login-btn"
                onClick={async () => {
                  try {
                    await onLogin();
                    if (forceSyncToFirestore) {
                      setTimeout(() => forceSyncToFirestore(), 800);
                    }
                  } catch (e) {
                    console.error('Login error:', e);
                  }
                }}
                className="premium-action premium-action-primary flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
                title="Sign in with Google to enable Firebase Cloud Sync across your devices"
              >
                <LogIn className="w-3.5 h-3.5 text-blue-400" />
                <span>Sign In</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-700/40 bg-slate-950/15 overflow-x-auto scrollbar-none">
        <nav className="flex space-x-1 sm:space-x-3 py-2 min-w-max">
          <button
            id="tab-overview"
            onClick={() => setActiveTab('overview')}
            className={`premium-nav flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border ${
              activeTab === 'overview'
                ? 'premium-nav-active text-white font-semibold border-slate-600/60'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/[0.035]'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Overview
          </button>

          <button
            id="tab-positions"
            onClick={() => setActiveTab('positions')}
            className={`premium-nav flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border ${
              activeTab === 'positions'
                ? 'premium-nav-active text-white font-semibold border-slate-600/60'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/[0.035]'
            }`}
          >
            <Layers className="w-4 h-4 text-blue-400" />
            Open Positions
          </button>

          <button
            id="tab-closed-cycles"
            onClick={() => setActiveTab('closed_cycles')}
            className={`premium-nav flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border ${
              activeTab === 'closed_cycles'
                ? 'premium-nav-active text-white font-semibold border-slate-600/60'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/[0.035]'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-purple-400" />
            Closed Cycles
          </button>

          <button
            id="tab-transactions"
            onClick={() => setActiveTab('journal')}
            className={`premium-nav flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border ${
              activeTab === 'journal'
                ? 'premium-nav-active text-white font-semibold border-slate-600/60'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/[0.035]'
            }`}
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            Transactions
          </button>

          <button
            id="tab-cash-ledger"
            onClick={() => setActiveTab('cash')}
            className={`premium-nav flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border ${
              activeTab === 'cash'
                ? 'premium-nav-active text-white font-semibold border-slate-600/60'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/[0.035]'
            }`}
          >
            <Wallet className="w-4 h-4 text-amber-400" />
            Cash Ledger
          </button>

          <button
            id="tab-reports"
            onClick={() => setActiveTab('reports')}
            className={`premium-nav flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border ${
              activeTab === 'reports'
                ? 'premium-nav-active text-white font-semibold border-slate-600/60'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/[0.035]'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-purple-400" />
            Reports and performance
          </button>

          <button
            id="tab-directory"
            onClick={() => setActiveTab('directory')}
            className={`premium-nav flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border ${
              activeTab === 'directory'
                ? 'premium-nav-active text-white font-semibold border-slate-600/60'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/[0.035]'
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
