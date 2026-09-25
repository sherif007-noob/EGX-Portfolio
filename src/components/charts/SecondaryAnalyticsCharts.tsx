import React, { useMemo } from 'react';
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
  ANALYTICS_CHART_MARGINS,
  ANALYTICS_CHART_THEME,
  AnalyticsChartTooltip,
  AnalyticsEmptyState,
  ChartLegend,
  ChartPlotSurface,
  analyticsActiveDotProps,
  analyticsGridProps,
  analyticsTooltipCursor,
  analyticsXAxisProps,
  analyticsYAxisProps,
  analyticsZeroLineProps,
  formatAnalyticsCompactEgp,
  formatAnalyticsEgp,
  formatAnalyticsPercent,
  formatAnalyticsPercentAxis,
} from './AnalyticsChartTheme';

interface SecondaryAnalyticsChartsProps {
  transactions: TradeTransaction[];
  historicalPrices: HistoricalPriceSeries;
  intradayPrices: IntradayPriceSeries;
  result: UnifiedAnalyticsResult | null;
  entranceReady?: boolean;
  tooltipsEnabled?: boolean;
  onChartInteraction?: React.PointerEventHandler<HTMLDivElement>;
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

const SecondaryMetric: React.FC<{
  label: string;
  value: React.ReactNode;
  toneClass: string;
  detail?: React.ReactNode;
}> = ({ label, value, toneClass, detail }) => (
  <div className="premium-secondary-chart-metric min-w-0 rounded-xl px-3 py-2.5">
    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
      {label}
    </div>
    <div className={`mt-1 font-mono text-base font-black sm:text-lg ${toneClass}`}>
      {value}
    </div>
    {detail && <div className="mt-0.5 text-[10px] text-slate-500">{detail}</div>}
  </div>
);

export const SecondaryAnalyticsCharts: React.FC<SecondaryAnalyticsChartsProps> = ({
  transactions,
  historicalPrices,
  intradayPrices,
  result,
  entranceReady = true,
  tooltipsEnabled = true,
  onChartInteraction,
}) => {
  const secondary = useMemo(
    () => buildSecondaryAnalytics(transactions, historicalPrices, intradayPrices, result),
    [transactions, historicalPrices, intradayPrices, result],
  );

  if (!result || result.points.length < 2) return null;

  const intraday = result.window.resolution === '15m';
  const lineType = intraday ? 'linear' : 'monotone';
  const chartData = secondary.points.map((point) => ({
    ...point,
    axisLabel: intraday ? formatCairoTime(point.date) : formatDailyLabel(point.date),
  }));

  const realizedStroke =
    (secondary.summary.realizedPnlEgp ?? 0) < 0
      ? ANALYTICS_CHART_THEME.rose
      : ANALYTICS_CHART_THEME.emerald;
  const unrealizedStroke =
    (secondary.summary.unrealizedPnlEgp ?? 0) < 0
      ? ANALYTICS_CHART_THEME.rose
      : ANALYTICS_CHART_THEME.cyan;

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

  const interactionProps = {
    'data-analytics-chart-interactive': 'true',
    onPointerDownCapture: onChartInteraction,
    onPointerMoveCapture: onChartInteraction,
  } as const;

  return (
    <section className="space-y-3" aria-label="Secondary portfolio analytics">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Risk &amp; Cost Analytics</h3>
          <p className="mt-1 text-xs text-slate-400">
            Secondary views use the same {result.window.label.toLowerCase()} valuation timeline as the primary chart.
          </p>
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
          Synchronized timeline
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div
          className="premium-panel premium-secondary-chart-card rounded-2xl p-4 sm:p-5 space-y-4"
          style={{ '--secondary-chart-rgb': '244 63 94' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="premium-secondary-chart-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                <TrendingDown className="h-4 w-4 text-rose-400" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white">Performance Drawdown</h4>
                <p className="mt-1 text-[11px] leading-4 text-slate-400">
                  Decline from the selected-period TWR performance peak.
                </p>
              </div>
            </div>
            <SecondaryMetric
              label="Max drawdown"
              value={
                secondary.summary.maxDrawdownPercent == null
                  ? '—'
                  : formatAnalyticsPercent(secondary.summary.maxDrawdownPercent)
              }
              toneClass="text-rose-400"
              detail={
                secondary.summary.maxEquityDrawdownEgp == null
                  ? undefined
                  : <>Nominal gap {formatAnalyticsEgp(secondary.summary.maxEquityDrawdownEgp)}</>
              }
            />
          </div>

          {chartData.length < 2 ? (
            <AnalyticsEmptyState>Not enough complete points for drawdown.</AnalyticsEmptyState>
          ) : (
            <ChartPlotSurface
              className="h-48 sm:h-56"
              ariaLabel="Performance drawdown chart"
              style={{ '--chart-plot-accent-rgb': '244 63 94' } as React.CSSProperties}
              {...interactionProps}
            >
              {entranceReady && (
                <ResponsiveContainer width="100%" height="100%" debounce={80}>
                  <AreaChart
                    data={chartData}
                    syncId="portfolio-secondary-analytics"
                    margin={ANALYTICS_CHART_MARGINS.compact}
                  >
                    <defs>
                      <linearGradient id="secondaryDrawdownGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={ANALYTICS_CHART_THEME.rose} stopOpacity={0.30} />
                        <stop offset="95%" stopColor={ANALYTICS_CHART_THEME.rose} stopOpacity={0.015} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...analyticsGridProps} />
                    {sharedXAxis}
                    <YAxis
                      {...analyticsYAxisProps}
                      tickFormatter={(value: number) => formatAnalyticsPercentAxis(value, 1)}
                    />
                    <ReferenceLine y={0} {...analyticsZeroLineProps} />
                    <Tooltip
                      active={tooltipsEnabled ? undefined : false}
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
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="url(#secondaryDrawdownGradient)"
                      fillOpacity={1}
                      dot={false}
                      activeDot={analyticsActiveDotProps('negative')}
                      className="premium-secondary-chart-series"
                      style={{ '--secondary-series-glow': 'rgba(244, 63, 94, 0.5)' } as React.CSSProperties}
                      isAnimationActive
                      animationDuration={520}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartPlotSurface>
          )}
        </div>

        <div
          className="premium-panel premium-secondary-chart-card rounded-2xl p-4 sm:p-5 space-y-4"
          style={{ '--secondary-chart-rgb': '245 158 11' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="premium-secondary-chart-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                <Receipt className="h-4 w-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white">Cumulative Fees</h4>
                <p className="mt-1 text-[11px] leading-4 text-slate-400">
                  Brokerage and explicit fee cash flows inside the visible timeframe.
                </p>
              </div>
            </div>
            <SecondaryMetric
              label="Fees in period"
              value={formatAnalyticsEgp(secondary.summary.feesInPeriodEgp)}
              toneClass="text-amber-400"
            />
          </div>

          {chartData.length < 2 ? (
            <AnalyticsEmptyState>Not enough complete points for fee history.</AnalyticsEmptyState>
          ) : (
            <ChartPlotSurface
              className="h-48 sm:h-56"
              ariaLabel="Cumulative fees chart"
              style={{ '--chart-plot-accent-rgb': '245 158 11' } as React.CSSProperties}
              {...interactionProps}
            >
              {entranceReady && (
                <ResponsiveContainer width="100%" height="100%" debounce={80}>
                  <AreaChart
                    data={chartData}
                    syncId="portfolio-secondary-analytics"
                    margin={ANALYTICS_CHART_MARGINS.compact}
                  >
                    <defs>
                      <linearGradient id="secondaryFeesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={ANALYTICS_CHART_THEME.amber} stopOpacity={0.28} />
                        <stop offset="95%" stopColor={ANALYTICS_CHART_THEME.amber} stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...analyticsGridProps} />
                    {sharedXAxis}
                    <YAxis {...analyticsYAxisProps} tickFormatter={formatAnalyticsCompactEgp} />
                    <Tooltip
                      active={tooltipsEnabled ? undefined : false}
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
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="url(#secondaryFeesGradient)"
                      fillOpacity={1}
                      dot={false}
                      activeDot={analyticsActiveDotProps('cost')}
                      className="premium-secondary-chart-series"
                      style={{ '--secondary-series-glow': 'rgba(245, 158, 11, 0.48)' } as React.CSSProperties}
                      isAnimationActive
                      animationDuration={520}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartPlotSurface>
          )}
        </div>

        <div
          className="premium-panel premium-secondary-chart-card space-y-4 rounded-2xl p-4 sm:p-5 xl:col-span-2"
          style={{ '--secondary-chart-rgb': '6 182 212' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="premium-secondary-chart-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                <Activity className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white">Realized vs Unrealized P&amp;L</h4>
                <p className="mt-1 text-[11px] leading-4 text-slate-400">
                  Fee-aware cumulative realized trade P&amp;L and open-position unrealized P&amp;L.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:min-w-[280px]">
              <SecondaryMetric
                label="Realized"
                value={
                  secondary.summary.realizedPnlEgp == null
                    ? '—'
                    : formatAnalyticsEgp(secondary.summary.realizedPnlEgp, true)
                }
                toneClass={
                  (secondary.summary.realizedPnlEgp ?? 0) >= 0
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }
              />
              <SecondaryMetric
                label="Unrealized"
                value={
                  secondary.summary.unrealizedPnlEgp == null
                    ? '—'
                    : formatAnalyticsEgp(secondary.summary.unrealizedPnlEgp, true)
                }
                toneClass={
                  (secondary.summary.unrealizedPnlEgp ?? 0) >= 0
                    ? 'text-cyan-300'
                    : 'text-rose-400'
                }
              />
            </div>
          </div>

          <ChartLegend
            ariaLabel="Realized and unrealized P&L series"
            items={[
              { label: 'Realized P&L', color: realizedStroke, kind: 'solid' },
              { label: 'Unrealized P&L', color: unrealizedStroke, kind: 'dashed' },
            ]}
            className="px-1"
          />

          {chartData.length < 2 ? (
            <AnalyticsEmptyState>Not enough complete points for P&amp;L composition.</AnalyticsEmptyState>
          ) : (
            <ChartPlotSurface
              className="h-52 sm:h-64"
              ariaLabel="Realized and unrealized P&L chart"
              style={{ '--chart-plot-accent-rgb': '6 182 212' } as React.CSSProperties}
              {...interactionProps}
            >
              {entranceReady && (
                <ResponsiveContainer width="100%" height="100%" debounce={80}>
                  <LineChart
                    data={chartData}
                    syncId="portfolio-secondary-analytics"
                    margin={ANALYTICS_CHART_MARGINS.compact}
                  >
                    <CartesianGrid {...analyticsGridProps} />
                    {sharedXAxis}
                    <YAxis {...analyticsYAxisProps} tickFormatter={formatAnalyticsCompactEgp} />
                    <ReferenceLine y={0} {...analyticsZeroLineProps} />
                    <Tooltip
                      active={tooltipsEnabled ? undefined : false}
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
                      stroke={realizedStroke}
                      strokeWidth={2.25}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      dot={false}
                      activeDot={{
                        ...analyticsActiveDotProps(
                          (secondary.summary.realizedPnlEgp ?? 0) < 0 ? 'negative' : 'positive',
                        ),
                        fill: realizedStroke,
                      }}
                      className="premium-secondary-chart-series"
                      style={{ '--secondary-series-glow': `${realizedStroke}80` } as React.CSSProperties}
                      isAnimationActive
                      animationDuration={520}
                      animationEasing="ease-out"
                    />
                    <Line
                      type={lineType}
                      dataKey="unrealizedPnlEgp"
                      name="Unrealized"
                      stroke={unrealizedStroke}
                      strokeWidth={2.05}
                      strokeDasharray="7 4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      dot={false}
                      activeDot={{
                        ...analyticsActiveDotProps(
                          (secondary.summary.unrealizedPnlEgp ?? 0) < 0 ? 'negative' : 'live',
                        ),
                        fill: unrealizedStroke,
                      }}
                      className="premium-secondary-chart-series"
                      style={{ '--secondary-series-glow': `${unrealizedStroke}73` } as React.CSSProperties}
                      isAnimationActive
                      animationDuration={520}
                      animationEasing="ease-out"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartPlotSurface>
          )}
        </div>
      </div>
    </section>
  );
};
