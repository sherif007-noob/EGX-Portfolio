import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Position, ClosedTrade, TradeTransaction, EGXTicker } from '../types';
import { auth, ensureAuthUser } from './firebaseAuth';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create', UPDATE = 'update', DELETE = 'delete', LIST = 'list', GET = 'get', WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo?: { userId?: string | null; email?: string | null; emailVerified?: boolean | null; isAnonymous?: boolean | null };
}

const STORAGE_KEY_WRITE_QUEUE = 'egx_firestore_write_queue_v1';
export interface QueuedWriteAction { id: string; type: 'full_save' | 'patch'; payload: any; timestamp: number; }

let quotaExceededState = false;
const quotaListeners: Array<(isExceeded: boolean) => void> = [];
let localMutationLockUntil = 0;
let lastKnownRemoteTimestamp: string | null = null;
let lastSerializedPayload = '';
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let isFlushingQueue = false;

export function getIsQuotaExceeded(): boolean { return quotaExceededState; }
export function subscribeToQuotaStatus(listener: (isExceeded: boolean) => void): () => void {
  quotaListeners.push(listener); listener(quotaExceededState);
  return () => { const i = quotaListeners.indexOf(listener); if (i >= 0) quotaListeners.splice(i, 1); };
}
export function setQuotaExceeded(exceeded: boolean) {
  if (quotaExceededState === exceeded) return;
  quotaExceededState = exceeded;
  quotaListeners.forEach((listener) => listener(exceeded));
}
export function markLocalMutation(durationMs = 3000) { localMutationLockUntil = Date.now() + durationMs; }
export function isLocalMutationActive() { return Date.now() < localMutationLockUntil; }

function getQueuedWrites(): QueuedWriteAction[] {
  try { const raw = localStorage.getItem(STORAGE_KEY_WRITE_QUEUE); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveQueuedWrites(queue: QueuedWriteAction[]) {
  try {
    if (queue.length === 0) localStorage.removeItem(STORAGE_KEY_WRITE_QUEUE);
    else localStorage.setItem(STORAGE_KEY_WRITE_QUEUE, JSON.stringify(queue.slice(-50)));
  } catch (err) { console.warn('Failed saving Firestore write queue:', err); }
}
export function enqueueWriteAction(action: Omit<QueuedWriteAction, 'id' | 'timestamp'>) {
  const queue = getQueuedWrites();
  const next = { ...action, id: `qw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, timestamp: Date.now() };
  saveQueuedWrites(action.type === 'full_save' ? [...queue.filter((q) => q.type !== 'full_save'), next] : [...queue, next]);
}

export async function flushPendingWriteQueue(): Promise<number> {
  if (isFlushingQueue) return 0;
  const user = await ensureAuthUser();
  if (!user?.uid) return 0;
  const queue = getQueuedWrites();
  if (!queue.length) return 0;
  isFlushingQueue = true;
  let flushed = 0;
  const remaining: QueuedWriteAction[] = [];
  try {
    for (const item of queue) {
      const ok = item.type === 'full_save'
        ? await directSavePortfolioToFirestore(item.payload, true, 'queue-flush-full-save')
        : await directPatchFirestoreDoc(item.payload, 'queue-flush-patch');
      if (ok) flushed++; else remaining.push(item);
    }
    saveQueuedWrites(remaining);
  } finally { isFlushingQueue = false; }
  return flushed;
}
export async function forceRetrySync() { setQuotaExceeded(false); return { success: true, flushedCount: await flushPendingWriteQueue() }; }

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const message = error?.message || String(error);
  const isQuota = error?.code === 'resource-exhausted' || String(message).toLowerCase().includes('quota exceeded');
  if (isQuota) { setQuotaExceeded(true); console.warn(`[Firestore QUOTA EXCEEDED] ${operationType} ${path}`); return; }
  console.error('[Firestore Error Caught]:', JSON.stringify({ error: message, operationType, path, authInfo: {
    userId: auth.currentUser?.uid || null, email: auth.currentUser?.email || null,
    emailVerified: auth.currentUser?.emailVerified || null, isAnonymous: auth.currentUser?.isAnonymous || null,
  }} as FirestoreErrorInfo));
}

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

function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined || data === null) return data as any;
  if (Array.isArray(data)) return data.map(sanitizeForFirestore) as any;
  if (typeof data === 'object') {
    const clean: any = {};
    Object.entries(data as any).forEach(([key, value]) => { if (value !== undefined) clean[key] = sanitizeForFirestore(value); });
    return clean;
  }
  return data;
}

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

export async function loadPortfolioFromFirestore(): Promise<PortfolioDataDocument | null> {
  const user = await ensureAuthUser();
  const uid = user?.uid;
  if (!uid) return null;
  try {
    const userSnap = await getDoc(doc(db, 'portfolios', uid));
    const userDoc = userSnap.exists() ? userSnap.data() as PortfolioDataDocument : null;
    let mainDoc: PortfolioDataDocument | null = null;
    if (uid !== 'main_portfolio') {
      const mainSnap = await getDoc(doc(db, 'portfolios', 'main_portfolio'));
      mainDoc = mainSnap.exists() ? mainSnap.data() as PortfolioDataDocument : null;
    }
    let chosen: PortfolioDataDocument | null = userDoc || mainDoc;
    if (userDoc && mainDoc) {
      const ut = new Date(userDoc.updatedAt || 0).getTime();
      const mt = new Date(mainDoc.updatedAt || 0).getTime();
      chosen = ut >= mt ? userDoc : mainDoc;
    }
    if (chosen) updateLastSavedSnapshot(chosen);
    return chosen;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `portfolios/${uid}`); return null;
  }
}

async function directSavePortfolioToFirestore(
  data: Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion' | 'lastPriceWriteAt'>,
  allowEmpty = true,
  reason = 'full-save'
): Promise<boolean> {
  const user = await ensureAuthUser();
  const uid = user?.uid;
  if (!uid) return false;
  const nowIso = new Date().toISOString();
  const payload = sanitizeForFirestore({ ...data, updatedAt: nowIso, schemaVersion: 3 }) as PortfolioDataDocument;
  markLocalMutation(3500);
  updateLastSavedSnapshot(payload);
  try {
    await setDoc(doc(db, 'portfolios', uid), payload, { merge: true });
    if (uid !== 'main_portfolio') await setDoc(doc(db, 'portfolios', 'main_portfolio'), payload, { merge: true });
    setQuotaExceeded(false);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `portfolios/${uid}`);
    if (allowEmpty) enqueueWriteAction({ type: 'full_save', payload: data });
    return false;
  }
}

export async function forceFullSyncToFirestore(data: Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion' | 'lastPriceWriteAt'>) {
  setQuotaExceeded(false);
  const ok = await directSavePortfolioToFirestore(data, true, 'manual-force-full-sync');
  if (ok) localStorage.removeItem(STORAGE_KEY_WRITE_QUEUE);
  return ok;
}

export async function savePortfolioToFirestore(
  data: Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion' | 'lastPriceWriteAt'>,
  allowEmpty = false,
  reason = 'full-save'
) {
  if (!allowEmpty && !(data.positions?.length || data.transactions?.length)) return false;
  if (generateFingerprint(data) === lastSerializedPayload && reason !== 'full-save-restore') return true;
  if (quotaExceededState) { enqueueWriteAction({ type: 'full_save', payload: data }); return false; }
  return directSavePortfolioToFirestore(data, allowEmpty, reason);
}

async function directPatchFirestoreDoc(partialData: Record<string, any>, reason: string): Promise<boolean> {
  const user = await ensureAuthUser();
  const uid = user?.uid;
  if (!uid) return false;
  const nowIso = new Date().toISOString();
  const sanitized = sanitizeForFirestore({ ...partialData, updatedAt: nowIso });
  markLocalMutation(3000);
  try {
    await updateDoc(doc(db, 'portfolios', uid), sanitized);
  } catch {
    await setDoc(doc(db, 'portfolios', uid), sanitized, { merge: true });
  }
  if (uid !== 'main_portfolio') {
    try { await updateDoc(doc(db, 'portfolios', 'main_portfolio'), sanitized); }
    catch { try { await setDoc(doc(db, 'portfolios', 'main_portfolio'), sanitized, { merge: true }); } catch { /* ignore mirror failure */ } }
  }
  return true;
}
export async function patchFirestoreDoc(partialData: Record<string, any>, reason = 'patch') {
  if (quotaExceededState) { enqueueWriteAction({ type: 'patch', payload: partialData }); return false; }
  try { return await directPatchFirestoreDoc(partialData, reason); }
  catch (error) { handleFirestoreError(error, OperationType.WRITE, 'portfolio'); enqueueWriteAction({ type: 'patch', payload: partialData }); return false; }
}

export function updateFirestorePositions(positions: Position[]) { return patchFirestoreDoc({ positions }, 'positions-update'); }
export function updateFirestoreClosedTrades(closedTrades: ClosedTrade[]) { return patchFirestoreDoc({ closedTrades }, 'closed-trades-update'); }
export function updateFirestoreCashBalance(cashBalance: number, capitalDeposits?: number) {
  return patchFirestoreDoc({ cashBalance, ...(capitalDeposits !== undefined ? { capitalDeposits } : {}) }, 'cash-balance-update');
}
export function updateFirestoreTickers(tickers: EGXTicker[]) { return patchFirestoreDoc({ tickers }, 'tickers-update'); }

/** Transaction mutations are authoritative full-document saves. This is deliberate: an empty ledger is valid and deletions must persist. */
export function updateFirestoreTransactions(
  transactions: TradeTransaction[], positions?: Position[], closedTrades?: ClosedTrade[], cashBalance?: number, capitalDeposits?: number
) {
  return forceFullSyncToFirestore({
    transactions,
    positions: positions || [],
    closedTrades: closedTrades || [],
    cashBalance: typeof cashBalance === 'number' ? cashBalance : 0,
    capitalDeposits: typeof capitalDeposits === 'number' ? capitalDeposits : 0,
  });
}

export function appendTransactionToFirestore(
  tx: TradeTransaction, positions?: Position[], closedTrades?: ClosedTrade[], cashBalance?: number, capitalDeposits?: number
) {
  return updateFirestoreTransactions([tx], positions, closedTrades, cashBalance, capitalDeposits);
}

export function debouncedSavePortfolioToFirestore(
  data: Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion' | 'lastPriceWriteAt'>, delayMs = 1500
) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => { void savePortfolioToFirestore(data, true, 'debounced-save'); }, delayMs);
}

let lastPriceWriteTimestamp = 0;
const PRICE_WRITE_THROTTLE_MS = 15 * 60 * 1000;
export async function savePriceTickToFirestore(positions: Position[], tickers: EGXTicker[], force = false) {
  const user = await ensureAuthUser();
  const uid = user?.uid;
  if (!uid || quotaExceededState) return false;
  const now = Date.now();
  if (!force && now - lastPriceWriteTimestamp < PRICE_WRITE_THROTTLE_MS) return false;
  lastPriceWriteTimestamp = now;
  const patch = { positions: sanitizeForFirestore(positions), tickers: sanitizeForFirestore(tickers), lastPriceWriteAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  try {
    markLocalMutation(3000);
    await setDoc(doc(db, 'portfolios', uid), patch, { merge: true });
    if (uid !== 'main_portfolio') await setDoc(doc(db, 'portfolios', 'main_portfolio'), patch, { merge: true });
    return true;
  } catch (error) { handleFirestoreError(error, OperationType.WRITE, `portfolios/${uid}`); return false; }
}

export function subscribeToPortfolioFromFirestore(onData: (data: PortfolioDataDocument) => void, onError?: (err: any) => void) {
  let unsubUid: (() => void) | null = null;
  let unsubMain: (() => void) | null = null;
  let cancelled = false;
  ensureAuthUser().then((user) => {
    if (cancelled || !user?.uid) return;
    const uid = user.uid;
    const handleSnap = (snapshot: any, source: string) => {
      if (snapshot.metadata?.hasPendingWrites || isLocalMutationActive()) return;
      if (!snapshot.exists()) return;
      const data = snapshot.data() as PortfolioDataDocument;
      const incomingTime = new Date(data.updatedAt || 0).getTime();
      const knownTime = lastKnownRemoteTimestamp ? new Date(lastKnownRemoteTimestamp).getTime() : 0;
      if (incomingTime && knownTime && incomingTime < knownTime) return;
      const fingerprint = generateFingerprint(data);
      if (fingerprint === lastSerializedPayload) return;
      updateLastSavedSnapshot(data);
      console.log(`[Firestore Real-time] Applied external update from ${source}`);
      onData(data);
    };
    unsubUid = onSnapshot(doc(db, 'portfolios', uid), { includeMetadataChanges: true }, (snap) => handleSnap(snap, `uid:${uid}`), onError);
    if (uid !== 'main_portfolio') unsubMain = onSnapshot(doc(db, 'portfolios', 'main_portfolio'), { includeMetadataChanges: true }, (snap) => handleSnap(snap, 'main_portfolio'));
  }).catch((err) => onError?.(err));
  return () => { cancelled = true; unsubUid?.(); unsubMain?.(); };
}
