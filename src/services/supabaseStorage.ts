import { Position, ClosedTrade, TradeTransaction, EGXTicker } from '../types';
import { loadPortfolioFromSupabase, savePortfolioToSupabase, savePriceTickToSupabase } from './supabasePersistence';
import { reconcilePortfolioFromLedger } from './portfolioReconciliation';

export interface PortfolioDataDocument {
  positions: Position[];
  closedTrades: ClosedTrade[];
  transactions: TradeTransaction[];
  cashBalance: number;
  capitalDeposits?: number;
  tickers?: EGXTicker[];
  updatedAt: string;
  schemaVersion: number;
  lastPriceWriteAt?: string;
}

type PortfolioWrite = Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion' | 'lastPriceWriteAt'>;

let lastSerializedPayload = '';
let lastKnownRemoteTimestamp: string | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let localMutationLockUntil = 0;
let lastPriceWriteTimestamp = 0;
let saveQueue: Promise<boolean> = Promise.resolve(true);

export function generateFingerprint(data: Partial<PortfolioDataDocument>): string {
  const txIds = (data.transactions || []).map((t) => t.id).sort().join(',');
  const positions = (data.positions || []).map((p) => `${p.ticker}:${p.shares}:${p.avgBuyPrice}:${p.totalFees || 0}`).sort().join('|');
  const closed = (data.closedTrades || []).map((t) => `${t.id}:${t.realizedPnlEgp}:${t.shares}`).sort().join('|');
  return `${txIds}||${positions}||${closed}||${Number(data.cashBalance ?? 0).toFixed(6)}||${Number(data.capitalDeposits ?? 0).toFixed(6)}`;
}

export function updateLastSavedSnapshot(data: Partial<PortfolioDataDocument>) {
  lastSerializedPayload = generateFingerprint(data);
  if (data.updatedAt) lastKnownRemoteTimestamp = data.updatedAt;
}
export function getLastSavedFingerprint() { return lastSerializedPayload; }
export function markLocalMutation(durationMs = 5000) { localMutationLockUntil = Math.max(localMutationLockUntil, Date.now() + durationMs); }
export function isLocalMutationActive() { return Date.now() < localMutationLockUntil; }
export function getIsQuotaExceeded() { return false; }
export function subscribeToQuotaStatus(listener: (isExceeded: boolean) => void) { listener(false); return () => undefined; }
export async function forceRetrySync() { return { success: true, flushedCount: 0 }; }
export async function flushPendingWriteQueue() { return 0; }

function deriveLedgerState(data: Partial<PortfolioDataDocument>): PortfolioWrite {
  const transactions = Array.isArray(data.transactions) ? data.transactions : [];
  const tickers = Array.isArray(data.tickers) ? data.tickers : [];
  const capitalDeposits = typeof data.capitalDeposits === 'number' && data.capitalDeposits >= 0 ? data.capitalDeposits : 0;
  const report = reconcilePortfolioFromLedger(transactions, tickers, capitalDeposits, Array.isArray(data.positions) ? data.positions : []);
  return {
    positions: report.reconciledPositions,
    closedTrades: report.reconciledClosedTrades,
    transactions,
    cashBalance: report.reconciledCashBalance,
    capitalDeposits: data.capitalDeposits,
    tickers,
  };
}

export async function loadPortfolioFromFirestore(): Promise<PortfolioDataDocument | null> {
  const data = await loadPortfolioFromSupabase();
  if (!data) return null;
  const reconciled = deriveLedgerState(data);
  const snapshot = { ...reconciled, updatedAt: data.updatedAt, schemaVersion: data.schemaVersion, lastPriceWriteAt: data.lastPriceWriteAt };
  updateLastSavedSnapshot(snapshot);
  return snapshot;
}

function enqueueSave(data: PortfolioWrite): Promise<boolean> {
  const run = async () => {
    const canonical = deriveLedgerState(data);
    let complete = canonical;

    // Some legacy callers omit capitalDeposits. Never replace it with zero;
    // recover the current remote value before issuing a complete snapshot save.
    if (typeof complete.capitalDeposits !== 'number' || !Number.isFinite(complete.capitalDeposits)) {
      const current = await loadPortfolioFromSupabase();
      if (!current || typeof current.capitalDeposits !== 'number' || !Number.isFinite(current.capitalDeposits)) {
        console.error('[Supabase] Refusing to save an incomplete portfolio snapshot: capitalDeposits is unavailable.');
        return false;
      }
      complete = { ...complete, capitalDeposits: current.capitalDeposits };
    }

    const fingerprint = generateFingerprint(complete);
    if (fingerprint === lastSerializedPayload) return true;
    markLocalMutation(5000);
    const ok = await savePortfolioToSupabase(complete);
    if (ok) updateLastSavedSnapshot({ ...complete, updatedAt: new Date().toISOString(), schemaVersion: 3 });
    return ok;
  };
  const next = saveQueue.then(run, run);
  saveQueue = next.catch(() => false);
  return next;
}

export async function savePortfolioToFirestore(data: PortfolioWrite, allowEmpty = false) {
  if (!allowEmpty && !(data.positions?.length || data.transactions?.length)) return false;
  return enqueueSave(data);
}

export function debouncedSavePortfolioToFirestore(data: PortfolioWrite, delayMs = 1500) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    void savePortfolioToFirestore(data, true);
  }, delayMs);
}

export async function forceFullSyncToFirestore(data: PortfolioWrite) {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  markLocalMutation(7500);
  return enqueueSave(data);
}

async function mergeAndSave(patch: Partial<PortfolioDataDocument>) {
  const current = await loadPortfolioFromSupabase();
  if (!current) return false;
  const canonical = deriveLedgerState(current);
  return savePortfolioToFirestore({
    positions: patch.positions ?? canonical.positions,
    closedTrades: patch.closedTrades ?? canonical.closedTrades,
    transactions: patch.transactions ?? canonical.transactions,
    cashBalance: patch.cashBalance ?? canonical.cashBalance,
    capitalDeposits: patch.capitalDeposits ?? canonical.capitalDeposits,
    tickers: patch.tickers ?? canonical.tickers,
  }, true);
}

export function updateFirestorePositions(positions: Position[]) { return mergeAndSave({ positions }); }
export function updateFirestoreClosedTrades(closedTrades: ClosedTrade[]) { return mergeAndSave({ closedTrades }); }
export function updateFirestoreCashBalance(cashBalance: number, capitalDeposits?: number) { return mergeAndSave({ cashBalance, ...(capitalDeposits === undefined ? {} : { capitalDeposits }) }); }
export function updateFirestoreTickers(tickers: EGXTicker[]) { return mergeAndSave({ tickers }); }

export async function updateFirestoreTransactions(transactions: TradeTransaction[], _positions?: Position[], _closedTrades?: ClosedTrade[], _cashBalance?: number, capitalDeposits?: number) {
  const current = await loadPortfolioFromSupabase();
  if (!current) {
    console.error('[Supabase] Refusing transaction save because the remote portfolio could not be loaded.');
    return false;
  }
  const canonicalCurrent = deriveLedgerState(current);
  return forceFullSyncToFirestore({
    positions: canonicalCurrent.positions,
    closedTrades: canonicalCurrent.closedTrades,
    transactions,
    cashBalance: canonicalCurrent.cashBalance,
    capitalDeposits: capitalDeposits ?? canonicalCurrent.capitalDeposits,
    tickers: canonicalCurrent.tickers,
  });
}

export function appendTransactionToFirestore(tx: TradeTransaction, positions?: Position[], closedTrades?: ClosedTrade[], cashBalance?: number, capitalDeposits?: number) { return updateFirestoreTransactions([tx], positions, closedTrades, cashBalance, capitalDeposits); }

export async function savePriceTickToFirestore(positions: Position[], tickers: EGXTicker[], force = false) {
  const now = Date.now();
  if (!force && now - lastPriceWriteTimestamp < 15 * 60 * 1000) return false;
  const ok = await savePriceTickToSupabase(positions, tickers, force);
  if (ok) lastPriceWriteTimestamp = now;
  return ok;
}

export function subscribeToPortfolioFromFirestore(onData: (data: PortfolioDataDocument) => void, onError?: (err: any) => void) {
  let cancelled = false;
  const poll = async () => {
    try {
      if (cancelled || isLocalMutationActive()) return;
      const data = await loadPortfolioFromSupabase();
      if (!data || cancelled || isLocalMutationActive()) return;
      const reconciled = deriveLedgerState(data);
      const incoming = new Date(data.updatedAt || 0).getTime();
      const known = lastKnownRemoteTimestamp ? new Date(lastKnownRemoteTimestamp).getTime() : 0;
      if (incoming && known && incoming <= known) return;
      const snapshot = { ...reconciled, updatedAt: data.updatedAt, schemaVersion: data.schemaVersion, lastPriceWriteAt: data.lastPriceWriteAt };
      if (generateFingerprint(snapshot) === lastSerializedPayload) return;
      updateLastSavedSnapshot(snapshot);
      onData(snapshot);
    } catch (error) {
      onError?.(error);
    }
  };
  void poll();
  const timer = setInterval(() => void poll(), 60_000);
  return () => { cancelled = true; clearInterval(timer); };
}
