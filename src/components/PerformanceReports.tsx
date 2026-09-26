import React, { useEffect, useMemo, useState } from 'react';
import { PerformanceStats, ClosedTrade, Position, PortfolioMetrics, TradeTransaction } from '../types';
import { TradingPerformanceReport } from './reports/TradingPerformanceReport';
import { MonthlyPerformanceReport } from './reports/MonthlyPerformanceReport';
import { calculateEquityBridge, isEquityBridgeBalanced } from '../services/portfolioPerformance';
import { calculatePortfolioValue } from '../services/portfolioAccounting';
import type { HistoricalPriceSeries } from '../services/historicalPriceStore';
import { PerformanceTimeframeChart } from './charts/PerformanceTimeframeChart';
import { RealizedTrajectoryChart } from './RealizedTrajectoryChart';
import { MotionSwap } from './PremiumMotion';
import { BarChart3, TrendingDown, Receipt, Layers, PieChart as PieChartIcon, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Sector } from 'recharts';
import {
  ANALYTICS_CHART_THEME,
  AnalyticsEmptyState,
  ChartPlotSurface,
  ChartTooltipShell,
  analyticsHexToRgbChannels,
  analyticsTooltipWrapperStyle,
  formatAnalyticsEgp,
  getAnalyticsAllocationColor,
  useAnalyticsReducedMotion,
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
  chartsReady?: boolean;
}

const EGP_FORMATTER = new Intl.NumberFormat('en-EG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatEgp = (value: number) => EGP_FORMATTER.format(value);

const PerformanceReportsComponent: React.FC<PerformanceReportsProps> = ({
  stats,
  closedTrades,
  positions,
  metrics,
  cashBalance = 0,
  capitalDeposits = 0,
  transactions,
  historicalPrices,
  historicalLoading = false,
  chartsReady = true,
}) => {
  const reducedMotion = useAnalyticsReducedMotion();
  const [allocationTooltipsEnabled, setAllocationTooltipsEnabled] = useState(true);
  const [allocationTab, setAllocationTab] = useState<'sector' | 'stock'>('sector');
  const [includeCash, setIncludeCash] = useState(true);
  const [activeAllocationIndex, setActiveAllocationIndex] = useState<number | null>(null);

  useEffect(() => {
    const dismissAllocationTooltip = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('[data-allocation-chart-interactive="true"]')
      ) {
        return;
      }
      setAllocationTooltipsEnabled(false);
    };

    document.addEventListener('pointerdown', dismissAllocationTooltip, true);
    return () => {
      document.removeEventListener('pointerdown', dismissAllocationTooltip, true);
    };
  }, []);

  const grossProfit = stats.totalRealizedGainEgp || 0;
  const grossLoss = stats.totalRealizedLossEgp || 0;
  const netRealizedPnl = grossProfit - grossLoss;
  const closedFees = stats.totalBrokerageFeesPaid || 0;
  const openFees = positions.reduce((sum, p) => sum + (p.totalFees || 0), 0);
  const netRealizedGlow =
    netRealizedPnl > 0 ? 'premium-state-win' : netRealizedPnl < 0 ? 'premium-state-loss' : 'premium-state-breakeven';

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
    const rows: Array<{
      name: string;
      value: number;
      percentage: number;
      shares: number;
      currentPrice: number;
      kind: 'holding' | 'cash';
    }> = positions.map((position) => ({
      name: position.ticker,
      value: position.shares * position.currentPrice,
      percentage: 0,
      shares: position.shares,
      currentPrice: position.currentPrice,
      kind: 'holding',
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

  const allocationData = useMemo(
    () =>
      (allocationTab === 'sector' ? sectorData : stockData).map((row) => ({
        ...row,
        color: getAnalyticsAllocationColor(row.name, {
          cash: row.kind === 'cash',
        }),
      })),
    [allocationTab, sectorData, stockData],
  );
  const allocationTotal = allocationData.reduce((sum, row) => sum + row.value, 0);
  const leadingAllocation = allocationData[0] ?? null;
  const activeAllocation =
    activeAllocationIndex == null ? null : allocationData[activeAllocationIndex] ?? null;
  const highlightedAllocation = activeAllocation ?? leadingAllocation;

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
    <div className="premium-reports-hierarchy space-y-7">
      <div className="premium-hierarchy-h0 flex flex-col gap-3 px-1 sm:flex-row sm:items-end sm:justify-between" data-hierarchy="h0">
        <div>
          <h2 className="premium-type-page-title flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-400" />
            Trading Performance &amp; Analytical Reports
          </h2>
          <p className="premium-type-helper mt-1 max-w-3xl">
            All portfolio equity and P&amp;L bridge figures use the centralized accounting engine.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="premium-chip px-2.5 py-1 rounded-lg text-slate-300">Closed Trades: {stats.totalTrades}</span>
          <span className="premium-chip px-2.5 py-1 rounded-lg text-emerald-400 border-emerald-500/30">Win Rate: {stats.winRate.toFixed(1)}%</span>
        </div>
      </div>

      <div className="premium-hierarchy-h3 premium-report-summary-band grid grid-cols-2 gap-px overflow-hidden rounded-2xl sm:grid-cols-4" data-hierarchy="h3">
        <div className="premium-report-summary-cell">
          <div className="premium-type-metric-label text-emerald-400">Realized Gains</div>
          <div className="mt-1.5 font-mono text-lg font-black text-emerald-400 sm:text-xl">+{formatEgp(grossProfit)} <span className="text-[10px] text-slate-500">EGP</span></div>
        </div>
        <div className="premium-report-summary-cell">
          <div className="premium-type-metric-label text-rose-400">Realized Losses</div>
          <div className="mt-1.5 font-mono text-lg font-black text-rose-400 sm:text-xl">-{formatEgp(grossLoss)} <span className="text-[10px] text-slate-500">EGP</span></div>
        </div>
        <div className={`premium-report-summary-cell ${netRealizedGlow}`}>
          <div className="premium-type-metric-label">Net Realized P&amp;L</div>
          <div className={`mt-1.5 font-mono text-lg font-black sm:text-xl ${netRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{netRealizedPnl >= 0 ? '+' : ''}{formatEgp(netRealizedPnl)} <span className="text-[10px] text-slate-500">EGP</span></div>
        </div>
        <div className="premium-report-summary-cell">
          <div className="premium-type-metric-label flex items-center gap-1 text-amber-400"><Receipt className="h-3.5 w-3.5" /> Fees</div>
          <div className="mt-1.5 font-mono text-lg font-black text-amber-400 sm:text-xl">{formatEgp(closedFees + openFees)} <span className="text-[10px] text-slate-500">EGP</span></div>
        </div>
      </div>

      <TradingPerformanceReport stats={stats} closedTrades={closedTrades} positions={positions} cashBalance={cashBalance} />

      <PerformanceTimeframeChart
        transactions={transactions}
        historicalPrices={historicalPrices}
        capitalDeposits={capitalDeposits}
        positions={positions}
        currentCashBalance={cashBalance}
        historicalLoading={historicalLoading}
        entranceReady={chartsReady}
      />

      <RealizedTrajectoryChart
        closedTrades={closedTrades}
        stats={stats}
        entranceReady={chartsReady}
      />

      <div className="premium-report-section premium-hierarchy-h2 rounded-2xl p-4 sm:p-5 space-y-4" data-hierarchy="h2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="premium-allocation-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
              <PieChartIcon className="h-4 w-4 text-cyan-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Portfolio Allocation</h3>
              <p className="mt-1 text-xs text-slate-400">
                Current market-value concentration across {allocationTab === 'sector' ? 'sectors' : 'holdings'}.
              </p>
            </div>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <div className="premium-selector-shell grid grid-cols-2 text-xs sm:flex sm:items-center">
              <button
                type="button"
                aria-pressed={allocationTab === 'sector'}
                onClick={() => {
                  setAllocationTab('sector');
                  setActiveAllocationIndex(null);
                }}
                className={`premium-filter-pill premium-compact-selector rounded-lg px-3 py-1 font-semibold ${allocationTab === 'sector' ? 'premium-filter-active-cyan' : ''}`}
              >
                Sectors
              </button>
              <button
                type="button"
                aria-pressed={allocationTab === 'stock'}
                onClick={() => {
                  setAllocationTab('stock');
                  setActiveAllocationIndex(null);
                }}
                className={`premium-filter-pill premium-compact-selector rounded-lg px-3 py-1 font-semibold ${allocationTab === 'stock' ? 'premium-filter-active-cyan' : ''}`}
              >
                Holdings
              </button>
            </div>

            {allocationTab === 'stock' && (
              <button
                type="button"
                role="switch"
                aria-checked={includeCash}
                onClick={() => {
                  setIncludeCash((current) => !current);
                  setActiveAllocationIndex(null);
                }}
                className="premium-cash-toggle flex w-full items-center justify-between gap-4 rounded-xl border px-3.5 py-2.5 text-left sm:w-auto sm:min-w-[178px]"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-slate-200">Include cash</span>
                  <span className="mt-0.5 block text-[10px] text-slate-500">
                    Available balance in allocation
                  </span>
                </span>
                <span className="premium-cash-switch-track relative h-6 w-11 shrink-0 rounded-full" aria-hidden="true">
                  <span className="premium-cash-switch-knob absolute h-[18px] w-[18px] rounded-full" />
                </span>
              </button>
            )}
          </div>
        </div>

        <MotionSwap motionKey={`${allocationTab}-${includeCash}-${allocationData.length > 0 ? 'data' : 'empty'}`} variant="state">
          {allocationData.length === 0 ? (
            <AnalyticsEmptyState>No allocation data.</AnalyticsEmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <ChartPlotSurface
                className="premium-allocation-plot relative min-h-[270px] overflow-hidden sm:min-h-[300px]"
                ariaLabel={`Portfolio allocation by ${allocationTab === 'sector' ? 'sector' : 'holding'}`}
                ariaDescription={`${allocationData.length} allocation buckets totaling ${formatAnalyticsEgp(allocationTotal)}. Largest allocation is ${leadingAllocation?.name ?? 'unavailable'} at ${leadingAllocation ? `${leadingAllocation.percentage.toFixed(1)}%` : 'unavailable'}. The ranked controls below provide keyboard-accessible selection.`}
                data-allocation-chart-interactive="true"
                onPointerDownCapture={() => setAllocationTooltipsEnabled(true)}
                onPointerMoveCapture={() => setAllocationTooltipsEnabled(true)}
                style={{
                  '--chart-plot-accent-rgb': '6 182 212',
                  '--allocation-highlight': highlightedAllocation?.color ?? ANALYTICS_CHART_THEME.cyan,
                } as React.CSSProperties}
              >
                <div className="absolute left-4 top-4 z-10">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Allocated value
                  </div>
                  <div className="mt-1 font-mono text-sm font-bold text-slate-100">
                    {formatEgp(allocationTotal)} EGP
                  </div>
                  <div className="mt-1 text-[10px] text-slate-600">
                    {allocationData.length} {allocationData.length === 1 ? 'bucket' : 'buckets'}
                  </div>
                </div>

                <div className="h-[270px] sm:h-[300px]">
                  {chartsReady && (
                    <ResponsiveContainer width="100%" height="100%" debounce={80}>
                      <PieChart>
                        <defs>
                          {allocationData.map((row, index) => (
                            <filter
                              key={`allocation-glow-${row.name}`}
                              id={`allocationActiveGlow-${index}`}
                              x="-110%"
                              y="-110%"
                              width="320%"
                              height="320%"
                              colorInterpolationFilters="sRGB"
                            >
                              <feDropShadow
                                dx="0"
                                dy="0"
                                stdDeviation="3.4"
                                floodColor={row.color}
                                floodOpacity="0.95"
                              />
                              <feDropShadow
                                dx="0"
                                dy="0"
                                stdDeviation="7"
                                floodColor={row.color}
                                floodOpacity="0.42"
                              />
                            </filter>
                          ))}
                        </defs>
                        <Pie
                          data={allocationData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={70}
                          outerRadius={101}
                          paddingAngle={2.4}
                          cornerRadius={5}
                          stroke="#020617"
                          strokeWidth={1.5}
                          isAnimationActive={!reducedMotion}
                          animationDuration={520}
                          animationEasing="ease-out"
                          onMouseEnter={(_, index) => setActiveAllocationIndex(index)}
                          onMouseLeave={() => setActiveAllocationIndex(null)}
                          onClick={(_, index) =>
                            setActiveAllocationIndex((current) => current === index ? null : index)
                          }
                          shape={(shapeProps: any) => {
                            const index = Number(shapeProps.index);
                            const row = allocationData[index];
                            const color = row?.color ?? ANALYTICS_CHART_THEME.cyan;
                            const active = activeAllocationIndex === index;
                            const dimmed = activeAllocationIndex != null && !active;

                            return (
                              <g
                                className={[
                                  'premium-allocation-segment',
                                  active ? 'premium-allocation-segment-active' : '',
                                  dimmed ? 'premium-allocation-segment-dimmed' : '',
                                ].join(' ')}
                                style={{
                                  '--allocation-segment-color': color,
                                } as React.CSSProperties}
                              >
                                <Sector
                                  {...shapeProps}
                                  fill={color}
                                  fillOpacity={active ? 1 : 0.94}
                                  stroke={active ? color : '#020617'}
                                  strokeOpacity={active ? 1 : 0.92}
                                  strokeWidth={active ? 3.2 : 1.5}
                                  filter={active ? `url(#allocationActiveGlow-${index})` : undefined}
                                />
                              </g>
                            );
                          }}
                        >
                          {allocationData.map((row) => (
                            <Cell key={row.name} fill={row.color} />
                          ))}
                        </Pie>

                        <Tooltip
                          active={allocationTooltipsEnabled ? undefined : false}
                          cursor={false}
                          wrapperStyle={analyticsTooltipWrapperStyle}
                          allowEscapeViewBox={{ x: false, y: false }}
                          offset={8}
                          content={(props: any) => {
                            if (!props?.active || !props?.payload?.length) return null;
                            const row = props.payload[0]?.payload as any;
                            const rank = allocationData.findIndex((item) => item.name === row.name) + 1;
                            const remaining = Math.max(0, 100 - Number(row.percentage || 0));

                            return (
                              <ChartTooltipShell className="min-w-0 sm:min-w-[235px]">
                                <div className="mb-2 border-b border-slate-800 pb-2">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-100">
                                      <span
                                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                                        style={{
                                          backgroundColor: row.color,
                                          boxShadow: `0 0 10px ${row.color}70`,
                                        }}
                                      />
                                      <span className="truncate">{row.name}</span>
                                    </span>
                                    <span
                                      className="font-mono text-xs font-bold"
                                      style={{ color: row.color }}
                                    >
                                      {Number(row.percentage || 0).toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="mt-0.5 text-[10px] text-slate-500">
                                    {allocationTab === 'sector'
                                      ? 'Sector allocation'
                                      : row.kind === 'cash'
                                        ? 'Cash allocation'
                                        : 'Holding allocation'}
                                  </div>
                                </div>

                                <div className="space-y-1.5 text-[11px]">
                                  <div className="flex justify-between gap-4">
                                    <span className="text-slate-400">Market value</span>
                                    <span className="font-mono font-semibold text-slate-100">
                                      {formatAnalyticsEgp(Number(row.value || 0))}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-4">
                                    <span className="text-slate-400">Rank</span>
                                    <span className="font-mono font-semibold text-slate-200">
                                      #{rank} of {allocationData.length}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-4">
                                    <span className="text-slate-400">Rest of allocation</span>
                                    <span className="font-mono font-semibold text-slate-300">
                                      {remaining.toFixed(1)}%
                                    </span>
                                  </div>
                                  {row.kind === 'sector' && (
                                    <div className="flex justify-between gap-4">
                                      <span className="text-slate-400">Open positions</span>
                                      <span className="font-mono font-semibold text-slate-200">
                                        {row.count}
                                      </span>
                                    </div>
                                  )}
                                  {row.kind === 'holding' && (
                                    <>
                                      <div className="flex justify-between gap-4">
                                        <span className="text-slate-400">Shares</span>
                                        <span className="font-mono font-semibold text-slate-200">
                                          {Number(row.shares || 0).toLocaleString('en-EG')}
                                        </span>
                                      </div>
                                      <div className="flex justify-between gap-4">
                                        <span className="text-slate-400">Latest price</span>
                                        <span className="font-mono font-semibold text-slate-200">
                                          {Number(row.currentPrice || 0).toFixed(2)} EGP
                                        </span>
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
                  )}
                </div>

                <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
                  <div className="mt-6 max-w-[128px] text-center" aria-live="polite">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {activeAllocation ? 'Selected' : 'Largest'}
                    </div>
                    <div className="mt-1 truncate text-sm font-bold text-white">
                      {highlightedAllocation?.name ?? '—'}
                    </div>
                    <div
                      className="mt-0.5 font-mono text-sm font-black"
                      style={{ color: highlightedAllocation?.color ?? ANALYTICS_CHART_THEME.cyan }}
                    >
                      {highlightedAllocation
                        ? `${highlightedAllocation.percentage.toFixed(1)}%`
                        : '—'}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-slate-500">
                      {highlightedAllocation
                        ? formatAnalyticsEgp(highlightedAllocation.value)
                        : ''}
                    </div>
                  </div>
                </div>
              </ChartPlotSurface>

              <div className="premium-report-glass-soft rounded-xl p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Concentration breakdown</div>
                    <div className="mt-0.5 text-[10px] text-slate-500">
                      Ranked by current market value · tap a row to inspect
                    </div>
                  </div>
                  <div className="premium-report-glass-soft rounded-lg px-2 py-1 font-mono text-[10px] text-slate-400">
                    {allocationData.length} {allocationData.length === 1 ? 'bucket' : 'buckets'}
                  </div>
                </div>

                <div className="max-h-[258px] space-y-2 overflow-y-auto pr-1">
                  {allocationData.map((row, index) => {
                    const active = activeAllocationIndex === index;
                    const dimmed = activeAllocationIndex != null && !active;

                    return (
                      <button
                        type="button"
                        key={row.name}
                        aria-pressed={active}
                        onMouseEnter={() => setActiveAllocationIndex(index)}
                        onMouseLeave={() => setActiveAllocationIndex(null)}
                        onFocus={() => setActiveAllocationIndex(index)}
                        onBlur={() => setActiveAllocationIndex(null)}
                        onClick={() =>
                          setActiveAllocationIndex((current) => current === index ? null : index)
                        }
                        className={[
                          'premium-subpanel premium-allocation-row w-full rounded-xl px-3 py-2.5 text-left',
                          active ? 'premium-allocation-row-active premium-semantic-selection' : '',
                          dimmed ? 'premium-allocation-row-dimmed' : '',
                        ].join(' ')}
                        style={{
                          '--allocation-row-color': row.color,
                          '--premium-semantic-rgb': analyticsHexToRgbChannels(row.color),
                          '--premium-semantic-deep-rgb': analyticsHexToRgbChannels(row.color),
                        } as React.CSSProperties}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="w-5 shrink-0 font-mono text-[10px] text-slate-600">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <span
                              className="premium-allocation-dot h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{
                                backgroundColor: row.color,
                                '--allocation-dot-color': row.color,
                              } as React.CSSProperties}
                            />
                            <span className="truncate text-xs font-semibold text-slate-200">
                              {row.name}
                            </span>
                          </div>
                          <div className="shrink-0 text-right">
                            <div
                              className="font-mono text-xs font-bold"
                              style={{ color: active ? row.color : undefined }}
                            >
                              {row.percentage.toFixed(1)}%
                            </div>
                            <div className="font-mono text-[10px] text-slate-500">
                              {formatEgp(row.value)} EGP
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="premium-allocation-progress h-full rounded-full"
                            style={{
                              width: `${Math.max(2, row.percentage)}%`,
                              backgroundColor: row.color,
                              '--allocation-progress-color': row.color,
                            } as React.CSSProperties}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </MotionSwap>
      </div>

      <div className="premium-report-section premium-hierarchy-h3 rounded-2xl p-4 space-y-4 sm:p-5" data-hierarchy="h3">
        <div><h3 className="premium-type-section-title flex items-center gap-2"><Layers className="w-4 h-4 text-blue-400" />Portfolio Equity Bridge</h3><p className="text-xs text-slate-400 mt-1">Ending equity = net capital contributed + realized P&amp;L + unrealized P&amp;L. Fees are already embedded in P&amp;L and are not deducted again.</p></div>
        {!bridgeBalanced && <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><div><strong>Accounting reconciliation difference:</strong> {formatEgp(performanceBridge.reconciliationDelta)} EGP. The report is showing the actual ledger/equity values instead of inventing a balancing capital figure.</div></div>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="premium-subpanel premium-hierarchy-h4 p-3 rounded-xl"><span className="text-slate-400 block">Net Capital Contributed</span><strong className="font-mono text-blue-300">{formatEgp(performanceBridge.netCapitalContributed)} EGP</strong></div>
          <div className={`premium-subpanel premium-hierarchy-h4 p-3 rounded-xl ${performanceBridge.realizedPnl > 0 ? 'premium-state-win' : performanceBridge.realizedPnl < 0 ? 'premium-state-loss' : 'premium-state-breakeven'}`}><span className="text-slate-400 block">Realized P&amp;L</span><strong className={`font-mono ${performanceBridge.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{performanceBridge.realizedPnl >= 0 ? '+' : ''}{formatEgp(performanceBridge.realizedPnl)} EGP</strong></div>
          <div className={`premium-subpanel premium-hierarchy-h4 p-3 rounded-xl ${performanceBridge.unrealizedPnl > 0 ? 'premium-state-win' : performanceBridge.unrealizedPnl < 0 ? 'premium-state-loss' : 'premium-state-breakeven'}`}><span className="text-slate-400 block">Unrealized P&amp;L</span><strong className={`font-mono ${performanceBridge.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{performanceBridge.unrealizedPnl >= 0 ? '+' : ''}{formatEgp(performanceBridge.unrealizedPnl)} EGP</strong></div>
          <div className="premium-subpanel premium-hierarchy-h4 p-3 rounded-xl"><span className="text-slate-400 block">Ending Equity / NAV</span><strong className="font-mono text-purple-300">{formatEgp(performanceBridge.endingEquity)} EGP</strong></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          {waterfallSteps.map((step, index) => <div key={step.name} className="premium-subpanel premium-hierarchy-h4 p-3 rounded-xl"><div className="text-[10px] text-slate-400">Step {index + 1}</div><div className="text-xs font-semibold text-slate-200">{step.name}</div><div className={`font-mono font-bold mt-1 ${step.total ? 'text-purple-300' : step.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{step.total ? formatEgp(step.end) : `${step.delta >= 0 ? '+' : ''}${formatEgp(step.delta)}`} EGP</div></div>)}
        </div>
        <div className="text-[11px] text-slate-500">Reported NAV: {formatEgp(reportedNav)} EGP · Bridge delta: {formatEgp(performanceBridge.reconciliationDelta)} EGP</div>
      </div>

      <div className="premium-report-section premium-hierarchy-h3 rounded-2xl p-4 sm:p-5" data-hierarchy="h3"><h3 className="premium-type-section-title flex items-center gap-2 mb-3"><TrendingDown className="w-4 h-4 text-rose-400" />Closed Trade Summary</h3><div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs"><div className="premium-subpanel premium-hierarchy-h4 p-3 rounded-xl"><span className="text-slate-400 block">Winning</span><strong className="text-emerald-400">{stats.winningTrades}</strong></div><div className="premium-subpanel premium-hierarchy-h4 p-3 rounded-xl"><span className="text-slate-400 block">Losing</span><strong className="text-rose-400">{stats.losingTrades}</strong></div><div className="premium-subpanel premium-hierarchy-h4 p-3 rounded-xl"><span className="text-slate-400 block">Average Hold</span><strong className="text-purple-300">{stats.avgHoldDays} days</strong></div><div className="premium-subpanel premium-hierarchy-h4 p-3 rounded-xl"><span className="text-slate-400 block">Profit Factor</span><strong className="text-amber-300">{Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞'}x</strong></div></div></div>

      <MonthlyPerformanceReport closedTrades={closedTrades} positions={positions} />
    </div>
  );
};

export const PerformanceReports = React.memo(PerformanceReportsComponent);
