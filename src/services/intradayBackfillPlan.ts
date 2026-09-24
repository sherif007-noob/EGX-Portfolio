import { INTRADAY_POLICY } from './intradayPolicy';

const DAY_MS = 86_400_000;
const DEFAULT_INCREMENTAL_OVERLAP_DAYS = 2;
const DEFAULT_CHUNK_DAYS = 7;

export interface IntradayFetchRange {
  fromMs: number;
  toMs: number;
}

export interface IntradayBackfillPlanInput {
  now: Date;
  earliestDerivedTimestamp?: string | null;
  latestRawTimestamp?: string | null;
  forceFullRepair?: boolean;
  chunkDays?: number;
}

function parseMs(value?: string | null): number {
  if (!value) return Number.NaN;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function splitIntradayFetchRanges(
  fromMs: number,
  toMs: number,
  chunkDays = DEFAULT_CHUNK_DAYS,
): IntradayFetchRange[] {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return [];
  const chunkMs = Math.max(1, Math.trunc(chunkDays)) * DAY_MS;
  const ranges: IntradayFetchRange[] = [];

  let cursor = fromMs;
  while (cursor < toMs) {
    const end = Math.min(toMs, cursor + chunkMs);
    ranges.push({ fromMs: cursor, toMs: end });
    cursor = end;
  }

  return ranges;
}

export function buildIntradayOneMinuteBackfillPlan(
  input: IntradayBackfillPlanInput,
): {
  mode: 'full-derived-backfill' | 'raw-backfill' | 'incremental';
  fromMs: number;
  toMs: number;
  rawCutoffMs: number;
  derivedCutoffMs: number;
  ranges: IntradayFetchRange[];
} {
  const nowMs = input.now.getTime();
  if (!Number.isFinite(nowMs)) throw new Error('A valid now date is required.');

  const rawCutoffMs = nowMs - INTRADAY_POLICY.rawRetentionDays * DAY_MS;
  const derivedCutoffMs = nowMs - INTRADAY_POLICY.derivedRetentionDays * DAY_MS;
  const earliestDerivedMs = parseMs(input.earliestDerivedTimestamp);
  const latestRawMs = parseMs(input.latestRawTimestamp);

  let mode: 'full-derived-backfill' | 'raw-backfill' | 'incremental';
  let fromMs: number;

  if (input.forceFullRepair || !Number.isFinite(earliestDerivedMs)) {
    mode = 'full-derived-backfill';
    fromMs = derivedCutoffMs;
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
    ranges: splitIntradayFetchRanges(fromMs, nowMs, input.chunkDays),
  };
}
