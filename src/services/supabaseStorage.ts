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

function deriveLedgerState(data: PortfolioDataDocument): PortfolioDataDocument {
  if (!Array.isArray(data.transactions)) return data;
  const report = reconcilePortfolioFromLedger(
    data.transactions,
    Array.isArray(data.tickers) ? data.tickers : [],
    typeof data.capitalDeposits === 'number' && data.capitalDeposits >= 0 ? data.capitalDeposits : 0,
    Array.isArray(data.positions) ? data.positions : [],
  );
  return {
    ...data,
    positions: report.reconciledPositions,
    closedTrades: report.reconciledClosedTrades,
    cashBalance: report.reconciledCashBalance,
  };
}

export async function loadPortfolioFromFirestore(): Promise<PortfolioDataDocument | null> {
  const data = await loadPortfolioFromSupabase();
  if (!data) return null;
  const reconciled = deriveLedgerState(data);
  updateLastSavedSnapshot(reconciled);
  return reconciled;
}

function enqueueSave(data: Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion' | 'lastPriceWriteAt'>): Promise<boolean> {
  const run = async () => {
    const canonical = deriveLedgerState(data);
    const fingerprint = generateFingerprint(canonical);
    if (fingerprint === lastSerializedPayload) return true;
    markLocalMutation(5000);
    const ok = await savePortfolioToSupabase(canonical);
    if (ok) updateLastSavedSnapshot({ ...canonical, updatedAt: new Date().toISOString(), schemaVersion: 3 });
    return ok;
  };
  const next = saveQueue.then(run, run);
  saveQueue = next.catch(() => false);
  return next;
}

export async function savePortfolioToFirestore(data: Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion' | 'lastPriceWriteAt'>, allowEmpty = false) {
  if (!allowEmpty && !(data.positions?.length || data.transactions?.length)) return false;
  return enqueueSave(data);
}

export function debouncedSavePortfolioToFirestore(data: Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion' | 'lastPriceWriteAt'>, delayMs = 1500) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    void savePortfolioToFirestore(data, true);
  }, delayMs);
}

export async function forceFullSyncToFirestore(data: Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion' | 'lastPriceWriteAt'>) {
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
export function updateFirestoreTransactions(transactions: TradeTransaction[], _positions?: Position[], _closedTrades?: ClosedTrade[], _cashBalance?: number, capitalDeposits?: number) {
  // The caller's derived projections are intentionally ignored. Rebuild them from the exact transaction ledger being written.
  const existingTickersPromise = loadPortfolioFromSupabase();
  return existingTickersPromise.then((current) => forceFullSyncToFirestore({
    positions: current?.positions ?? [],
    closedTrades: current?.closedTrades ?? [],
    transactions,
    cashBalance: current?.cashBalance ?? 0,
    capitalDeposits: capitalDeposits ?? current?.capitalDeposits,
    tickers: current?.tickers ?? [],
  }));
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
      const incoming = new Date(reconciled.updatedAt || 0).getTime();
      const known = lastKnownRemoteTimestamp ? new Date(lastKnownRemoteTimestamp).getTime() : 0;
      if (incoming && known && incoming <= known) return;
      if (generateFingerprint(reconciled) === lastSerializedPayload) return;
      updateLastSavedSnapshot(reconciled);
      onData(reconciled);
    } catch (error) {
      onError?.(error);
    }
  };
  void poll();
  const timer = setInterval(() => void poll(), 60_000);
  return () => { cancelled = true; clearInterval(timer); };
}
