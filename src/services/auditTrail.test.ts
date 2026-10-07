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
