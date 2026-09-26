import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Settings2,
} from 'lucide-react';

export type NavigationTab = 'overview' | 'positions' | 'closed_cycles' | 'journal' | 'cash' | 'reports' | 'directory';

const NAV_GROUPS = [
  {
    label: 'Portfolio',
    items: [
      { tab: 'overview', id: 'tab-overview', label: 'Overview', compactLabel: 'Overview', icon: TrendingUp, accent: '16 185 129' },
      { tab: 'positions', id: 'tab-positions', label: 'Open Positions', compactLabel: 'Positions', icon: Layers, accent: '59 130 246' },
      { tab: 'closed_cycles', id: 'tab-closed-cycles', label: 'Closed Cycles', compactLabel: 'Cycles', icon: RotateCcw, accent: '168 85 247' },
    ],
  },
  {
    label: 'Activity',
    items: [
      { tab: 'journal', id: 'tab-transactions', label: 'Transactions', compactLabel: 'Transactions', icon: BookOpen, accent: '245 158 11' },
      { tab: 'cash', id: 'tab-cash-ledger', label: 'Cash Ledger', compactLabel: 'Cash', icon: Wallet, accent: '245 158 11' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { tab: 'reports', id: 'tab-reports', label: 'Reports & Performance', compactLabel: 'Reports', icon: BarChart3, accent: '168 85 247' },
      { tab: 'directory', id: 'tab-directory', label: 'Stocks & Prices', compactLabel: 'Stocks', icon: ListOrdered, accent: '20 184 166' },
    ],
  },
] as const satisfies ReadonlyArray<{
  label: string;
  items: ReadonlyArray<{
    tab: NavigationTab;
    id: string;
    label: string;
    compactLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
  }>;
}>;

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
  onOpenSettings?: () => void;
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
  onOpenSettings,
}) => {
  const navScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollNavLeft, setCanScrollNavLeft] = useState(false);
  const [canScrollNavRight, setCanScrollNavRight] = useState(false);

  const updateNavOverflow = useCallback(() => {
    const container = navScrollRef.current;
    if (!container) return;
    const tolerance = 2;
    setCanScrollNavLeft(container.scrollLeft > tolerance);
    setCanScrollNavRight(
      container.scrollLeft + container.clientWidth < container.scrollWidth - tolerance,
    );
  }, []);

  useEffect(() => {
    const container = navScrollRef.current;
    if (!container) return;

    updateNavOverflow();
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateNavOverflow)
      : null;
    observer?.observe(container);
    window.addEventListener('resize', updateNavOverflow);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateNavOverflow);
    };
  }, [updateNavOverflow]);

  const scrollNavItemIntoView = useCallback((
    item: HTMLElement | null,
    behavior: ScrollBehavior,
  ) => {
    const container = navScrollRef.current;
    if (!container || !item) return;

    const containerRect = container.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const edgePadding = 24;
    let nextLeft = container.scrollLeft;

    if (itemRect.left < containerRect.left + edgePadding) {
      nextLeft += itemRect.left - containerRect.left - edgePadding;
    } else if (itemRect.right > containerRect.right - edgePadding) {
      nextLeft += itemRect.right - containerRect.right + edgePadding;
    } else {
      return;
    }

    const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    container.scrollTo({
      left: Math.min(maxLeft, Math.max(0, nextLeft)),
      behavior,
    });
  }, []);

  useEffect(() => {
    const container = navScrollRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>('[aria-current="page"]');
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    scrollNavItemIntoView(active, reduceMotion ? 'auto' : 'smooth');
    window.requestAnimationFrame(updateNavOverflow);
  }, [activeTab, scrollNavItemIntoView, updateNavOverflow]);

  const handleNavKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-nav-tab="true"]'),
    );
    const currentIndex = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (currentIndex < 0 || tabs.length === 0) return;

    event.preventDefault();

    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;

    const nextTab = tabs[nextIndex];
    nextTab?.focus();
    scrollNavItemIntoView(nextTab ?? null, 'auto');
  };

  return (
    <header className="premium-header sticky top-0 z-40 w-full border-b">
      {/* Top Bar */}
      <div className="premium-safe-inline-header premium-header-safe-top max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="premium-header-top-row flex flex-wrap items-center justify-between min-h-[4rem] py-2 gap-y-2.5 gap-x-2">
          
          {/* Brand Logo & Title */}
          <div className="premium-header-brand flex items-center gap-3 shrink-0">
            <div className="premium-header-logo premium-inset-glass relative w-10 h-10 rounded-xl flex items-center justify-center p-1.5 shrink-0">
              <img src="/icon.svg" alt="EGX Logo" className="w-full h-full object-contain" />
              <span className="absolute -bottom-1 -right-1 inline-flex h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.32)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  EGX Portfolio
                </h1>
                <span className="premium-header-market-badge hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  EGX Equities • EGP
                </span>
              </div>
              <p className="premium-header-subtitle text-[11px] text-slate-400 hidden sm:block">
                Live Prices, Analytics &amp; Automated Schema Sync
              </p>
            </div>
          </div>

          {/* Phase 9 command zone: utilities are grouped separately from creation actions. */}
          <div className="premium-header-action-rail premium-header-command-zone flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1 sm:justify-end">
            <div className="premium-header-utility-scroller min-w-0 flex-1 overflow-x-auto overscroll-x-contain scrollbar-none sm:flex-none sm:overflow-visible">
              <div className="premium-header-utility-cluster flex w-max items-center gap-1 rounded-xl p-1 sm:gap-1.5">
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
                <span className="premium-header-action-label hidden lg:inline">Price Alerts</span>
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
                <span className="premium-header-action-label hidden md:inline">{isSyncingPrices ? 'Syncing...' : 'Sync Prices'}</span>
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
              <span className="premium-header-action-label hidden md:inline">
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
                <span className="premium-header-action-label hidden lg:inline">Backup &amp; Reconcile</span>
              </button>
            )}

              {/* Settings placeholder — intentionally no settings modal in Phase 9. */}
              <button
                id="header-settings-btn"
                onClick={onOpenSettings}
                aria-label="Settings"
                aria-haspopup="dialog"
                className="premium-action premium-header-utility-action flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                title="Settings — reserved for a future phase"
              >
                <Settings2 className="h-3.5 w-3.5 text-slate-300" />
                <span className="premium-header-action-label hidden 2xl:inline">Settings</span>
              </button>
            </div>
            </div>

            <div className="premium-header-create-cluster flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Scan Screenshot Button */}
            {onOpenScreenshotModal && (
              <button
                id="header-scan-btn"
                onClick={onOpenScreenshotModal}
                className="premium-action premium-action-success flex shrink-0 items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                title="Upload trade screenshot or receipt to scan and log"
              >
                <Zap className="w-3.5 h-3.5 text-emerald-200" />
                <span className="premium-header-action-label hidden lg:inline">Scan Receipt</span>
              </button>
            )}

            {/* Add Trade Button */}
            <button
              id="header-add-trade-btn"
              onClick={onOpenAddTrade}
              className="premium-action premium-action-primary premium-shimmer-border flex shrink-0 items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span className="premium-header-action-label hidden sm:inline">Add Trade</span>
            </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="premium-nav-shell relative border-t border-slate-700/40 bg-slate-950/15">
        <div className="premium-safe-inline-header relative mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div
            ref={navScrollRef}
            onScroll={updateNavOverflow}
            className="premium-nav-scroller overflow-x-auto overscroll-x-contain scrollbar-none"
          >
            <nav
              className="premium-header-nav-row flex min-w-max items-center py-2"
              aria-label="Portfolio navigation"
              onKeyDown={handleNavKeyDown}
            >
              {NAV_GROUPS.map((group, groupIndex) => (
                <React.Fragment key={group.label}>
                  {groupIndex > 0 && (
                    <span
                      className="premium-nav-divider mx-1.5 h-6 w-px shrink-0 sm:mx-2.5"
                      aria-hidden="true"
                    />
                  )}
                  <div
                    className="flex items-center gap-1 sm:gap-1.5"
                    role="group"
                    aria-label={group.label}
                  >
                    <span className="premium-nav-group-label hidden 2xl:inline-flex px-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-600">
                      {group.label}
                    </span>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = activeTab === item.tab;
                      return (
                        <button
                          key={item.tab}
                          id={item.id}
                          aria-current={active ? 'page' : undefined}
                          aria-label={item.label}
                          data-nav-tab="true"
                          onClick={() => setActiveTab(item.tab)}
                          className={`premium-nav premium-nav-item flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium sm:gap-2 sm:px-3 sm:text-sm ${
                            active
                              ? 'premium-nav-active text-white font-semibold'
                              : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/[0.035]'
                          }`}
                          style={{ '--premium-nav-accent': item.accent } as React.CSSProperties}
                        >
                          <Icon className="premium-nav-icon h-4 w-4" />
                          <span className="2xl:hidden">{item.compactLabel}</span>
                          <span className="hidden 2xl:inline">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </React.Fragment>
              ))}
            </nav>
          </div>

          <div
            className={`premium-nav-edge premium-nav-edge-left pointer-events-none absolute inset-y-0 left-0 w-10 transition-opacity duration-200 ${
              canScrollNavLeft ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden="true"
          />
          <div
            className={`premium-nav-edge premium-nav-edge-right pointer-events-none absolute inset-y-0 right-0 w-10 transition-opacity duration-200 ${
              canScrollNavRight ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden="true"
          />
        </div>
      </div>
    </header>
  );
};
