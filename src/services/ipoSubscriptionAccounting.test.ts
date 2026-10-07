import { describe, expect, it } from 'vitest';
import type { TradeTransaction } from '../types';
import { calculatePortfolioMetrics } from '../utils/portfolioMetrics';
import {
  prepareIpoAllocationMutation,
  prepareIpoCancellationMutation,
  prepareIpoSubscriptionMutation,
} from './ledgerWorkflowMutations';
import type { CanonicalLedgerSnapshot } from './ledgerMutationService';
import { reconcilePortfolioFromLedger } from './portfolioReconciliation';

function snapshot(
  transactions: TradeTransaction[] = [],
  capitalDeposits = 200_000,
): CanonicalLedgerSnapshot {
  const report = reconcilePortfolioFromLedger(transactions, [], capitalDeposits);
  return {
    transactions,
    positions: report.reconciledPositions,
    closedTrades: report.reconciledClosedTrades,
    cashBalance: report.reconciledCashBalance,
    capitalDeposits,
    tickers: [],
  };
}

describe('IPO subscription ledger accounting', () => {
  it('moves submitted capital from available cash into a NAV-neutral pending IPO asset', () => {
    const current = snapshot([], 200_000);
    const prepared = prepareIpoSubscriptionMutation(current, {
      transactionId: 'ipo-1',
      ticker: 'HALN',
      companyName: 'MNT-Halan',
      sector: 'Non-Bank Financial Services & Fintech',
      requestedAmount: 160_000,
      offerPrice: 8,
      subscriptionDate: '2026-10-08',
      reference: 'TEST-IPO',
    });

    const report = reconcilePortfolioFromLedger(
      prepared.transactions,
      current.tickers,
      current.capitalDeposits,
      current.positions,
    );

    expect(report.discrepanciesFound).toEqual([]);
    expect(report.reconciledCashBalance).toBe(40_000);
    expect(report.reconciledPositions).toEqual([]);

    const metrics = calculatePortfolioMetrics(
      report.reconciledPositions,
      report.reconciledCashBalance,
      report.reconciledClosedTrades,
      [],
      prepared.transactions,
    );
    expect(metrics.pendingIpoSubscriptionsEgp).toBe(160_000);
    expect(metrics.totalValue).toBe(200_000);
  });

  it('settles allocation into shares and releases the unallocated reservation', () => {
    const submitted = prepareIpoSubscriptionMutation(snapshot([], 200_000), {
      transactionId: 'ipo-1',
      ticker: 'HALN',
      companyName: 'MNT-Halan',
      sector: 'Non-Bank Financial Services & Fintech',
      requestedAmount: 160_000,
      offerPrice: 8,
      subscriptionDate: '2026-10-08',
    });
    const submittedSnapshot = snapshot(submitted.transactions, 200_000);

    const allocated = prepareIpoAllocationMutation(submittedSnapshot, {
      transactionId: 'ipo-1',
      allocatedShares: 10_000,
      allocationDate: '2026-10-15',
    });

    const report = reconcilePortfolioFromLedger(
      allocated.transactions,
      [],
      200_000,
      submittedSnapshot.positions,
    );

    expect(report.discrepanciesFound).toEqual([]);
    expect(report.reconciledCashBalance).toBe(120_000);
    expect(report.reconciledPositions[0]).toMatchObject({
      ticker: 'HALN',
      shares: 10_000,
      avgBuyPrice: 8,
    });
    expect(allocated.value?.ipoSubscription?.refundAmount).toBe(80_000);
  });

  it('cancels a pending IPO without consuming cash or creating shares', () => {
    const submitted = prepareIpoSubscriptionMutation(snapshot([], 200_000), {
      transactionId: 'ipo-1',
      ticker: 'HALN',
      companyName: 'MNT-Halan',
      sector: 'Non-Bank Financial Services & Fintech',
      requestedAmount: 160_000,
      offerPrice: 8,
      subscriptionDate: '2026-10-08',
    });
    const current = snapshot(submitted.transactions, 200_000);
    const cancelled = prepareIpoCancellationMutation(current, 'ipo-1');
    const report = reconcilePortfolioFromLedger(cancelled.transactions, [], 200_000);

    expect(report.discrepanciesFound).toEqual([]);
    expect(report.reconciledCashBalance).toBe(200_000);
    expect(report.reconciledPositions).toEqual([]);
  });
});
