import {
  cairoDateKey,
  latestIntradaySessionDate,
  normalizeIntradayTicker,
  type IntradayPriceSeries,
} from './intradayPriceStore';

export interface IntradayResolutionCandidate {
  intervalMinutes: number;
  series: IntradayPriceSeries;
}

export interface SelectedIntradayResolution {
  intervalMinutes: number;
  series: IntradayPriceSeries;
  sessionDate: string;
  coveredTickers: string[];
  referenceTickers: string[];
}

export function sessionCoveredTickers(
  series: IntradayPriceSeries,
  sessionDate: string,
  expectedTickers: string[] = [],
): string[] {
  const expected = new Set(
    expectedTickers.map(normalizeIntradayTicker).filter(Boolean),
  );
  const covered = new Set<string>();

  for (const [rawTicker, bars] of Object.entries(series)) {
    const ticker = normalizeIntradayTicker(rawTicker);
    if (!ticker || (expected.size && !expected.has(ticker))) continue;
    if (bars.some((bar) => cairoDateKey(bar.timestamp) === sessionDate)) {
      covered.add(ticker);
    }
  }

  return [...covered].sort();
}

export function selectBestIntradayResolution(
  candidates: IntradayResolutionCandidate[],
  expectedTickers: string[],
  notAfterDate: string,
): SelectedIntradayResolution | null {
  const expected = [...new Set(expectedTickers.map(normalizeIntradayTicker).filter(Boolean))];
  const normalizedCandidates = candidates
    .filter((candidate) => Number.isFinite(candidate.intervalMinutes) && candidate.intervalMinutes > 0)
    .map((candidate) => ({
      ...candidate,
      sessionDate: latestIntradaySessionDate(candidate.series, notAfterDate),
    }));

  const latestSessionDate = normalizedCandidates
    .map((candidate) => candidate.sessionDate)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  if (!latestSessionDate) return null;

  const coverageByInterval = normalizedCandidates
    .filter((candidate) => candidate.sessionDate === latestSessionDate)
    .map((candidate) => ({
      ...candidate,
      coveredTickers: sessionCoveredTickers(candidate.series, latestSessionDate, expected),
    }));

  const reference = new Set<string>();
  for (const candidate of coverageByInterval) {
    for (const ticker of candidate.coveredTickers) reference.add(ticker);
  }
  if (!reference.size) return null;

  const referenceTickers = [...reference].sort();
  const ordered = [...coverageByInterval].sort(
    (a, b) => a.intervalMinutes - b.intervalMinutes,
  );

  // Prefer the finest resolution only when it has the same ticker breadth as
  // the best data available for that session. This prevents a partial 1m
  // migration (for example ACTF only) from displacing a complete 5m session.
  const complete = ordered.find((candidate) =>
    referenceTickers.every((ticker) => candidate.coveredTickers.includes(ticker)),
  );

  const selected =
    complete ??
    [...ordered].sort((a, b) => {
      const coverageDelta = b.coveredTickers.length - a.coveredTickers.length;
      return coverageDelta || a.intervalMinutes - b.intervalMinutes;
    })[0];

  if (!selected) return null;

  return {
    intervalMinutes: selected.intervalMinutes,
    series: selected.series,
    sessionDate: latestSessionDate,
    coveredTickers: selected.coveredTickers,
    referenceTickers,
  };
}
