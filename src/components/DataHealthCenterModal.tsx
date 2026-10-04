import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { PremiumModalMotion } from './PremiumMotion';
import {
  DataHealthItem,
  DataHealthSnapshot,
  DataHealthStatus,
  loadDataHealthSnapshot,
} from '../services/dataHealth';

interface DataHealthCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  heldTickers: string[];
}

const STATUS_META: Record<DataHealthStatus, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  className: string;
}> = {
  healthy: {
    label: 'Healthy',
    icon: CheckCircle2,
    className: 'border-emerald-500/35 bg-emerald-500/8 text-emerald-300',
  },
  warning: {
    label: 'Attention',
    icon: AlertTriangle,
    className: 'border-amber-500/35 bg-amber-500/8 text-amber-300',
  },
  error: {
    label: 'Degraded',
    icon: XCircle,
    className: 'border-rose-500/35 bg-rose-500/8 text-rose-300',
  },
  unknown: {
    label: 'Unknown',
    icon: Activity,
    className: 'border-slate-500/35 bg-slate-500/8 text-slate-300',
  },
};

function cairoTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

const HealthRow: React.FC<{ item: DataHealthItem }> = ({ item }) => {
  const meta = STATUS_META[item.status];
  const Icon = meta.icon;

  return (
    <div className="premium-modal-section rounded-xl border p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {item.label}
          </div>
          <div className="mt-1 text-sm font-bold text-slate-100">{item.value}</div>
        </div>
        <div className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-bold ${meta.className}`}>
          <Icon className="h-3.5 w-3.5" />
          {meta.label}
        </div>
      </div>

      {item.detail && (
        <p className="mt-2 text-[11px] leading-5 text-slate-400">{item.detail}</p>
      )}

      {item.affectedTickers && item.affectedTickers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.affectedTickers.map((ticker) => (
            <span
              key={ticker}
              className="rounded-md border border-amber-500/25 bg-amber-500/8 px-1.5 py-0.5 font-mono text-[10px] text-amber-200"
            >
              {ticker}
            </span>
          ))}
        </div>
      )}

      {item.timestamp && (
        <div className="mt-2 font-mono text-[10px] text-slate-600">
          {cairoTimestamp(item.timestamp)} Cairo
        </div>
      )}
    </div>
  );
};

export const DataHealthCenterModal: React.FC<DataHealthCenterModalProps> = ({
  isOpen,
  onClose,
  heldTickers,
}) => {
  const [snapshot, setSnapshot] = useState<DataHealthSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heldKey = useMemo(
    () => [...new Set(heldTickers.map((ticker) => ticker.trim().toUpperCase()))].sort().join('|'),
    [heldTickers],
  );

  const refresh = useCallback(async () => {
    if (!isOpen) return;
    setIsLoading(true);
    setError(null);
    try {
      const next = await loadDataHealthSnapshot(heldTickers);
      setSnapshot(next);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Could not load data-health diagnostics.');
    } finally {
      setIsLoading(false);
    }
  }, [heldKey, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [isOpen, refresh]);

  const overall = snapshot ? STATUS_META[snapshot.overallStatus] : STATUS_META.unknown;
  const OverallIcon = overall.icon;

  return (
    <PremiumModalMotion
      isOpen={isOpen}
      backdropClassName="premium-modal-backdrop premium-modal-backdrop-panel-scroll fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      panelClassName="premium-modal premium-modal-viewport relative w-full max-w-2xl rounded-2xl p-4 sm:p-6"
      onBackdropClick={onClose}
      panelAriaLabel="Data Health Center"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white">Data Health Center</h3>
            <p className="text-xs text-slate-400">
              Production trust signals for quotes, history, ingestion and Supabase sync
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close data health center"
          onClick={onClose}
          className="premium-icon-action rounded-lg p-1.5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-700/70 bg-slate-950/30 p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <OverallIcon className={`h-4 w-4 ${overall.className.split(' ').at(-1) ?? ''}`} />
            <span className="text-sm font-bold text-slate-100">Overall: {overall.label}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {snapshot
              ? `Expected EGX session ${snapshot.expectedSessionDate} • checked ${cairoTimestamp(snapshot.checkedAt)} Cairo`
              : 'Waiting for a production health snapshot…'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isLoading}
          className="premium-action premium-filter-active-cyan inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Checking…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-500/35 bg-rose-500/8 p-3 text-xs leading-5 text-rose-200">
          <div className="flex items-center gap-2 font-bold">
            <XCircle className="h-4 w-4" />
            Health snapshot failed
          </div>
          <div className="mt-1 text-rose-200/80">{error}</div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {snapshot?.items.map((item) => <HealthRow key={item.id} item={item} />)}
        {!snapshot && !error && (
          <div className="premium-modal-section col-span-full rounded-xl border p-5 text-center text-xs text-slate-500">
            Reading the authoritative production data sources…
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-slate-800 pt-3 text-[10px] leading-4 text-slate-600">
        This surface is diagnostic only. It never fills missing candles, mutates accounting, or changes the selected analytics dataset.
      </div>
    </PremiumModalMotion>
  );
};
