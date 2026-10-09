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
  it('stores a 25% broker hold without reducing NAV or owning requested shares',()=>{
    const start=snapshot([],200000);
    const recorded=prepareIpoSubscriptionMutation(start,{
      transactionId:'ipo-partial-test',ticker:'IPOX',companyName:'Synthetic IPO',sector:'Other',
      requestedAmount:100000,requestedShares:4000,reservedAmount:25000,offerPrice:25,
      subscriptionDate:'2026-10-07',
    });
    expect(recorded.value?.ipoSubscription?.reservedAmount).toBe(25000);
    expect(recorded.value?.netCashImpact).toBe(-25000);
    const result=reconcilePortfolioFromLedger(recorded.transactions,[],200000);
    expect(result.discrepanciesFound).toEqual([]);
    expect(result.reconciledCashBalance).toBe(175000);
    expect(result.reconciledPositions).toEqual([]);
    const metrics=calculatePortfolioMetrics([],175000,[],[],recorded.transactions);
    expect(metrics.pendingIpoSubscriptionsEgp).toBe(25000);
    expect(metrics.totalValue).toBe(200000);
  });

  it('partially allocated IPO refunds unused broker hold and keeps NAV consistent',()=>{
    const prior=prepareIpoSubscriptionMutation(snapshot([],200000),{
      transactionId:'ipo-partial-test',ticker:'IPOX',companyName:'Synthetic IPO',sector:'Other',
      requestedAmount:100000,reservedAmount:25000,offerPrice:25,subscriptionDate:'2026-10-07',
    });
    const settled=prepareIpoAllocationMutation(snapshot(prior.transactions,200000),{
      transactionId:'ipo-partial-test',allocatedShares:100,allocationDate:'2026-10-12',
    });
    expect(settled.value?.ipoSubscription?.refundAmount).toBe(22500);
    expect(settled.value?.ipoSubscription?.additionalPaymentAmount).toBe(0);
    const result=reconcilePortfolioFromLedger(settled.transactions,[],200000);
    expect(result.discrepanciesFound).toEqual([]);
    expect(result.reconciledCashBalance).toBe(197500);
    expect(result.reconciledPositions[0]).toMatchObject({ticker:'IPOX',shares:100,avgBuyPrice:25});
  });

  it('IPO allocation above hold consumes only the additional cash needed',()=>{
    const prior=prepareIpoSubscriptionMutation(snapshot([],200000),{
      transactionId:'ipo-topup-test',ticker:'IPOX',companyName:'Synthetic IPO',sector:'Other',
      requestedAmount:100000,reservedAmount:25000,offerPrice:25,subscriptionDate:'2026-10-07',
    });
    const settled=prepareIpoAllocationMutation(snapshot(prior.transactions,200000),{
      transactionId:'ipo-topup-test',allocatedShares:2000,allocationDate:'2026-10-12',
    });
    expect(settled.value?.ipoSubscription?.refundAmount).toBe(0);
    expect(settled.value?.ipoSubscription?.additionalPaymentAmount).toBe(25000);
    const result=reconcilePortfolioFromLedger(settled.transactions,[],200000);
    expect(result.discrepanciesFound).toEqual([]);
    expect(result.reconciledCashBalance).toBe(150000);
  });

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
