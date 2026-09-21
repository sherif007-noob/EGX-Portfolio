import React, { useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, Receipt, TrendingDown } from 'lucide-react';
import type { TradeTransaction } from '../../types';
import type { HistoricalPriceSeries } from '../../services/historicalPriceStore';
import type { IntradayPriceSeries } from '../../services/intradayPriceStore';
import type { UnifiedAnalyticsResult } from '../../services/unifiedAnalyticsEngine';
import { buildSecondaryAnalytics } from '../../services/secondaryAnalytics';
import {
  ANALYTICS_CHART_THEME,
  AnalyticsChartTooltip,
  AnalyticsEmptyState,
  analyticsGridProps,
  analyticsTooltipCursor,
  analyticsXAxisProps,
  analyticsYAxisProps,
  formatAnalyticsCompactEgp,
  formatAnalyticsEgp,
  formatAnalyticsPercent,
} from './AnalyticsChartTheme';

interface SecondaryAnalyticsChartsProps {
  transactions: TradeTransaction[];
  historicalPrices: HistoricalPriceSeries;
  intradayPrices: IntradayPriceSeries;
  result: UnifiedAnalyticsResult | null;
  transitionKey: string;
  suppressSeriesAnimation?: boolean;
}

function formatDailyLabel(value: string): string {
  return new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-EG', {
    month: 'short',
    day: 'numeric',
  });
}

function formatCairoTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-EG', {
    timeZone: 'Africa/Cairo',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatTooltipDate(value: string, intraday: boolean): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  if (intraday) {
    return date.toLocaleString('en-EG', {
      timeZone: 'Africa/Cairo',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  return value.slice(0, 10);
}

export const SecondaryAnalyticsCharts: React.FC<SecondaryAnalyticsChartsProps> = ({
  transactions,
  historicalPrices,
  intradayPrices,
  result,
  transitionKey,
  suppressSeriesAnimation = false,
}) => {
  const reduceMotion = useReducedMotion();
  const secondary = useMemo(
    () => buildSecondaryAnalytics(transactions, historicalPrices, intradayPrices, result),
    [transactions, historicalPrices, intradayPrices, result],
  );

  if (!result || result.points.length < 2) return null;

  const intraday = result.window.resolution === '15m';
  const lineType = intraday ? 'linear' : 'monotone';
  const drawdownGradientId = `secondaryDrawdownGradient-${transitionKey}`;
  const feesGradientId = `secondaryFeesGradient-${transitionKey}`;
  const chartData = secondary.points.map((point) => ({
    ...point,
    axisLabel: intraday ? formatCairoTime(point.date) : formatDailyLabel(point.date),
  }));

  const labelFormatter = (_: string | number, payload: readonly any[]) =>
    formatTooltipDate(String(payload?.[0]?.payload?.date || ''), intraday);

  const sharedXAxis = (
    <XAxis
      dataKey="axisLabel"
      {...analyticsXAxisProps}
      interval="preserveStartEnd"
      minTickGap={28}
    />
  );

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.section
        key={transitionKey}
        className="space-y-3"
        aria-label="Secondary portfolio analytics"
        data-motion-owned="react"
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 7 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: {
            duration: reduceMotion ? 0.12 : 0.44,
            ease: [0.22, 0.8, 0.24, 1],
          },
        }}
        exit={{
          opacity: 0,
          y: reduceMotion ? 0 : -5,
          transition: {
            duration: reduceMotion ? 0.1 : 0.27,
            ease: [0.4, 0, 0.7, 0.2],
          },
        }}
      >
      <div>
        <h3 className="text-sm font-bold text-white">Risk &amp; Cost Analytics</h3>
        <p className="mt-1 text-xs text-slate-400">
          Secondary views use the same {result.window.label.toLowerCase()} valuation timeline as the primary chart.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-bold text-white">
                <TrendingDown className="h-4 w-4 text-rose-400" />
                Performance Drawdown
              </h4>
              <p className="mt-1 text-[11px] text-slate-400">
                Decline from the selected-period TWR performance peak.
              </p>
            </div>
            <div className="text-right">
              <div className="font-mono text-lg font-black text-rose-400">
                {secondary.summary.maxDrawdownPercent == null
                  ? '—'
                  : formatAnalyticsPercent(secondary.summary.maxDrawdownPercent)}
              </div>
              {secondary.summary.maxEquityDrawdownEgp != null && (
                <div className="text-[10px] text-slate-500">
                  Nominal equity gap: {formatAnalyticsEgp(secondary.summary.maxEquityDrawdownEgp)}
                </div>
              )}
            </div>
          </div>

          {chartData.length < 2 ? (
            <AnalyticsEmptyState>Not enough complete points for drawdown.</AnalyticsEmptyState>
          ) : (
            <div className="h-52 sm:h-56">
              <ResponsiveContainer width="100%" height="100%" debounce={80}>
                <AreaChart data={chartData} syncId="portfolio-secondary-analytics" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={drawdownGradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={ANALYTICS_CHART_THEME.rose} stopOpacity={0.24} />
                      <stop offset="95%" stopColor={ANALYTICS_CHART_THEME.rose} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...analyticsGridProps} />
                  {sharedXAxis}
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
                        title="Performance Drawdown"
                        labelFormatter={labelFormatter}
                        nameFormatter={() => 'Drawdown'}
                        valueFormatter={(value) => formatAnalyticsPercent(value)}
                        tone="negative"
                      />
                    )}
                  />
                  <Area
                    type={lineType}
                    dataKey="drawdownPercent"
                    stroke={ANALYTICS_CHART_THEME.rose}
                    strokeWidth={2}
                    fill={`url(#${drawdownGradientId})`}
                    fillOpacity={1}
                    dot={false}
                    activeDot={{
                      r: 4.5,
                      fill: ANALYTICS_CHART_THEME.rose,
                      stroke: '#020617',
                      strokeWidth: 2,
                    }}
                    isAnimationActive={!suppressSeriesAnimation}
                    animationDuration={520}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-bold text-white">
                <Receipt className="h-4 w-4 text-amber-400" />
                Cumulative Fees
              </h4>
              <p className="mt-1 text-[11px] text-slate-400">
                Brokerage and explicit fee cash flows inside the visible timeframe.
              </p>
            </div>
            <div className="font-mono text-lg font-black text-amber-400">
              {formatAnalyticsEgp(secondary.summary.feesInPeriodEgp)}
            </div>
          </div>

          {chartData.length < 2 ? (
            <AnalyticsEmptyState>Not enough complete points for fee history.</AnalyticsEmptyState>
          ) : (
            <div className="h-52 sm:h-56">
              <ResponsiveContainer width="100%" height="100%" debounce={80}>
                <AreaChart data={chartData} syncId="portfolio-secondary-analytics" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={feesGradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={ANALYTICS_CHART_THEME.amber} stopOpacity={0.22} />
                      <stop offset="95%" stopColor={ANALYTICS_CHART_THEME.amber} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...analyticsGridProps} />
                  {sharedXAxis}
                  <YAxis {...analyticsYAxisProps} tickFormatter={formatAnalyticsCompactEgp} />
                  <Tooltip
                    cursor={analyticsTooltipCursor}
                    content={(props) => (
                      <AnalyticsChartTooltip
                        {...props}
                        title="Fees Paid"
                        labelFormatter={labelFormatter}
                        nameFormatter={() => 'Cumulative Fees'}
                        valueFormatter={(value) => formatAnalyticsEgp(value)}
                      />
                    )}
                  />
                  <Area
                    type="stepAfter"
                    dataKey="cumulativeFeesEgp"
                    stroke={ANALYTICS_CHART_THEME.amber}
                    strokeWidth={2}
                    fill={`url(#${feesGradientId})`}
                    fillOpacity={1}
                    dot={false}
                    activeDot={{
                      r: 4.5,
                      fill: ANALYTICS_CHART_THEME.amber,
                      stroke: '#020617',
                      strokeWidth: 2,
                    }}
                    isAnimationActive={!suppressSeriesAnimation}
                    animationDuration={520}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="xl:col-span-2 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-bold text-white">
                <Activity className="h-4 w-4 text-cyan-400" />
                Realized vs Unrealized P&amp;L
              </h4>
              <p className="mt-1 text-[11px] text-slate-400">
                Fee-aware cumulative realized trade P&amp;L and open-position unrealized P&amp;L.
              </p>
            </div>
            <div className="flex gap-4 text-right text-[11px]">
              <div>
                <div className="text-slate-500">Realized</div>
                <div className={`font-mono font-bold ${(secondary.summary.realizedPnlEgp ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {secondary.summary.realizedPnlEgp == null ? '—' : formatAnalyticsEgp(secondary.summary.realizedPnlEgp, true)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Unrealized</div>
                <div className={`font-mono font-bold ${(secondary.summary.unrealizedPnlEgp ?? 0) >= 0 ? 'text-cyan-300' : 'text-rose-400'}`}>
                  {secondary.summary.unrealizedPnlEgp == null ? '—' : formatAnalyticsEgp(secondary.summary.unrealizedPnlEgp, true)}
                </div>
              </div>
            </div>
          </div>

          {chartData.length < 2 ? (
            <AnalyticsEmptyState>Not enough complete points for P&amp;L composition.</AnalyticsEmptyState>
          ) : (
            <div className="h-56 sm:h-64">
              <ResponsiveContainer width="100%" height="100%" debounce={80}>
                <LineChart data={chartData} syncId="portfolio-secondary-analytics" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid {...analyticsGridProps} />
                  {sharedXAxis}
                  <YAxis {...analyticsYAxisProps} tickFormatter={formatAnalyticsCompactEgp} />
                  <ReferenceLine y={0} stroke={ANALYTICS_CHART_THEME.zeroLine} strokeDasharray="3 3" />
                  <Tooltip
                    cursor={analyticsTooltipCursor}
                    content={(props) => (
                      <AnalyticsChartTooltip
                        {...props}
                        title="P&L Composition"
                        labelFormatter={labelFormatter}
                        nameFormatter={(name) => name === 'realizedPnlEgp' ? 'Realized' : 'Unrealized'}
                        valueFormatter={(value) => formatAnalyticsEgp(value, true)}
                      />
                    )}
                  />
                  <Line
                    type={lineType}
                    dataKey="realizedPnlEgp"
                    name="Realized"
                    stroke={ANALYTICS_CHART_THEME.emerald}
                    strokeWidth={2.1}
                    dot={false}
                    activeDot={{ r: 4.5, fill: ANALYTICS_CHART_THEME.emerald, stroke: '#020617', strokeWidth: 2 }}
                    isAnimationActive={!suppressSeriesAnimation}
                    animationDuration={520}
                    animationEasing="ease-out"
                  />
                  <Line
                    type={lineType}
                    dataKey="unrealizedPnlEgp"
                    name="Unrealized"
                    stroke={ANALYTICS_CHART_THEME.cyan}
                    strokeWidth={2.1}
                    dot={false}
                    activeDot={{ r: 4.5, fill: ANALYTICS_CHART_THEME.cyan, stroke: '#020617', strokeWidth: 2 }}
                    isAnimationActive={!suppressSeriesAnimation}
                    animationDuration={520}
                    animationEasing="ease-out"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
      </motion.section>
    </AnimatePresence>
  );
};
