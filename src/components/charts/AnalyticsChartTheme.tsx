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
  tooltipBackground: '#020617',
  tooltipBorder: '#334155',
} as const;

export const analyticsGridProps = {
  strokeDasharray: '3 3',
  stroke: ANALYTICS_CHART_THEME.grid,
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
  opacity: 0.75,
} as const;


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

export function formatAnalyticsCompactEgp(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${sign}${(absolute / 1_000_000).toFixed(1)}m`;
  if (absolute >= 1_000) return `${sign}${(absolute / 1_000).toFixed(1)}k`;
  return `${sign}${absolute.toFixed(0)}`;
}

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
      'premium-floating premium-tooltip-content min-w-[150px] max-w-[min(78vw,320px)] rounded-xl border',
      'px-3 py-2.5 text-xs',
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
      <div className="border-b border-slate-800 pb-1.5 mb-1.5">
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
  <div className="premium-surface flex min-h-40 items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center text-xs text-slate-500">
    {children}
  </div>
);

export const AnalyticsChartLoadingState: React.FC = () => (
  <div
    className="min-h-40 animate-pulse rounded-xl border border-slate-800 bg-slate-950/30 p-4"
    aria-label="Loading chart data"
  >
    <div className="h-full min-h-32 rounded-lg bg-gradient-to-b from-slate-800/50 to-slate-900/20" />
  </div>
);
