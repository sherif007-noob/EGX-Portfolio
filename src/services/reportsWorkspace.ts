export const REPORT_MODES = [
  'overview',
  'analytics',
  'trading',
  'allocation',
  'monthly',
] as const;

export type ReportsMode = (typeof REPORT_MODES)[number];

export const REPORTS_LAST_MODE_STORAGE_KEY = 'reports:lastMode';
export const DEFAULT_REPORTS_MODE: ReportsMode = 'overview';

export const REPORT_MODE_LABELS: Record<ReportsMode, string> = {
  overview: 'Overview',
  analytics: 'Analytics',
  trading: 'Trading',
  allocation: 'Allocation',
  monthly: 'Monthly',
};

export const isReportsMode = (value: unknown): value is ReportsMode =>
  typeof value === 'string' && REPORT_MODES.includes(value as ReportsMode);

export const parseReportsMode = (value: unknown): ReportsMode =>
  isReportsMode(value) ? value : DEFAULT_REPORTS_MODE;

export const readPersistedReportsMode = (): ReportsMode => {
  if (typeof window === 'undefined') return DEFAULT_REPORTS_MODE;

  try {
    return parseReportsMode(window.localStorage.getItem(REPORTS_LAST_MODE_STORAGE_KEY));
  } catch {
    return DEFAULT_REPORTS_MODE;
  }
};

export const persistReportsMode = (mode: ReportsMode): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(REPORTS_LAST_MODE_STORAGE_KEY, mode);
  } catch {
    // Persistence is a convenience only; Reports must remain usable if storage is unavailable.
  }
};
