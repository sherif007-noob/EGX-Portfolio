import React, { useMemo, useState } from 'react';
import { egxSessionPresentation } from '../services/egxSessionPresentation';
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
import type { Position, TradeTransaction } from '../types';
import type { HistoricalPriceSeries } from '../services/historicalPriceStore';
import type { AnalyticsTimeframe } from '../services/analyticsTimeframes';
import {
  buildDailyBenchmarkComparison,
  buildIntradayBenchmarkComparison,
  PORTFOLIO_BENCHMARKS,
  type BenchmarkComparisonPoint,
  type PortfolioBenchmarkTicker,
} from '../services/portfolioBenchmarks';
import { useAnalyticsSeries } from './useAnalyticsSeries';
import { cashFlowNeutralReturn } from './cashFlowNeutralReturn';
import { formatCompact, formatEgp, formatPercent, formatSigned, toneClass } from './format';

type ChartMode = 'ret' | 'val' | 'dep' | 'twr' | 'mwr' | 'bm';
type IndexChoice = 'all' | PortfolioBenchmarkTicker;
type Unit = 'egp' | 'pct';
type Granularity = 1 | 5 | 15 | 60;
const GRANULARITIES: Granularity[] = [1, 5, 15, 60];
const chartTime = (date: string): number => { const parsed = Date.parse(date.length === 10 ? `${date}T12:00:00Z` : date); return Number.isFinite(parsed) ? parsed : NaN; };
const labelTime = (time: number, intraday: boolean): string => new Intl.DateTimeFormat('en-GB', { timeZone: intraday ? 'Africa/Cairo' : 'UTC', ...(intraday ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : { day: 'numeric', month: 'short' as const }) }).format(new Date(time));

interface SeriesDef {
  key: string;
  label: string;
  color: string;
  area?: boolean;
  dashed?: boolean;
}

const RANGES: Array<{ value: AnalyticsTimeframe; label: string }> = [
  { value: 'TODAY', label: 'Today' },
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '90D', label: '90D' },
  { value: 'YTD', label: 'YTD' },
  { value: 'ALL', label: 'All' },
];

const MODES: Array<{ value: ChartMode; label: string }> = [
  { value: 'ret', label: 'Return' },
  { value: 'val', label: 'Value' },
  { value: 'dep', label: 'vs Deposits' },
  { value: 'twr', label: 'TWR' },
  { value: 'mwr', label: 'MWR' },
  { value: 'bm', label: 'Benchmarks' },
];

const INDEX_COLORS: Record<PortfolioBenchmarkTicker, string> = {
  EGX30: 'var(--ui-purple)',
  EGX70EWI: 'var(--ui-amber)',
  EGX100EWI: 'var(--ui-coral)',
};

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

interface HomeChartProps {
  transactions: TradeTransaction[];
  historicalPrices: HistoricalPriceSeries;
  capitalDeposits: number;
  positions: Position[];
  currentCashBalance: number;
  historicalLoading?: boolean;
}

export const HomeChart: React.FC<HomeChartProps> = ({
  transactions,
  historicalPrices,
  capitalDeposits,
  positions,
  currentCashBalance,
  historicalLoading = false,
}) => {
  const [timeframe, setTimeframe] = useState<AnalyticsTimeframe>('1M');
  const marketSession = egxSessionPresentation();
  const [mode, setMode] = useState<ChartMode>('ret');
  const [indexChoice, setIndexChoice] = useState<IndexChoice>('all');
  const [granularity, setGranularity] = useState<Granularity>(1);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { result, loading, error, intradayPrices } = useAnalyticsSeries({
    transactions,
    historicalPrices,
    capitalDeposits,
    positions,
    currentCashBalance,
    timeframe,
    granularity,
  });

  const points = result?.points ?? [];
  const summary = result?.summary;

  const model = useMemo(() => {
    const rows: Array<Record<string, number | string>> = [];
    let series: SeriesDef[] = [];
    let unit: Unit = 'egp';

    if (mode === 'ret' && points.length) {
      // The "Return" line must not jump when deposits, withdrawals or audited
      // reconciliation adjustments change NAV without investment performance.
      for (const item of cashFlowNeutralReturn(points)) rows.push({ date:item.date, ret:item.value });
      series = [{ key: 'ret', label: 'Return', color: 'var(--ui-teal)', area: true }];
    } else if (mode === 'val') {
      for (const point of points) rows.push({ date: point.date, equity: point.equity });
      series = [{ key: 'equity', label: 'Portfolio', color: 'var(--ui-teal)', area: true }];
    } else if (mode === 'dep') {
      for (const point of points) rows.push({ date: point.date, equity: point.equity, netDeposits: point.netDeposits });
      series = [
        { key: 'equity', label: 'Value', color: 'var(--ui-teal)', area: true },
        { key: 'netDeposits', label: 'Net deposits', color: 'var(--ui-amber)', dashed: true },
      ];
    } else if (mode === 'twr') {
      unit = 'pct';
      for (const point of points) if (finite(point.twrPercent)) rows.push({ date: point.date, twr: point.twrPercent });
      series = [{ key: 'twr', label: 'TWR', color: 'var(--ui-teal)', area: true }];
    } else if (mode === 'mwr') {
      unit = 'pct';
      for (const point of points) if (finite(point.mwrrPercent)) rows.push({ date: point.date, mwr: point.mwrrPercent });
      series = [{ key: 'mwr', label: 'MWR', color: 'var(--ui-blue)', area: true }];
    } else if (mode === 'bm') {
      unit = 'pct';
      const usable = points.filter((point) => finite(point.twrPercent));
      const comparison: BenchmarkComparisonPoint[] =
        timeframe === 'TODAY'
          ? buildIntradayBenchmarkComparison(usable, intradayPrices)
          : buildDailyBenchmarkComparison(
              usable.map((point) => ({ date: point.date, twrPercent: point.twrPercent as number })),
              historicalPrices,
            );
      const chosen = PORTFOLIO_BENCHMARKS.filter((item) => indexChoice === 'all' || item.ticker === indexChoice);
      for (const point of comparison) {
        const row: Record<string, number | string> = { date: point.date, portfolio: point.portfolioReturnPercent };
        for (const item of chosen) {
          const value = point[item.ticker];
          if (finite(value)) row[item.ticker] = value;
        }
        rows.push(row);
      }
      series = [
        { key: 'portfolio', label: 'Portfolio', color: 'var(--ui-teal)' },
        ...chosen.map((item) => ({ key: item.ticker as string, label: item.label as string, color: INDEX_COLORS[item.ticker] })),
      ];
    }

    return { rows: rows.map(row => ({ ...row, timestamp: chartTime(String(row.date)) })).filter(row => Number.isFinite(row.timestamp)), series, unit };
  }, [mode, points, timeframe, intradayPrices, historicalPrices, indexChoice]);

  const last = model.rows.at(-1);
  const formatValue = (value: number) => (model.unit === 'pct' ? formatPercent(value) : mode === 'val' || mode === 'dep' ? formatEgp(value) : formatSigned(value));

  const legend = model.series.map((item) => ({
    ...item,
    value: last && finite(last[item.key]) ? (last[item.key] as number) : null,
  }));

  const relative =
    mode === 'bm' && indexChoice !== 'all' && last && finite(last.portfolio) && finite(last[indexChoice])
      ? (last.portfolio as number) - (last[indexChoice] as number)
      : null;

  const isLoading = loading || (timeframe !== 'TODAY' && historicalLoading);
  const hasData = model.rows.length >= 2;
  const missingBenchmarks = mode === 'bm' ? model.series.filter(item => item.key !== 'portfolio' && !model.rows.some(row => finite(row[item.key]))).map(item => item.label) : [];
  const ChartRoot = model.series.some((item) => item.area) ? AreaChart : LineChart;

  return (
    <div>
      <div className="ui-chips" role="group" aria-label="Chart range">
        {RANGES.map((range) => (
          <button
            key={range.value}
            type="button"
            className="ui-chip"
            aria-pressed={timeframe === range.value}
            onClick={() => setTimeframe(range.value)}
          >
            {range.value === 'TODAY' && !marketSession.isCurrentSessionDay ? 'Last session' : range.label}
          </button>
        ))}
      </div>

      <div className="ui-chart-toolbar"><div className="ui-chips" role="group" aria-label="Chart type">
        {MODES.filter(item => showAdvanced || ['ret', 'val', 'bm'].includes(item.value)).map((item) => (
          <button
            key={item.value}
            type="button"
            className="ui-chip sub"
            aria-pressed={mode === item.value}
            onClick={() => setMode(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div><button type="button" className="ui-link ui-sm" aria-expanded={showAdvanced} onClick={() => setShowAdvanced(value => !value)}>{showAdvanced ? 'Less' : 'More metrics'}</button></div>

      {timeframe === 'TODAY' && !marketSession.isCurrentSessionDay && (
        <p className="ui-note" role="status">{marketSession.description} · {marketSession.sessionCaption}. No new EGX session or trading return today.</p>
      )}
      {timeframe === 'TODAY' && <div className="ui-chips ui-granularity" role="group" aria-label="Today chart interval">{GRANULARITIES.map(minutes => <button key={minutes} className="ui-chip sub" type="button" aria-pressed={granularity === minutes} onClick={() => setGranularity(minutes)}>{minutes === 60 ? '1h' : `${minutes}m`}</button>)}</div>}

      {mode === 'bm' && (
        <div className="ui-chips" style={{ marginTop: 8 }} role="group" aria-label="Benchmark index">
          <button type="button" className="ui-chip sub" aria-pressed={indexChoice === 'all'} onClick={() => setIndexChoice('all')}>
            All indices
          </button>
          {PORTFOLIO_BENCHMARKS.map((item) => (
            <button
              key={item.ticker}
              type="button"
              className="ui-chip sub"
              aria-pressed={indexChoice === item.ticker}
              onClick={() => setIndexChoice(item.ticker)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <div className="ui-card" style={{ marginTop: 10, padding: '10px 6px 6px' }}>
        {isLoading ? (
          <p className="ui-sm" style={{ padding: 24, textAlign: 'center' }}>Loading prices…</p>
        ) : error ? (
          <p className="ui-sm" style={{ padding: 24, textAlign: 'center' }}>{error}</p>
        ) : !hasData ? (
          <p className="ui-sm" style={{ padding: 24, textAlign: 'center' }}>Not enough data for this range yet.</p>
        ) : (
          <div role="img" aria-label={`${MODES.find((item) => item.value === mode)?.label} chart for ${timeframe}`} className="ui-chart-canvas">
            <ResponsiveContainer width="100%" height="100%">
              <ChartRoot data={model.rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--ui-border)" vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(value: number) => labelTime(value, timeframe === 'TODAY')}
                  tick={{ fill: 'var(--ui-text-2)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  width={46}
                  tickFormatter={(value: number) => (model.unit === 'pct' ? `${value.toFixed(1)}%` : formatCompact(value))}
                  tick={{ fill: 'var(--ui-text-2)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                />
                {(model.unit === 'pct' || mode === 'ret') && <ReferenceLine y={0} stroke="var(--ui-border-strong)" strokeDasharray="3 3" />}
                <Tooltip
                  cursor={{ stroke: 'var(--ui-border-strong)' }}
                  contentStyle={{ background: 'var(--ui-surface-2)', border: '1px solid var(--ui-border-strong)', borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(label) => labelTime(Number(label), timeframe === 'TODAY')}
                  formatter={(value, name) => [formatValue(Number(value)), String(name)]}
                />
                {model.series.map((item) =>
                  item.area ? (
                    <Area
                      key={item.key}
                      type="monotone"
                      dataKey={item.key}
                      name={item.label}
                      stroke={item.color}
                      strokeWidth={2.2}
                      fill={item.color}
                      fillOpacity={0.14}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ) : (
                    <Line
                      key={item.key}
                      type="monotone"
                      dataKey={item.key}
                      name={item.label}
                      stroke={item.color}
                      strokeWidth={item.key === 'portfolio' ? 2.4 : 1.6}
                      strokeDasharray={item.dashed ? '4 3' : undefined}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ),
                )}
              </ChartRoot>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {missingBenchmarks.length > 0 && !isLoading && <p className="ui-note" role="status">No aligned price history for: {missingBenchmarks.join(', ')}. Unavailable indices are not plotted.</p>}

      {hasData && !isLoading && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 8 }}>
          {mode === 'ret' && summary && finite(summary.pnlEgp) ? (
            <span className="ui-sm">
              <span className="ui-dot" style={{ ['--dot' as string]: 'var(--ui-teal)' }} />
              Return{' '}
              <span className={`ui-mono ${toneClass(summary.pnlEgp)}`}>
                {formatSigned(summary.pnlEgp)} EGP · {formatPercent(summary.mwrrPercent)}
              </span>
            </span>
          ) : (
            legend.map((item) => (
              <span key={item.key} className="ui-sm">
                <span className="ui-dot" style={{ ['--dot' as string]: item.color }} />
                {item.label}{' '}
                <span className="ui-mono" style={{ color: 'var(--ui-text)' }}>
                  {item.value === null ? '—' : formatValue(item.value)}
                </span>
              </span>
            ))
          )}
          {relative !== null && (
            <span className="ui-sm">
              Relative{' '}
              <span className={`ui-mono ${toneClass(relative)}`}>
                {relative > 0 ? '+' : ''}
                {relative.toFixed(2)} pts
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
