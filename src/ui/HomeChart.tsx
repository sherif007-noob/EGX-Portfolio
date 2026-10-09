import React, { useMemo, useState } from 'react';
import { egxSessionPresentation } from '../services/egxSessionPresentation';
import {
  Area,
  AreaChart,
  ComposedChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ReferenceDot,
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
import { chartCapitalEvents, chartReturnTooltipMetrics } from './homeChartPresentation';
import { formatCompact, formatEgp, formatPercent, formatSigned, toneClass } from './format';

type ChartMode = 'ret' | 'dep' | 'twr' | 'mwr' | 'bm';
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
  const [comparePortfolio,setComparePortfolio]=useState(false);
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
  const capitalEvents = useMemo(() => chartCapitalEvents(transactions), [transactions]);

  const model = useMemo(() => {
    const rows: Array<Record<string, number | string>> = [];
    let series: SeriesDef[] = [];
    let unit: Unit = 'egp';

    if (mode === 'ret' && points.length) {
      // The "Return" line must not jump when deposits, withdrawals or audited
      // reconciliation adjustments change NAV without investment performance.
      const fallback = cashFlowNeutralReturn(points);
      for (let index=0; index<points.length; index++) {
        const verified=points[index].returnEgp;
        rows.push({
          date:points[index].date, ret:finite(verified) ? verified : fallback[index]?.value ?? 0,
          ...(comparePortfolio ? {nav:points[index].equity} : {}),
        });
      }
      series = [
        { key:'ret',label:'Return (EGP)',color:'var(--ui-teal)',area:true },
        ...(comparePortfolio ? [{key:'nav',label:'Portfolio NAV (EGP)',color:'var(--ui-blue)',dashed:true}] : []),
      ];
    } else if (mode === 'dep') {
      for (const point of points) rows.push({ date: point.date, equity: point.equity, netDeposits: point.netDeposits });
      series = [
        { key: 'equity', label: 'Value', color: 'var(--ui-teal)', area: true },
        { key: 'netDeposits', label: 'Net deposits', color: 'var(--ui-amber)', dashed: true },
      ];
    } else if (mode === 'twr' || mode === 'mwr') {
      unit = 'pct';
      // Both are calculated by the engine independently. Overlay the other
      // measure to expose real capital-timing differences, rather than drawing
      // two apparently interchangeable single-line charts.
      for (const point of points) {
        if (!finite(point.twrPercent) && !finite(point.mwrrPercent)) continue;
        rows.push({
          date:point.date,
          ...(finite(point.twrPercent)?{twr:point.twrPercent}:{}),
          ...(finite(point.mwrrPercent)?{mwr:point.mwrrPercent}:{}),
        });
      }
      series = mode === 'twr'
        ? [
            {key:'twr',label:'TWR (time-weighted)',color:'var(--ui-teal)',area:true},
            {key:'mwr',label:'MWR (money-weighted)',color:'var(--ui-blue)',dashed:true},
          ]
        : [
            {key:'mwr',label:'MWR (money-weighted)',color:'var(--ui-blue)',area:true},
            {key:'twr',label:'TWR (time-weighted)',color:'var(--ui-teal)',dashed:true},
          ];
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

    return { rows: rows.map(row => ({ ...row, timestamp: chartTime(String(row.date)) }))
      .filter(row => Number.isFinite(row.timestamp)), series, unit };
  }, [mode, comparePortfolio, points, timeframe, intradayPrices, historicalPrices, indexChoice]);

  const visibleCapitalEvents = useMemo(() => capitalEvents.flatMap(event => {
    // DATE-only CASH entries provide no trustworthy intraday clock. Place the
    // marker on that day's first visible observation, not at a fake execution time.
    const row=model.rows.find(item=>String(item.date).slice(0,10)===event.date);
    if(!row || !finite(row.timestamp) || !finite(row.equity))return [];
    return [{...event,timestamp:row.timestamp,equity:row.equity}];
  }),[capitalEvents,model.rows]);

  const pointByDate = useMemo(() => new Map(points.map(point=>[point.date,point])),[points]);

  const renderDetailedTooltip = (props: { active?:boolean; payload?:ReadonlyArray<{payload?:Record<string,number|string>}> }) => {
    const row=props.payload?.[0]?.payload;
    if(!props.active || !row)return null;
    const date=String(row.date??'');
    const point=pointByDate.get(date);
    if(!point)return null;
    const index=points.findIndex(p=>p.date===date);
    const previous=index>0 ? points[index-1] : undefined;
    const event=capitalEvents.find(item=>item.date===date.slice(0,10));
    const displayDate=labelTime(Number(row.timestamp),timeframe==='TODAY');
    const metric=(label:string,value:string,tone?:number|null)=>(
      <div className="ui-chart-tooltip-row" key={label}>
        <span>{label}</span>
        <strong className={tone===undefined?'ui-mono':`ui-mono ${toneClass(tone)}`}>{value}</strong>
      </div>
    );
    if(mode==='ret'){
      // Use canonical point P&L and its previous observation. Do not derive
      // an unrelated "daily profit" from raw NAV that includes deposits.
      const numbers=chartReturnTooltipMetrics(
        {...point,returnEgp:finite(row.ret) ? row.ret : point.returnEgp},
        previous ? {
          ...previous,
          returnEgp:finite(model.rows[index-1]?.ret) ? Number(model.rows[index-1].ret) : previous.returnEgp,
        } : undefined,
      );
      return <div className="ui-chart-detail-tooltip">
        <strong>Return · {displayDate}</strong>
        <div className="ui-chart-tooltip-rows">
          {metric('Total return · selected range',
            numbers.cumulativeReturn==null?'—':`${formatSigned(numbers.cumulativeReturn)} EGP`,
            numbers.cumulativeReturn)}
          {metric(previous
              ? `Change vs ${labelTime(chartTime(previous.date),timeframe==='TODAY')}`
              : (timeframe==='TODAY'?'Previous interval':'Previous session'),
            numbers.intervalReturn==null?'—':`${formatSigned(numbers.intervalReturn)} EGP`,
            numbers.intervalReturn)}
          {metric('Interval return %',formatPercent(numbers.intervalPercent),numbers.intervalPercent)}
          {metric('Total portfolio NAV',`${formatEgp(numbers.nav)} EGP`)}
          {event && event.deposited>0 && metric('Deposited that day',`+${formatEgp(event.deposited)} EGP`)}
          {event && event.withdrawn>0 && metric('Withdrawn that day',`−${formatEgp(event.withdrawn)} EGP`)}
        </div>
        <small>Deposits and withdrawals are excluded from return.</small>
      </div>;
    }
    if(mode==='dep'){
      return <div className="ui-chart-detail-tooltip">
        <strong>NAV vs deposits · {displayDate}</strong>
        <div className="ui-chart-tooltip-rows">
          {metric('Total NAV',`${formatEgp(point.equity)} EGP`)}
          {metric('Net deposits',`${formatEgp(point.netDeposits)} EGP`)}
          {metric('NAV − deposits',`${formatSigned(point.equity-point.netDeposits)} EGP`,
            point.equity-point.netDeposits)}
          {event && event.deposited>0&&metric('Deposited that day',`+${formatEgp(event.deposited)} EGP`)}
          {event && event.withdrawn>0&&metric('Withdrawn that day',`−${formatEgp(event.withdrawn)} EGP`)}
        </div>
        {event&&<small>Cash event dated {event.date}; execution time not inferred.</small>}
      </div>;
    }
    return null;
  };

  const last = model.rows.at(-1);
  const formatValue = (value: number) => (model.unit === 'pct' ? formatPercent(value) : mode === 'dep' ? formatEgp(value) : formatSigned(value));

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
  const includesAreas = model.series.some(item=>item.area);
  const includesLines = model.series.some(item=>!item.area);
  const ChartRoot = includesAreas && includesLines ? ComposedChart : includesAreas ? AreaChart : LineChart;

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
        {MODES.filter(item => showAdvanced || ['ret', 'dep', 'bm'].includes(item.value)).map((item) => (
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

      {mode==='ret' && (
        <div className="ui-return-compare-control">
          <button type="button" className="ui-chip sub" aria-pressed={comparePortfolio}
            aria-label="Compare portfolio NAV with return"
            onClick={()=>setComparePortfolio(on=>!on)}>
            {comparePortfolio?'✓ Portfolio vs Return':'+ Compare portfolio value'}
          </button>
          {comparePortfolio && <span className="ui-sm">
            NAV (blue, right scale) vs P&amp;L (green, left scale)
          </span>}
        </div>
      )}
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

      {(mode==='twr'||mode==='mwr') && (
        <p className="ui-note ui-weighted-return-note">
          {mode==='twr'
            ? 'TWR (solid green) removes the effect of contribution timing. MWR (dashed blue) weights when your money was invested.'
            : 'MWR (solid blue) reflects contribution timing. TWR (dashed green) measures the portfolio independent of that timing.'}
          {' '}They can coincide when cash movements occur at the period boundary; date-only deposits cannot establish an exact intraday weighting.
        </p>
      )}
      {mode==='dep' && (
        <p className="ui-note" style={{marginTop:8}}>
          Compare NAV with your net contributions. Cash transfers change value but are not trading profit. Deposits and withdrawals are marked on the chart.
        </p>
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
              <ChartRoot data={model.rows} margin={{ top: mode==='dep' ? 30 : 8, right: 8, bottom: 0, left: 0 }}>
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
                  yAxisId="primary"
                  width={46}
                  tickFormatter={(value: number) => (model.unit === 'pct' ? `${value.toFixed(1)}%` : formatCompact(value))}
                  tick={{ fill: 'var(--ui-text-2)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                />
                {mode==='ret' && comparePortfolio && (
                  <YAxis yAxisId="nav" orientation="right" width={46}
                    tickFormatter={(value:number)=>formatCompact(value)}
                    tick={{fill:'var(--ui-blue)',fontSize:10}} tickLine={false} axisLine={false}
                    domain={['auto','auto']}/>
                )}
                {(model.unit === 'pct' || mode === 'ret') && <ReferenceLine yAxisId="primary" y={0} stroke="var(--ui-border-strong)" strokeDasharray="3 3" />}
                <Tooltip
                  cursor={{ stroke: 'var(--ui-border-strong)' }}
                  content={(mode==='ret'||mode==='dep')?renderDetailedTooltip:undefined}
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
                      yAxisId={item.key==='nav'?'nav':'primary'}
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
                      yAxisId={item.key==='nav'?'nav':'primary'}
                      name={item.label}
                      stroke={item.color}
                      strokeWidth={item.key === 'portfolio' ? 2.4 : 1.6}
                      strokeDasharray={item.dashed ? '4 3' : undefined}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ),
                )}
                                {mode==='dep'&&visibleCapitalEvents.map(event=>(
                  <ReferenceDot key={event.date}
                    x={event.timestamp} y={event.equity} yAxisId="primary" r={4}
                    fill={event.netFlow>=0?'var(--ui-amber)':'var(--ui-coral)'}
                    stroke="var(--ui-surface-2)" strokeWidth={2}
                    label={{value:event.deposited>0&&event.withdrawn===0
                      ?`Deposit +${formatCompact(event.deposited)}`
                      :event.withdrawn>0&&event.deposited===0
                        ?`Withdrawal −${formatCompact(event.withdrawn)}`
                        :`Cash ${event.netFlow>=0?'+':''}${formatCompact(event.netFlow)}`,
                      position:'top',fontSize:10,fill:'var(--ui-text)'}}/>
                ))}
              </ChartRoot>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {result?.dataQuality && result.dataQuality.incompleteDays > 0 && !isLoading && (
        <p className="ui-note" role="status">Incomplete valuation on {result.dataQuality.incompleteDays} day(s). Missing historical prices: {result.dataQuality.missingTickers.join(', ') || 'unknown'}. Returns may omit those periods.</p>
      )}
      {missingBenchmarks.length > 0 && !isLoading && <p className="ui-note" role="status">No aligned price history for: {missingBenchmarks.join(', ')}. Unavailable indices are not plotted.</p>}

      {hasData && !isLoading && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 8 }}>
          {mode === 'ret' && last && finite(last.ret) ? (
            <span className="ui-sm">
              <span className="ui-dot" style={{ ['--dot' as string]: 'var(--ui-teal)' }} />
              Cash-flow-adjusted P&L since first point{' '}
              <span className={`ui-mono ${toneClass(last.ret)}`}>
                {formatSigned(last.ret)} EGP
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
          {mode==='ret' && comparePortfolio && last && finite(last.nav) && (
            <span className="ui-sm">
              <span className="ui-dot" style={{ ['--dot' as string]:'var(--ui-blue)' }}/>
              Portfolio NAV <span className="ui-mono">{formatEgp(last.nav)} EGP</span>
            </span>
          )}
          {(mode==='twr'||mode==='mwr') && last && finite(last.twr) && finite(last.mwr) && (
            <span className="ui-sm">
              MWR − TWR <span className={`ui-mono ${toneClass(last.mwr-last.twr)}`}>
                {formatSigned(last.mwr-last.twr)} percentage points
              </span>
            </span>
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
