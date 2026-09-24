export type HistoryCoverageRequirement = {
  ticker: string;
  firstRequiredDate: string;
};

export type StoredHistoryDate = {
  ticker: string;
  date: string;
};

export type HistoricalRepairReason =
  | 'no-history'
  | 'missing-head'
  | 'internal-gap'
  | 'stale-tail';

export type HistoricalRepairPlan = {
  ticker: string;
  startDate: string;
  endDate: string;
  reasons: HistoricalRepairReason[];
  missingReferenceDates: string[];
};

function normalizeDate(value: string): string {
  return String(value || '').slice(0, 10);
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function isEgxTradingWeekday(date: string): boolean {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  const day = parsed.getUTCDay();
  return day >= 0 && day <= 4;
}

export function buildHistoricalRepairPlans(
  requirements: HistoryCoverageRequirement[],
  storedRows: StoredHistoryDate[],
  endDateInput: string,
): HistoricalRepairPlan[] {
  const endDate = normalizeDate(endDateInput);
  const rowsByTicker = new Map<string, Set<string>>();
  const marketDates = new Set<string>();

  for (const row of storedRows) {
    const ticker = String(row.ticker || '').trim().toUpperCase();
    const date = normalizeDate(row.date);
    if (!ticker || !date || date > endDate) continue;
    if (!rowsByTicker.has(ticker)) rowsByTicker.set(ticker, new Set());
    rowsByTicker.get(ticker)!.add(date);
    marketDates.add(date);
  }

  const sortedMarketDates = [...marketDates].sort();
  const plans: HistoricalRepairPlan[] = [];

  for (const requirement of requirements) {
    const ticker = String(requirement.ticker || '').trim().toUpperCase();
    const firstRequiredDate = normalizeDate(requirement.firstRequiredDate);
    if (!ticker || !firstRequiredDate || firstRequiredDate > endDate) continue;

    const dates = [...(rowsByTicker.get(ticker) || new Set<string>())]
      .filter((date) => date >= firstRequiredDate && date <= endDate)
      .sort();

    if (!dates.length) {
      plans.push({
        ticker,
        startDate: firstRequiredDate,
        endDate,
        reasons: ['no-history'],
        missingReferenceDates: sortedMarketDates.filter(
          (date) => date >= firstRequiredDate && date <= endDate,
        ),
      });
      continue;
    }

    const firstStoredDate = dates[0];
    const lastStoredDate = dates[dates.length - 1];
    const stored = new Set(dates);
    const missingReferenceDates = sortedMarketDates.filter(
      (date) =>
        date >= firstRequiredDate &&
        date <= endDate &&
        !stored.has(date),
    );

    const reasons: HistoricalRepairReason[] = [];
    const repairStarts: string[] = [];

    if (firstStoredDate > firstRequiredDate) {
      reasons.push('missing-head');
      repairStarts.push(firstRequiredDate);
    }

    if (missingReferenceDates.length) {
      reasons.push('internal-gap');
      repairStarts.push(missingReferenceDates[0]);
    }

    if (isEgxTradingWeekday(endDate) && lastStoredDate < endDate) {
      reasons.push('stale-tail');
      repairStarts.push(
        addDays(lastStoredDate, -7) < firstRequiredDate
          ? firstRequiredDate
          : addDays(lastStoredDate, -7),
      );
    }

    if (!reasons.length) continue;

    plans.push({
      ticker,
      startDate: repairStarts.sort()[0],
      endDate,
      reasons: [...new Set(reasons)],
      missingReferenceDates,
    });
  }

  return plans.sort((a, b) => a.ticker.localeCompare(b.ticker));
}
