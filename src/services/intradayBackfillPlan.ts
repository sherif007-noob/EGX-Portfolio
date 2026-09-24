import { INTRADAY_POLICY } from './intradayPolicy';

const DAY_MS = 86_400_000;

export interface IntradayBackfillPlanInput {
  now: Date;
  earliestDerivedTimestamp?: string | null;
  earliestFiveMinuteTimestamp?: string | null;
  latestRawTimestamp?: string | null;
  forceFullRepair?: boolean;
}

function parseMs(value?: string | null): number {
  if (!value) return Number.NaN;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function retentionCutoffStartOfUtcDay(nowMs: number, retentionDays: number): number {
  const target = new Date(nowMs - retentionDays * DAY_MS);
  if (Number.isNaN(target.getTime())) throw new Error('A valid retention cutoff date is required.');
  return Date.parse(`${target.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export function buildIntradayOneMinuteBackfillPlan(
  input: IntradayBackfillPlanInput,
): {
  mode: 'full-derived-backfill' | 'raw-backfill' | 'incremental';
  fromMs: number;
  toMs: number;
  rawCutoffMs: number;
  derivedCutoffMs: number;
} {
  const nowMs = input.now.getTime();
  if (!Number.isFinite(nowMs)) throw new Error('A valid now date is required.');

  const rawCutoffMs = retentionCutoffStartOfUtcDay(
    nowMs,
    INTRADAY_POLICY.rawRetentionDays,
  );
  const derivedCutoffMs = retentionCutoffStartOfUtcDay(
    nowMs,
    INTRADAY_POLICY.derivedRetentionDays,
  );

  const earliestDerivedMs = parseMs(input.earliestDerivedTimestamp);
  const latestRawMs = parseMs(input.latestRawTimestamp);

  if (input.forceFullRepair || !Number.isFinite(earliestDerivedMs)) {
    return {
      mode: 'full-derived-backfill',
      fromMs: derivedCutoffMs,
      toMs: nowMs,
      rawCutoffMs,
      derivedCutoffMs,
    };
  }

  if (!Number.isFinite(latestRawMs)) {
    return {
      mode: 'raw-backfill',
      fromMs: rawCutoffMs,
      toMs: nowMs,
      rawCutoffMs,
      derivedCutoffMs,
    };
  }

  return {
    mode: 'incremental',
    fromMs: Math.max(
      rawCutoffMs,
      latestRawMs - INTRADAY_POLICY.incrementalOverlapDays * DAY_MS,
    ),
    toMs: nowMs,
    rawCutoffMs,
    derivedCutoffMs,
  };
}
