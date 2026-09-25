export type MonthlyAuditSummaryKind = 'LIQUIDATED' | 'HOLDING';

export interface MonthlyAuditSummaryRecord {
  kind: MonthlyAuditSummaryKind;
  pnlEgp: number;
  fees: number;
}

export interface MonthlyAuditSummary {
  totalPnlEgp: number;
  totalFees: number;
  recordCount: number;
  closedCount: number;
  holdingCount: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number | null;
  state: 'positive' | 'negative' | 'neutral';
}

const DECISIVE_EPSILON = 0.01;

export function calculateMonthlyAuditSummary(records: MonthlyAuditSummaryRecord[]): MonthlyAuditSummary {
  const liquidated = records.filter((record) => record.kind === 'LIQUIDATED');
  const wins = liquidated.filter((record) => record.pnlEgp > DECISIVE_EPSILON).length;
  const losses = liquidated.filter((record) => record.pnlEgp < -DECISIVE_EPSILON).length;
  const breakevens = liquidated.length - wins - losses;
  const decisive = wins + losses;
  const totalPnlEgp = records.reduce((sum, record) => sum + (Number.isFinite(record.pnlEgp) ? record.pnlEgp : 0), 0);
  const totalFees = records.reduce((sum, record) => sum + (Number.isFinite(record.fees) ? record.fees : 0), 0);

  return {
    totalPnlEgp,
    totalFees,
    recordCount: records.length,
    closedCount: liquidated.length,
    holdingCount: records.length - liquidated.length,
    wins,
    losses,
    breakevens,
    winRate: decisive > 0 ? (wins / decisive) * 100 : null,
    state:
      totalPnlEgp > DECISIVE_EPSILON
        ? 'positive'
        : totalPnlEgp < -DECISIVE_EPSILON
          ? 'negative'
          : 'neutral',
  };
}
