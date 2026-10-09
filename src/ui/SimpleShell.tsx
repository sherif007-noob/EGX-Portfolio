import './ui.css';
import { PillGroup } from './Pill';
import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Database,
  Gift,
  HeartPulse,
  Home,
  Landmark,
  Layers,
  ListChecks,
  ListOrdered,
  MoreHorizontal,
  Plus,
  RefreshCw,
  ScanLine,
  Table2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { NavigationTab } from '../components/Header';

export interface SimpleShellProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  onOpenGoogleSheets: () => void;
  onOpenAddTrade: () => void;
  onOpenBonusShares?: () => void;
  onOpenIpoSubscription?: () => void;
  onOpenBackupModal?: () => void;
  onOpenScreenshotModal?: () => void;
  onOpenPriceAlerts?: () => void;
  onQuickAddCash?: () => void;
  unreadAlertCount?: number;
  isAlertsActive?: boolean;
  isSheetsConnected: boolean;
  isTokenExpired?: boolean;
  onSyncLivePrices?: () => void;
  isSyncingPrices?: boolean;
  onOpenSettings?: () => void;
}

type Icon = React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;

/** Tabs the shell groups under each bottom-bar entry. */
export const ACTIVITY_TABS: NavigationTab[] = ['journal', 'cash', 'closed_cycles'];

const MAIN_TABS: Array<{ id: string; label: string; icon: Icon; target: NavigationTab; tabs: NavigationTab[] }> = [
  { id: 'home', label: 'Home', icon: Home, target: 'overview', tabs: ['overview'] },
  { id: 'holdings', label: 'Holdings', icon: Layers, target: 'positions', tabs: ['positions'] },
  { id: 'activity', label: 'Activity', icon: ListChecks, target: 'journal', tabs: ACTIVITY_TABS },
  { id: 'reports', label: 'Reports', icon: BarChart3, target: 'reports', tabs: ['reports'] },
];

interface SheetItem {
  icon: Icon;
  label: string;
  hint?: string;
  color: string;
  onSelect?: () => void;
}

const Sheet: React.FC<{ title: string; items: SheetItem[]; onClose: () => void }> = ({ title, items, onClose }) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const visible = items.filter((item) => item.onSelect);
  return (
    <div className="ui-scrim" onClick={onClose}>
      <div className="ui-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="ui-sheet-title">{title}</div>
        {visible.map((item) => {
          const ItemIcon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              className="ui-sheet-item"
              onClick={() => {
                onClose();
                item.onSelect?.();
              }}
            >
              <span
                className="ui-avatar"
                style={{ ['--av' as string]: item.color, width: 34, height: 34 }}
                aria-hidden="true"
              >
                <ItemIcon size={17} aria-hidden />
              </span>
              <span>
                {item.label}
                {item.hint && <small>{item.hint}</small>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const SimpleShell: React.FC<SimpleShellProps> = ({
  activeTab,
  setActiveTab,
  onOpenGoogleSheets,
  onOpenAddTrade,
  onOpenBonusShares,
  onOpenIpoSubscription,
  onOpenBackupModal,
  onOpenScreenshotModal,
  onOpenPriceAlerts,
  onQuickAddCash,
  unreadAlertCount = 0,
  isSheetsConnected,
  isTokenExpired = false,
  onSyncLivePrices,
  isSyncingPrices = false,
  onOpenSettings,
}) => {
  const [sheet, setSheet] = useState<'add' | 'more' | null>(null);
  const close = () => setSheet(null);
  const moreActive = activeTab === 'directory';

  const addItems: SheetItem[] = [
    { icon: Plus, label: 'Trade', hint: 'Buy or sell shares', color: 'var(--ui-teal)', onSelect: onOpenAddTrade },
    { icon: ScanLine, label: 'Scan broker receipt', hint: 'Auto-fill from a screenshot', color: 'var(--ui-blue)', onSelect: onOpenScreenshotModal },
    { icon: Wallet, label: 'Deposit or withdraw cash', color: 'var(--ui-amber)', onSelect: onQuickAddCash },
    { icon: Gift, label: 'Bonus shares', color: 'var(--ui-purple)', onSelect: onOpenBonusShares },
    { icon: Landmark, label: 'IPO subscription', color: 'var(--ui-coral)', onSelect: onOpenIpoSubscription },
  ];

  const moreItems: SheetItem[] = [
    { icon: ListOrdered, label: 'Stocks and prices', color: 'var(--ui-teal)', onSelect: () => setActiveTab('directory') },
    { icon: Bell, label: 'Price alerts', hint: unreadAlertCount > 0 ? `${unreadAlertCount} unread` : undefined, color: 'var(--ui-amber)', onSelect: onOpenPriceAlerts },
    {
      icon: Table2,
      label: 'Google Sheets',
      hint: isTokenExpired ? 'Sign-in expired, reconnect' : isSheetsConnected ? 'Connected' : 'Not connected',
      color: 'var(--ui-teal)',
      onSelect: onOpenGoogleSheets,
    },
    { icon: Database, label: 'Backup and restore', hint: 'Export, import, reconcile ledger', color: 'var(--ui-blue)', onSelect: onOpenBackupModal },
    { icon: HeartPulse, label: 'Data health', color: 'var(--ui-coral)', onSelect: onOpenSettings },
  ];

  return (
    <>
      <header className="ui-topbar">
        <div className="ui-topbar-inner">
          <div className="ui-brand">
            <span className="ui-brand-mark" aria-hidden="true"><TrendingUp size={16} /></span>
            EGX Portfolio
          </div>

          <nav className="ui-desktop-tabs" aria-label="Primary">
            {MAIN_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="ui-desktop-tab"
                aria-current={item.tabs.includes(activeTab) ? 'page' : undefined}
                onClick={() => setActiveTab(item.target)}
              >
                <item.icon size={16} aria-hidden />
                {item.label}
              </button>
            ))}
            <button
              type="button"
              className="ui-desktop-tab"
              aria-current={moreActive ? 'page' : undefined}
              onClick={() => setSheet('more')}
            >
              <MoreHorizontal size={16} aria-hidden />
              More
            </button>
          </nav>
          <span className="ui-spacer" />

          {onOpenPriceAlerts && (
            <button
              type="button"
              className="ui-iconbtn"
              onClick={onOpenPriceAlerts}
              aria-label={unreadAlertCount > 0 ? `Price alerts, ${unreadAlertCount} unread` : 'Price alerts'}
            >
              <Bell size={20} aria-hidden />
              {unreadAlertCount > 0 && <span className="ui-badge-dot" aria-hidden="true" />}
            </button>
          )}
          {onSyncLivePrices && (
            <button type="button" className="ui-iconbtn" onClick={onSyncLivePrices} disabled={isSyncingPrices} aria-label={isSyncingPrices ? 'Syncing prices' : 'Sync prices'}>
              <RefreshCw size={20} aria-hidden className={isSyncingPrices ? 'animate-spin' : undefined} />
            </button>
          )}
          {isTokenExpired && (
            <button type="button" className="ui-iconbtn" onClick={onOpenGoogleSheets} aria-label="Google Sheets sign-in expired">
              <AlertTriangle size={20} aria-hidden style={{ color: 'var(--ui-warn)' } as React.CSSProperties} />
            </button>
          )}
          <button type="button" className="ui-add-btn" onClick={() => setSheet('add')}>
            <Plus size={16} aria-hidden /> Add
          </button>
        </div>
      </header>

      <button type="button" className="ui-fab" aria-label="Add" onClick={() => setSheet('add')}>
        <Plus size={26} aria-hidden />
      </button>

      <nav className="ui-bottom-nav" aria-label="Primary">
        {MAIN_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={item.tabs.includes(activeTab) ? 'page' : undefined}
            onClick={() => setActiveTab(item.target)}
          >
            <item.icon size={22} aria-hidden />
            {item.label}
          </button>
        ))}
        <button type="button" aria-current={moreActive ? 'page' : undefined} onClick={() => setSheet('more')}>
          <MoreHorizontal size={22} aria-hidden />
          More
        </button>
      </nav>

      {sheet === 'add' && <Sheet title="Add" items={addItems} onClose={close} />}
      {sheet === 'more' && <Sheet title="More" items={moreItems} onClose={close} />}
    </>
  );
};

const ACTIVITY_SEGMENTS: Array<{ tab: NavigationTab; label: string }> = [
  { tab: 'journal', label: 'Transactions' },
  { tab: 'cash', label: 'Cash' },
  { tab: 'closed_cycles', label: 'Closed' },
];

/** Segmented switch shown above the Transactions, Cash and Closed Cycles views. */
export const ActivitySwitcher: React.FC<{ activeTab: NavigationTab; setActiveTab: (tab: NavigationTab) => void }> = ({
  activeTab,
  setActiveTab,
}) => (
  <section className="ui-activity-nav" aria-label="Activity navigation">
    <div className="ui-activity-heading">
      <h1>Activity</h1>
      <span className="ui-sm">Trades, cash and completed positions</span>
    </div>
    <PillGroup label="Activity view" value={activeTab} onChange={setActiveTab}
      choices={ACTIVITY_SEGMENTS.map(segment => ({value:segment.tab,label:segment.label}))}/>

  </section>
);
