import { describe, expect, it } from 'vitest';
import type { TradeTransaction } from '../types';
import { calculatePortfolioMetrics } from '../utils/portfolioMetrics';
import { calculateIpoOrderQuote } from './ipoOrderQuote';
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
  it('saves the user-entered integer share count without deriving shares back from rounded cash', () => {
    const order=calculateIpoOrderQuote(4001,0.73,25);
    const prepared=prepareIpoSubscriptionMutation(snapshot([],10000),{
      transactionId:'shares-first',ticker:'IPOX',companyName:'Example IPO',sector:'Other',
      requestedShares:order.requestedShares,requestedAmount:order.requestedAmount,
      reservedAmount:order.reservedAmount,offerPrice:order.offerPrice,subscriptionDate:'2026-10-07',
    });
    expect(prepared.value?.shares).toBe(4001);
    expect(prepared.value?.ipoSubscription?.requestedShares).toBe(4001);
    expect(prepared.value?.ipoSubscription?.requestedAmount).toBe(2920.73);
    expect(prepared.value?.ipoSubscription?.reservedAmount).toBe(730.18);
    const reconciled=reconcilePortfolioFromLedger(prepared.transactions,[],10000);
    expect(reconciled.discrepanciesFound).toEqual([]);
    expect(reconciled.reconciledCashBalance).toBe(9269.82);
    expect(reconciled.reconciledPositions).toEqual([]);
    const metrics=calculatePortfolioMetrics([],reconciled.reconciledCashBalance,[],[],prepared.transactions);
    expect(metrics.totalValue).toBe(10000);
  });

  it('rejects a shares-first IPO order whose amount does not equal shares × price',()=>{
    expect(()=>prepareIpoSubscriptionMutation(snapshot([],10000),{
      transactionId:'inconsistent',ticker:'IPOX',companyName:'Example IPO',sector:'Other',
      requestedShares:4001,requestedAmount:2921.73,reservedAmount:730.18,
      offerPrice:0.73,subscriptionDate:'2026-10-07',
    })).toThrow(/does not match shares/);
  });

  it('rejects fractional shares even if the submitted EGP total is mathematically consistent',()=>{
    expect(()=>prepareIpoSubscriptionMutation(snapshot([],10000),{
      transactionId:'fractional',ticker:'IPOX',companyName:'Example IPO',sector:'Other',
      requestedShares:5.5,requestedAmount:137.5,reservedAmount:34.38,
      offerPrice:25,subscriptionDate:'2026-10-07',
    })).toThrow(/whole number/);
  });


  // Synthetic 25%-hold example; no real broker order values are stored here.
  const partialOrder = {
    transactionId:'ipo-demo',ticker:'IPOX',companyName:'Example IPO',sector:'Other' as const,
    requestedAmount:100000,reservedAmount:25000,offerPrice:25,subscriptionDate:'2026-10-07',
  };

  it('holds only 25% of the full commitment without creating shares or returns', () => {
    const prepared=prepareIpoSubscriptionMutation(snapshot([],100000),partialOrder);
    const report=reconcilePortfolioFromLedger(prepared.transactions,[],100000);
    expect(report.discrepanciesFound).toEqual([]);
    expect(prepared.value?.ipoSubscription?.requestedShares).toBe(4000);
    expect(prepared.value?.ipoSubscription?.reservedAmount).toBe(25000);
    expect(report.reconciledCashBalance).toBe(75000);
    expect(report.reconciledPositions).toEqual([]);
    const metrics=calculatePortfolioMetrics([],report.reconciledCashBalance,[],[],prepared.transactions);
    expect(metrics.pendingIpoSubscriptionsEgp).toBe(25000);
    expect(metrics.totalValue).toBe(100000);
    expect(metrics.dayChangeEgp).toBe(0);
  });

  it('releases only unused held cash on partial allocation', () => {
    const order=prepareIpoSubscriptionMutation(snapshot([],100000),partialOrder);
    const allocated=prepareIpoAllocationMutation(snapshot(order.transactions,100000),{
      transactionId:'ipo-demo',allocatedShares:400,allocationDate:'2026-10-15',
    });
    expect(allocated.value?.ipoSubscription?.refundAmount).toBe(15000);
    expect(allocated.value?.ipoSubscription?.additionalPaymentAmount).toBe(0);
    const report=reconcilePortfolioFromLedger(allocated.transactions,[],100000);
    expect(report.discrepanciesFound).toEqual([]);
    expect(report.reconciledCashBalance).toBe(90000);
    expect(report.reconciledPositions[0]).toMatchObject({ticker:'IPOX',shares:400,avgBuyPrice:25});
    const metrics=calculatePortfolioMetrics(report.reconciledPositions,report.reconciledCashBalance,[],[],allocated.transactions);
    expect(metrics.pendingIpoSubscriptionsEgp).toBe(0);
    expect(metrics.totalValue).toBe(100000);
  });

  it('charges only additional cash above the original reserve', () => {
    const order=prepareIpoSubscriptionMutation(snapshot([],100000),partialOrder);
    const allocated=prepareIpoAllocationMutation(snapshot(order.transactions,100000),{
      transactionId:'ipo-demo',allocatedShares:1200,allocationDate:'2026-10-15',
    });
    expect(allocated.value?.ipoSubscription?.refundAmount).toBe(0);
    expect(allocated.value?.ipoSubscription?.additionalPaymentAmount).toBe(5000);
    const report=reconcilePortfolioFromLedger(allocated.transactions,[],100000);
    expect(report.discrepanciesFound).toEqual([]);
    expect(report.reconciledCashBalance).toBe(70000);
  });

  it('prevents an allocation that needs more cash than is available', () => {
    const order=prepareIpoSubscriptionMutation(snapshot([],25100),partialOrder);
    expect(()=>prepareIpoAllocationMutation(snapshot(order.transactions,25100),{
      transactionId:'ipo-demo',allocatedShares:1200,allocationDate:'2026-10-15',
    })).toThrow(/additional cash/);
  });

  it('cancels and releases only the broker hold, not the full order', () => {
    const order=prepareIpoSubscriptionMutation(snapshot([],100000),partialOrder);
    const cancelled=prepareIpoCancellationMutation(snapshot(order.transactions,100000),'ipo-demo');
    const report=reconcilePortfolioFromLedger(cancelled.transactions,[],100000);
    expect(cancelled.value?.ipoSubscription?.refundAmount).toBe(25000);
    expect(report.reconciledCashBalance).toBe(100000);
    expect(report.reconciledPositions).toEqual([]);
  });

  it('defaults old records to the original full-reserve behavior',()=>{
    const old=prepareIpoSubscriptionMutation(snapshot([],200000),{
      transactionId:'ipo-legacy',ticker:'IPOX',companyName:'Example IPO',sector:'Other',
      requestedAmount:160000,offerPrice:8,subscriptionDate:'2026-10-08',
    });
    expect(old.value?.ipoSubscription?.reservedAmount).toBe(160000);
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
