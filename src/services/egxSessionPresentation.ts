import { getLatestEgxSessionDate } from './analyticsTimeframes';
import { cairoDateKey, egxHolidayOn, isEgxTradingDay } from './egxTradingCalendar';

export interface EgxSessionPresentation {
  calendarDate: string;
  sessionDate: string;
  isCurrentSessionDay: boolean;
  isHoliday: boolean;
  description: string;
  sessionCaption: string;
}

/** Read-only presentation. Never infer a holiday from missing price ingestion. */
export function egxSessionPresentation(now = new Date()): EgxSessionPresentation {
  const calendarDate = cairoDateKey(now);
  const sessionDate = getLatestEgxSessionDate(now);
  const holiday = egxHolidayOn(calendarDate);
  const isCurrentSessionDay = isEgxTradingDay(calendarDate) && sessionDate === calendarDate;
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', day: 'numeric', month: 'short',
  }).format(new Date(`${sessionDate}T12:00:00Z`));
  const description = isCurrentSessionDay ? 'Today'
    : holiday ? `EGX holiday: ${holiday.name}`
    : !isEgxTradingDay(calendarDate) ? 'EGX closed'
    : 'Before market open';
  return {
    calendarDate,sessionDate,isCurrentSessionDay,
    isHoliday:!!holiday,description,
    sessionCaption:isCurrentSessionDay?'Today':`Last session · ${formatted}`,
  };
}
