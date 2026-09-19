import React, { useMemo, useState } from 'react';
import { PerformanceStats, ClosedTrade, Position, PortfolioMetrics, TradeTransaction } from '../types';
import { TradingPerformanceReport } from './reports/TradingPerformanceReport';
import { MonthlyPerformanceReport } from './reports/MonthlyPerformanceReport';
import { calculateEquityBridge, isEquityBridgeBalanced } from '../services/portfolioPerformance';
import { calculatePortfolioValue } from '../services/portfolioAccounting';
import type { HistoricalPriceSeries } from '../services/historicalPriceStore';
import { PerformanceTimeframeChart } from './charts/PerformanceTimeframeChart';
import { RealizedTrajectoryChart } from './RealizedTrajectoryChart';
import { BarChart3, TrendingDown, Receipt, Layers, PieChart as PieChartIcon, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Sector } from 'recharts';
import {
  AnalyticsChartTooltip,
  ChartTooltipShell,
  formatAnalyticsEgp,
} from './charts/AnalyticsChartTheme';

interface PerformanceReportsProps {
  stats: PerformanceStats;
  closedTrades: ClosedTrade[];
  positions: Position[];
  metrics?: PortfolioMetrics;
  cashBalance?: number;
  capitalDeposits?: number;
  transactions: TradeTransaction[];
  historicalPrices: HistoricalPriceSeries;
  historicalLoading?: boolean;
}

const COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#6366f1', '#f97316', '#84cc16'];

export const PerformanceReports: React.FC<PerformanceReportsProps> = ({
  stats,
  closedTrades,
  positions,
  metrics,
  cashBalance = 0,
  capitalDeposits = 0,
  transactions,
  historicalPrices,
  historicalLoading = false,
}) => {
  const [allocationTab, setAllocationTab] = useState<'sector' | 'stock'>('sector');
  const [includeCash, setIncludeCash] = useState(true);
  const [activeAllocationIndex, setActiveAllocationIndex] = useState<number | null>(null);

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
    const map: Record<string, { value: number; count: number }> = {};
    positions.forEach((position) => {
      const key = position.sector;
      if (!map[key]) map[key] = { value: 0, count: 0 };
      map[key].value += position.shares * position.currentPrice;
      map[key].count += 1;
    });
    const total = Object.values(map).reduce((sum, row) => sum + row.value, 0);
    return Object.entries(map).map(([name, row]) => ({
      name,
      value: row.value,
      percentage: total > 0 ? row.value / total * 100 : 0,
      count: row.count,
      kind: 'sector' as const,
    })).sort((a, b) => b.value - a.value);
  }, [positions]);

  const stockData = useMemo(() => {
    const rows = positions.map((position) => ({
      name: position.ticker,
      value: position.shares * position.currentPrice,
      percentage: 0,
      shares: position.shares,
      currentPrice: position.currentPrice,
      kind: 'holding' as const,
    }));
    if (includeCash && cashBalance > 0) {
      rows.push({
        name: 'CASH',
        value: cashBalance,
        percentage: 0,
        shares: 0,
        currentPrice: 1,
        kind: 'cash' as const,
      });
    }
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    return rows.map((row) => ({ ...row, percentage: total > 0 ? row.value / total * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [positions, cashBalance, includeCash]);

  const allocationData = allocationTab === 'sector' ? sectorData : stockData;
  const allocationTotal = allocationData.reduce((sum, row) => sum + row.value, 0);
  const leadingAllocation = allocationData[0] ?? null;

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

      <PerformanceTimeframeChart
        transactions={transactions}
        historicalPrices={historicalPrices}
        capitalDeposits={capitalDeposits}
        historicalLoading={historicalLoading}
      />

      <RealizedTrajectoryChart
        closedTrades={closedTrades}
        stats={stats}
      />

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10">
              <PieChartIcon className="h-4 w-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Portfolio Allocation</h3>
              <p className="mt-1 text-xs text-slate-400">
                Current market-value concentration across {allocationTab === 'sector' ? 'sectors' : 'holdings'}.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950/70 p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setAllocationTab('sector');
                  setActiveAllocationIndex(null);
                }}
                className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                  allocationTab === 'sector'
                    ? 'bg-cyan-500/15 text-cyan-300 shadow-sm'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                Sectors
              </button>
              <button
                type="button"
                onClick={() => {
                  setAllocationTab('stock');
                  setActiveAllocationIndex(null);
                }}
                className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                  allocationTab === 'stock'
                    ? 'bg-cyan-500/15 text-cyan-300 shadow-sm'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                Holdings
              </button>
            </div>

            {allocationTab === 'stock' && (
              <button
                type="button"
                aria-pressed={includeCash}
                onClick={() => setIncludeCash((current) => !current)}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  includeCash
                    ? 'border-purple-500/30 bg-purple-500/10 text-purple-300'
                    : 'border-slate-800 bg-slate-950/70 text-slate-500 hover:text-slate-300'
                }`}
              >
                {includeCash ? 'Cash included' : 'Cash excluded'}
              </button>
            )}
          </div>
        </div>

        {allocationData.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/50 text-xs text-slate-500">
            No allocation data.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="relative min-h-[285px] overflow-hidden rounded-xl border border-slate-800 bg-slate-950/55">
              <div className="absolute left-4 top-4 z-10">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Allocated value</div>
                <div className="mt-1 font-mono text-sm font-bold text-slate-200">
                  {formatEgp(allocationTotal)} EGP
                </div>
              </div>

              <div className="h-[285px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocationData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={67}
                      outerRadius={98}
                      paddingAngle={2}
                      stroke="#020617"
                      strokeWidth={2}
                      onMouseEnter={(_, index) => setActiveAllocationIndex(index)}
                      onMouseLeave={() => setActiveAllocationIndex(null)}
                      shape={(shapeProps: any) => {
                        const index = Number(shapeProps.index);
                        const active = activeAllocationIndex === index;
                        const dimmed = activeAllocationIndex != null && !active;
                        return (
                          <g
                            style={{
                              transformBox: 'fill-box',
                              transformOrigin: 'center',
                              transform: active ? 'scale(1.055)' : 'scale(1)',
                              opacity: dimmed ? 0.48 : 1,
                              transition: 'transform 180ms ease, opacity 160ms ease',
                              filter: active ? 'drop-shadow(0 8px 12px rgba(6, 182, 212, 0.18))' : 'none',
                            }}
                          >
                            <Sector {...shapeProps} />
                          </g>
                        );
                      }}
                    >
                      {allocationData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      cursor={false}
                      wrapperStyle={{ zIndex: 40, pointerEvents: 'none' }}
                      content={(props: any) => {
                        if (!props?.active || !props?.payload?.length) return null;
                        const row = props.payload[0]?.payload as any;
                        const rank = allocationData.findIndex((item) => item.name === row.name) + 1;
                        const remaining = Math.max(0, 100 - Number(row.percentage || 0));

                        return (
                          <ChartTooltipShell className="min-w-[235px]">
                            <div className="mb-2 border-b border-slate-800 pb-2">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-semibold text-slate-100">{row.name}</span>
                                <span className="font-mono text-xs font-bold text-cyan-300">
                                  {Number(row.percentage || 0).toFixed(1)}%
                                </span>
                              </div>
                              <div className="mt-0.5 text-[10px] text-slate-500">
                                {allocationTab === 'sector' ? 'Sector allocation' : row.kind === 'cash' ? 'Cash allocation' : 'Holding allocation'}
                              </div>
                            </div>

                            <div className="space-y-1.5 text-[11px]">
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-400">Market value</span>
                                <span className="font-mono font-semibold text-slate-100">{formatAnalyticsEgp(Number(row.value || 0))}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-400">Rank</span>
                                <span className="font-mono font-semibold text-slate-200">#{rank} of {allocationData.length}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-400">Rest of allocation</span>
                                <span className="font-mono font-semibold text-slate-300">{remaining.toFixed(1)}%</span>
                              </div>
                              {row.kind === 'sector' && (
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-400">Open positions</span>
                                  <span className="font-mono font-semibold text-slate-200">{row.count}</span>
                                </div>
                              )}
                              {row.kind === 'holding' && (
                                <>
                                  <div className="flex justify-between gap-4">
                                    <span className="text-slate-400">Shares</span>
                                    <span className="font-mono font-semibold text-slate-200">{Number(row.shares || 0).toLocaleString('en-EG')}</span>
                                  </div>
                                  <div className="flex justify-between gap-4">
                                    <span className="text-slate-400">Latest price</span>
                                    <span className="font-mono font-semibold text-slate-200">{Number(row.currentPrice || 0).toFixed(2)} EGP</span>
                                  </div>
                                </>
                              )}
                              {row.kind === 'cash' && (
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-400">Balance type</span>
                                  <span className="font-semibold text-purple-300">Available cash</span>
                                </div>
                              )}
                            </div>
                          </ChartTooltipShell>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className={`pointer-events-none absolute inset-0 z-0 flex items-center justify-center transition-opacity duration-150 ${activeAllocationIndex == null ? 'opacity-100' : 'opacity-0'}`}>
                <div className="mt-5 text-center">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Largest</div>
                  <div className="mt-1 max-w-[110px] truncate text-sm font-bold text-white">
                    {leadingAllocation?.name ?? '—'}
                  </div>
                  <div className="font-mono text-xs font-semibold text-cyan-300">
                    {leadingAllocation ? `${leadingAllocation.percentage.toFixed(1)}%` : '—'}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-slate-200">Concentration breakdown</div>
                  <div className="mt-0.5 text-[10px] text-slate-500">
                    Ranked by current market value
                  </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-[10px] text-slate-400">
                  {allocationData.length} {allocationData.length === 1 ? 'bucket' : 'buckets'}
                </div>
              </div>

              <div className="max-h-[238px] space-y-2 overflow-y-auto pr-1">
                {allocationData.map((row, index) => (
                  <div
                    key={row.name}
                    className="rounded-lg border border-slate-800/90 bg-slate-950/65 px-3 py-2.5 transition hover:border-slate-700 hover:bg-slate-950"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="w-5 shrink-0 font-mono text-[10px] text-slate-600">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="truncate text-xs font-semibold text-slate-200">{row.name}</span>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-mono text-xs font-semibold text-slate-200">
                          {row.percentage.toFixed(1)}%
                        </div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {formatEgp(row.value)} EGP
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(2, row.percentage)}%`,
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
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
