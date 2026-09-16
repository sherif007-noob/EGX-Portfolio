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

function deriveLedgerState(data: Partial<PortfolioDataDocument>): PortfolioDataDocument {
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
    updatedAt: data.updatedAt || new Date().toISOString(),
    schemaVersion: data.schemaVersion || 3,
    lastPriceWriteAt: data.lastPriceWriteAt,
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
    // Canonicalize every portfolio write from the ledger immediately before persistence.
    // This prevents stale positions/cash/closed-trade projections from surviving a ledger mutation.
    const canonical = deriveLedgerState(data);
    const fingerprint = generateFingerprint(canonical);
    if (fingerprint === lastSerializedPayload) return true;
    markLocalMutation(5000);
    const ok = await savePortfolioToSupabase({
      positions: canonical.positions,
      closedTrades: canonical.closedTrades,
      transactions: canonical.transactions,
      cashBalance: canonical.cashBalance,
      capitalDeposits: canonical.capitalDeposits,
      tickers: canonical.tickers,
    });
    if (ok) updateLastSavedSnapshot({ ...canonical, updatedAt: new Date().toISOString(), schemaVersion: 3 });
    return ok;
  };
  const next = saveQueue.then(run, run);
  saveQueue = next.catch(() => false);
  return next;
}

export async function savePortfolioToFirestore(
  data: Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion' | 'lastPriceWriteAt'>,
  allowEmpty = false,
) {
  if (!allowEmpty && !(data.positions?.length || data.transactions?.length)) return false;
  return enqueueSave(data);
}

export function debouncedSavePortfolioToFirestore(
  data: Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion' | 'lastPriceWriteAt'>,
  delayMs = 1500,
) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    void savePortfolioToFirestore(data, true);
  }, delayMs);
}

export async function forceFullSyncToFirestore(
  data: Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion' | 'lastPriceWriteAt'>,
) {
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
  const currentCanonical = deriveLedgerState(current);
  return savePortfolioToFirestore({
    positions: patch.positions ?? currentCanonical.positions,
    closedTrades: patch.closedTrades ?? currentCanonical.closedTrades,
    transactions: patch.transactions ?? currentCanonical.transactions,
    cashBalance: patch.cashBalance ?? currentCanonical.cashBalance,
    capitalDeposits: patch.capitalDeposits ?? currentCanonical.capitalDeposits,
    tickers: patch.tickers ?? currentCanonical.tickers,
  }, true);
}

export function updateFirestorePositions(positions: Position[]) { return mergeAndSave({ positions }); }
export function updateFirestoreClosedTrades(closedTrades: ClosedTrade[]) { return mergeAndSave({ closedTrades }); }
export function updateFirestoreCashBalance(cashBalance: number, capitalDeposits?: number) {
  return mergeAndSave({ cashBalance, ...(capitalDeposits === undefined ? {} : { capitalDeposits }) });
}
export function updateFirestoreTickers(tickers: EGXTicker[]) { return mergeAndSave({ tickers }); }
export function updateFirestoreTransactions(
  transactions: TradeTransaction[],
  _positions?: Position[],
  _closedTrades?: ClosedTrade[],
  _cashBalance?: number,
  capitalDeposits?: number,
) {
  // Derived arguments are intentionally ignored. The ledger is authoritative.
  return forceFullSyncToFirestore({
    transactions,
    positions: [],
    closedTrades: [],
    cashBalance: 0,
    capitalDeposits,
  });
}
export function appendTransactionToFirestore(tx: TradeTransaction, positions?: Position[], closedTrades?: ClosedTrade[], cashBalance?: number, capitalDeposits?: number) {
  return updateFirestoreTransactions([tx], positions, closedTrades, cashBalance, capitalDeposits);
}

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
