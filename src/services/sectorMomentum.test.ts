import { describe, expect, it } from 'vitest';
import {
  detectSectorMomentumClusters,
  findSectorMomentumBaseline,
  type SectorMomentumSnapshot,
} from './sectorMomentum';

function row(
  ticker: string,
  close: number,
  volume: number,
  rvol10: number,
  changePct: number,
) {
  return {
    ticker,
    name: ticker,
    sector: 'Non-Energy Minerals',
    industry: 'Construction Materials',
    close,
    changePct,
    volume,
    avgVolume10d: 1_000_000,
    rvol10,
    turnover: close * volume,
  };
}

describe('sector momentum cluster detector', () => {
  it('detects three aligned cement names and ranks leader / runner-up', () => {
    const baseline: SectorMomentumSnapshot = {
      capturedAt: 1_000_000,
      rows: [
        row('ARCC', 60, 100_000, 1.05, 1.0),
        row('MCQE', 180, 50_000, 1.10, 1.0),
        row('SCEM', 75, 80_000, 1.00, 1.0),
      ],
    };
    const current: SectorMomentumSnapshot = {
      capturedAt: 1_420_000,
      rows: [
        row('ARCC', 60.60, 110_000, 1.35, 2.0),
        row('MCQE', 181.80, 53_000, 1.40, 2.1),
        row('SCEM', 75.60, 87_000, 1.30, 1.8),
      ],
    };

    const alerts = detectSectorMomentumClusters(baseline, current);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].groupName).toBe('Cement');
    expect(alerts[0].memberCount).toBe(3);
    expect(alerts[0].leader.ticker).toBe('MCQE');
    expect(alerts[0].runnerUp?.ticker).toBeTruthy();
  });

  it('does not alert when only two names qualify', () => {
    const baseline: SectorMomentumSnapshot = {
      capturedAt: 1_000_000,
      rows: [
        row('ARCC', 60, 100_000, 1.05, 1.0),
        row('MCQE', 180, 50_000, 1.10, 1.0),
        row('SCEM', 75, 80_000, 1.00, 1.0),
      ],
    };
    const current: SectorMomentumSnapshot = {
      capturedAt: 1_420_000,
      rows: [
        row('ARCC', 60.60, 110_000, 1.35, 2.0),
        row('MCQE', 181.80, 53_000, 1.40, 2.1),
        row('SCEM', 75.05, 80_100, 1.01, 1.1),
      ],
    };

    expect(detectSectorMomentumClusters(baseline, current)).toHaveLength(0);
  });

  it('selects the snapshot nearest the middle of the 5-10 minute window', () => {
    const currentAt = 1_000_000;
    const history: SectorMomentumSnapshot[] = [
      { capturedAt: currentAt - 5 * 60_000, rows: [] },
      { capturedAt: currentAt - 7 * 60_000, rows: [] },
      { capturedAt: currentAt - 10 * 60_000, rows: [] },
    ];

    expect(findSectorMomentumBaseline(history, currentAt)?.capturedAt)
      .toBe(currentAt - 7 * 60_000);
  });
});
