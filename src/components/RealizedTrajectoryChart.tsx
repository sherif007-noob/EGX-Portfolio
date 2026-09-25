import React, { useState, useMemo } from 'react';
import { ClosedTrade, PerformanceStats } from '../types';
import {
  REALIZED_TRAJECTORY_TIMEFRAMES,
  filterRealizedTrajectoryTrades,
  type RealizedTrajectoryTimeframe,
} from '../services/realizedTrajectoryTimeframes';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Clock, Award, ShieldCheck } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell
} from 'recharts';
import {
  ANALYTICS_CHART_MARGINS,
  ANALYTICS_CHART_THEME,
  AnalyticsEmptyState,
  ChartLegend,
  ChartPlotSurface,
  ChartTooltipShell,
  analyticsGridProps,
  analyticsTooltipCursor,
  analyticsXAxisProps,
  analyticsYAxisProps,
  analyticsZeroLineProps,
  formatAnalyticsCompactEgp,
  formatAnalyticsEgp,
  formatAnalyticsPercent,
  getAnalyticsTradeMarkerStyle,
  type AnalyticsTradeMarkerOutcome,
} from './charts/AnalyticsChartTheme';

interface RealizedTrajectoryChartProps {
  closedTrades: ClosedTrade[];
  stats?: PerformanceStats;
  title?: string;
  subtitle?: string;
  className?: string;
  entranceReady?: boolean;
}

function outcomeTextClass(outcome: AnalyticsTradeMarkerOutcome): string {
  if (outcome === 'WIN') return 'text-emerald-400';
  if (outcome === 'LOSS') return 'text-rose-400';
  if (outcome === 'BREAKEVEN') return 'text-amber-400';
  return 'text-slate-300';
}

function outcomeBadgeClass(outcome: AnalyticsTradeMarkerOutcome): string {
  if (outcome === 'WIN') return 'bg-emerald-500/20 text-emerald-400';
  if (outcome === 'LOSS') return 'bg-rose-500/20 text-rose-400';
  if (outcome === 'BREAKEVEN') return 'bg-amber-500/20 text-amber-400';
  return 'bg-slate-700 text-slate-300';
}

const RealizedTrajectoryChartComponent: React.FC<RealizedTrajectoryChartProps> = ({
  closedTrades,
  title = 'Realized P&L Gain / Loss Trajectory',
  subtitle = 'Historical equity growth trajectory of closed trades over time (in EGP)',
  className = '',
  entranceReady = true,
}) => {
  const [trajectoryMode, setTrajectoryMode] = useState<'cumulative' | 'discrete'>('cumulative');
  const [trajectoryTimeframe, setTrajectoryTimeframe] = useState<RealizedTrajectoryTimeframe>('ALL');

  const filteredClosedTrades = useMemo(
    () => filterRealizedTrajectoryTrades(closedTrades, trajectoryTimeframe),
    [closedTrades, trajectoryTimeframe],
  );

  // Prepare chronological trajectory points. Every filtered closed trade remains
  // a persistent visible point in cumulative mode.
  const trajectoryData = useMemo(() => {
    const sorted = [...filteredClosedTrades].sort((a, b) => {
      const dateA = a.sellDate || '2026-01-01';
      const dateB = b.sellDate || '2026-01-01';
      return dateA.localeCompare(dateB);
    });

    let runningCumulative = 0;
    const points = [
      {
        index: 0,
        tradeLabel: 'Inception',
        date: 'Baseline',
        ticker: 'PORTFOLIO',
        companyName: 'Starting Portfolio Equity',
        tradePnl: 0,
        tradePercent: 0,
        cumulativePnl: 0,
        fees: 0,
        outcome: 'START' as 'START' | 'WIN' | 'LOSS' | 'BREAKEVEN',
      },
    ];

    sorted.forEach((trade, idx) => {
      runningCumulative += trade.realizedPnlEgp;
      points.push({
        index: idx + 1,
        tradeLabel: `#${idx + 1} ${trade.ticker}`,
        date: trade.sellDate || `Trade ${idx + 1}`,
        ticker: trade.ticker,
        companyName: trade.companyName,
        tradePnl: trade.realizedPnlEgp,
        tradePercent: trade.realizedPnlPercent,
        cumulativePnl: runningCumulative,
        fees: trade.totalFees || 0,
        outcome: trade.outcome,
      });
    });

    return points;
  }, [filteredClosedTrades]);

  const netRealizedPnl = filteredClosedTrades.reduce((acc, t) => acc + t.realizedPnlEgp, 0);
  const trajectoryStroke =
    netRealizedPnl > 0
      ? ANALYTICS_CHART_THEME.emerald
      : netRealizedPnl < 0
        ? ANALYTICS_CHART_THEME.rose
        : ANALYTICS_CHART_THEME.amber;
  const peakHighWaterMark = Math.max(...trajectoryData.map((d) => d.cumulativePnl), 0);
  const winCount = filteredClosedTrades.filter((t) => t.outcome === 'WIN').length;
  const lossCount = filteredClosedTrades.filter((t) => t.outcome === 'LOSS').length;
  const avgHoldDays =
    filteredClosedTrades.length > 0
      ? Math.round(
          filteredClosedTrades.reduce((acc, t) => acc + (t.holdingDays || 0), 0) /
            filteredClosedTrades.length,
        )
      : 0;

  return (
    <div className={`premium-report-glass premium-radial p-4 sm:p-5 rounded-2xl space-y-4 ${className}`}>
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            {title}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>

        <div className="premium-report-glass-soft grid w-full grid-cols-2 gap-1.5 rounded-xl p-1 text-xs sm:flex sm:w-auto sm:items-center sm:self-auto">
          <button
            aria-pressed={trajectoryMode === 'cumulative'}
            onClick={() => setTrajectoryMode('cumulative')}
            className={`premium-segment min-w-0 px-2 py-1.5 rounded-md font-medium sm:px-3 ${
              trajectoryMode === 'cumulative'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Cumulative Curve
          </button>
          <button
            aria-pressed={trajectoryMode === 'discrete'}
            onClick={() => setTrajectoryMode('discrete')}
            className={`premium-segment min-w-0 px-2 py-1.5 rounded-md font-medium sm:px-3 ${
              trajectoryMode === 'discrete'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Trade-by-Trade
          </button>
        </div>
      </div>

      <div
        className="-mx-1 flex max-w-[calc(100%+0.5rem)] items-center gap-1.5 overflow-x-auto px-1 pb-1"
        role="group"
        aria-label="Realized trajectory timeframe"
      >
        <span className="mr-1 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Period
        </span>
        {REALIZED_TRAJECTORY_TIMEFRAMES.map((item) => {
          const selected = trajectoryTimeframe === item.value;
          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={selected}
              onClick={() => setTrajectoryTimeframe(item.value)}
              className={[
                'premium-segment min-w-[48px] shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold',
                selected
                  ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                  : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200',
              ].join(' ')}
            >
              {item.label}
            </button>
          );
        })}
        <span className="ml-1 shrink-0 font-mono text-[10px] text-slate-500">
          {filteredClosedTrades.length}/{closedTrades.length} trades
        </span>
      </div>

      {/* Trajectory Key Stats Summary */}
      <div className="premium-report-glass-soft grid grid-cols-2 gap-2.5 rounded-xl p-3 text-xs sm:grid-cols-4">
        <div className={`rounded-lg border p-2 ${
          netRealizedPnl > 0
            ? 'premium-state-win'
            : netRealizedPnl < 0
            ? 'premium-state-loss'
            : 'premium-state-breakeven'
        }`}>
          <span className="text-slate-400 block text-[10px]">Net Realized P&amp;L</span>
          <span className={`font-mono font-bold ${netRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatAnalyticsEgp(netRealizedPnl, true)}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px]">Peak High-Water Mark</span>
          <span className="font-mono font-bold text-cyan-400">
            {formatAnalyticsEgp(peakHighWaterMark, true)}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px]">Trades Closed</span>
          <span className="font-mono font-bold text-slate-200">
            {filteredClosedTrades.length} trades ({winCount}W / {lossCount}L)
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px]">Avg Holding Duration</span>
          <span className="font-mono font-bold text-purple-400">
            {avgHoldDays} trading days
          </span>
        </div>
      </div>

      {/* Trajectory Plot Points Guide (for Cumulative Growth Mode) */}
      {trajectoryMode === 'cumulative' && (
        <div className="space-y-2 px-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Each point is one closed trade
          </div>
          <ChartLegend
            ariaLabel="Realized trajectory trade outcomes"
            items={[
              { label: 'Winning trade', color: ANALYTICS_CHART_THEME.emerald, kind: 'dot' },
              { label: 'Losing trade', color: ANALYTICS_CHART_THEME.rose, kind: 'dot' },
              ...(filteredClosedTrades.some((trade) => trade.outcome === 'BREAKEVEN')
                ? [{ label: 'Breakeven trade', color: ANALYTICS_CHART_THEME.amber, kind: 'dot' as const }]
                : []),
              { label: 'Inception', color: ANALYTICS_CHART_THEME.neutral, kind: 'dot' },
            ]}
          />
        </div>
      )}

      {/* Chart Canvas */}
      {filteredClosedTrades.length === 0 ? (
        <AnalyticsEmptyState>
          {closedTrades.length === 0
            ? 'No closed trades are available for the realized P&L trajectory yet.'
            : `No closed trades fall inside the selected ${trajectoryTimeframe} period.`}
        </AnalyticsEmptyState>
      ) : (
        <ChartPlotSurface
          className="h-56 w-full sm:h-72"
          ariaLabel={trajectoryMode === 'cumulative' ? 'Cumulative realized P&L trajectory' : 'Trade-by-trade realized P&L'}
        >
          {entranceReady && (
          <ResponsiveContainer width="100%" height="100%" debounce={80}>
            {trajectoryMode === 'cumulative' ? (
            <AreaChart data={trajectoryData} margin={ANALYTICS_CHART_MARGINS.trajectory}>
              <defs>
                <linearGradient id="pnlGrowthGradReusable" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={trajectoryStroke} stopOpacity={0.32} />
                  <stop offset="95%" stopColor={trajectoryStroke} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...analyticsGridProps} />
              <XAxis
                dataKey="tradeLabel"
                {...analyticsXAxisProps}
                fontSize={11}
              />
              <YAxis
                {...analyticsYAxisProps}
                fontSize={11}
                tickFormatter={formatAnalyticsCompactEgp}
              />
              <ReferenceLine y={0} {...analyticsZeroLineProps} />
              <Tooltip
                cursor={analyticsTooltipCursor}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const outcome = data.outcome as AnalyticsTradeMarkerOutcome;
                    return (
                      <ChartTooltipShell className="space-y-1">
                        <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-1 font-semibold text-white">
                          <span>{data.ticker}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${outcomeBadgeClass(outcome)}`}
                          >
                            {data.outcome}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">{data.companyName}</p>
                        <div className="pt-1 space-y-0.5 font-mono text-[11px]">
                          <div className="flex justify-between gap-3 text-slate-400">
                            <span>Date:</span>
                            <span className="text-slate-200">{data.date}</span>
                          </div>
                          {data.index > 0 && (
                            <div className="flex justify-between gap-3 text-slate-400">
                              <span>Trade P&amp;L:</span>
                              <span className={outcomeTextClass(outcome)}>
                                {formatAnalyticsEgp(data.tradePnl, true)} ({formatAnalyticsPercent(data.tradePercent, true)})
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between gap-3 border-t border-slate-800 pt-1 text-slate-300 font-bold">
                            <span>Cumulative Level:</span>
                            <span className={data.cumulativePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {formatAnalyticsEgp(data.cumulativePnl, true)}
                            </span>
                          </div>
                        </div>
                      </ChartTooltipShell>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="cumulativePnl"
                stroke={trajectoryStroke}
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#pnlGrowthGradReusable)"
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const outcome = payload.outcome as AnalyticsTradeMarkerOutcome;
                  const marker = getAnalyticsTradeMarkerStyle(outcome);
                  return (
                    <circle
                      key={`pt-trade-${payload.index}-${payload.ticker}`}
                      cx={cx}
                      cy={cy}
                      r={marker.radius}
                      fill={marker.fill}
                      stroke={marker.stroke}
                      strokeWidth={marker.strokeWidth}
                      className="premium-trajectory-trade-marker cursor-pointer"
                      style={{ '--trajectory-marker-glow': marker.glow } as React.CSSProperties}
                    />
                  );
                }}
                activeDot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const marker = getAnalyticsTradeMarkerStyle(
                    payload.outcome as AnalyticsTradeMarkerOutcome,
                  );
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={marker.activeRadius}
                      fill={marker.fill}
                      stroke={marker.stroke}
                      strokeWidth={marker.strokeWidth}
                      className="premium-trajectory-trade-marker premium-trajectory-trade-marker-active"
                      style={{ '--trajectory-marker-glow': marker.glow } as React.CSSProperties}
                    />
                  );
                }}
              />
            </AreaChart>
          ) : (
            <BarChart
              data={trajectoryData.filter((d) => d.index > 0)}
              margin={ANALYTICS_CHART_MARGINS.trajectory}
            >
              <CartesianGrid {...analyticsGridProps} />
              <XAxis
                dataKey="tradeLabel"
                {...analyticsXAxisProps}
                fontSize={11}
              />
              <YAxis
                {...analyticsYAxisProps}
                fontSize={11}
                tickFormatter={formatAnalyticsCompactEgp}
              />
              <ReferenceLine y={0} {...analyticsZeroLineProps} />
              <Tooltip
                cursor={analyticsTooltipCursor}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const outcome = data.outcome as AnalyticsTradeMarkerOutcome;
                    return (
                      <ChartTooltipShell className="space-y-1">
                        <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-1 font-semibold text-white">
                          <span>{data.ticker}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${outcomeBadgeClass(outcome)}`}
                          >
                            {data.outcome}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">{data.companyName}</p>
                        <div className="pt-1 space-y-0.5 font-mono text-[11px]">
                          <div className="flex justify-between gap-3 text-slate-400">
                            <span>Sell Date:</span>
                            <span className="text-slate-200">{data.date}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span>Trade P&amp;L:</span>
                            <span className={`font-bold ${outcomeTextClass(outcome)}`}>
                              {formatAnalyticsEgp(data.tradePnl, true)} ({formatAnalyticsPercent(data.tradePercent, true)})
                            </span>
                          </div>
                          {data.fees > 0 && (
                            <div className="flex justify-between gap-3 text-slate-400">
                              <span>Commissions:</span>
                              <span className="text-amber-400">{formatAnalyticsEgp(data.fees)}</span>
                            </div>
                          )}
                        </div>
                      </ChartTooltipShell>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="tradePnl" radius={[4, 4, 0, 0]}>
                {trajectoryData
                  .filter((d) => d.index > 0)
                  .map((entry) => (
                    <Cell
                      key={`bar-${entry.index}-${entry.ticker}`}
                      fill={getAnalyticsTradeMarkerStyle(entry.outcome as AnalyticsTradeMarkerOutcome).fill}
                    />
                  ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
        )}
      </ChartPlotSurface>
      )}
    </div>
  );
};

export const RealizedTrajectoryChart = React.memo(RealizedTrajectoryChartComponent);
