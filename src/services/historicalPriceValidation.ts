import { HistoricalPricePoint } from './historicalPriceStore';

export type HistoricalDataQualityStatus = 'VALID' | 'MISSING' | 'DISCREPANCY' | 'UNAVAILABLE';

export interface HistoricalDataQualityResult {
  status: HistoricalDataQualityStatus;
  ticker: string;
  date: string;
  primaryClose?: number;
  secondaryClose?: number;
  discrepancyPercent?: number;
  reason?: string;
}

export function validateHistoricalPoint(ticker: string, date: string, primary?: HistoricalPricePoint, secondary?: HistoricalPricePoint, tolerancePercent = 0.5): HistoricalDataQualityResult {
  if (!primary) return { status: secondary ? 'VALID' : 'MISSING', ticker, date, secondaryClose: secondary?.close, reason: secondary ? 'Primary provider missing; secondary provider supplied a value.' : 'No provider supplied a value.' };
  if (!Number.isFinite(primary.close) || primary.close <= 0) return { status: 'UNAVAILABLE', ticker, date, reason: 'Primary close is invalid.' };
  if (!secondary) return { status: 'VALID', ticker, date, primaryClose: primary.close };
  if (!Number.isFinite(secondary.close) || secondary.close <= 0) return { status: 'DISCREPANCY', ticker, date, primaryClose: primary.close, secondaryClose: secondary.close, reason: 'Secondary close is invalid.' };
  const discrepancyPercent = Math.abs(primary.close - secondary.close) / secondary.close * 100;
  return discrepancyPercent <= tolerancePercent
    ? { status: 'VALID', ticker, date, primaryClose: primary.close, secondaryClose: secondary.close, discrepancyPercent }
    : { status: 'DISCREPANCY', ticker, date, primaryClose: primary.close, secondaryClose: secondary.close, discrepancyPercent, reason: `Provider closes differ by ${discrepancyPercent.toFixed(3)}%.` };
}

export function findHistoricalGaps(series: HistoricalPricePoint[], startDate: string, endDate: string): string[] {
  const available = new Set(series.map((point) => String(point.date).slice(0, 10)));
  const gaps: string[] = [];
  for (let cursor = new Date(`${startDate}T00:00:00Z`); cursor <= new Date(`${endDate}T00:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = cursor.toISOString().slice(0, 10);
    const weekday = cursor.getUTCDay();
    if (weekday !== 5 && weekday !== 6 && !available.has(day)) gaps.push(day);
  }
  return gaps;
}
