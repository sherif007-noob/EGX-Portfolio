import { INTRADAY_POLICY } from './intradayPolicy';

const DAY_MS = 86_400_000;
const DEFAULT_INCREMENTAL_OVERLAP_DAYS = 2;

export interface IntradayBackfillPlanInput {
  now: Date;
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
  mode: 'full-raw-backfill' | 'raw-backfill' | 'incremental';
  fromMs: number;
  toMs: number;
  rawCutoffMs: number;
  derivedCutoffMs: number;
} {
  const nowMs = input.now.getTime();
  if (!Number.isFinite(nowMs)) throw new Error('A valid now date is required.');

  // Raw 1m data is intentionally a recent tier. Keep the cutoff at a whole
  // UTC day boundary so the first retained EGX session is not truncated
  // mid-bucket. The 5m tier may remain for 90 days independently.
  const rawCutoffMs = retentionCutoffStartOfUtcDay(
    nowMs,
    INTRADAY_POLICY.rawRetentionDays,
  );
  const derivedCutoffMs = retentionCutoffStartOfUtcDay(
    nowMs,
    INTRADAY_POLICY.derivedRetentionDays,
  );
  const latestRawMs = parseMs(input.latestRawTimestamp);

  let mode: 'full-raw-backfill' | 'raw-backfill' | 'incremental';
  let fromMs: number;

  if (input.forceFullRepair) {
    mode = 'full-raw-backfill';
    fromMs = rawCutoffMs;
  } else if (!Number.isFinite(latestRawMs)) {
    mode = 'raw-backfill';
    fromMs = rawCutoffMs;
  } else {
    mode = 'incremental';
    fromMs = Math.max(
      rawCutoffMs,
      latestRawMs - DEFAULT_INCREMENTAL_OVERLAP_DAYS * DAY_MS,
    );
  }

  return {
    mode,
    fromMs,
    toMs: nowMs,
    rawCutoffMs,
    derivedCutoffMs,
  };
}
