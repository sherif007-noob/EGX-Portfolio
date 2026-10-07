export const formatEgp = (value: number, digits = 2): string =>
  new Intl.NumberFormat('en-EG', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);

export const formatSigned = (value: number, digits = 2): string =>
  `${value > 0 ? '+' : ''}${formatEgp(value, digits)}`;

export const formatPercent = (value: number | null | undefined, digits = 2): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`;
};

export const toneClass = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) return '';
  return value > 0 ? 'ui-pos' : 'ui-neg';
};

/** Compact axis labels: 116.9k, 1.2m, 950. */
export const formatCompact = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (abs >= 10_000) return `${Math.round(value / 1000)}k`;
  if (abs >= 1_000) return `${(value / 1000).toFixed(1)}k`;
  return `${Math.round(value)}`;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-09-07" -> "7 Sep"; intraday ISO timestamps -> "10:30". */
export const formatChartDate = (value: string): string => {
  if (!value) return '';
  const timeMatch = /T(\d{2}:\d{2})/.exec(value) ?? /^(\d{2}:\d{2})/.exec(value);
  if (timeMatch) return timeMatch[1];
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return value;
  return `${day} ${MONTHS[month - 1] ?? ''}`;
};

const SECTOR_COLORS = ['--ui-blue', '--ui-coral', '--ui-purple', '--ui-amber', '--ui-teal', '--ui-gray'];

/** Stable color per sector so the same sector always looks the same. */
export const sectorColorVar = (sector: string | undefined): string => {
  const key = (sector ?? '').toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return `var(${SECTOR_COLORS[hash % SECTOR_COLORS.length]})`;
};
