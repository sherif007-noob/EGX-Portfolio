export const INTRADAY_POLICY = {
  timeZone: 'Africa/Cairo',
  rawIntervalMinutes: 1,
  derivedIntervalMinutes: 5,
  legacyFallbackIntervalMinutes: 15,
  rawRetentionDays: 30,
  derivedRetentionDays: 90,
  ingestionCadenceMinutes: 5,
  sessionStartMinutes: 10 * 60,
  sessionEndMinutes: 14 * 60 + 30,
  scheduledIngestionEndMinutes: 14 * 60 + 40,
  tradingWeekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'] as const,
  initialBackfillBars: 5000,
  backfillBatchBars: 5000,
  maxBackfillBatches: 10,
  incrementalBars: 1200,
  incrementalOverlapDays: 2,
  readIntervals: [1, 5, 15] as const,
} as const;

export type SupportedIntradayInterval = (typeof INTRADAY_POLICY.readIntervals)[number];

export function isSupportedIntradayInterval(value: number): value is SupportedIntradayInterval {
  return INTRADAY_POLICY.readIntervals.includes(value as SupportedIntradayInterval);
}

export function retentionDaysForIntradayInterval(intervalMinutes: number): number {
  if (intervalMinutes === INTRADAY_POLICY.rawIntervalMinutes) return INTRADAY_POLICY.rawRetentionDays;
  return INTRADAY_POLICY.derivedRetentionDays;
}
