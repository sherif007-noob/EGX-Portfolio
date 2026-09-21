import React, { useState, useMemo } from 'react';
import { ClosedTrade, PerformanceStats } from '../types';
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
  ANALYTICS_CHART_THEME,
  ChartTooltipShell,
  analyticsGridProps,
  analyticsTooltipCursor,
  analyticsXAxisProps,
  analyticsYAxisProps,
} from './charts/AnalyticsChartTheme';

const EGP_FORMATTER = new Intl.NumberFormat('en-EG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatEgp = (val: number) => EGP_FORMATTER.format(val);

interface RealizedTrajectoryChartProps {
  closedTrades: ClosedTrade[];
  stats?: PerformanceStats;
  title?: string;
  subtitle?: string;
  className?: string;
}

const RealizedTrajectoryChartComponent: React.FC<RealizedTrajectoryChartProps> = ({
  closedTrades,
  stats,
  title = 'Realized P&L Gain / Loss Trajectory',
  subtitle = 'Historical equity growth trajectory of closed trades over time (in EGP)',
  className = '',
}) => {
  const [trajectoryMode, setTrajectoryMode] = useState<'cumulative' | 'discrete'>('cumulative');

  // Prepare chronological trajectory points
  const trajectoryData = useMemo(() => {
    const sorted = [...closedTrades].sort((a, b) => {
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
  }, [closedTrades]);

  const netRealizedPnl = closedTrades.reduce((acc, t) => acc + t.realizedPnlEgp, 0);
  const peakHighWaterMark = Math.max(...trajectoryData.map((d) => d.cumulativePnl), 0);
  const winCount = closedTrades.filter((t) => t.outcome === 'WIN').length;
  const lossCount = closedTrades.filter((t) => t.outcome === 'LOSS').length;
  const avgHoldDays =
    stats?.avgHoldDays ||
    (closedTrades.length > 0
      ? Math.round(closedTrades.reduce((acc, t) => acc + (t.holdingDays || 0), 0) / closedTrades.length)
      : 0);

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

        <div className="premium-report-glass-soft flex items-center gap-1.5 p-1 rounded-xl text-xs self-start sm:self-auto">
          <button
            aria-pressed={trajectoryMode === 'cumulative'}
            onClick={() => setTrajectoryMode('cumulative')}
            className={`premium-segment px-3 py-1 rounded-md font-medium ${
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
            className={`premium-segment px-3 py-1 rounded-md font-medium ${
              trajectoryMode === 'discrete'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Trade-by-Trade
          </button>
        </div>
      </div>

      {/* Trajectory Key Stats Summary */}
      <div className="premium-report-glass-soft grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl text-xs">
        <div className={`rounded-lg border p-2 ${
          netRealizedPnl > 0
            ? 'premium-state-win'
            : netRealizedPnl < 0
            ? 'premium-state-loss'
            : 'premium-state-breakeven'
        }`}>
          <span className="text-slate-400 block text-[10px]">Net Realized P&amp;L</span>
          <span className={`font-mono font-bold ${netRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {netRealizedPnl >= 0 ? '+' : ''}{formatEgp(netRealizedPnl)} EGP
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px]">Peak High-Water Mark</span>
          <span className="font-mono font-bold text-cyan-400">
            +{formatEgp(peakHighWaterMark)} EGP
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px]">Trades Closed</span>
          <span className="font-mono font-bold text-slate-200">
            {closedTrades.length} trades ({winCount}W / {lossCount}L)
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
        <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-400 px-1">
          <span className="text-slate-500">Milestone points on chronological growth trajectory:</span>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-900" />
              <span className="text-slate-300 font-medium">Winning Trade</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-slate-900" />
              <span className="text-slate-300 font-medium">Losing Trade</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-slate-900" />
              <span className="text-slate-400 font-medium">Inception</span>
            </span>
          </div>
        </div>
      )}

      {/* Chart Canvas */}
      <div className="h-64 sm:h-72 w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          {trajectoryMode === 'cumulative' ? (
            <AreaChart data={trajectoryData} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="pnlGrowthGradReusable" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={ANALYTICS_CHART_THEME.emerald} stopOpacity={0.32} />
                  <stop offset="95%" stopColor={ANALYTICS_CHART_THEME.emerald} stopOpacity={0.0} />
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
                tickFormatter={(val) => `${val >= 0 ? '+' : ''}${(val / 1000).toFixed(0)}k`}
              />
              <ReferenceLine y={0} stroke={ANALYTICS_CHART_THEME.zeroLine} strokeDasharray="3 3" />
              <Tooltip
                cursor={analyticsTooltipCursor}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const isWin = data.tradePnl >= 0;
                    return (
                      <ChartTooltipShell className="space-y-1">
                        <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-1 font-semibold text-white">
                          <span>{data.ticker}</span>
                          <span
                            className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                              data.outcome === 'WIN'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : data.outcome === 'LOSS'
                                ? 'bg-rose-500/20 text-rose-400'
                                : 'bg-slate-700 text-slate-300'
                            }`}
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
                              <span className={isWin ? 'text-emerald-400' : 'text-rose-400'}>
                                {isWin ? '+' : ''}{formatEgp(data.tradePnl)} EGP ({data.tradePercent >= 0 ? '+' : ''}{data.tradePercent.toFixed(1)}%)
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between gap-3 border-t border-slate-800 pt-1 text-slate-300 font-bold">
                            <span>Cumulative Level:</span>
                            <span className={data.cumulativePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {data.cumulativePnl >= 0 ? '+' : ''}{formatEgp(data.cumulativePnl)} EGP
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
                stroke={ANALYTICS_CHART_THEME.emerald}
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#pnlGrowthGradReusable)"
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (payload.outcome === 'START') {
                    return (
                      <circle
                        key={`pt-start-${payload.index}`}
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill="#94a3b8"
                        stroke="#0f172a"
                        strokeWidth={2}
                      />
                    );
                  }
                  const isWin = payload.outcome === 'WIN';
                  return (
                    <circle
                      key={`pt-trade-${payload.index}-${payload.ticker}`}
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill={isWin ? ANALYTICS_CHART_THEME.emerald : ANALYTICS_CHART_THEME.rose}
                      stroke="#0f172a"
                      strokeWidth={2}
                      className="cursor-pointer transition-transform hover:scale-125"
                    />
                  );
                }}
                activeDot={{ r: 7, fill: ANALYTICS_CHART_THEME.emerald, stroke: '#020617', strokeWidth: 2 }}
              />
            </AreaChart>
          ) : (
            <BarChart
              data={trajectoryData.filter((d) => d.index > 0)}
              margin={{ top: 10, right: 15, left: 10, bottom: 5 }}
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
                tickFormatter={(val) => `${val >= 0 ? '+' : ''}${(val / 1000).toFixed(0)}k`}
              />
              <ReferenceLine y={0} stroke={ANALYTICS_CHART_THEME.zeroLine} strokeDasharray="3 3" />
              <Tooltip
                cursor={analyticsTooltipCursor}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const isWin = data.tradePnl >= 0;
                    return (
                      <ChartTooltipShell className="space-y-1">
                        <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-1 font-semibold text-white">
                          <span>{data.ticker}</span>
                          <span
                            className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                              isWin ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                            }`}
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
                            <span className={`font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isWin ? '+' : ''}{formatEgp(data.tradePnl)} EGP ({data.tradePercent >= 0 ? '+' : ''}{data.tradePercent.toFixed(1)}%)
                            </span>
                          </div>
                          {data.fees > 0 && (
                            <div className="flex justify-between gap-3 text-slate-400">
                              <span>Commissions:</span>
                              <span className="text-amber-400">{formatEgp(data.fees)} EGP</span>
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
                      fill={entry.tradePnl >= 0 ? ANALYTICS_CHART_THEME.emerald : ANALYTICS_CHART_THEME.rose}
                    />
                  ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const RealizedTrajectoryChart = React.memo(RealizedTrajectoryChartComponent);
