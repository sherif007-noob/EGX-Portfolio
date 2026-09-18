import React, { useEffect, useMemo, useState } from 'react';
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
import type { TradeTransaction } from '../../types';
import type { HistoricalPriceSeries } from '../../services/historicalPriceStore';
import { getIntradayPrices, normalizeIntradayTicker } from '../../services/intradayPriceStore';
import { buildIntradayAnalyticsResult } from '../../services/intradayAnalyticsEngine';
import {
  buildUnifiedAnalyticsResult,
  type UnifiedAnalyticsResult,
} from '../../services/unifiedAnalyticsEngine';
import {
  resolveAnalyticsWindow,
  type AnalyticsTimeframe,
} from '../../services/analyticsTimeframes';
import {
  ANALYTICS_CHART_THEME,
  AnalyticsChartLoadingState,
  AnalyticsChartTooltip,
  AnalyticsEmptyState,
  analyticsGridProps,
  analyticsTooltipCursor,
  analyticsXAxisProps,
  analyticsYAxisProps,
  formatAnalyticsPercent,
} from './AnalyticsChartTheme';

interface PerformanceTimeframeChartProps {
  transactions: TradeTransaction[];
  historicalPrices: HistoricalPriceSeries;
  capitalDeposits: number;
  historicalLoading?: boolean;
}

const TIMEFRAMES: Array<{ value: AnalyticsTimeframe; label: string }> = [
  { value: 'TODAY', label: 'Today' },
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '90D', label: '90D' },
  { value: 'YTD', label: 'YTD' },
  { value: 'ALL', label: 'All' },
];

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

function formatCairoDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-EG', {
    timeZone: 'Africa/Cairo',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export const PerformanceTimeframeChart: React.FC<PerformanceTimeframeChartProps> = ({
  transactions,
  historicalPrices,
  capitalDeposits,
  historicalLoading = false,
}) => {
  const [timeframe, setTimeframe] = useState<AnalyticsTimeframe>('1M');
  const [intradayResult, setIntradayResult] = useState<UnifiedAnalyticsResult | null>(null);
  const [intradayLoading, setIntradayLoading] = useState(false);
  const [intradayError, setIntradayError] = useState<string | null>(null);

  const dailyResult = useMemo(() => {
    if (timeframe === 'TODAY') return null;
    return buildUnifiedAnalyticsResult(transactions, historicalPrices, timeframe, {
      openingCapital: capitalDeposits,
    });
  }, [transactions, historicalPrices, timeframe, capitalDeposits]);

  useEffect(() => {
    if (timeframe !== 'TODAY') return;

    let cancelled = false;
    setIntradayLoading(true);
    setIntradayError(null);
    setIntradayResult(null);

    const load = async () => {
      try {
        const window = resolveAnalyticsWindow('TODAY');
        const sessionDate = window.endDate;
        const tickers = [...new Set(
          transactions
            .map((tx) => normalizeIntradayTicker(tx.ticker))
            .filter((ticker) => ticker && ticker !== 'CASH'),
        )];

        const intradayPrices = await getIntradayPrices(
          tickers,
          `${sessionDate}T00:00:00.000Z`,
          `${sessionDate}T23:59:59.999Z`,
          15,
        );

        const result = buildIntradayAnalyticsResult(
          transactions,
          historicalPrices,
          intradayPrices,
          {
            sessionDate,
            openingCapital: capitalDeposits,
            asOf: new Date(),
          },
        );

        if (!cancelled) setIntradayResult(result);
      } catch (error) {
        if (!cancelled) {
          setIntradayError(error instanceof Error ? error.message : 'Intraday analytics unavailable.');
        }
      } finally {
        if (!cancelled) setIntradayLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [timeframe, transactions, historicalPrices, capitalDeposits]);

  const result = timeframe === 'TODAY' ? intradayResult : dailyResult;
  const loading = timeframe === 'TODAY' ? intradayLoading : historicalLoading;
  const points = result?.points.filter((point) => Number.isFinite(point.mwrrPercent)) ?? [];
  const periodReturn = result?.summary.mwrrPercent;
  const positive = (periodReturn ?? 0) >= 0;
  const selectedLabel = result?.window.label ?? TIMEFRAMES.find((item) => item.value === timeframe)?.label ?? '';
  const chartData = points.map((point) => ({
    ...point,
    axisLabel: timeframe === 'TODAY' ? formatCairoTime(point.date) : formatDailyLabel(point.date),
  }));

  const tooltip = (props: any) => (
    <AnalyticsChartTooltip
      {...props}
      title="Performance (MWR)"
      labelFormatter={(_, payload) => {
        const value = payload?.[0]?.payload?.date || '';
        return timeframe === 'TODAY' ? formatCairoDateTime(value) : String(value).slice(0, 10);
      }}
      nameFormatter={() => 'Return'}
      valueFormatter={(value) => formatAnalyticsPercent(value, true)}
      tone={positive ? 'positive' : 'negative'}
    />
  );

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">Performance (MWR)</h3>
            <p className="text-xs text-slate-400 mt-1">
              Non-annualized money-weighted return for the selected period.
            </p>
          </div>
          <div className="sm:text-right">
            <div className={`text-2xl font-black font-mono ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {periodReturn == null ? '—' : formatAnalyticsPercent(periodReturn, true)}
            </div>
            <div className="text-[11px] text-slate-400">{selectedLabel}</div>
            {timeframe === 'ALL' && result?.summary.annualizedMwrrPercent != null && (
              <div className="text-[10px] text-slate-500 mt-0.5">
                Annualized XIRR: {formatAnalyticsPercent(result.summary.annualizedMwrrPercent, true)}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Performance timeframe">
          {TIMEFRAMES.map((item) => {
            const selected = timeframe === item.value;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setTimeframe(item.value)}
                className={[
                  'shrink-0 min-w-[54px] px-3 py-1.5 rounded-lg border text-xs font-semibold transition',
                  selected
                    ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700',
                ].join(' ')}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <AnalyticsChartLoadingState />
      ) : intradayError ? (
        <AnalyticsEmptyState>{intradayError}</AnalyticsEmptyState>
      ) : chartData.length < 2 ? (
        <AnalyticsEmptyState>
          {timeframe === 'TODAY'
            ? 'No complete 15-minute portfolio series is available for the latest EGX session yet.'
            : 'Not enough complete valuation points are available for this timeframe.'}
        </AnalyticsEmptyState>
      ) : (
        <div className="h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            {timeframe === 'TODAY' ? (
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...analyticsGridProps} />
                <XAxis
                  dataKey="axisLabel"
                  {...analyticsXAxisProps}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis
                  {...analyticsYAxisProps}
                  tickFormatter={(value: number) => `${value.toFixed(2)}%`}
                />
                <ReferenceLine y={0} stroke={ANALYTICS_CHART_THEME.zeroLine} strokeDasharray="3 3" />
                <Tooltip cursor={analyticsTooltipCursor} content={tooltip} />
                <Line
                  type="linear"
                  dataKey="mwrrPercent"
                  name="MWR"
                  stroke={positive ? ANALYTICS_CHART_THEME.emerald : ANALYTICS_CHART_THEME.rose}
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: positive ? ANALYTICS_CHART_THEME.emerald : ANALYTICS_CHART_THEME.rose,
                    stroke: '#020617',
                    strokeWidth: 2,
                  }}
                  isAnimationActive={false}
                />
              </LineChart>
            ) : (
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="timeframeMwrGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ANALYTICS_CHART_THEME.cyan} stopOpacity={0.28} />
                    <stop offset="95%" stopColor={ANALYTICS_CHART_THEME.cyan} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...analyticsGridProps} />
                <XAxis dataKey="axisLabel" {...analyticsXAxisProps} interval="preserveStartEnd" />
                <YAxis
                  {...analyticsYAxisProps}
                  tickFormatter={(value: number) => `${value.toFixed(1)}%`}
                />
                <ReferenceLine y={0} stroke={ANALYTICS_CHART_THEME.zeroLine} strokeDasharray="3 3" />
                <Tooltip cursor={analyticsTooltipCursor} content={tooltip} />
                <Area
                  type="monotone"
                  dataKey="mwrrPercent"
                  name="MWR"
                  stroke={ANALYTICS_CHART_THEME.cyan}
                  strokeWidth={2.25}
                  fill="url(#timeframeMwrGradient)"
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
            )}
          </ResponsiveContainer>
        </div>
      )}

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
          <span>
            {timeframe === 'TODAY'
              ? '15-minute session reconstruction · execution-time aware'
              : `${result.dataQuality.completeDays} complete valuation days`}
          </span>
          {result.dataQuality.incompleteDays > 0 && (
            <span className="text-amber-400/80">
              {result.dataQuality.incompleteDays} incomplete point{result.dataQuality.incompleteDays === 1 ? '' : 's'} excluded
            </span>
          )}
        </div>
      )}
    </div>
  );
};
