import React from 'react';
import { PortfolioMetrics, PerformanceStats } from '../types';
import { 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck, 
  Activity,
  RefreshCw,
  Clock,
  Radio,
  Receipt,
  RotateCcw
} from 'lucide-react';
import { EGXScheduleStatus } from '../services/marketPriceSync';

const EGP_FORMATTER = new Intl.NumberFormat('en-EG', {
  style: 'decimal',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatEgp = (val: number) => EGP_FORMATTER.format(val);

interface PortfolioSummaryProps {
  metrics: PortfolioMetrics;
  stats: PerformanceStats;
  onQuickAddCash?: () => void;
  onSyncLivePrices?: () => void;
  onReconcileLedger?: () => void;
  isSyncingPrices?: boolean;
  lastPriceSyncTime?: string | null;
  scheduleStatus?: EGXScheduleStatus;
}

const PortfolioSummaryComponent: React.FC<PortfolioSummaryProps> = ({
  metrics,
  stats,
  onQuickAddCash,
  onSyncLivePrices,
  onReconcileLedger,
  isSyncingPrices = false,
  lastPriceSyncTime,
  scheduleStatus,
}) => {
  const isPositiveUnrealized = metrics.unrealizedPnlEgp >= 0;
  const isPositiveRealized = metrics.realizedPnlEgp >= 0;
  const isPositiveDay = metrics.dayChangeEgp >= 0;
  const dayGlowClass =
    metrics.dayChangeEgp > 0
      ? 'premium-glow-win'
      : metrics.dayChangeEgp < 0
      ? 'premium-glow-loss'
      : 'premium-glow-breakeven';
  const unrealizedGlowClass =
    metrics.unrealizedPnlEgp > 0
      ? 'premium-glow-win'
      : metrics.unrealizedPnlEgp < 0
      ? 'premium-glow-loss'
      : 'premium-glow-breakeven';
  const realizedGlowClass =
    metrics.realizedPnlEgp > 0
      ? 'premium-glow-win'
      : metrics.realizedPnlEgp < 0
      ? 'premium-glow-loss'
      : 'premium-glow-breakeven';
  const totalMarketVal = metrics.totalMarketValue !== undefined ? metrics.totalMarketValue : Math.max(0, metrics.totalValue - metrics.cashBalance);

  return (
    <div className="premium-hierarchy-h0 space-y-4" data-hierarchy="h0">
      {/* Phase 8.1 — portfolio hierarchy: hero -> primary support -> secondary support. */}
      <div className="space-y-2.5 sm:space-y-3">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-6">
          {/* H1 — Total Portfolio Value */}
          <div
            className={`premium-card premium-hero-card premium-hierarchy-h1 premium-overview-hero col-span-2 rounded-2xl p-4 sm:p-5 md:col-span-2 ${dayGlowClass}`}
            data-hierarchy="h1"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="premium-type-metric-label">Total Portfolio Value</div>
                <div className="mt-2 flex min-w-0 items-baseline gap-1.5">
                  <span className="premium-type-metric premium-type-metric-hero font-mono text-white">
                    {formatEgp(metrics.totalValue)}
                  </span>
                  <span className="premium-type-unit shrink-0">EGP</span>
                </div>
              </div>
              <span className="hidden shrink-0 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold text-cyan-300 sm:inline-flex">
                Equities + Cash
              </span>
            </div>

            <div className="premium-overview-today mt-3 flex items-center justify-between gap-3 rounded-xl px-3 py-2.5">
              <div className="min-w-0">
                <div className="premium-type-metadata font-semibold">Today</div>
                <div
                  className={`mt-0.5 flex items-center gap-1.5 text-sm font-bold ${
                    isPositiveDay ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {isPositiveDay ? (
                    <TrendingUp className="h-4 w-4 shrink-0" />
                  ) : (
                    <TrendingDown className="h-4 w-4 shrink-0" />
                  )}
                  <span className="font-mono">
                    {isPositiveDay ? '+' : ''}{formatEgp(metrics.dayChangeEgp)} EGP
                  </span>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-lg border px-2 py-1 font-mono text-xs font-bold ${
                  isPositiveDay
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                }`}
              >
                {isPositiveDay ? '+' : ''}{metrics.dayChangePercent.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* H2 — Unrealized P&L */}
          <div
            className={`premium-card premium-hierarchy-h2 col-span-1 flex flex-col justify-between rounded-2xl p-3.5 sm:p-4 md:col-span-2 ${unrealizedGlowClass}`}
            data-hierarchy="h2"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="premium-type-metric-label">Unrealized P&amp;L</span>
                <span className="hidden text-[10px] text-slate-500 lg:inline">Net of Buy Fees</span>
              </div>
              <div className="mt-2 flex min-w-0 items-baseline gap-1.5">
                <span
                  className={`premium-type-metric premium-type-metric-primary min-w-0 font-mono ${
                    isPositiveUnrealized ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {isPositiveUnrealized ? '+' : ''}{formatEgp(metrics.unrealizedPnlEgp)}
                </span>
                <span className="premium-type-unit shrink-0">EGP</span>
              </div>
            </div>
            <div className="mt-3 flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between">
              <span
                className={`rounded-md border px-1.5 py-0.5 font-mono text-xs font-semibold ${
                  isPositiveUnrealized
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                }`}
              >
                {isPositiveUnrealized ? '+' : ''}{metrics.unrealizedPnlPercent.toFixed(2)}%
              </span>
              {metrics.grossUnrealizedPnlEgp !== undefined && (
                <span className="premium-type-metadata font-mono" title="Gross gain before deducting buy commissions">
                  Gross: {metrics.grossUnrealizedPnlEgp >= 0 ? '+' : ''}{formatEgp(metrics.grossUnrealizedPnlEgp)}
                </span>
              )}
            </div>
          </div>

          {/* H2 — Market exposure */}
          <div
            className="premium-card premium-material-tone-cyan premium-hierarchy-h2 col-span-1 flex flex-col justify-between rounded-2xl p-3.5 sm:p-4 md:col-span-2"
            data-hierarchy="h2"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="premium-type-metric-label">Total Market Value</span>
                <span className="hidden rounded-md border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300 lg:inline-flex">
                  {metrics.totalPositions} Holdings
                </span>
              </div>
              <div className="mt-2 flex min-w-0 items-baseline gap-1.5">
                <span className="premium-type-metric premium-type-metric-primary min-w-0 font-mono text-white">
                  {formatEgp(totalMarketVal)}
                </span>
                <span className="premium-type-unit shrink-0">EGP</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="premium-type-metadata">
                Cost: <span className="font-mono font-medium text-slate-300">{formatEgp(metrics.totalCost)}</span>
              </span>
              <span className="font-mono text-xs font-semibold text-cyan-400">
                {((totalMarketVal / (metrics.totalValue || 1)) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* H3 — supporting metrics */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
          <div
            className={`premium-card premium-hierarchy-h3 flex flex-col justify-between rounded-2xl p-3 sm:p-3.5 ${realizedGlowClass}`}
            data-hierarchy="h3"
          >
            <div>
              <div className="premium-type-metric-label">Realized Gain (Booked)</div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span
                  className={`premium-type-metric premium-type-metric-secondary font-mono ${
                    isPositiveRealized ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {isPositiveRealized ? '+' : ''}{formatEgp(metrics.realizedPnlEgp)}
                </span>
                <span className="premium-type-unit">EGP</span>
              </div>
            </div>
            <div className="premium-type-metadata mt-2 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>{stats.winningTrades} W / {stats.losingTrades} L</span>
            </div>
          </div>

          <div
            className="premium-card premium-material-tone-blue premium-hierarchy-h3 flex flex-col justify-between rounded-2xl p-3 sm:p-3.5"
            data-hierarchy="h3"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="premium-type-metric-label">Cash Available</span>
                <button
                  onClick={onQuickAddCash}
                  className="premium-action premium-action-priority-secondary rounded-lg px-2 py-1 text-[10px] font-semibold"
                >
                  Adjust
                </button>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="premium-type-metric premium-type-metric-secondary font-mono text-white">
                  {formatEgp(metrics.cashBalance)}
                </span>
                <span className="premium-type-unit">EGP</span>
              </div>
            </div>
            <div className="premium-type-metadata mt-2">
              {((metrics.cashBalance / (metrics.totalValue || 1)) * 100).toFixed(1)}% of portfolio
            </div>
          </div>

          <div
            className="premium-card premium-material-tone-amber premium-hierarchy-h3 premium-overview-fees col-span-2 flex flex-col justify-between rounded-2xl p-3 sm:col-span-1 sm:p-3.5"
            data-hierarchy="h3"
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="premium-type-metric-label">Brokerage Fees</div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="premium-type-metric premium-type-metric-secondary font-mono text-amber-400">
                    {formatEgp(metrics.totalFeesPaid || 0)}
                  </span>
                  <span className="premium-type-unit">EGP</span>
                </div>
              </div>
              <Receipt className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/80" />
            </div>
            <div className="premium-type-metadata mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-slate-800/60 pt-2">
              <span>Open: <span className="font-mono text-slate-300">{formatEgp(metrics.openFeesPaid || 0)}</span></span>
              <span>Closed: <span className="font-mono text-slate-300">{formatEgp(metrics.closedFeesPaid || 0)}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* H4 utility/context strip — deliberately below the portfolio summary. */}
      <div
        className="premium-glass premium-material-tone-cyan premium-hierarchy-h4 premium-overview-market-strip flex flex-col justify-between gap-3 rounded-2xl p-3 md:flex-row md:items-center"
        data-hierarchy="h4"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="premium-type-metadata flex items-center gap-1.5 font-bold text-slate-400">
              <Activity className="h-3.5 w-3.5 text-cyan-400/80" />
              EGX Live Market Feed
            </span>
            {scheduleStatus && (
              <span
                className={`inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-tight ${
                  scheduleStatus.isSessionActive
                    ? 'border-emerald-700/45 bg-emerald-950/35 text-emerald-400'
                    : 'border-slate-700/70 bg-slate-900/55 text-slate-500'
                }`}
                title="Trading schedule: Sun-Thu 09:47 - 16:30 Cairo time (:02, :17, :32, :47)"
              >
                <Radio className={`h-3 w-3 ${scheduleStatus.isSessionActive ? 'animate-pulse text-emerald-400' : 'text-slate-600'}`} />
                {scheduleStatus.isSessionActive ? 'Session Active' : 'Session Closed'}
                <span className="ml-0.5 font-mono text-slate-500">({scheduleStatus.cairoTimeString} Cairo)</span>
              </span>
            )}
          </div>
          <div className="premium-type-metadata flex flex-wrap items-center gap-2">
            {lastPriceSyncTime ? (
              <span className="flex items-center gap-1 text-slate-400">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                Last updated: <span className="font-semibold text-slate-300">{lastPriceSyncTime}</span>
              </span>
            ) : (
              <span>Scheduled syncs: Sun-Thu every 15m (+2m offset)</span>
            )}
            {scheduleStatus?.nextTickLabel && (
              <span>
                • Next auto-sync: <span className="font-mono font-medium text-amber-400/90">{scheduleStatus.nextTickLabel} Cairo</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex w-full items-center justify-end gap-2 md:w-auto">
          {onReconcileLedger && (
            <button
              id="btn-reconcile-ledger-overview"
              onClick={onReconcileLedger}
              className="premium-action premium-action-priority-utility flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold"
              title="Re-audit transactions and compute positions and metrics"
            >
              <RotateCcw className="h-3.5 w-3.5 text-emerald-400/85" />
              <span className="hidden sm:inline">Reconcile Ledger</span>
            </button>
          )}

          {onSyncLivePrices && (
            <button
              id="btn-sync-live-prices-overview"
              onClick={onSyncLivePrices}
              disabled={isSyncingPrices}
              className="premium-action premium-action-priority-utility flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
              title="Sync live quotes for ~300 EGX stocks"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncingPrices ? 'animate-spin text-cyan-400' : 'text-cyan-400/85'}`} />
              <span className="hidden sm:inline">{isSyncingPrices ? 'Syncing...' : 'Sync Prices'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const PortfolioSummary = React.memo(PortfolioSummaryComponent);
