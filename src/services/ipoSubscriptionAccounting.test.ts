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
  it('records HALN 6,600-share order with only 25% held and no false P&L or fake shares', () => {
    const original=snapshot([],100000);
    const prepared=prepareIpoSubscriptionMutation(original,{
      transactionId:'haln-hold',
      ticker:'HALN', companyName:'MNT-Halan',sector:'Other',
      requestedAmount:161700,reservedAmount:40425,offerPrice:24.5,
      subscriptionDate:'2026-10-07',
    });
    const report=reconcilePortfolioFromLedger(prepared.transactions,[],original.capitalDeposits);
    expect(report.discrepanciesFound).toEqual([]);
    expect(prepared.value?.ipoSubscription?.requestedShares).toBe(6600);
    expect(prepared.value?.ipoSubscription?.reservedAmount).toBe(40425);
    expect(report.reconciledCashBalance).toBe(59575);
    expect(report.reconciledPositions).toEqual([]);
    const metrics=calculatePortfolioMetrics([],report.reconciledCashBalance,[],[],prepared.transactions);
    expect(metrics.pendingIpoSubscriptionsEgp).toBe(40425);
    expect(metrics.totalValue).toBe(100000);
    expect(metrics.dayChangeEgp).toBe(0);
  });

  it('releases unused cash hold on partial allocation', () => {
    const order=prepareIpoSubscriptionMutation(snapshot([],100000),{
      transactionId:'ipo-partial',ticker:'HALN',companyName:'MNT-Halan',sector:'Other',
      requestedAmount:161700,reservedAmount:40425,offerPrice:24.5,subscriptionDate:'2026-10-07',
    });
    const allocation=prepareIpoAllocationMutation(snapshot(order.transactions,100000),{
      transactionId:'ipo-partial',allocatedShares:1000,allocationDate:'2026-10-15',
    });
    expect(allocation.value?.ipoSubscription?.refundAmount).toBe(15925);
    expect(allocation.value?.ipoSubscription?.additionalPaymentAmount).toBe(0);
    const result=reconcilePortfolioFromLedger(allocation.transactions,[],100000);
    expect(result.discrepanciesFound).toEqual([]);
    expect(result.reconciledCashBalance).toBe(75500);
    expect(result.reconciledPositions[0]).toMatchObject({ticker:'HALN',shares:1000,avgBuyPrice:24.5});
    const metrics=calculatePortfolioMetrics(result.reconciledPositions,result.reconciledCashBalance,[],[],allocation.transactions);
    expect(metrics.pendingIpoSubscriptionsEgp).toBe(0);
    expect(metrics.totalValue).toBe(100000);
  });

  it('requests only necessary additional cash when allocation exceeds broker hold', () => {
    const order=prepareIpoSubscriptionMutation(snapshot([],100000),{
      transactionId:'ipo-topup',ticker:'HALN',companyName:'MNT-Halan',sector:'Other',
      requestedAmount:161700,reservedAmount:40425,offerPrice:24.5,subscriptionDate:'2026-10-07',
    });
    const allocation=prepareIpoAllocationMutation(snapshot(order.transactions,100000),{
      transactionId:'ipo-topup',allocatedShares:2000,allocationDate:'2026-10-15',
    });
    expect(allocation.value?.ipoSubscription?.refundAmount).toBe(0);
    expect(allocation.value?.ipoSubscription?.additionalPaymentAmount).toBe(8575);
    const result=reconcilePortfolioFromLedger(allocation.transactions,[],100000);
    expect(result.reconciledCashBalance).toBe(51000);
    expect(result.discrepanciesFound).toEqual([]);
  });

  it('rejects additional cash due when available cash cannot cover allocation', () => {
    const order=prepareIpoSubscriptionMutation(snapshot([],41375.29),{
      transactionId:'ipo-insufficient',ticker:'HALN',companyName:'MNT-Halan',sector:'Other',
      requestedAmount:161700,reservedAmount:40425,offerPrice:24.5,subscriptionDate:'2026-10-07',
    });
    expect(()=>prepareIpoAllocationMutation(snapshot(order.transactions,41375.29),{
      transactionId:'ipo-insufficient',allocatedShares:2000,allocationDate:'2026-10-15',
    })).toThrow(/additional cash/);
  });

  it('cancels a partially reserved IPO by releasing the hold, not the full order', () => {
    const order=prepareIpoSubscriptionMutation(snapshot([],100000),{
      transactionId:'ipo-cancel-partial',ticker:'HALN',companyName:'MNT-Halan',sector:'Other',
      requestedAmount:161700,reservedAmount:40425,offerPrice:24.5,subscriptionDate:'2026-10-07',
    });
    const canceled=prepareIpoCancellationMutation(snapshot(order.transactions,100000),'ipo-cancel-partial');
    const result=reconcilePortfolioFromLedger(canceled.transactions,[],100000);
    expect(canceled.value?.ipoSubscription?.refundAmount).toBe(40425);
    expect(result.reconciledCashBalance).toBe(100000);
    expect(result.reconciledPositions).toEqual([]);
  });

  it('retains backward compatibility for previously full-reserved subscriptions',()=>{
    const full=prepareIpoSubscriptionMutation(snapshot([],200000),{
      transactionId:'legacy-compatible',ticker:'TEST',companyName:'Test',sector:'Other',
      requestedAmount:160000,offerPrice:8,subscriptionDate:'2026-10-08',
    });
    expect(full.value?.ipoSubscription?.reservedAmount).toBe(160000);
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
