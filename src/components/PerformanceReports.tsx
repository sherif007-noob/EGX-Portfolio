import React, { useMemo, useState } from 'react';
import { PerformanceStats, ClosedTrade, Position, PortfolioMetrics } from '../types';
import { TradingPerformanceReport } from './reports/TradingPerformanceReport';
import { MonthlyPerformanceReport } from './reports/MonthlyPerformanceReport';
import { calculateEquityBridge, isEquityBridgeBalanced } from '../services/portfolioPerformance';
import type { MWRRPoint } from '../services/portfolioPerformance';
import { calculatePortfolioValue } from '../services/portfolioAccounting';
import { BarChart3, TrendingUp, TrendingDown, Receipt, Layers, PieChart as PieChartIcon, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import {
  ANALYTICS_CHART_THEME,
  AnalyticsChartTooltip,
  AnalyticsEmptyState,
  analyticsGridProps,
  analyticsTooltipCursor,
  analyticsXAxisProps,
  analyticsYAxisProps,
} from './charts/AnalyticsChartTheme';

interface PerformanceReportsProps {
  stats: PerformanceStats;
  closedTrades: ClosedTrade[];
  positions: Position[];
  metrics?: PortfolioMetrics;
  cashBalance?: number;
  capitalDeposits?: number;
  historicalPerformance?: MWRRPoint[];
}

const COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#6366f1', '#f97316', '#84cc16'];

export const PerformanceReports: React.FC<PerformanceReportsProps> = ({
  stats,
  closedTrades,
  positions,
  metrics,
  cashBalance = 0,
  capitalDeposits = 0,
  historicalPerformance = [],
}) => {
  const [allocationTab, setAllocationTab] = useState<'sector' | 'stock'>('sector');
  const [includeCash, setIncludeCash] = useState(true);

  const formatEgp = (value: number) => new Intl.NumberFormat('en-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  const grossProfit = stats.totalRealizedGainEgp || 0;
  const grossLoss = stats.totalRealizedLossEgp || 0;
  const netRealizedPnl = grossProfit - grossLoss;
  const closedFees = stats.totalBrokerageFeesPaid || 0;
  const openFees = positions.reduce((sum, p) => sum + (p.totalFees || 0), 0);

  const performanceBridge = useMemo(() => calculateEquityBridge(
    Number.isFinite(capitalDeposits) && capitalDeposits >= 0 ? capitalDeposits : 0,
    closedTrades,
    positions,
    cashBalance,
  ), [capitalDeposits, closedTrades, positions, cashBalance]);

  const sectorData = useMemo(() => {
    const map: Record<string, number> = {};
    positions.forEach((p) => {
      map[p.sector] = (map[p.sector] || 0) + p.shares * p.currentPrice;
    });
    const total = Object.values(map).reduce((a, b) => a + b, 0);
    return Object.entries(map).map(([name, value]) => ({
      name,
      value,
      percentage: total > 0 ? value / total * 100 : 0,
    })).sort((a, b) => b.value - a.value);
  }, [positions]);

  const stockData = useMemo(() => {
    const rows = positions.map((p) => ({
      name: p.ticker,
      value: p.shares * p.currentPrice,
      percentage: 0,
    }));
    if (includeCash && cashBalance > 0) rows.push({ name: 'CASH', value: cashBalance, percentage: 0 });
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    return rows.map((row) => ({ ...row, percentage: total > 0 ? row.value / total * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [positions, cashBalance, includeCash]);

  const mwrrData = useMemo(() => historicalPerformance
    .filter((point) => point.complete && Number.isFinite(point.mwrrPercent))
    .map((point) => ({
      date: point.date,
      label: new Date(`${point.date}T00:00:00`).toLocaleDateString('en-EG', { month: 'short', day: 'numeric' }),
      mwrrPercent: Number(point.mwrrPercent),
    })), [historicalPerformance]);

  const trajectoryData = useMemo(() => {
    let cumulative = 0;
    return [...closedTrades]
      .sort((a, b) => String(a.sellDate || '').localeCompare(String(b.sellDate || '')))
      .map((trade, index) => {
        cumulative += trade.realizedPnlEgp;
        return {
          index: index + 1,
          label: `${index + 1}. ${trade.ticker}`,
          pnl: trade.realizedPnlEgp,
          cumulative,
        };
      });
  }, [closedTrades]);

  const waterfallSteps = useMemo(() => {
    const steps = [
      { name: 'Net Capital Contributed', delta: performanceBridge.netCapitalContributed, total: true },
      { name: 'Realized P&L', delta: performanceBridge.realizedPnl, total: false },
      { name: 'Unrealized P&L', delta: performanceBridge.unrealizedPnl, total: false },
      { name: 'Ending Equity / NAV', delta: performanceBridge.endingEquity, total: true },
    ];
    let level = 0;
    return steps.map((step) => {
      if (step.total) {
        level = step.delta;
        return { ...step, start: 0, end: step.delta };
      }
      const start = level;
      level += step.delta;
      return { ...step, start, end: level };
    });
  }, [performanceBridge]);

  const reportedNav = metrics?.totalValue ?? calculatePortfolioValue(cashBalance, positions);
  const bridgeBalanced = isEquityBridgeBalanced(performanceBridge);

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><BarChart3 className="w-5 h-5 text-purple-400" />Trading Performance &amp; Analytical Reports</h2>
          <p className="text-xs text-slate-400 mt-1">All portfolio equity and P&amp;L bridge figures use the centralized accounting engine.</p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">Closed Trades: {stats.totalTrades}</span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-emerald-400">Win Rate: {stats.winRate.toFixed(1)}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800"><div className="text-xs text-emerald-400 font-semibold">Realized Gains</div><div className="mt-2 text-2xl font-black font-mono text-emerald-400">+{formatEgp(grossProfit)} <span className="text-xs text-slate-400">EGP</span></div></div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800"><div className="text-xs text-rose-400 font-semibold">Realized Losses</div><div className="mt-2 text-2xl font-black font-mono text-rose-400">-{formatEgp(grossLoss)} <span className="text-xs text-slate-400">EGP</span></div></div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800"><div className="text-xs text-slate-300 font-semibold">Net Realized P&amp;L</div><div className={`mt-2 text-2xl font-black font-mono ${netRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{netRealizedPnl >= 0 ? '+' : ''}{formatEgp(netRealizedPnl)} <span className="text-xs text-slate-400">EGP</span></div></div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800"><div className="text-xs text-amber-400 font-semibold flex items-center gap-1"><Receipt className="w-4 h-4" /> Fees</div><div className="mt-2 text-2xl font-black font-mono text-amber-400">{formatEgp(closedFees + openFees)} <span className="text-xs text-slate-400">EGP</span></div></div>
      </div>

      <TradingPerformanceReport stats={stats} closedTrades={closedTrades} positions={positions} cashBalance={cashBalance} />

      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div><h3 className="text-sm font-bold text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-cyan-400" />Money-Weighted Return (MWRR)</h3><p className="text-xs text-slate-400 mt-1">Historical annualized money-weighted return reconstructed from the transaction ledger, contributed capital, and daily EGX closes.</p></div>
        {mwrrData.length < 2 ? (
          <AnalyticsEmptyState>
            Historical MWRR is unavailable until enough complete valuation days are present.
          </AnalyticsEmptyState>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mwrrData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="mwrrChartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ANALYTICS_CHART_THEME.cyan} stopOpacity={0.28} />
                    <stop offset="95%" stopColor={ANALYTICS_CHART_THEME.cyan} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...analyticsGridProps} />
                <XAxis dataKey="label" {...analyticsXAxisProps} />
                <YAxis
                  {...analyticsYAxisProps}
                  tickFormatter={(value: number) => `${value.toFixed(1)}%`}
                />
                <ReferenceLine y={0} stroke={ANALYTICS_CHART_THEME.zeroLine} strokeDasharray="3 3" />
                <Tooltip
                  cursor={analyticsTooltipCursor}
                  content={(props) => (
                    <AnalyticsChartTooltip
                      {...props}
                      title="MWRR"
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ''}
                      nameFormatter={() => 'Return'}
                      valueFormatter={(value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`}
                    />
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="mwrrPercent"
                  name="MWRR"
                  stroke={ANALYTICS_CHART_THEME.cyan}
                  strokeWidth={2.25}
                  fill="url(#mwrrChartGradient)"
                  fillOpacity={1}
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: ANALYTICS_CHART_THEME.cyan,
                    stroke: '#020617',
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div><h3 className="text-sm font-bold text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-400" />Realized P&amp;L Trajectory</h3><p className="text-xs text-slate-400 mt-1">Closed-trade realized P&amp;L over time. This is not the portfolio equity curve.</p></div>
        {trajectoryData.length === 0 ? (
          <AnalyticsEmptyState>No closed trades recorded yet.</AnalyticsEmptyState>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trajectoryData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="realizedTrajectoryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ANALYTICS_CHART_THEME.emerald} stopOpacity={0.28} />
                    <stop offset="95%" stopColor={ANALYTICS_CHART_THEME.emerald} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...analyticsGridProps} />
                <XAxis dataKey="label" {...analyticsXAxisProps} />
                <YAxis
                  {...analyticsYAxisProps}
                  tickFormatter={(value: number) =>
                    Math.abs(value) >= 1000
                      ? `${value >= 0 ? '+' : ''}${(value / 1000).toFixed(1)}k`
                      : `${value >= 0 ? '+' : ''}${value.toFixed(0)}`
                  }
                />
                <ReferenceLine y={0} stroke={ANALYTICS_CHART_THEME.zeroLine} strokeDasharray="3 3" />
                <Tooltip
                  cursor={analyticsTooltipCursor}
                  content={(props) => (
                    <AnalyticsChartTooltip
                      {...props}
                      title="Realized P&L"
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.label || ''}
                      nameFormatter={() => 'Cumulative'}
                      valueFormatter={(value) => `${value >= 0 ? '+' : ''}${formatEgp(value)} EGP`}
                    />
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  name="Cumulative"
                  stroke={ANALYTICS_CHART_THEME.emerald}
                  strokeWidth={2.25}
                  fill="url(#realizedTrajectoryGradient)"
                  fillOpacity={1}
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: ANALYTICS_CHART_THEME.emerald,
                    stroke: '#020617',
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div><h3 className="text-sm font-bold text-white flex items-center gap-2"><PieChartIcon className="w-4 h-4 text-cyan-400" />Portfolio Allocation</h3><p className="text-xs text-slate-400 mt-1">Current market-value allocation.</p></div>
          <div className="flex items-center gap-2 text-xs"><button onClick={() => setAllocationTab('sector')} className={`px-3 py-1 rounded-lg ${allocationTab === 'sector' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'}`}>Sectors</button><button onClick={() => setAllocationTab('stock')} className={`px-3 py-1 rounded-lg ${allocationTab === 'stock' ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-800 text-slate-400'}`}>Stocks</button>{allocationTab === 'stock' && <label className="flex items-center gap-1.5 text-slate-300"><input type="checkbox" checked={includeCash} onChange={(e) => setIncludeCash(e.target.checked)} />Cash</label>}</div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-center">
          <div className="h-64">{(allocationTab === 'sector' ? sectorData : stockData).length === 0 ? <div className="h-full flex items-center justify-center text-xs text-slate-500">No allocation data.</div> : <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={allocationTab === 'sector' ? sectorData : stockData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>{(allocationTab === 'sector' ? sectorData : stockData).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip
                  cursor={false}
                  content={(props) => (
                    <AnalyticsChartTooltip
                      {...props}
                      title="Allocation"
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ''}
                      nameFormatter={() => 'Market Value'}
                      valueFormatter={(value) => `${formatEgp(value)} EGP`}
                    />
                  )}
                /></PieChart></ResponsiveContainer>}</div>
          <div className="space-y-2 max-h-64 overflow-auto">{(allocationTab === 'sector' ? sectorData : stockData).map((row, i) => <div key={row.name} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-xs"><span className="flex items-center gap-2 text-slate-200"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />{row.name}</span><span className="font-mono text-slate-300">{formatEgp(row.value)} EGP ({row.percentage.toFixed(1)}%)</span></div>)}</div>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div><h3 className="text-sm font-bold text-white flex items-center gap-2"><Layers className="w-4 h-4 text-blue-400" />Portfolio Equity Bridge</h3><p className="text-xs text-slate-400 mt-1">Ending equity = net capital contributed + realized P&amp;L + unrealized P&amp;L. Fees are already embedded in P&amp;L and are not deducted again.</p></div>
        {!bridgeBalanced && <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><div><strong>Accounting reconciliation difference:</strong> {formatEgp(performanceBridge.reconciliationDelta)} EGP. The report is showing the actual ledger/equity values instead of inventing a balancing capital figure.</div></div>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800"><span className="text-slate-400 block">Net Capital Contributed</span><strong className="font-mono text-blue-300">{formatEgp(performanceBridge.netCapitalContributed)} EGP</strong></div>
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800"><span className="text-slate-400 block">Realized P&amp;L</span><strong className={`font-mono ${performanceBridge.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{performanceBridge.realizedPnl >= 0 ? '+' : ''}{formatEgp(performanceBridge.realizedPnl)} EGP</strong></div>
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800"><span className="text-slate-400 block">Unrealized P&amp;L</span><strong className={`font-mono ${performanceBridge.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{performanceBridge.unrealizedPnl >= 0 ? '+' : ''}{formatEgp(performanceBridge.unrealizedPnl)} EGP</strong></div>
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800"><span className="text-slate-400 block">Ending Equity / NAV</span><strong className="font-mono text-purple-300">{formatEgp(performanceBridge.endingEquity)} EGP</strong></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          {waterfallSteps.map((step, index) => <div key={step.name} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800"><div className="text-[10px] text-slate-400">Step {index + 1}</div><div className="text-xs font-semibold text-slate-200">{step.name}</div><div className={`font-mono font-bold mt-1 ${step.total ? 'text-purple-300' : step.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{step.total ? formatEgp(step.end) : `${step.delta >= 0 ? '+' : ''}${formatEgp(step.delta)}`} EGP</div></div>)}
        </div>
        <div className="text-[11px] text-slate-500">Reported NAV: {formatEgp(reportedNav)} EGP · Bridge delta: {formatEgp(performanceBridge.reconciliationDelta)} EGP</div>
      </div>

      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800"><h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3"><TrendingDown className="w-4 h-4 text-rose-400" />Closed Trade Summary</h3><div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs"><div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800"><span className="text-slate-400 block">Winning</span><strong className="text-emerald-400">{stats.winningTrades}</strong></div><div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800"><span className="text-slate-400 block">Losing</span><strong className="text-rose-400">{stats.losingTrades}</strong></div><div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800"><span className="text-slate-400 block">Average Hold</span><strong className="text-purple-300">{stats.avgHoldDays} days</strong></div><div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800"><span className="text-slate-400 block">Profit Factor</span><strong className="text-amber-300">{Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞'}x</strong></div></div></div>

      <MonthlyPerformanceReport closedTrades={closedTrades} positions={positions} />
    </div>
  );
};
