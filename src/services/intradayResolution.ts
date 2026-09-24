import {
  cairoDateKey,
  latestIntradaySessionDate,
  normalizeIntradayTicker,
  type IntradayPriceSeries,
} from './intradayPriceStore';
import { INTRADAY_POLICY } from './intradayPolicy';

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

interface SessionCoverageWindow {
  ticker: string;
  firstMs: number;
  lastMs: number;
  bars: number;
}

export function sessionCoveredTickers(
  series: IntradayPriceSeries,
  sessionDate: string,
  expectedTickers: string[] = [],
): string[] {
  return sessionCoverageWindows(series, sessionDate, expectedTickers)
    .map((window) => window.ticker)
    .sort();
}

export function sessionCoverageWindows(
  series: IntradayPriceSeries,
  sessionDate: string,
  expectedTickers: string[] = [],
): SessionCoverageWindow[] {
  const expected = new Set(
    expectedTickers.map(normalizeIntradayTicker).filter(Boolean),
  );
  const windows: SessionCoverageWindow[] = [];

  for (const [rawTicker, bars] of Object.entries(series)) {
    const ticker = normalizeIntradayTicker(rawTicker);
    if (!ticker || (expected.size && !expected.has(ticker))) continue;

    const sessionBars = bars
      .filter((bar) => cairoDateKey(bar.timestamp) === sessionDate)
      .map((bar) => new Date(bar.timestamp).getTime())
      .filter(Number.isFinite)
      .sort((a, b) => a - b);

    if (!sessionBars.length) continue;
    windows.push({
      ticker,
      firstMs: sessionBars[0],
      lastMs: sessionBars[sessionBars.length - 1],
      bars: sessionBars.length,
    });
  }

  return windows.sort((a, b) => a.ticker.localeCompare(b.ticker));
}

function candidateHasComparableSessionEnvelope(
  candidate: IntradayResolutionCandidate & {
    coveredTickers: string[];
    windows: SessionCoverageWindow[];
  },
  allCandidates: Array<IntradayResolutionCandidate & {
    coveredTickers: string[];
    windows: SessionCoverageWindow[];
  }>,
  referenceTickers: string[],
): boolean {
  const maxConfiguredInterval = Math.max(...INTRADAY_POLICY.readIntervals);
  const toleranceMs = Math.max(candidate.intervalMinutes, maxConfiguredInterval) * 60_000;
  const candidateByTicker = new Map(candidate.windows.map((window) => [window.ticker, window]));

  for (const ticker of referenceTickers) {
    const current = candidateByTicker.get(ticker);
    if (!current) return false;

    const peers = allCandidates
      .flatMap((peer) => peer.windows)
      .filter((window) => window.ticker === ticker);
    if (!peers.length) continue;

    const referenceFirst = Math.min(...peers.map((window) => window.firstMs));
    const referenceLast = Math.max(...peers.map((window) => window.lastMs));

    // Do not let a tiny late/early fine-resolution sample win merely because
    // it contains every ticker. Legitimate illiquidity is preserved because
    // we compare the observed session envelope across resolutions rather than
    // demanding a candle for every minute.
    if (current.firstMs > referenceFirst + toleranceMs) return false;
    if (current.lastMs < referenceLast - toleranceMs) return false;
  }

  return true;
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
    .map((candidate) => {
      const windows = sessionCoverageWindows(candidate.series, latestSessionDate, expected);
      return {
        ...candidate,
        windows,
        coveredTickers: windows.map((window) => window.ticker),
      };
    });

  const reference = new Set<string>();
  for (const candidate of coverageByInterval) {
    for (const ticker of candidate.coveredTickers) reference.add(ticker);
  }
  if (!reference.size) return null;

  const referenceTickers = [...reference].sort();
  const ordered = [...coverageByInterval].sort(
    (a, b) => a.intervalMinutes - b.intervalMinutes,
  );

  const complete = ordered.find((candidate) =>
    referenceTickers.every((ticker) => candidate.coveredTickers.includes(ticker)) &&
    candidateHasComparableSessionEnvelope(
      candidate,
      coverageByInterval,
      referenceTickers,
    ),
  );

  const selected =
    complete ??
    [...ordered]
      .filter((candidate) =>
        candidateHasComparableSessionEnvelope(
          candidate,
          coverageByInterval,
          candidate.coveredTickers,
        ),
      )
      .sort((a, b) => {
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
