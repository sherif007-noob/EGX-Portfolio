/**
 * Exchange calendar overrides. An EGX holiday must be verified against an
 * exchange closure notice, NOT inferred from absent market-data ingestion.
 *
 * Store actual exchange closure dates (including moved holidays), not the
 * public holiday's nominal annual date. Future years require new notices.
 */
export const EGX_EXCHANGE_HOLIDAYS: Readonly<Record<string, { name: string; source: string }>> = {
  '2026-10-08': {
    name: 'Armed Forces Day (observed)',
    // Official EGX notice redistributed by Sigma Capital on 2026-10-05:
    // Thursday Oct 8 closed, Thursday Oct 6 NOT closed; resume Sunday Oct 11.
    source: 'https://www.sigma-cap.com/main/news_page_exact?newsId=46118692&newsType=EGX',
  },
};

export function egxHolidayOn(dateKey: string) {
  return EGX_EXCHANGE_HOLIDAYS[dateKey] ?? null;
}

export function isEgxTradingDay(dateKey: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;
  const date = new Date(`${dateKey}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==dateKey) return false;
  const day = date.getUTCDay();
  return day !== 5 && day !== 6 && !egxHolidayOn(dateKey);
}

export function previousEgxTradingDate(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid EGX session date');
  do { date.setUTCDate(date.getUTCDate() - 1); }
  while (!isEgxTradingDay(date.toISOString().slice(0,10)));
  return date.toISOString().slice(0,10);
}
export function nextEgxTradingDate(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid EGX session date');
  do { date.setUTCDate(date.getUTCDate() + 1); }
  while (!isEgxTradingDay(date.toISOString().slice(0,10)));
  return date.toISOString().slice(0,10);
}

/** Cairo calendar date, regardless of the browser's timezone or UTC midnight. */
export function cairoDateKey(now: Date = new Date()): string {
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',
    year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=(type:string)=>parts.find(item=>item.type===type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
