export type AnalyticsTimeframe = 'TODAY' | '1W' | '1M' | '90D' | 'YTD' | 'ALL';
export type AnalyticsResolution = '15m' | '1d';

export interface AnalyticsWindow {
  timeframe: AnalyticsTimeframe;
  label: string;
  startDate: string;
  endDate: string;
  resolution: AnalyticsResolution;
  requiresIntraday: boolean;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateKey(date: string): Date {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`);
}

function shiftDays(date: string, days: number): string {
  const d = parseDateKey(date);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

function previousEgxTradingDate(date: string): string {
  let d = parseDateKey(date);
  do {
    d.setUTCDate(d.getUTCDate() - 1);
  } while (d.getUTCDay() === 5 || d.getUTCDay() === 6);
  return isoDate(d);
}

function subtractCalendarMonth(date: string): string {
  const d = parseDateKey(date);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();

  const previousMonthStart = new Date(Date.UTC(year, month - 1, 1));
  const previousMonthLastDay = new Date(
    Date.UTC(previousMonthStart.getUTCFullYear(), previousMonthStart.getUTCMonth() + 1, 0),
  ).getUTCDate();

  previousMonthStart.setUTCDate(Math.min(day, previousMonthLastDay));
  return isoDate(previousMonthStart);
}

export function getLatestEgxSessionDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const date = `${read('year')}-${read('month')}-${read('day')}`;
  const hour = Number(read('hour'));
  const minute = Number(read('minute'));
  const minuteOfDay = hour * 60 + minute;
  const weekday = parseDateKey(date).getUTCDay();

  if (weekday === 5 || weekday === 6) return previousEgxTradingDate(date);

  // Keep the analytics session boundary aligned with the regular EGX session.
  // Pre-market may begin earlier, but portfolio session analytics start at 10:00 Cairo.
  if (minuteOfDay < 10 * 60) return previousEgxTradingDate(date);
  return date;
}

export function resolveAnalyticsWindow(
  timeframe: AnalyticsTimeframe,
  options: {
    now?: Date;
    latestSessionDate?: string;
    firstPortfolioDate?: string;
  } = {},
): AnalyticsWindow {
  const endDate = (options.latestSessionDate || getLatestEgxSessionDate(options.now)).slice(0, 10);
  const firstPortfolioDate = options.firstPortfolioDate?.slice(0, 10);

  switch (timeframe) {
    case 'TODAY':
      return {
        timeframe,
        label: 'Today',
        startDate: endDate,
        endDate,
        resolution: '15m',
        requiresIntraday: true,
      };
    case '1W':
      return {
        timeframe,
        label: 'Past week',
        startDate: shiftDays(endDate, -6),
        endDate,
        resolution: '1d',
        requiresIntraday: false,
      };
    case '1M':
      return {
        timeframe,
        label: 'Past month',
        startDate: subtractCalendarMonth(endDate),
        endDate,
        resolution: '1d',
        requiresIntraday: false,
      };
    case '90D':
      return {
        timeframe,
        label: 'Past 90 days',
        startDate: shiftDays(endDate, -90),
        endDate,
        resolution: '1d',
        requiresIntraday: false,
      };
    case 'YTD':
      return {
        timeframe,
        label: 'Year to date',
        startDate: `${endDate.slice(0, 4)}-01-01`,
        endDate,
        resolution: '1d',
        requiresIntraday: false,
      };
    case 'ALL':
      return {
        timeframe,
        label: 'All time',
        startDate: firstPortfolioDate || endDate,
        endDate,
        resolution: '1d',
        requiresIntraday: false,
      };
  }
}
