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
  Receipt
} from 'lucide-react';
import { EGXScheduleStatus } from '../services/marketPriceSync';

interface PortfolioSummaryProps {
  metrics: PortfolioMetrics;
  stats: PerformanceStats;
  onQuickAddCash: () => void;
  onSyncLivePrices?: () => void;
  isSyncingPrices?: boolean;
  lastPriceSyncTime?: string | null;
  scheduleStatus?: EGXScheduleStatus;
}

export const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({
  metrics,
  stats,
  onQuickAddCash,
  onSyncLivePrices,
  isSyncingPrices = false,
  lastPriceSyncTime,
  scheduleStatus,
}) => {
  const isPositiveUnrealized = metrics.unrealizedPnlEgp >= 0;
  const isPositiveRealized = metrics.realizedPnlEgp >= 0;
  const isPositiveDay = metrics.dayChangeEgp >= 0;

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/90 p-3.5 sm:p-4 rounded-xl border border-slate-800 shadow-sm">
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
          {onSyncLivePrices && (
            <button
              id="btn-sync-live-prices-overview"
              onClick={onSyncLivePrices}
              disabled={isSyncingPrices}
              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-cyan-950/40 transition active:scale-95 disabled:opacity-50"
              title="Fetch live quotes for ~300 EGX stocks directly from TradingView Egypt Scanner"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPrices ? 'animate-spin text-white' : ''}`} />
              <span>{isSyncingPrices ? 'Syncing Prices...' : 'Sync Live Prices'}</span>
            </button>
          )}
          <button
            id="btn-quick-cash-overview"
            onClick={onQuickAddCash}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium border border-slate-700 transition"
          >
            <Wallet className="w-3.5 h-3.5 text-amber-400" />
            Cash Balance
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Portfolio Value */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm col-span-2 sm:col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Total Portfolio Value</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
              Equities + Cash
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {formatEgp(metrics.totalValue)}
            </span>
            <span className="text-xs font-semibold text-slate-400">EGP</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1 font-semibold ${
                isPositiveDay ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isPositiveDay ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {isPositiveDay ? '+' : ''}{formatEgp(metrics.dayChangeEgp)} EGP ({isPositiveDay ? '+' : ''}
              {metrics.dayChangePercent.toFixed(2)}%)
            </span>
            <span className="text-slate-400 text-[11px]">today</span>
          </div>
        </div>

        {/* Unrealized P&L */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="text-xs text-slate-400 font-medium">Unrealized P&amp;L</div>
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
          <div className="mt-1">
            <span
              className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                isPositiveUnrealized
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}
            >
              {isPositiveUnrealized ? '+' : ''}{metrics.unrealizedPnlPercent.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Realized Profit (Closed Trades) */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
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
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{stats.winningTrades} W / {stats.losingTrades} L</span>
          </div>
        </div>

        {/* Cash Balance */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
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
          <div className="mt-1 text-xs text-slate-400">
            {((metrics.cashBalance / (metrics.totalValue || 1)) * 100).toFixed(1)}% of portfolio
          </div>
        </div>

        {/* Total Brokerage Fees Paid */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
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
          <div className="mt-1 text-xs text-slate-400">
            Total commissions paid
          </div>
        </div>
      </div>
    </div>
  );
};
