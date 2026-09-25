import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DropdownPresence } from '../PremiumMotion';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { curveCardinal } from 'd3-shape';
import { Check, ChevronDown } from 'lucide-react';
import { SecondaryAnalyticsCharts } from './SecondaryAnalyticsCharts';
import {
  createWeeklyAreaInterpolator,
  createWeeklyLineInterpolator,
  matchWeeklyPointByDate,
  type WeeklyTransitionCurve,
} from './weeklyTransitionInterpolation';
import type { Position, TradeTransaction } from '../../types';
import type { HistoricalPriceSeries } from '../../services/historicalPriceStore';
import { getIntradayPrices, normalizeIntradayTicker, type IntradayPriceSeries } from '../../services/intradayPriceStore';
import { INTRADAY_POLICY } from '../../services/intradayPolicy';
import { aggregateIntradayBars } from '../../services/intradayAggregation';
import { resolveIntradaySessionTickers } from '../../services/intradayTickerUniverse';
import { selectBestIntradayResolution } from '../../services/intradayResolution';
import { buildIntradayAnalyticsResult } from '../../services/intradayAnalyticsEngine';
import { deriveCanonicalCapitalDeposits } from '../../services/portfolioReconciliation';
import {
  buildUnifiedAnalyticsResult,
  type UnifiedAnalyticsResult,
} from '../../services/unifiedAnalyticsEngine';
import {
  resolveAnalyticsWindow,
  type AnalyticsTimeframe,
} from '../../services/analyticsTimeframes';
import {
  ANALYTICS_MODES,
  analyticsModePoints,
  analyticsModeSummary,
  getAnalyticsModeDefinition,
  type AnalyticsChartMode,
} from '../../services/analyticsModes';
import {
  ANALYTICS_CHART_MARGINS,
  ANALYTICS_CHART_THEME,
  AnalyticsChartLoadingState,
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
  formatAnalyticsPercentAxis,
} from './AnalyticsChartTheme';

interface PerformanceTimeframeChartProps {
  transactions: TradeTransaction[];
  historicalPrices: HistoricalPriceSeries;
  capitalDeposits: number;
  positions: Position[];
  currentCashBalance: number;
  historicalLoading?: boolean;
  entranceReady?: boolean;
}

type TodayResolution = 'AUTO' | 1 | 5 | 15 | 60;

const TODAY_RESOLUTIONS: Array<{ value: TodayResolution; label: string }> = [
  { value: 'AUTO', label: 'Auto' },
  { value: 1, label: '1m' },
  { value: 5, label: '5m' },
  { value: 15, label: '15m' },
  { value: 60, label: '1h' },
];

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

function formatFullDailyDate(value: string): string {
  return new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-EG', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function signedToneClass(value: number | null): string {
  if (value == null || Math.abs(value) < 1e-12) return 'text-slate-200';
  return value > 0 ? 'text-emerald-400' : 'text-rose-400';
}

function normalizeDisplayTicker(value: string): string {
  return String(value || '').trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
}

function formatShareCount(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString('en-EG')
    : value.toLocaleString('en-EG', { maximumFractionDigits: 4 });
}

const TooltipMetric: React.FC<{
  label: string;
  value: string;
  valueClassName?: string;
}> = ({ label, value, valueClassName = 'text-slate-100' }) => (
  <div className="flex items-start justify-between gap-4">
    <span className="min-w-0 text-slate-400">{label}</span>
    <span className={`shrink-0 text-right font-mono font-semibold ${valueClassName}`}>
      {value}
    </span>
  </div>
);

const PerformanceTimeframeChartComponent: React.FC<PerformanceTimeframeChartProps> = ({
  transactions,
  historicalPrices,
  capitalDeposits,
  positions,
  currentCashBalance,
  historicalLoading = false,
  entranceReady = true,
}) => {
  const [timeframe, setTimeframe] = useState<AnalyticsTimeframe>('1M');
  const [mode, setMode] = useState<AnalyticsChartMode>('PORTFOLIO_RETURN');
  const [todayResolution, setTodayResolution] = useState<TodayResolution>('AUTO');
  const [effectiveTodayResolution, setEffectiveTodayResolution] = useState<number | null>(null);
  const [weeklyMorph, setWeeklyMorph] = useState<{
    from: AnalyticsTimeframe;
    to: AnalyticsTimeframe;
  } | null>(null);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const [intradayResult, setIntradayResult] = useState<UnifiedAnalyticsResult | null>(null);
  const [loadedIntradayPrices, setLoadedIntradayPrices] = useState<IntradayPriceSeries>({});
  const [intradayLoading, setIntradayLoading] = useState(false);
  const [intradayError, setIntradayError] = useState<string | null>(null);

  const canonicalCapitalDeposits = useMemo(
    () => deriveCanonicalCapitalDeposits(transactions, currentCashBalance, capitalDeposits),
    [transactions, currentCashBalance, capitalDeposits],
  );

  const dailyResult = useMemo(() => {
    if (timeframe === 'TODAY') return null;
    return buildUnifiedAnalyticsResult(transactions, historicalPrices, timeframe, {
      openingCapital: canonicalCapitalDeposits,
    });
  }, [transactions, historicalPrices, timeframe, canonicalCapitalDeposits]);

  useEffect(() => {
    let cancelled = false;
    setIntradayLoading(true);
    setIntradayError(null);

    const load = async () => {
      try {
        const requestedWindow = resolveAnalyticsWindow('TODAY');
        const requestedSessionDate = requestedWindow.endDate;
        const tickers = resolveIntradaySessionTickers(transactions, requestedSessionDate);

        const loadWindow = async (startDate: string, intervalMinutes: number) =>
          getIntradayPrices(
            tickers,
            `${startDate}T00:00:00.000Z`,
            `${requestedSessionDate}T23:59:59.999Z`,
            intervalMinutes,
          );

        const loadResolutionCandidates = async (startDate: string) =>
          Promise.all(
            INTRADAY_POLICY.readIntervals.map(async (intervalMinutes) => ({
              intervalMinutes,
              series: await loadWindow(startDate, intervalMinutes),
            })),
          );

        const chooseResolution = (
          candidates: Awaited<ReturnType<typeof loadResolutionCandidates>>,
        ) => {
          if (todayResolution === 'AUTO' || todayResolution === 60) {
            return selectBestIntradayResolution(candidates, tickers, requestedSessionDate);
          }
          const requested = candidates.find(
            (candidate) => candidate.intervalMinutes === todayResolution,
          );
          return requested
            ? selectBestIntradayResolution([requested], tickers, requestedSessionDate)
            : null;
        };

        let candidates = await loadResolutionCandidates(requestedSessionDate);
        let selection = chooseResolution(candidates);

        // Normal sessions stay on a one-day query. Only fall back to a wider
        // lookback when the requested day has no actual market bars
        // (for example, after midnight, a weekend, or an exchange holiday).
        if (!selection) {
          const lookback = new Date(`${requestedSessionDate}T00:00:00Z`);
          lookback.setUTCDate(lookback.getUTCDate() - 14);
          const lookbackDate = lookback.toISOString().slice(0, 10);

          candidates = await loadResolutionCandidates(lookbackDate);
          selection = chooseResolution(candidates);
        }

        let intradayPrices: IntradayPriceSeries = selection?.series ?? {};
        let effectiveResolution = selection?.intervalMinutes ?? null;
        if (todayResolution === 60 && selection) {
          intradayPrices = Object.fromEntries(
            Object.entries(selection.series).map(([ticker, bars]) => [
              ticker,
              aggregateIntradayBars(bars, 60),
            ]),
          );
          effectiveResolution = 60;
        }
        const sessionDate = selection?.sessionDate ?? requestedSessionDate;

        const livePrices = Object.fromEntries(
          positions
            .map((position) => [normalizeIntradayTicker(position.ticker), Number(position.currentPrice)] as const)
            .filter(([ticker, price]) => ticker && Number.isFinite(price) && price > 0),
        );

        const result = buildIntradayAnalyticsResult(
          transactions,
          historicalPrices,
          intradayPrices,
          {
            sessionDate,
            openingCapital: canonicalCapitalDeposits,
            currentCashBalance,
            asOf: new Date(),
            livePrices,
          },
        );

        if (!cancelled) {
          setLoadedIntradayPrices(intradayPrices);
          setEffectiveTodayResolution(effectiveResolution);
          setIntradayResult(result);
        }
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
  }, [transactions, historicalPrices, canonicalCapitalDeposits, currentCashBalance, positions, todayResolution]);

  useEffect(() => {
    const handleGlobalPress = (event: Event) => {
      const target = event.target as Node | null;
      if (target && modeMenuRef.current && !modeMenuRef.current.contains(target)) {
        setModeMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModeMenuOpen(false);
    };

    document.addEventListener('pointerdown', handleGlobalPress, true);
    document.addEventListener('touchstart', handleGlobalPress, true);
    document.addEventListener('mousedown', handleGlobalPress, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handleGlobalPress, true);
      document.removeEventListener('touchstart', handleGlobalPress, true);
      document.removeEventListener('mousedown', handleGlobalPress, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  const handleTimeframeChange = (nextTimeframe: AnalyticsTimeframe) => {
    if (nextTimeframe === timeframe) return;

    setWeeklyMorph(
      timeframe === '1W' || nextTimeframe === '1W'
        ? { from: timeframe, to: nextTimeframe }
        : null,
    );
    setTimeframe(nextTimeframe);
  };

  const result = timeframe === 'TODAY' ? intradayResult : dailyResult;
  const loading = timeframe === 'TODAY' ? intradayLoading && !intradayResult : historicalLoading;
  const definition = getAnalyticsModeDefinition(mode);
  const summary = analyticsModeSummary(result, mode);
  const points = analyticsModePoints(result, mode);
  const selectedLabel =
    timeframe === 'TODAY' && result
      ? `${formatDailyLabel(result.window.endDate)} session`
      : result?.window.label ??
        TIMEFRAMES.find((item) => item.value === timeframe)?.label ??
        '';

  const chartData = points.map((point) => ({
    ...point,
    // Daily ranges use real elapsed calendar time on the X axis. This keeps
    // weekend/holiday gaps proportional instead of treating every trading
    // valuation as an equally spaced category.
    axisTime: new Date(
      timeframe === 'TODAY' ? point.date : `${point.date.slice(0, 10)}T12:00:00Z`,
    ).getTime(),
    axisLabel: timeframe === 'TODAY' ? formatCairoTime(point.date) : formatDailyLabel(point.date),
  }));

  const isPercentMode = definition.valueKind === 'percent';
  const isDepositsMode = mode === 'PORTFOLIO_DEPOSITS';
  const isPortfolioReturnMode = mode === 'PORTFOLIO_RETURN';
  const longRangeCurve = curveCardinal.tension(0.55);

  const yDomain: [number, number] | undefined = (() => {
    const values = chartData.flatMap((point) => {
      const visible: number[] = [];
      const primary = Number(point[definition.primaryKey]);
      if (Number.isFinite(primary)) visible.push(primary);

      if (definition.secondaryKey) {
        const secondary = Number(point[definition.secondaryKey]);
        if (Number.isFinite(secondary)) visible.push(secondary);
      }

      return visible;
    });

    if (!values.length) return undefined;

    let minimum = Math.min(...values);
    let maximum = Math.max(...values);

    // Percentage charts should retain the meaningful 0% reference line.
    // Absolute portfolio/deposit charts should not be flattened against zero.
    if (isPercentMode) {
      minimum = Math.min(0, minimum);
      maximum = Math.max(0, maximum);
    }

    const span = maximum - minimum;
    const fallbackPadding = Math.max(
      Math.abs(maximum || minimum) * 0.005,
      isPercentMode ? 0.05 : 1,
    );
    const padding = span > 0 ? span * 0.08 : fallbackPadding;

    return [minimum - padding, maximum + padding];
  })();

  const toneValue = isPercentMode
    ? summary.primaryValue
    : summary.changeEgp;
  const positive = (toneValue ?? 0) >= 0;
  const toneClass = positive ? 'text-emerald-400' : 'text-rose-400';
  const chartCurve = timeframe === 'TODAY' ? 'linear' : longRangeCurve;
  const weeklySourceCurve: WeeklyTransitionCurve =
    weeklyMorph?.from === 'TODAY' ? 'linear' : 'cardinal';
  const weeklyTargetCurve: WeeklyTransitionCurve =
    weeklyMorph?.to === 'TODAY' ? 'linear' : 'cardinal';

  const weeklyAreaInterpolator = useMemo(
    () =>
      weeklyMorph
        ? createWeeklyAreaInterpolator(weeklySourceCurve, weeklyTargetCurve)
        : undefined,
    [weeklyMorph, weeklySourceCurve, weeklyTargetCurve],
  );

  const weeklyLineInterpolator = useMemo(
    () =>
      weeklyMorph
        ? createWeeklyLineInterpolator(weeklySourceCurve, weeklyTargetCurve)
        : undefined,
    [weeklyMorph, weeklySourceCurve, weeklyTargetCurve],
  );
  const todaySemanticStroke =
    (toneValue ?? 0) > 0
      ? ANALYTICS_CHART_THEME.emerald
      : (toneValue ?? 0) < 0
      ? ANALYTICS_CHART_THEME.rose
      : ANALYTICS_CHART_THEME.amber;
  const primaryStroke =
    timeframe === 'TODAY'
      ? todaySemanticStroke
      : isPercentMode
        ? ANALYTICS_CHART_THEME.cyan
        : ANALYTICS_CHART_THEME.blue;

  const tooltip = (props: any) => {
    if (!props?.active || !props?.payload?.length) return null;

    const point = props.payload[0]?.payload as (typeof chartData)[number] | undefined;
    if (!point) return null;

    const pointIndex = chartData.findIndex((candidate) => candidate.date === point.date);
    const previousPoint = pointIndex > 0 ? chartData[pointIndex - 1] : null;
    const firstPoint = chartData[0] ?? null;

    const equity = finiteNumber(point.equity);
    const cash = finiteNumber(point.cash);
    const marketValue = finiteNumber(point.marketValue);
    const netDeposits = finiteNumber(point.netDeposits);
    const twr = finiteNumber(point.twrPercent);
    const mwr = finiteNumber(point.mwrrPercent);
    const drawdown = finiteNumber(point.drawdownPercent);

    const previousEquity = finiteNumber(previousPoint?.equity);
    const intervalExternalFlow = finiteNumber(point.externalFlow) ?? 0;
    const intervalPnl =
      equity != null && previousEquity != null
        ? equity - previousEquity - intervalExternalFlow
        : null;

    const previousTwr = finiteNumber(previousPoint?.twrPercent);
    const intervalReturn =
      twr != null && previousTwr != null && 1 + previousTwr / 100 > 0
        ? ((1 + twr / 100) / (1 + previousTwr / 100) - 1) * 100
        : previousPoint == null
          ? twr
          : null;

    const startingEquity =
      finiteNumber(result?.summary.startEquity) ??
      finiteNumber(firstPoint?.equity);
    const startingNetDeposits = finiteNumber(firstPoint?.netDeposits) ?? 0;
    const periodExternalFlow =
      netDeposits == null ? 0 : netDeposits - startingNetDeposits;
    const periodPnl =
      equity != null && startingEquity != null
        ? equity - startingEquity - periodExternalFlow
        : null;
    const accumulatedProfit =
      equity != null && netDeposits != null
        ? equity - netDeposits
        : null;

    const pointDate = String(point.date || '');
    const pointMs = new Date(pointDate).getTime();
    const previousMs = previousPoint ? new Date(previousPoint.date).getTime() : Number.NaN;
    const currentDay = pointDate.slice(0, 10);

    const activity = transactions.filter((tx) => {
      const ticker = normalizeDisplayTicker(tx.ticker);
      if (!ticker || ticker === 'CASH') return false;

      if (timeframe === 'TODAY') {
        if (!tx.executedAt || !Number.isFinite(pointMs)) return false;
        const executedMs = new Date(tx.executedAt).getTime();
        if (!Number.isFinite(executedMs) || executedMs > pointMs) return false;
        return !Number.isFinite(previousMs) || executedMs > previousMs;
      }

      return String(tx.date || '').slice(0, 10) === currentDay;
    });

    const activitySummary = (() => {
      if (!activity.length) return null;

      const totalFees = activity.reduce(
        (sum, tx) => sum + (Number.isFinite(tx.fees) ? Number(tx.fees) : 0),
        0,
      );

      if (activity.length === 1) {
        const tx = activity[0];
        const shares = Number(tx.shares);
        const price = Number(tx.price);
        const base =
          Number.isFinite(shares) && Number.isFinite(price)
            ? `${tx.type} ${normalizeDisplayTicker(tx.ticker)} · ${formatShareCount(shares)} @ ${price.toLocaleString('en-EG', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : `${tx.type} ${normalizeDisplayTicker(tx.ticker)}`;

        return totalFees > 0
          ? `${base} · ${formatAnalyticsEgp(totalFees)} fees`
          : base;
      }

      const buys = activity.filter((tx) => tx.type === 'BUY').length;
      const sells = activity.filter((tx) => tx.type === 'SELL').length;
      const pieces = [
        `${activity.length} executions`,
        buys > 0 ? `${buys} buy${buys === 1 ? '' : 's'}` : '',
        sells > 0 ? `${sells} sell${sells === 1 ? '' : 's'}` : '',
      ].filter(Boolean);

      if (totalFees > 0) pieces.push(`${formatAnalyticsEgp(totalFees)} fees`);
      return pieces.join(' · ');
    })();

    const previousText = [
      intervalPnl == null ? '' : formatAnalyticsEgp(intervalPnl, true),
      intervalReturn == null ? '' : formatAnalyticsPercent(intervalReturn, true),
    ].filter(Boolean).join(' · ');

    const cashInvestedText =
      cash != null && marketValue != null
        ? `${formatAnalyticsEgp(cash)} / ${formatAnalyticsEgp(marketValue)}`
        : '—';

    const titleDate =
      timeframe === 'TODAY'
        ? formatCairoDateTime(pointDate)
        : formatFullDailyDate(pointDate);

    return (
      <ChartTooltipShell className="min-w-[260px]">
        <div className="mb-2 border-b border-slate-800 pb-2">
          <div className="font-semibold text-slate-100">{definition.label}</div>
          <div className="font-mono text-[10px] text-slate-400">{titleDate}</div>
        </div>

        <div className="space-y-1.5">
          {mode === 'PORTFOLIO_RETURN' && (
            <>
              <TooltipMetric
                label="Portfolio value"
                value={equity == null ? '—' : formatAnalyticsEgp(equity)}
              />
              <TooltipMetric
                label="Since previous point"
                value={previousText || '—'}
                valueClassName={signedToneClass(intervalReturn ?? intervalPnl)}
              />
              <TooltipMetric
                label="Period P&L"
                value={periodPnl == null ? '—' : formatAnalyticsEgp(periodPnl, true)}
                valueClassName={signedToneClass(periodPnl)}
              />
              <TooltipMetric
                label="TWR"
                value={twr == null ? '—' : formatAnalyticsPercent(twr, true)}
                valueClassName={signedToneClass(twr)}
              />
            </>
          )}

          {mode === 'PORTFOLIO_DEPOSITS' && (
            <>
              <TooltipMetric
                label="Portfolio value"
                value={equity == null ? '—' : formatAnalyticsEgp(equity)}
              />
              <TooltipMetric
                label="Net deposits"
                value={netDeposits == null ? '—' : formatAnalyticsEgp(netDeposits)}
                valueClassName="text-purple-300"
              />
              <TooltipMetric
                label="Profit over deposits"
                value={accumulatedProfit == null ? '—' : formatAnalyticsEgp(accumulatedProfit, true)}
                valueClassName={signedToneClass(accumulatedProfit)}
              />
              <TooltipMetric
                label="Since previous point"
                value={previousText || '—'}
                valueClassName={signedToneClass(intervalReturn ?? intervalPnl)}
              />
              <TooltipMetric
                label="TWR"
                value={twr == null ? '—' : formatAnalyticsPercent(twr, true)}
                valueClassName={signedToneClass(twr)}
              />
            </>
          )}

          {mode === 'TWR' && (
            <>
              <TooltipMetric
                label="TWR"
                value={twr == null ? '—' : formatAnalyticsPercent(twr, true)}
                valueClassName={signedToneClass(twr)}
              />
              <TooltipMetric
                label="Since previous point"
                value={previousText || '—'}
                valueClassName={signedToneClass(intervalReturn ?? intervalPnl)}
              />
              <TooltipMetric
                label="Portfolio value"
                value={equity == null ? '—' : formatAnalyticsEgp(equity)}
              />
              <TooltipMetric
                label="Period P&L"
                value={periodPnl == null ? '—' : formatAnalyticsEgp(periodPnl, true)}
                valueClassName={signedToneClass(periodPnl)}
              />
              <TooltipMetric
                label="Net deposits"
                value={netDeposits == null ? '—' : formatAnalyticsEgp(netDeposits)}
                valueClassName="text-purple-300"
              />
              <TooltipMetric
                label="Drawdown from peak"
                value={drawdown == null ? '—' : formatAnalyticsPercent(drawdown, true)}
                valueClassName={signedToneClass(drawdown)}
              />
            </>
          )}

          {mode === 'MWR' && (
            <>
              <TooltipMetric
                label="MWR"
                value={mwr == null ? '—' : formatAnalyticsPercent(mwr, true)}
                valueClassName={signedToneClass(mwr)}
              />
              <TooltipMetric
                label="TWR"
                value={twr == null ? '—' : formatAnalyticsPercent(twr, true)}
                valueClassName={signedToneClass(twr)}
              />
              <TooltipMetric
                label="Since previous point"
                value={previousText || '—'}
                valueClassName={signedToneClass(intervalReturn ?? intervalPnl)}
              />
              <TooltipMetric
                label="Portfolio value"
                value={equity == null ? '—' : formatAnalyticsEgp(equity)}
              />
              <TooltipMetric
                label="Period P&L"
                value={periodPnl == null ? '—' : formatAnalyticsEgp(periodPnl, true)}
                valueClassName={signedToneClass(periodPnl)}
              />
              <TooltipMetric
                label="Net deposits"
                value={netDeposits == null ? '—' : formatAnalyticsEgp(netDeposits)}
                valueClassName="text-purple-300"
              />
            </>
          )}

          {timeframe === 'TODAY' && (
            <TooltipMetric
              label="Cash / invested"
              value={cashInvestedText}
            />
          )}

          {activitySummary && (
            <div className="mt-2 border-t border-slate-800 pt-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Activity</div>
              <div className="mt-0.5 text-[11px] leading-4 text-amber-300">{activitySummary}</div>
            </div>
          )}
        </div>
      </ChartTooltipShell>
    );
  };

  const headline = isPercentMode
    ? summary.primaryValue == null
      ? '—'
      : formatAnalyticsPercent(summary.primaryValue, true)
    : summary.primaryValue == null
      ? '—'
      : formatAnalyticsEgp(summary.primaryValue);

  const renderYAxis = () => (
    <YAxis
      {...analyticsYAxisProps}
      domain={yDomain}
      tickFormatter={(value: number) =>
        isPercentMode
          ? formatAnalyticsPercentAxis(value, timeframe === 'TODAY' ? 2 : 1)
          : formatAnalyticsCompactEgp(value)
      }
    />
  );

  const renderReferenceLine = () =>
    isPercentMode ? (
      <ReferenceLine y={0} {...analyticsZeroLineProps} />
    ) : null;

  const renderPrimaryArea = () => entranceReady ? (
    <Area
      type={chartCurve}
      dataKey={definition.primaryKey}
      name={definition.primaryLabel}
      stroke={primaryStroke}
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="url(#analyticsPrimaryGradient)"
      fillOpacity={1}
      dot={false}
      activeDot={{
        r: 5,
        fill: primaryStroke,
        stroke: '#020617',
        strokeWidth: 2,
      }}
      isAnimationActive
      animationDuration={520}
      animationEasing="ease-out"
      animationMatchBy={weeklyMorph ? matchWeeklyPointByDate : undefined}
      animationInterpolateFn={weeklyAreaInterpolator}
      onAnimationEnd={() => {
        if (weeklyMorph) setWeeklyMorph(null);
      }}
    />
  ) : null;

  const renderSecondaryLine = () =>
    entranceReady && definition.secondaryKey ? (
      <Line
        type={chartCurve}
        dataKey={definition.secondaryKey}
        name={definition.secondaryLabel}
        stroke={ANALYTICS_CHART_THEME.purple}
        strokeWidth={1.8}
        strokeDasharray="6 4"
        strokeLinecap="round"
        strokeLinejoin="round"
        dot={false}
        activeDot={{
          r: 4,
          fill: ANALYTICS_CHART_THEME.purple,
          stroke: '#020617',
          strokeWidth: 2,
        }}
        isAnimationActive
        animationDuration={520}
        animationEasing="ease-out"
        animationMatchBy={weeklyMorph ? matchWeeklyPointByDate : undefined}
        animationInterpolateFn={weeklyLineInterpolator}
      />
    ) : null;

  return (
    <>
      <div className="premium-panel premium-radial p-4 sm:p-5 rounded-2xl space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div ref={modeMenuRef} className="relative min-w-0 z-20">
            <button
              type="button"
              onClick={() => setModeMenuOpen((value) => !value)}
              className="premium-accordion-trigger group flex max-w-full items-center gap-1.5 text-left"
              aria-haspopup="menu"
              aria-expanded={modeMenuOpen}
            >
              <h3 className="truncate text-sm font-bold text-white group-hover:text-cyan-200">
                {definition.label}
              </h3>
              <ChevronDown
                className={`premium-motion-chevron h-4 w-4 shrink-0 text-slate-500 ${modeMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <p className="text-xs text-slate-400 mt-1">{definition.description}</p>

            <DropdownPresence
              isOpen={modeMenuOpen}
              role="menu"
              className="premium-floating premium-dropdown absolute left-0 top-9 z-[80] w-[min(calc(100vw-2rem),320px)] overflow-hidden rounded-xl border p-1.5"
            >
              {modeMenuOpen && <>
                {ANALYTICS_MODES.map((item) => {
                  const selected = item.mode === mode;
                  return (
                    <button
                      key={item.mode}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      onClick={() => {
                        setMode(item.mode);
                        setModeMenuOpen(false);
                      }}
                      className={[
                        'premium-menu-item flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left',
                        selected
                          ? 'bg-cyan-500/10 text-cyan-200'
                          : 'text-slate-300 hover:bg-slate-900 hover:text-white',
                      ].join(' ')}
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                        {selected && <Check className="h-3.5 w-3.5 text-cyan-400" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold">{item.label}</span>
                        <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">
                          {item.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </>}
            </DropdownPresence>
          </div>

          <div className="sm:text-right">
            <div className={`text-2xl font-black font-mono ${isPercentMode || isPortfolioReturnMode ? toneClass : 'text-slate-100'}`}>
              {headline}
            </div>

            {isPortfolioReturnMode && (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:justify-end">
                <span className={toneClass}>
                  {summary.changeEgp == null ? '—' : formatAnalyticsEgp(summary.changeEgp, true)}
                </span>
                <span className={toneClass}>
                  {summary.changePercent == null ? '—' : formatAnalyticsPercent(summary.changePercent, true)}
                </span>
                <span className="text-slate-500">{selectedLabel}</span>
              </div>
            )}

            {isDepositsMode && (
              <div className="mt-0.5 space-y-0.5 text-[11px]">
                <div className="text-purple-300">
                  Net deposits: {summary.secondaryValue == null ? '—' : formatAnalyticsEgp(summary.secondaryValue)}
                </div>
                <div className={toneClass}>
                  Portfolio P&amp;L: {summary.changeEgp == null ? '—' : formatAnalyticsEgp(summary.changeEgp, true)}
                </div>
                <div className="text-slate-500">{selectedLabel}</div>
              </div>
            )}

            {isPercentMode && (
              <>
                <div className="text-[11px] text-slate-400">{selectedLabel}</div>
                {mode === 'MWR' && timeframe === 'ALL' && result?.summary.annualizedMwrrPercent != null && (
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Annualized XIRR: {formatAnalyticsPercent(result.summary.annualizedMwrrPercent, true)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {timeframe === 'TODAY' && (
          <div className="-mx-1 flex max-w-[calc(100%+0.5rem)] items-center gap-1.5 overflow-x-auto px-1 pb-2" role="group" aria-label="Today chart resolution">
            <span className="mr-1 shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Resolution
            </span>
            {TODAY_RESOLUTIONS.map((item) => {
              const selected = todayResolution === item.value;
              return (
                <button
                  key={String(item.value)}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setTodayResolution(item.value)}
                  className={[
                    'premium-segment shrink-0 min-w-[44px] rounded-lg border px-2.5 py-1 text-[11px] font-semibold',
                    selected
                      ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700',
                  ].join(' ')}
                >
                  {item.label}
                </button>
              );
            })}
            {effectiveTodayResolution != null && (
              <span className="ml-1 shrink-0 text-[10px] text-slate-500">
                {todayResolution === 'AUTO' ? `Using ${effectiveTodayResolution}m` : ''}
              </span>
            )}
          </div>
        )}

        <div className="-mx-1 flex max-w-[calc(100%+0.5rem)] snap-x gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Analytics timeframe">
          {TIMEFRAMES.map((item) => {
            const selected = timeframe === item.value;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={selected}
                onClick={() => handleTimeframeChange(item.value)}
                className={[
                  'premium-segment shrink-0 snap-start min-w-[54px] px-3 py-1.5 rounded-lg border text-xs font-semibold',
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

      {definition.secondaryKey && chartData.length >= 2 && !loading && (
        <ChartLegend
          ariaLabel={`${definition.label} series`}
          items={[
            { label: definition.primaryLabel, color: primaryStroke, kind: 'solid' },
            {
              label: definition.secondaryLabel ?? 'Comparison',
              color: ANALYTICS_CHART_THEME.purple,
              kind: 'dashed',
            },
          ]}
          className="px-1"
        />
      )}

      {loading ? (
        <AnalyticsChartLoadingState />
      ) : intradayError && !intradayResult ? (
        <AnalyticsEmptyState>{intradayError}</AnalyticsEmptyState>
      ) : chartData.length < 2 ? (
        <AnalyticsEmptyState>
          {timeframe === 'TODAY'
            ? 'No complete intraday portfolio series is available for the latest EGX session yet.'
            : 'Not enough complete valuation points are available for this timeframe.'}
        </AnalyticsEmptyState>
      ) : (
        <ChartPlotSurface
          className="h-[232px] sm:h-72"
          ariaLabel={`${definition.label} chart`}
        >
          {entranceReady && (
          <ResponsiveContainer width="100%" height="100%" debounce={80}>
            <AreaChart
              data={chartData}
              syncId="portfolio-secondary-analytics"
              margin={ANALYTICS_CHART_MARGINS.primary}
            >
              <defs>
                <linearGradient id="analyticsPrimaryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={primaryStroke}
                    stopOpacity={timeframe === 'TODAY' ? 0.32 : 0.28}
                  />
                  <stop
                    offset="95%"
                    stopColor={primaryStroke}
                    stopOpacity={0.01}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid {...analyticsGridProps} />
              <XAxis
                dataKey={timeframe === 'TODAY' ? 'axisLabel' : 'axisTime'}
                {...analyticsXAxisProps}
                type={timeframe === 'TODAY' ? 'category' : 'number'}
                scale={timeframe === 'TODAY' ? 'auto' : 'time'}
                domain={timeframe === 'TODAY' ? undefined : ['dataMin', 'dataMax']}
                tickFormatter={
                  timeframe === 'TODAY'
                    ? undefined
                    : (value: number) => formatDailyLabel(new Date(value).toISOString())
                }
                interval="preserveStartEnd"
                minTickGap={timeframe === 'TODAY' ? 28 : 24}
              />
              {renderYAxis()}
              {renderReferenceLine()}
              <Tooltip
                cursor={analyticsTooltipCursor}
                content={tooltip}
              />
              {renderPrimaryArea()}
              {renderSecondaryLine()}
            </AreaChart>
          </ResponsiveContainer>
          )}
        </ChartPlotSurface>
      )}

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
          <span>
            {timeframe === 'TODAY'
              ? todayResolution === 'AUTO'
                ? 'Adaptive 1m → 5m → 15m session reconstruction · execution-time aware'
                : `${todayResolution === 60 ? '1h' : `${todayResolution}m`} session reconstruction · execution-time aware`
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

      <SecondaryAnalyticsCharts
        transactions={transactions}
        historicalPrices={historicalPrices}
        intradayPrices={loadedIntradayPrices}
        result={result}
        entranceReady={entranceReady}
      />
    </>
  );
};

export const PerformanceTimeframeChart = React.memo(PerformanceTimeframeChartComponent);
