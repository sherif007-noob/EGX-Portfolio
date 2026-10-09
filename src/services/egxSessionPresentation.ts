import { getLatestEgxSessionDate } from './analyticsTimeframes';
import { cairoDateKey, egxHolidayOn, isEgxTradingDay } from './egxTradingCalendar';

export interface EgxSessionPresentation {
  calendarDate: string;
  sessionDate: string;
  isCurrentSessionDay: boolean;
  /** Calendar/clock window only: not a live exchange-status assertion. */
  isRegularTradingHours: boolean;
  isHoliday: boolean;
  description: string;
  sessionCaption: string;
  lastSessionCaption: string;
}

/** Read-only presentation. Never infer a holiday from missing price ingestion. */
export function egxSessionPresentation(now = new Date()): EgxSessionPresentation {
  const calendarDate = cairoDateKey(now);
  const sessionDate = getLatestEgxSessionDate(now);
  const holiday = egxHolidayOn(calendarDate);
  const isCurrentSessionDay = isEgxTradingDay(calendarDate) && sessionDate === calendarDate;
  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone:'Africa/Cairo', hour:'2-digit', minute:'2-digit',hourCycle:'h23',
  }).formatToParts(now);
  const hour = Number(timeParts.find(part=>part.type==='hour')?.value ?? -1);
  const minute = Number(timeParts.find(part=>part.type==='minute')?.value ?? -1);
  const timeOfDay = hour * 60 + minute;
  const isRegularTradingHours = isCurrentSessionDay && timeOfDay >= 600 && timeOfDay < 870;
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', day: 'numeric', month: 'short',
  }).format(new Date(`${sessionDate}T12:00:00Z`));
  const description = isCurrentSessionDay ? 'Today'
    : holiday ? `EGX holiday: ${holiday.name}`
    : !isEgxTradingDay(calendarDate) ? 'EGX closed'
    : 'Before market open';
  return {
    calendarDate,sessionDate,isCurrentSessionDay,isRegularTradingHours,
    isHoliday:!!holiday,description,
    sessionCaption:isCurrentSessionDay?'Today':`Last session · ${formatted}`,
    lastSessionCaption:`Last session · ${formatted}`,
  };
}
