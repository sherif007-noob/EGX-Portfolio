export interface SectorScannerRow {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  close: number;
  changePct: number;
  volume: number;
  avgVolume10d: number | null;
  rvol10: number | null;
  turnover: number;
}

export interface SectorMomentumSnapshot {
  capturedAt: number;
  rows: SectorScannerRow[];
}

export interface SectorMomentumMember extends SectorScannerRow {
  groupKey: string;
  groupName: string;
  groupType: 'industry' | 'sector';
  baselinePrice: number;
  baselineVolume: number;
  windowMinutes: number;
  momentumPct: number;
  volumeDelta: number;
  windowTurnover: number;
  rvolDelta: number | null;
  activityScore: number;
}

export interface SectorClusterAlert {
  id: string;
  detectedAt: number;
  groupKey: string;
  groupName: string;
  groupType: 'industry' | 'sector';
  memberCount: number;
  windowMinutes: number;
  averageMomentumPct: number;
  averageRvol: number | null;
  totalWindowTurnover: number;
  strengthScore: number;
  leader: SectorMomentumMember;
  runnerUp: SectorMomentumMember | null;
  members: SectorMomentumMember[];
}

export interface SectorMomentumConfig {
  minMemberCount: number;
  minMomentumPct: number;
  minCurrentTurnover: number;
  minWindowTurnover: number;
  minGroupWindowTurnover: number;
  minRvol: number;
  minRvolDelta: number;
  baselineMinAgeMs: number;
  baselineMaxAgeMs: number;
  baselineTargetAgeMs: number;
}

export const DEFAULT_SECTOR_MOMENTUM_CONFIG: SectorMomentumConfig = {
  minMemberCount: 3,
  minMomentumPct: 0.25,
  minCurrentTurnover: 1_500_000,
  minWindowTurnover: 250_000,
  minGroupWindowTurnover: 1_000_000,
  minRvol: 1.0,
  minRvolDelta: 0.05,
  baselineMinAgeMs: 5 * 60_000,
  baselineMaxAgeMs: 10 * 60_000,
  baselineTargetAgeMs: 7.5 * 60_000,
};

const CEMENT_TICKERS = new Set([
  'ALEX',
  'ARCC',
  'MBSC',
  'MCQE',
  'SCEM',
  'SUCE',
  'SVCE',
  'TORA',
]);

const numeric = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeTicker = (value: unknown): string => {
  const raw = String(value || '').trim().toUpperCase();
  const withoutExchange = raw.includes(':') ? raw.split(':').at(-1)! : raw;
  return withoutExchange.replace(/\.CA$/, '');
};

const normalizeGroupText = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\bCo\.?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

function groupForRow(row: SectorScannerRow): {
  groupKey: string;
  groupName: string;
  groupType: 'industry' | 'sector';
} | null {
  if (CEMENT_TICKERS.has(row.ticker)) {
    return { groupKey: 'cement', groupName: 'Cement', groupType: 'industry' };
  }

  const industry = normalizeGroupText(row.industry);
  if (industry && !/^other$/i.test(industry) && !/^n\/?a$/i.test(industry)) {
    return {
      groupKey: `industry:${industry.toLowerCase()}`,
      groupName: industry,
      groupType: 'industry',
    };
  }

  const sector = normalizeGroupText(row.sector);
  if (sector && !/^other$/i.test(sector) && !/^n\/?a$/i.test(sector)) {
    return {
      groupKey: `sector:${sector.toLowerCase()}`,
      groupName: sector,
      groupType: 'sector',
    };
  }

  return null;
}

/**
 * Decodes the shared EGX scanner response. The first 16 columns preserve the
 * portfolio quote contract; the sector-momentum fields are appended after them.
 */
export function parseSectorScannerResponse(
  payload: any,
  capturedAt = Date.now(),
): SectorMomentumSnapshot {
  const rows: SectorScannerRow[] = [];

  for (const item of Array.isArray(payload?.data) ? payload.data : []) {
    if (!Array.isArray(item?.d)) continue;
    const d = item.d;
    const ticker = normalizeTicker(item.s || d[0]);
    const close = numeric(d[3]);
    const changePct = numeric(d[4]);
    const volume = numeric(d[6]);
    const currency = String(d[15] || '').trim().toUpperCase();
    const avgVolume10d = numeric(d[16]);
    const rvol10 = numeric(d[17]);

    if (!ticker || close === null || close <= 0 || volume === null || volume < 0) continue;
    if (currency && currency !== 'EGP') continue;

    rows.push({
      ticker,
      name: String(d[1] || d[0] || ticker).trim(),
      sector: String(d[11] || '').trim(),
      industry: String(d[13] || '').trim(),
      close,
      changePct: changePct ?? 0,
      volume,
      avgVolume10d,
      rvol10,
      turnover: close * volume,
    });
  }

  return { capturedAt, rows };
}

export async function fetchSectorMomentumSnapshot(
  endpoint = '/api/egx/scan',
): Promise<SectorMomentumSnapshot> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ purpose: 'sector-momentum' }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Sector scanner HTTP ${response.status}`);
  }

  return parseSectorScannerResponse(await response.json());
}

export function findSectorMomentumBaseline(
  history: SectorMomentumSnapshot[],
  currentCapturedAt: number,
  config: SectorMomentumConfig = DEFAULT_SECTOR_MOMENTUM_CONFIG,
): SectorMomentumSnapshot | null {
  let best: SectorMomentumSnapshot | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const snapshot of history) {
    const age = currentCapturedAt - snapshot.capturedAt;
    if (age < config.baselineMinAgeMs || age > config.baselineMaxAgeMs) continue;
    const distance = Math.abs(age - config.baselineTargetAgeMs);
    if (distance < bestDistance) {
      best = snapshot;
      bestDistance = distance;
    }
  }

  return best;
}

export function detectSectorMomentumClusters(
  baseline: SectorMomentumSnapshot,
  current: SectorMomentumSnapshot,
  config: SectorMomentumConfig = DEFAULT_SECTOR_MOMENTUM_CONFIG,
): SectorClusterAlert[] {
  const elapsedMs = current.capturedAt - baseline.capturedAt;
  if (elapsedMs <= 0) return [];
  const windowMinutes = elapsedMs / 60_000;
  const baselineByTicker = new Map(baseline.rows.map((row) => [row.ticker, row]));
  const grouped = new Map<string, SectorMomentumMember[]>();

  for (const row of current.rows) {
    const previous = baselineByTicker.get(row.ticker);
    if (!previous || previous.close <= 0) continue;

    const grouping = groupForRow(row);
    if (!grouping) continue;

    const momentumPct = ((row.close / previous.close) - 1) * 100;
    const volumeDelta = Math.max(0, row.volume - previous.volume);
    const averageWindowPrice = (row.close + previous.close) / 2;
    const windowTurnover = volumeDelta * averageWindowPrice;
    const rvolDelta =
      row.rvol10 !== null && previous.rvol10 !== null
        ? row.rvol10 - previous.rvol10
        : null;

    const rvolRising =
      row.rvol10 !== null &&
      row.rvol10 >= config.minRvol &&
      rvolDelta !== null &&
      rvolDelta >= config.minRvolDelta;

    if (row.changePct <= 0) continue;
    if (momentumPct < config.minMomentumPct) continue;
    if (row.turnover < config.minCurrentTurnover) continue;
    if (windowTurnover < config.minWindowTurnover) continue;
    if (!rvolRising) continue;

    const activityScore =
      momentumPct * 45 +
      Math.min(row.rvol10 ?? 0, 5) * 10 +
      Math.max(0, Math.log10(Math.max(windowTurnover, 1)) - 5) * 8;

    const member: SectorMomentumMember = {
      ...row,
      ...grouping,
      baselinePrice: previous.close,
      baselineVolume: previous.volume,
      windowMinutes,
      momentumPct,
      volumeDelta,
      windowTurnover,
      rvolDelta,
      activityScore,
    };

    const members = grouped.get(grouping.groupKey) || [];
    members.push(member);
    grouped.set(grouping.groupKey, members);
  }

  const alerts: SectorClusterAlert[] = [];

  for (const [groupKey, unsortedMembers] of grouped) {
    if (unsortedMembers.length < config.minMemberCount) continue;

    const members = [...unsortedMembers].sort((a, b) => b.activityScore - a.activityScore);
    const totalWindowTurnover = members.reduce((sum, member) => sum + member.windowTurnover, 0);
    if (totalWindowTurnover < config.minGroupWindowTurnover) continue;

    const averageMomentumPct =
      members.reduce((sum, member) => sum + member.momentumPct, 0) / members.length;
    const rvolValues = members
      .map((member) => member.rvol10)
      .filter((value): value is number => value !== null);
    const averageRvol = rvolValues.length
      ? rvolValues.reduce((sum, value) => sum + value, 0) / rvolValues.length
      : null;
    const strengthScore =
      members.reduce((sum, member) => sum + member.activityScore, 0) / members.length +
      Math.min(members.length - config.minMemberCount, 4) * 5;

    alerts.push({
      id: `${current.capturedAt}:${groupKey}`,
      detectedAt: current.capturedAt,
      groupKey,
      groupName: members[0].groupName,
      groupType: members[0].groupType,
      memberCount: members.length,
      windowMinutes,
      averageMomentumPct,
      averageRvol,
      totalWindowTurnover,
      strengthScore,
      leader: members[0],
      runnerUp: members[1] || null,
      members,
    });
  }

  return alerts.sort((a, b) => b.strengthScore - a.strengthScore);
}
