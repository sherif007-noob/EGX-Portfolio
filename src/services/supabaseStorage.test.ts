import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { TradeTransaction } from '../types';
import type { SupabasePortfolioData } from './supabasePersistence';

vi.mock('./supabasePersistence', () => ({
  loadPortfolioFromSupabase: vi.fn(),
  savePortfolioToSupabase: vi.fn(),
  savePriceTickToSupabase: vi.fn(),
}));

import { loadPortfolioFromSupabase, savePortfolioToSupabase } from './supabasePersistence';

const buy = (id = 'buy-1'): TradeTransaction => ({
  id, type: 'BUY', ticker: 'TEST', companyName: 'Test', sector: 'Other',
  shares: 10, price: 10, fees: 1, totalAmount: 101, date: '2026-01-01',
});

describe('ledger storage mutations', () => {
  let storage: typeof import('./supabaseStorage');
  let remote: SupabasePortfolioData;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    storage = await import('./supabaseStorage');
    remote = {
      positions: [], closedTrades: [], transactions: [buy()], cashBalance: 899,
      capitalDeposits: 1000, tickers: [], updatedAt: '2026-01-01', schemaVersion: 3,
    };
    vi.mocked(loadPortfolioFromSupabase).mockImplementation(async () => structuredClone(remote));
    vi.mocked(savePortfolioToSupabase).mockImplementation(async (data) => {
      remote = { ...structuredClone(data), updatedAt: '2026-01-02', schemaVersion: 3 };
      return true;
    });
  });

  afterEach(() => vi.useRealTimers());

  it('persists same-ID date and note edits even when all balances are unchanged', async () => {
    await storage.loadPortfolioFromFirestore();
    const edited = { ...buy(), date: '2026-01-03', notes: 'Corrected execution' };
    expect(await storage.updateFirestoreTransactions([edited])).toBe(true);
    expect(savePortfolioToSupabase).toHaveBeenCalledOnce();
    const reloaded = await storage.loadPortfolioFromFirestore();
    expect(reloaded?.transactions).toEqual([edited]);
    expect(reloaded?.cashBalance).toBe(899);
  });

  it('ignores transaction and property ordering in the fingerprint', () => {
    const tx = buy();
    const reordered = Object.fromEntries(Object.entries(tx).reverse()) as unknown as TradeTransaction;
    expect(storage.generateFingerprint({ transactions: [tx, buy('buy-2')] }))
      .toBe(storage.generateFingerprint({ transactions: [buy('buy-2'), reordered] }));
  });

  it('recovers missing capital before rebuilding and persisting cash', async () => {
    expect(await storage.savePortfolioToFirestore({ ...remote, capitalDeposits: undefined })).toBe(true);
    expect(remote.capitalDeposits).toBe(1000);
    expect(remote.cashBalance).toBe(899);
    expect(remote.positions[0].shares).toBe(10);
  });

  it('serializes append reads and writes and makes retries idempotent', async () => {
    await Promise.all([
      storage.appendTransactionToFirestore(buy('buy-2')),
      storage.appendTransactionToFirestore(buy('buy-3')),
    ]);
    await storage.appendTransactionToFirestore(buy('buy-2'));
    expect(remote.transactions.map((tx) => tx.id).sort()).toEqual(['buy-1', 'buy-2', 'buy-3']);
    expect(remote.cashBalance).toBe(697);
    expect(remote.positions[0].shares).toBe(30);
  });

  it('calculates a queued cash adjustment from the latest saved ledger', async () => {
    await Promise.all([
      storage.appendTransactionToFirestore(buy('buy-2')),
      storage.updateFirestoreCashBalance(900),
    ]);
    expect(remote.transactions).toHaveLength(3);
    expect(remote.transactions.find((tx) => tx.cashFlowType === 'CASH_ADJUSTMENT')?.cashFlowAmount).toBe(102);
    expect(remote.cashBalance).toBe(900);
    expect(remote.capitalDeposits).toBe(1000);
  });

  it('does not let an older debounce restore a deleted transaction', async () => {
    vi.useFakeTimers();
    storage.debouncedSavePortfolioToFirestore(remote, 1500);
    await storage.updateFirestoreTransactions([]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(remote.transactions).toEqual([]);
    expect(remote.positions).toEqual([]);
    expect(remote.cashBalance).toBe(1000);
    expect(savePortfolioToSupabase).toHaveBeenCalledOnce();
  });

  it('refuses failed remote reads and can save after a failed write', async () => {
    vi.mocked(loadPortfolioFromSupabase).mockResolvedValueOnce(null);
    expect(await storage.appendTransactionToFirestore(buy('buy-2'))).toBe(false);
    expect(savePortfolioToSupabase).not.toHaveBeenCalled();
    vi.mocked(savePortfolioToSupabase).mockRejectedValueOnce(new Error('network failure'));
    await expect(storage.updateFirestoreTransactions([])).rejects.toThrow('network failure');
    expect(await storage.appendTransactionToFirestore(buy('buy-2'))).toBe(true);
    expect(remote.transactions).toHaveLength(2);
  });

  it('persists cash edits and deletions and reconstructs them on reload', async () => {
    const { applyCashLedgerEvent, changeCashLedgerEntry } = await import('./cashLedger');
    const deposited = applyCashLedgerEvent({ ...remote, capitalDeposits: 1000, tickers: [] }, 'DEPOSIT', 200, 'Bank', '2026-01-03');
    await storage.forceFullSyncToFirestore(deposited);
    const edited = changeCashLedgerEntry(deposited, deposited.transaction.id, { type: 'DEPOSIT', amount: 300, date: '2026-01-04' });
    await storage.forceFullSyncToFirestore(edited);
    const reloaded = await storage.loadPortfolioFromFirestore();
    expect(reloaded?.capitalDeposits).toBe(1300);
    expect(reloaded?.cashBalance).toBe(1199);
    expect(reloaded?.transactions.find(tx => tx.id === deposited.transaction.id)?.date).toBe('2026-01-04');
    const deleted = changeCashLedgerEntry(edited, deposited.transaction.id, null);
    await storage.forceFullSyncToFirestore(deleted);
    const final = await storage.loadPortfolioFromFirestore();
    expect(final?.capitalDeposits).toBe(1000);
    expect(final?.cashBalance).toBe(899);
    expect(final?.transactions.some(tx => tx.id === deposited.transaction.id)).toBe(false);
  });

  it('leaves the saved cash row intact after failure and permits a retry', async () => {
    const { applyCashLedgerEvent, changeCashLedgerEntry } = await import('./cashLedger');
    const deposited = applyCashLedgerEvent({ ...remote, capitalDeposits: 1000, tickers: [] }, 'DEPOSIT', 200);
    await storage.forceFullSyncToFirestore(deposited);
    const deleted = changeCashLedgerEntry(deposited, deposited.transaction.id, null);
    vi.mocked(savePortfolioToSupabase).mockResolvedValueOnce(false);
    expect(await storage.forceFullSyncToFirestore(deleted)).toBe(false);
    expect(remote.transactions.some(tx => tx.id === deposited.transaction.id)).toBe(true);
    expect(await storage.forceFullSyncToFirestore(deleted)).toBe(true);
    expect(remote.transactions.some(tx => tx.id === deposited.transaction.id)).toBe(false);
  });

});
