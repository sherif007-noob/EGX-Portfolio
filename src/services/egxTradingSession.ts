import { INTRADAY_POLICY } from './intradayPolicy';

export interface EgxCairoSessionClock {
  dateKey: string;
  weekday: string;
  minuteOfDay: number;
  isTradingWeekday: boolean;
  isRegularSession: boolean;
  isScheduledIngestionWindow: boolean;
}

export function egxCairoSessionClock(date: Date): EgxCairoSessionClock {
  if (Number.isNaN(date.getTime())) throw new Error('A valid date is required.');

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: INTRADAY_POLICY.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const hour = Number(read('hour'));
  const minute = Number(read('minute'));
  const weekday = read('weekday');
  const minuteOfDay = hour * 60 + minute;
  const isTradingWeekday = (INTRADAY_POLICY.tradingWeekdays as readonly string[]).includes(weekday);

  return {
    dateKey: `${read('year')}-${read('month')}-${read('day')}`,
    weekday,
    minuteOfDay,
    isTradingWeekday,
    isRegularSession:
      isTradingWeekday &&
      minuteOfDay >= INTRADAY_POLICY.sessionStartMinutes &&
      minuteOfDay < INTRADAY_POLICY.sessionEndMinutes,
    isScheduledIngestionWindow:
      isTradingWeekday &&
      minuteOfDay >= INTRADAY_POLICY.sessionStartMinutes &&
      minuteOfDay <= INTRADAY_POLICY.scheduledIngestionEndMinutes,
  };
}
