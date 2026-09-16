import { Position, ClosedTrade, TradeTransaction, EGXTicker } from '../types';
import { loadPortfolioFromSupabase, savePortfolioToSupabase, savePriceTickToSupabase } from './supabasePersistence';

export interface PortfolioDataDocument {
  positions: Position[]; closedTrades: ClosedTrade[]; transactions: TradeTransaction[]; cashBalance: number;
  capitalDeposits?: number; tickers?: EGXTicker[]; updatedAt: string; schemaVersion: number; lastPriceWriteAt?: string;
}
let lastSerializedPayload = '';
let lastKnownRemoteTimestamp: string | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let localMutationLockUntil = 0;
let lastPriceWriteTimestamp = 0;

export function generateFingerprint(data: Partial<PortfolioDataDocument>): string {
  const txIds = (data.transactions || []).map((t) => t.id).sort().join(',');
  const positions = (data.positions || []).map((p) => `${p.ticker}:${p.shares}:${p.avgBuyPrice}:${p.totalFees || 0}`).sort().join('|');
  const closed = (data.closedTrades || []).map((t) => `${t.id}:${t.realizedPnlEgp}:${t.shares}`).sort().join('|');
  return `${txIds}||${positions}||${closed}||${Number(data.cashBalance ?? 0).toFixed(6)}||${Number(data.capitalDeposits ?? 0).toFixed(6)}`;
}
export function updateLastSavedSnapshot(data: Partial<PortfolioDataDocument>) { lastSerializedPayload = generateFingerprint(data); if (data.updatedAt) lastKnownRemoteTimestamp = data.updatedAt; }
export function getLastSavedFingerprint() { return lastSerializedPayload; }
export function markLocalMutation(durationMs = 3000) { localMutationLockUntil = Date.now() + durationMs; }
export function isLocalMutationActive() { return Date.now() < localMutationLockUntil; }

// Compatibility exports retain existing hook call sites; they no longer touch Firestore.
export function getIsQuotaExceeded() { return false; }
export function subscribeToQuotaStatus(listener: (isExceeded: boolean) => void) { listener(false); return () => undefined; }
export async function forceRetrySync() { return { success: true, flushedCount: 0 }; }
export async function flushPendingWriteQueue() { return 0; }

export async function loadPortfolioFromFirestore(): Promise<PortfolioDataDocument | null> {
  const data = await loadPortfolioFromSupabase();
  if (data) updateLastSavedSnapshot(data);
  return data;
}
export async function savePortfolioToFirestore(data: Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion' | 'lastPriceWriteAt'>, allowEmpty = false) {
  if (!allowEmpty && !(data.positions?.length || data.transactions?.length)) return false;
  if (generateFingerprint(data) === lastSerializedPayload) return true;
  markLocalMutation(3500);
  const ok = await savePortfolioToSupabase(data);
  if (ok) updateLastSavedSnapshot({ ...data, updatedAt: new Date().toISOString(), schemaVersion: 3 });
  return ok;
}
export function debouncedSavePortfolioToFirestore(data: Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion' | 'lastPriceWriteAt'>, delayMs = 1500) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => { void savePortfolioToFirestore(data, true); }, delayMs);
}
export async function forceFullSyncToFirestore(data: Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion' | 'lastPriceWriteAt'>) {
  const ok = await savePortfolioToSupabase(data);
  if (ok) updateLastSavedSnapshot({ ...data, updatedAt: new Date().toISOString(), schemaVersion: 3 });
  return ok;
}
export function updateFirestorePositions(positions: Position[]) { return savePortfolioToFirestore({ positions, closedTrades: [], transactions: [], cashBalance: 0 }); }
export function updateFirestoreClosedTrades(closedTrades: ClosedTrade[]) { return savePortfolioToFirestore({ positions: [], closedTrades, transactions: [], cashBalance: 0 }); }
export function updateFirestoreCashBalance(cashBalance: number, capitalDeposits?: number) { return savePortfolioToFirestore({ positions: [], closedTrades: [], transactions: [], cashBalance, capitalDeposits }); }
export function updateFirestoreTickers(tickers: EGXTicker[]) { return savePortfolioToFirestore({ positions: [], closedTrades: [], transactions: [], cashBalance: 0, tickers }); }
export function updateFirestoreTransactions(transactions: TradeTransaction[], positions?: Position[], closedTrades?: ClosedTrade[], cashBalance?: number, capitalDeposits?: number) {
  return forceFullSyncToFirestore({ transactions, positions: positions || [], closedTrades: closedTrades || [], cashBalance: typeof cashBalance === 'number' ? cashBalance : 0, capitalDeposits });
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
      if (!data || cancelled) return;
      const incoming = new Date(data.updatedAt || 0).getTime();
      const known = lastKnownRemoteTimestamp ? new Date(lastKnownRemoteTimestamp).getTime() : 0;
      if (incoming && known && incoming <= known) return;
      if (generateFingerprint(data) === lastSerializedPayload) return;
      updateLastSavedSnapshot(data);
      onData(data);
    } catch (error) { onError?.(error); }
  };
  void poll();
  const timer = setInterval(() => void poll(), 60_000);
  return () => { cancelled = true; clearInterval(timer); };
}