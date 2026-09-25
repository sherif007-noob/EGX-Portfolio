import { describe, expect, it } from 'vitest';
import { calculateMonthlyAuditSummary } from './monthlyAuditSummary';

describe('monthly audit summary', () => {
  it('combines visible closed and holding P&L for the all-records view', () => {
    const summary = calculateMonthlyAuditSummary([
      { kind: 'LIQUIDATED', pnlEgp: 100, fees: 6 },
      { kind: 'HOLDING', pnlEgp: -250, fees: 4 },
    ]);

    expect(summary.totalPnlEgp).toBe(-150);
    expect(summary.totalFees).toBe(10);
    expect(summary.recordCount).toBe(2);
    expect(summary.closedCount).toBe(1);
    expect(summary.holdingCount).toBe(1);
    expect(summary.state).toBe('negative');
  });

  it('naturally follows the active filter because it summarizes only supplied visible records', () => {
    const closedOnly = calculateMonthlyAuditSummary([
      { kind: 'LIQUIDATED', pnlEgp: 120, fees: 5 },
    ]);
    const holdingsOnly = calculateMonthlyAuditSummary([
      { kind: 'HOLDING', pnlEgp: -80, fees: 3 },
      { kind: 'HOLDING', pnlEgp: 20, fees: 2 },
    ]);

    expect(closedOnly.totalPnlEgp).toBe(120);
    expect(closedOnly.closedCount).toBe(1);
    expect(closedOnly.holdingCount).toBe(0);

    expect(holdingsOnly.totalPnlEgp).toBe(-60);
    expect(holdingsOnly.closedCount).toBe(0);
    expect(holdingsOnly.holdingCount).toBe(2);
  });

  it('excludes breakeven closed trades from the win-rate denominator', () => {
    const summary = calculateMonthlyAuditSummary([
      { kind: 'LIQUIDATED', pnlEgp: 100, fees: 1 },
      { kind: 'LIQUIDATED', pnlEgp: -50, fees: 1 },
      { kind: 'LIQUIDATED', pnlEgp: 0, fees: 1 },
      { kind: 'HOLDING', pnlEgp: 200, fees: 1 },
    ]);

    expect(summary.wins).toBe(1);
    expect(summary.losses).toBe(1);
    expect(summary.breakevens).toBe(1);
    expect(summary.winRate).toBe(50);
  });
});
