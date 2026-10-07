import { describe, expect, it } from 'vitest';
import type { TradeTransaction } from '../types';
import type { CanonicalLedgerSnapshot } from './ledgerMutationService';
import { buildAuditTrailDraft } from './auditTrail';

function snapshot(transactions: TradeTransaction[], cashBalance = 1000): CanonicalLedgerSnapshot {
  return {
    transactions,
    positions: [],
    closedTrades: [],
    cashBalance,
    capitalDeposits: 1000,
    tickers: [],
  };
}

const buy: TradeTransaction = {
  id: 'tx-1',
  type: 'BUY',
  ticker: 'TEST',
  companyName: 'Test',
  sector: 'Other',
  shares: 10,
  price: 10,
  date: '2026-10-08',
  fees: 0,
  totalAmount: 100,
  netCashImpact: -100,
};

describe('audit trail diff builder', () => {
  it('captures a transaction creation with before/after financial context', () => {
    const draft = buildAuditTrailDraft(
      'BUY',
      snapshot([], 1000),
      snapshot([buy], 900),
      buy,
    );

    expect(draft).toMatchObject({
      mutationKind: 'BUY',
      entityType: 'TRANSACTION',
      entityId: 'tx-1',
      ticker: 'TEST',
      beforeState: {
        cashBalance: 1000,
        transaction: null,
      },
      afterState: {
        cashBalance: 900,
        transaction: { id: 'tx-1' },
      },
      metadata: {
        addedTransactionIds: ['tx-1'],
        removedTransactionIds: [],
      },
    });
  });

  it('captures edit reason and the actual before/after transaction', () => {
    const edited = { ...buy, price: 12, totalAmount: 120, netCashImpact: -120 };
    const draft = buildAuditTrailDraft(
      'EDIT_TRANSACTION',
      snapshot([buy], 900),
      snapshot([edited], 880),
      edited,
      'Correct broker receipt price',
    );

    expect(draft?.reason).toBe('Correct broker receipt price');
    expect(draft?.beforeState.transaction?.price).toBe(10);
    expect(draft?.afterState.transaction?.price).toBe(12);
    expect(draft?.metadata.changedTransactionIds).toEqual(['tx-1']);
  });


  it('classifies cash entry edits and deletions as CASH with the source row as entity', () => {
    const cashTx: TradeTransaction = {
      id: 'cash-1',
      type: 'BUY',
      ticker: 'CASH',
      companyName: 'Cash Deposit',
      sector: 'Liquid Buying Power',
      shares: 500,
      price: 1,
      date: '2026-10-07',
      fees: 0,
      totalAmount: 500,
      cashFlowType: 'DEPOSIT',
      cashFlowAmount: 500,
      netCashImpact: 500,
    };
    const edited = { ...cashTx, shares: 600, totalAmount: 600, cashFlowAmount: 600, netCashImpact: 600 };

    const editDraft = buildAuditTrailDraft(
      'EDIT_CASH_TRANSACTION',
      snapshot([cashTx], 1500),
      snapshot([edited], 1600),
      'cash-1',
      'Correct broker deposit receipt',
    );
    expect(editDraft).toMatchObject({
      entityType: 'CASH',
      entityId: 'cash-1',
      ticker: 'CASH',
      reason: 'Correct broker deposit receipt',
      metadata: { changedTransactionIds: ['cash-1'] },
    });

    const deleteDraft = buildAuditTrailDraft(
      'DELETE_CASH_TRANSACTION',
      snapshot([edited], 1600),
      snapshot([], 1000),
      'cash-1',
      'Duplicate deposit',
    );
    expect(deleteDraft).toMatchObject({
      entityType: 'CASH',
      entityId: 'cash-1',
      reason: 'Duplicate deposit',
      metadata: { removedTransactionIds: ['cash-1'] },
    });
  });

  it('classifies manual cash reconciliation adjustments as CASH', () => {
    const adjustment: TradeTransaction = {
      id: 'cash-adjust-1',
      type: 'BUY',
      ticker: 'CASH',
      companyName: 'Cash Reconciliation Adjustment',
      sector: 'Liquid Buying Power',
      shares: 75,
      price: 1,
      date: '2026-10-08',
      fees: 0,
      totalAmount: 75,
      cashFlowType: 'RECONCILIATION_ADJUSTMENT',
      cashFlowAmount: 75,
      netCashImpact: 75,
    };
    const draft = buildAuditTrailDraft(
      'RECONCILIATION_ADJUSTMENT',
      snapshot([], 1000),
      snapshot([adjustment], 1075),
      adjustment,
      'Match broker available cash',
    );
    expect(draft).toMatchObject({
      entityType: 'CASH',
      entityId: 'cash-adjust-1',
      reason: 'Match broker available cash',
    });
  });

  it('keeps restore/import audits at portfolio level even when many transaction rows change', () => {
    const replacement = { ...buy, id: 'tx-restored', price: 9, totalAmount: 90, netCashImpact: -90 };
    const draft = buildAuditTrailDraft(
      'RESTORE_PORTFOLIO',
      snapshot([buy], 900),
      snapshot([replacement], 910),
      { transactions: 1 },
      'Restore verified backup',
    );
    expect(draft).toMatchObject({
      entityType: 'PORTFOLIO_LEDGER',
      entityId: 'portfolio-ledger',
      ticker: undefined,
      reason: 'Restore verified backup',
      metadata: {
        addedTransactionIds: ['tx-restored'],
        removedTransactionIds: ['tx-1'],
      },
    });
  });

  it('returns null for a true no-op', () => {
    expect(buildAuditTrailDraft('RECONCILE_LEDGER', snapshot([buy]), snapshot([buy]))).toBeNull();
  });

  it('classifies lifecycle mutations explicitly', () => {
    const action: TradeTransaction = {
      ...buy,
      id: 'corp-1',
      type: 'CORPORATE_ACTION',
      shares: 1,
      price: 0,
      totalAmount: 0,
      netCashImpact: 0,
      corporateActionType: 'BONUS_SHARES',
    };
    const draft = buildAuditTrailDraft(
      'CORPORATE_ACTION_BONUS_SHARES',
      snapshot([buy]),
      snapshot([buy, action]),
      action,
    );
    expect(draft?.entityType).toBe('CORPORATE_ACTION');
  });
});
