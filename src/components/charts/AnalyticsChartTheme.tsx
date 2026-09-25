import React from 'react';

export const ANALYTICS_CHART_THEME = {
  grid: '#1e293b',
  axis: '#64748b',
  axisLine: '#334155',
  zeroLine: '#475569',
  crosshair: '#38bdf8',
  cyan: '#06b6d4',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  emerald: '#10b981',
  rose: '#f43f5e',
  amber: '#f59e0b',
  neutral: '#94a3b8',
  plotBorder: 'rgba(100, 116, 139, 0.18)',
  plotHighlight: 'rgba(255, 255, 255, 0.04)',
  tooltipBackground: '#020617',
  tooltipBorder: '#334155',
} as const;

export type AnalyticsChartTone =
  | 'live'
  | 'comparison'
  | 'positive'
  | 'negative'
  | 'cost'
  | 'neutral';

export const ANALYTICS_ALLOCATION_PALETTE = [
  ANALYTICS_CHART_THEME.cyan,
  ANALYTICS_CHART_THEME.blue,
  ANALYTICS_CHART_THEME.purple,
  ANALYTICS_CHART_THEME.emerald,
  ANALYTICS_CHART_THEME.amber,
  '#ec4899',
  '#14b8a6',
  '#6366f1',
  '#f97316',
  '#84cc16',
] as const;

export const ANALYTICS_CHART_MARGINS = {
  primary: { top: 8, right: 8, left: 0, bottom: 0 },
  compact: { top: 8, right: 8, left: 0, bottom: 0 },
  trajectory: { top: 10, right: 15, left: 10, bottom: 5 },
} as const;

export const analyticsGridProps = {
  strokeDasharray: '3 3',
  stroke: ANALYTICS_CHART_THEME.grid,
  strokeOpacity: 0.78,
  vertical: false,
} as const;

export const analyticsXAxisProps = {
  stroke: ANALYTICS_CHART_THEME.axis,
  fontSize: 10,
  tickLine: false,
  axisLine: { stroke: ANALYTICS_CHART_THEME.axisLine },
  minTickGap: 24,
} as const;

export const analyticsYAxisProps = {
  stroke: ANALYTICS_CHART_THEME.axis,
  fontSize: 10,
  tickLine: false,
  axisLine: false,
  width: 54,
} as const;

export const analyticsTooltipCursor = {
  stroke: ANALYTICS_CHART_THEME.crosshair,
  strokeWidth: 1,
  strokeDasharray: '4 4',
  opacity: 0.72,
} as const;

export const analyticsZeroLineProps = {
  stroke: ANALYTICS_CHART_THEME.zeroLine,
  strokeWidth: 1,
  strokeDasharray: '3 3',
  strokeOpacity: 0.9,
} as const;

export function getAnalyticsToneColor(tone: AnalyticsChartTone): string {
  switch (tone) {
    case 'comparison':
      return ANALYTICS_CHART_THEME.purple;
    case 'positive':
      return ANALYTICS_CHART_THEME.emerald;
    case 'negative':
      return ANALYTICS_CHART_THEME.rose;
    case 'cost':
      return ANALYTICS_CHART_THEME.amber;
    case 'neutral':
      return ANALYTICS_CHART_THEME.neutral;
    case 'live':
    default:
      return ANALYTICS_CHART_THEME.cyan;
  }
}

export function analyticsActiveDotProps(
  tone: AnalyticsChartTone = 'live',
  radius = 4.5,
) {
  const fill = getAnalyticsToneColor(tone);
  return {
    r: radius,
    fill,
    stroke: ANALYTICS_CHART_THEME.tooltipBackground,
    strokeWidth: 2,
    className: 'premium-chart-active-dot',
  } as const;
}

export type AnalyticsTradeMarkerOutcome = 'START' | 'WIN' | 'LOSS' | 'BREAKEVEN';

export interface AnalyticsTradeMarkerStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
  activeRadius: number;
  glow: string;
}

/**
 * Persistent trajectory markers are data-bearing observations: each marker maps
 * to one inception/trade event and must remain visible in cumulative mode.
 * Do not sample or thin these markers as a visual optimization.
 */
export function getAnalyticsTradeMarkerStyle(
  outcome: AnalyticsTradeMarkerOutcome,
): AnalyticsTradeMarkerStyle {
  if (outcome === 'WIN') {
    return {
      fill: ANALYTICS_CHART_THEME.emerald,
      stroke: ANALYTICS_CHART_THEME.tooltipBackground,
      strokeWidth: 2,
      radius: 5,
      activeRadius: 7,
      glow: 'rgba(16, 185, 129, 0.34)',
    };
  }
  if (outcome === 'LOSS') {
    return {
      fill: ANALYTICS_CHART_THEME.rose,
      stroke: ANALYTICS_CHART_THEME.tooltipBackground,
      strokeWidth: 2,
      radius: 5,
      activeRadius: 7,
      glow: 'rgba(244, 63, 94, 0.34)',
    };
  }
  if (outcome === 'BREAKEVEN') {
    return {
      fill: ANALYTICS_CHART_THEME.amber,
      stroke: ANALYTICS_CHART_THEME.tooltipBackground,
      strokeWidth: 2,
      radius: 5,
      activeRadius: 7,
      glow: 'rgba(245, 158, 11, 0.30)',
    };
  }
  return {
    fill: ANALYTICS_CHART_THEME.neutral,
    stroke: ANALYTICS_CHART_THEME.tooltipBackground,
    strokeWidth: 2,
    radius: 4,
    activeRadius: 6,
    glow: 'rgba(148, 163, 184, 0.24)',
  };
}

export function formatAnalyticsEgp(value: number, signed = false): string {
  if (!Number.isFinite(value)) return '—';
  const prefix = signed && value > 0 ? '+' : '';
  return `${prefix}${value.toLocaleString('en-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EGP`;
}

export function formatAnalyticsPercent(value: number, signed = false): string {
  if (!Number.isFinite(value)) return '—';
  const prefix = signed && value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
}

export function formatAnalyticsPercentAxis(value: number, precision = 1): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(precision)}%`;
}

export function formatAnalyticsCompactEgp(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${sign}${(absolute / 1_000_000).toFixed(1)}m`;
  if (absolute >= 1_000) return `${sign}${(absolute / 1_000).toFixed(1)}k`;
  return `${sign}${absolute.toFixed(0)}`;
}

interface ChartPlotSurfaceProps {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

export const ChartPlotSurface: React.FC<ChartPlotSurfaceProps> = ({
  children,
  className = '',
  ariaLabel,
}) => (
  <div
    className={['premium-chart-plot relative min-w-0 rounded-xl border', className].join(' ')}
    aria-label={ariaLabel}
  >
    {children}
  </div>
);

export interface ChartLegendItem {
  label: string;
  color: string;
  kind?: 'solid' | 'dashed' | 'dot';
}

interface ChartLegendProps {
  items: readonly ChartLegendItem[];
  ariaLabel?: string;
  className?: string;
}

export const ChartLegend: React.FC<ChartLegendProps> = ({
  items,
  ariaLabel = 'Chart legend',
  className = '',
}) => (
  <div
    role="list"
    aria-label={ariaLabel}
    className={['premium-chart-legend flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-slate-400', className].join(' ')}
  >
    {items.map((item) => (
      <div role="listitem" key={item.label} className="flex min-w-0 items-center gap-1.5">
        {item.kind === 'dot' ? (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}55` }}
            aria-hidden="true"
          />
        ) : (
          <span
            className="h-px w-4 shrink-0"
            style={{
              backgroundColor: item.kind === 'dashed' ? 'transparent' : item.color,
              backgroundImage:
                item.kind === 'dashed'
                  ? `repeating-linear-gradient(90deg, ${item.color} 0 5px, transparent 5px 8px)`
                  : undefined,
            }}
            aria-hidden="true"
          />
        )}
        <span className="truncate">{item.label}</span>
      </div>
    ))}
  </div>
);

interface ChartTooltipShellProps {
  children: React.ReactNode;
  className?: string;
}

export const ChartTooltipShell: React.FC<ChartTooltipShellProps> = ({
  children,
  className = '',
}) => (
  <div
    className={[
      'premium-floating premium-tooltip-content premium-chart-tooltip w-max max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border sm:min-w-[150px] sm:max-w-[320px]',
      'px-3 py-2.5 text-xs break-words',
      'text-slate-200',
      className,
    ].join(' ')}
  >
    {children}
  </div>
);

export interface AnalyticsTooltipValue {
  name: string;
  value: number;
  color?: string;
}

interface AnalyticsChartTooltipProps {
  active?: boolean;
  payload?: readonly any[];
  label?: string | number;
  title?: string;
  labelFormatter?: (label: string | number, payload: readonly any[]) => string;
  valueFormatter?: (value: number, name: string, payload: any) => string;
  nameFormatter?: (name: string, payload: any) => string;
  tone?: 'neutral' | 'positive' | 'negative';
  signedValueColors?: boolean;
}

export const AnalyticsChartTooltip: React.FC<AnalyticsChartTooltipProps> = ({
  active,
  payload = [],
  label,
  title,
  labelFormatter,
  valueFormatter,
  nameFormatter,
  tone = 'neutral',
  signedValueColors = false,
}) => {
  if (!active || payload.length === 0) return null;

  const resolvedLabel = labelFormatter
    ? labelFormatter(label ?? '', payload)
    : String(label ?? '');

  const toneClass =
    tone === 'positive'
      ? 'text-emerald-400'
      : tone === 'negative'
        ? 'text-rose-400'
        : 'text-cyan-300';

  return (
    <ChartTooltipShell>
      <div className="mb-1.5 border-b border-slate-800/90 pb-1.5">
        {title && <div className={`font-semibold ${toneClass}`}>{title}</div>}
        {resolvedLabel && (
          <div className="font-mono text-[10px] text-slate-400">{resolvedLabel}</div>
        )}
      </div>

      <div className="space-y-1.5">
        {payload.map((entry, index) => {
          const rawValue = Number(entry?.value);
          if (!Number.isFinite(rawValue)) return null;
          const rawName = String(entry?.name ?? entry?.dataKey ?? 'Value');
          const displayName = nameFormatter
            ? nameFormatter(rawName, entry)
            : rawName;
          const displayValue = valueFormatter
            ? valueFormatter(rawValue, rawName, entry)
            : rawValue.toLocaleString('en-EG', { maximumFractionDigits: 2 });
          const indicator = entry?.color || entry?.stroke || entry?.fill || ANALYTICS_CHART_THEME.cyan;
          const valueClass = signedValueColors
            ? rawValue > 0
              ? 'text-emerald-400'
              : rawValue < 0
                ? 'text-rose-400'
                : 'text-slate-200'
            : 'text-slate-100';

          return (
            <div
              key={`${rawName}-${index}`}
              className="flex items-center justify-between gap-4"
            >
              <span className="flex min-w-0 items-center gap-2 text-slate-400">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: indicator }}
                />
                <span className="truncate">{displayName}</span>
              </span>
              <span className={`shrink-0 font-mono font-semibold ${valueClass}`}>
                {displayValue}
              </span>
            </div>
          );
        })}
      </div>
    </ChartTooltipShell>
  );
};

interface AnalyticsEmptyStateProps {
  children: React.ReactNode;
}

export const AnalyticsEmptyState: React.FC<AnalyticsEmptyStateProps> = ({ children }) => (
  <ChartPlotSurface className="flex min-h-40 items-center justify-center border-dashed px-4 py-8 text-center text-xs text-slate-500">
    {children}
  </ChartPlotSurface>
);

export const AnalyticsChartLoadingState: React.FC = () => (
  <ChartPlotSurface
    className="min-h-40 animate-pulse p-4"
    ariaLabel="Loading chart data"
  >
    <div className="premium-chart-skeleton h-full min-h-32 rounded-lg" />
  </ChartPlotSurface>
);
