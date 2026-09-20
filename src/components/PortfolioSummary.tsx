import React from 'react';
import { PortfolioMetrics, PerformanceStats } from '../types';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Wallet, 
  ShieldCheck, 
  PieChart, 
  Activity,
  RefreshCw,
  Clock,
  Radio,
  Receipt,
  RotateCcw
} from 'lucide-react';
import { EGXScheduleStatus } from '../services/marketPriceSync';

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

export const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({
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

  const formatEgp = (val: number) => {
    return new Intl.NumberFormat('en-EG', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="space-y-4">
      {/* Live Market Price Sync Bar */}
      <div className="premium-glass flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              EGX Live Market Feed
            </span>
            {scheduleStatus && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                  scheduleStatus.isSessionActive
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/60'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title="Trading schedule: Sun-Thu 09:47 - 16:30 Cairo time (:02, :17, :32, :47)"
              >
                <Radio className={`w-3 h-3 ${scheduleStatus.isSessionActive ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                {scheduleStatus.isSessionActive ? 'Session Active' : 'Session Closed'}
                <span className="text-slate-400 font-mono ml-0.5">({scheduleStatus.cairoTimeString} Cairo)</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
            {lastPriceSyncTime ? (
              <span className="flex items-center gap-1 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Last updated: <span className="font-semibold text-white">{lastPriceSyncTime}</span>
              </span>
            ) : (
              <span className="text-slate-400">Scheduled syncs: Sun-Thu every 15m (+2m offset)</span>
            )}
            {scheduleStatus?.nextTickLabel && (
              <span className="text-slate-400">
                • Next auto-sync: <span className="text-amber-400 font-mono font-medium">{scheduleStatus.nextTickLabel} Cairo</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onReconcileLedger && (
            <button
              id="btn-reconcile-ledger-overview"
              onClick={onReconcileLedger}
              className="premium-control flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/70 hover:bg-slate-700/80 text-emerald-300 border border-slate-700/70 hover:border-emerald-500/40 rounded-xl text-xs font-semibold"
              title="Re-audit transactions and compute positions and metrics"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Reconcile Ledger</span>
            </button>
          )}

          {onSyncLivePrices && (
            <button
              id="btn-sync-live-prices-overview"
              onClick={onSyncLivePrices}
              disabled={isSyncingPrices}
              className="premium-control flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/70 hover:bg-slate-700/80 text-cyan-300 border border-slate-700/70 hover:border-cyan-500/40 rounded-xl text-xs font-semibold disabled:opacity-50"
              title="Sync live quotes for ~300 EGX stocks"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPrices ? 'animate-spin text-cyan-400' : 'text-cyan-400'}`} />
              <span className="hidden sm:inline">{isSyncingPrices ? 'Syncing...' : 'Sync Prices'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Portfolio Value */}
        <div className={`premium-card premium-hero-card p-4 rounded-2xl flex flex-col justify-between ${dayGlowClass}`}>
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium">Total Portfolio Value</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                Equities + Cash
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {formatEgp(metrics.totalValue)}
              </span>
              <span className="text-[11px] font-semibold text-slate-400">EGP</span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span
              className={`inline-flex items-center gap-1 font-semibold ${
                isPositiveDay ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isPositiveDay ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {isPositiveDay ? '+' : ''}{formatEgp(metrics.dayChangeEgp)} EGP ({isPositiveDay ? '+' : ''}
              {metrics.dayChangePercent.toFixed(2)}%)
            </span>
            <span className="text-slate-500 text-[11px]">today</span>
          </div>
        </div>

        {/* Total Market Value (Total Invested / Open Positions Value) */}
        <div className="premium-card p-4 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium">Total Market Value</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-400 font-semibold border border-cyan-500/20">
                {metrics.totalPositions} Holdings
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {formatEgp(totalMarketVal)}
              </span>
              <span className="text-[11px] font-semibold text-slate-400">EGP</span>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>Cost: <span className="font-mono text-slate-300 font-medium">{formatEgp(metrics.totalCost)}</span></span>
            <span className="text-[11px] text-cyan-400 font-semibold">{((totalMarketVal / (metrics.totalValue || 1)) * 100).toFixed(1)}%</span>
          </div>
        </div>

        {/* Unrealized Gain */}
        <div className={`premium-card p-4 rounded-2xl flex flex-col justify-between ${unrealizedGlowClass}`}>
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Unrealized P&amp;L</span>
              <span className="text-[10px] text-slate-500 font-normal">Net of Buy Fees</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span
                className={`text-xl sm:text-2xl font-bold tracking-tight ${
                  isPositiveUnrealized ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isPositiveUnrealized ? '+' : ''}{formatEgp(metrics.unrealizedPnlEgp)}
              </span>
              <span className="text-[11px] text-slate-400">EGP</span>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span
              className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                isPositiveUnrealized
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}
            >
              {isPositiveUnrealized ? '+' : ''}{metrics.unrealizedPnlPercent.toFixed(2)}%
            </span>
            {metrics.grossUnrealizedPnlEgp !== undefined && (
              <span className="text-[10px] text-slate-400 font-mono" title="Gross gain before deducting buy commissions">
                Gross: {metrics.grossUnrealizedPnlEgp >= 0 ? '+' : ''}{formatEgp(metrics.grossUnrealizedPnlEgp)}
              </span>
            )}
          </div>
        </div>

        {/* Realized Profit (Closed Trades) */}
        <div className={`premium-card p-4 rounded-2xl flex flex-col justify-between ${realizedGlowClass}`}>
          <div>
            <div className="text-xs text-slate-400 font-medium">Realized Gain (Booked)</div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span
                className={`text-xl sm:text-2xl font-bold tracking-tight ${
                  isPositiveRealized ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isPositiveRealized ? '+' : ''}{formatEgp(metrics.realizedPnlEgp)}
              </span>
              <span className="text-[11px] text-slate-400">EGP</span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{stats.winningTrades} W / {stats.losingTrades} L</span>
          </div>
        </div>

        {/* Cash Balance */}
        <div className="premium-card p-4 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Cash Available</span>
              <button
                onClick={onQuickAddCash}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold underline"
              >
                Adjust
              </button>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {formatEgp(metrics.cashBalance)}
              </span>
              <span className="text-[11px] text-slate-400">EGP</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {((metrics.cashBalance / (metrics.totalValue || 1)) * 100).toFixed(1)}% of portfolio
          </div>
        </div>

        {/* Total Brokerage Fees Paid */}
        <div className="premium-card p-4 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Brokerage Fees</span>
              <Receipt className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-amber-400 font-mono">
                {formatEgp(metrics.totalFeesPaid || 0)}
              </span>
              <span className="text-[11px] text-slate-400">EGP</span>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-1.5">
            <span>Open: <span className="text-slate-300 font-mono">{formatEgp(metrics.openFeesPaid || 0)}</span></span>
            <span>Closed: <span className="text-slate-300 font-mono">{formatEgp(metrics.closedFeesPaid || 0)}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
};
