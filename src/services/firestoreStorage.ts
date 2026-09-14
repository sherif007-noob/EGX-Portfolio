import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Position, ClosedTrade, TradeTransaction, EGXTicker } from '../types';
import { auth, ensureAuthUser } from './firebaseAuth';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo?: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

const STORAGE_KEY_WRITE_QUEUE = 'egx_firestore_write_queue_v1';

export interface QueuedWriteAction {
  id: string;
  type: 'full_save' | 'patch';
  payload: any;
  timestamp: number;
}

let quotaExceededState = false;
const quotaListeners: Array<(isExceeded: boolean) => void> = [];

export function getIsQuotaExceeded(): boolean {
  return quotaExceededState;
}

export function subscribeToQuotaStatus(listener: (isExceeded: boolean) => void): () => void {
  quotaListeners.push(listener);
  listener(quotaExceededState);
  return () => {
    const idx = quotaListeners.indexOf(listener);
    if (idx >= 0) quotaListeners.splice(idx, 1);
  };
}

export function setQuotaExceeded(exceeded: boolean) {
  if (quotaExceededState !== exceeded) {
    quotaExceededState = exceeded;
    quotaListeners.forEach((l) => l(exceeded));
  }
}

// Local mutation fencing: suppresses echo snapshots when local write occurs
let localMutationLockUntil = 0;
let lastKnownRemoteTimestamp: string | null = null;
let lastSerializedPayload = '';

export function markLocalMutation(durationMs = 2500) {
  localMutationLockUntil = Date.now() + durationMs;
}

export function isLocalMutationActive(): boolean {
  return Date.now() < localMutationLockUntil;
}

function getQueuedWrites(): QueuedWriteAction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WRITE_QUEUE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueuedWrites(queue: QueuedWriteAction[]): void {
  try {
    if (queue.length === 0) {
      localStorage.removeItem(STORAGE_KEY_WRITE_QUEUE);
    } else {
      localStorage.setItem(STORAGE_KEY_WRITE_QUEUE, JSON.stringify(queue.slice(-50)));
    }
  } catch (err) {
    console.warn('Failed saving Firestore write queue to localStorage:', err);
  }
}

export function enqueueWriteAction(action: Omit<QueuedWriteAction, 'id' | 'timestamp'>): void {
  const queue = getQueuedWrites();
  if (action.type === 'full_save') {
    const filtered = queue.filter((q) => q.type !== 'full_save');
    filtered.push({
      ...action,
      id: `qw-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
    });
    saveQueuedWrites(filtered);
    return;
  }

  queue.push({
    ...action,
    id: `qw-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
  });
  saveQueuedWrites(queue);
}

let isFlushingQueue = false;

export async function flushPendingWriteQueue(): Promise<number> {
  if (isFlushingQueue) return 0;
  const user = await ensureAuthUser();
  if (!user?.uid) return 0;
  const queue = getQueuedWrites();
  if (queue.length === 0) return 0;

  isFlushingQueue = true;
  let flushedCount = 0;
  const remainingQueue: QueuedWriteAction[] = [];

  try {
    for (const item of queue) {
      let success = false;
      if (item.type === 'full_save') {
        success = await directSavePortfolioToFirestore(item.payload, false, 'queue-flush-full-save');
      } else if (item.type === 'patch') {
        success = await directPatchFirestoreDoc(item.payload, 'queue-flush-patch');
      }
      if (success) {
        flushedCount++;
      } else {
        remainingQueue.push(item);
      }
    }
    saveQueuedWrites(remainingQueue);
  } catch (err) {
    console.warn('Failed flushing write queue:', err);
  } finally {
    isFlushingQueue = false;
  }
  return flushedCount;
}

export async function forceRetrySync(): Promise<{ success: boolean; flushedCount: number }> {
  setQuotaExceeded(false);
  const flushed = await flushPendingWriteQueue();
  return { success: true, flushedCount: flushed };
}

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const isQuota =
    error?.code === 'resource-exhausted' ||
    (typeof error?.message === 'string' && error.message.toLowerCase().includes('quota exceeded'));

  if (isQuota) {
    setQuotaExceeded(true);
    console.warn(`[Firestore QUOTA EXCEEDED] on ${operationType} ${path}. Enqueuing future writes.`);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: error?.message || String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
    },
  };
  console.error('[Firestore Error Caught]:', JSON.stringify(errInfo));
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
  if (data === undefined) return null as any;
  if (data === null) return null as any;
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as any;
  }
  if (typeof data === 'object') {
    const clean: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        clean[key] = sanitizeForFirestore(value);
      }
    }
    return clean;
  }
  return data;
}

export function generateFingerprint(data: Partial<PortfolioDataDocument>): string {
  const pCount = (data.positions || []).length;
  const cCount = (data.closedTrades || []).length;
  const tCount = (data.transactions || []).length;
  const cash = Number(data.cashBalance ?? 0).toFixed(2);
  const cap = Number(data.capitalDeposits ?? 0).toFixed(2);

  const txIds = (data.transactions || [])
    .slice(0, 5)
    .map((t) => t.id)
    .join(',');
  const posKeys = (data.positions || [])
    .map((p) => `${p.ticker}:${p.shares}:${p.avgBuyPrice}`)
    .sort()
    .join('|');

  return `${pCount}_${cCount}_${tCount}_${cash}_${cap}_${txIds}_${posKeys}`;
}

export function updateLastSavedSnapshot(data: Partial<PortfolioDataDocument>) {
  lastSerializedPayload = generateFingerprint(data);
  if (data.updatedAt) {
    lastKnownRemoteTimestamp = data.updatedAt;
  }
}

export function getLastSavedFingerprint() {
  return lastSerializedPayload;
}

/**
 * Loads the user portfolio from Firestore.
 * Evaluates both the authenticated user document and the shared main_portfolio document,
 * returning the newest, most complete document.
 */
export async function loadPortfolioFromFirestore(): Promise<PortfolioDataDocument | null> {
  const user = await ensureAuthUser();
  const uid = user?.uid;
  if (!uid) return null;

  try {
    let userDoc: PortfolioDataDocument | null = null;
    let mainDoc: PortfolioDataDocument | null = null;

    // 1. Fetch user document
    try {
      const snap = await getDoc(doc(db, 'portfolios', uid));
      if (snap.exists()) {
        userDoc = snap.data() as PortfolioDataDocument;
      }
    } catch (e) {
      console.warn('[Firestore] Failed reading user doc:', e);
    }

    // 2. Fetch main_portfolio document (shared sync across preview and devices)
    if (uid !== 'main_portfolio') {
      try {
        const snap = await getDoc(doc(db, 'portfolios', 'main_portfolio'));
        if (snap.exists()) {
          mainDoc = snap.data() as PortfolioDataDocument;
        }
      } catch (e) {
        console.warn('[Firestore] Failed reading main_portfolio doc:', e);
      }
    }

    // 3. Resolve which document is newer / more authoritative
    let chosen: PortfolioDataDocument | null = null;
    if (userDoc && mainDoc) {
      const userTime = userDoc.updatedAt ? new Date(userDoc.updatedAt).getTime() : 0;
      const mainTime = mainDoc.updatedAt ? new Date(mainDoc.updatedAt).getTime() : 0;

      if (Math.abs(userTime - mainTime) > 1000) {
        chosen = userTime >= mainTime ? userDoc : mainDoc;
      } else {
        const userCount = (userDoc.transactions?.length || 0) + (userDoc.positions?.length || 0);
        const mainCount = (mainDoc.transactions?.length || 0) + (mainDoc.positions?.length || 0);
        chosen = userCount >= mainCount ? userDoc : mainDoc;
      }
    } else {
      chosen = userDoc || mainDoc;
    }

    if (chosen) {
      updateLastSavedSnapshot(chosen);
      return chosen;
    }

    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `portfolios/${uid}`);
    return null;
  }
}

/**
 * Direct write of full portfolio state to Firestore.
 * Immediately sets mutation lock and updates snapshot fingerprint to prevent echo reverts.
 */
async function directSavePortfolioToFirestore(
  data: Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion' | 'lastPriceWriteAt'>,
  allowEmpty = false,
  reason = 'full-save'
): Promise<boolean> {
  const user = await ensureAuthUser();
  const uid = user?.uid;
  if (!uid) return false;

  const nowIso = new Date().toISOString();
  const rawPayload: PortfolioDataDocument = {
    ...data,
    updatedAt: nowIso,
    schemaVersion: 3,
  };
  const sanitizedPayload = sanitizeForFirestore(rawPayload);

  // Lock out snapshot echoes immediately and update tracked state
  markLocalMutation(3000);
  lastKnownRemoteTimestamp = nowIso;
  updateLastSavedSnapshot(rawPayload);

  try {
    console.log(`[Firestore Write] ${reason} on portfolios/${uid}`);
    const docRef = doc(db, 'portfolios', uid);
    await setDoc(docRef, sanitizedPayload, { merge: true });

    // Mirror to main_portfolio so preview, mobile, and desktop stay synchronized
    if (uid !== 'main_portfolio') {
      try {
        await setDoc(doc(db, 'portfolios', 'main_portfolio'), sanitizedPayload, { merge: true });
      } catch (mirrorErr) {
        console.warn('Mirror to main_portfolio warning:', mirrorErr);
      }
    }

    setQuotaExceeded(false);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `portfolios/${uid}`);
    return false;
  }
}

/**
 * Force an immediate, authoritative full save to Firestore.
 * Bypasses debouncing and clears offline queue upon success.
 */
export async function forceFullSyncToFirestore(
  data: Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion' | 'lastPriceWriteAt'>
): Promise<boolean> {
  setQuotaExceeded(false);
  const success = await directSavePortfolioToFirestore(data, true, 'manual-force-full-sync');
  if (success) {
    localStorage.removeItem(STORAGE_KEY_WRITE_QUEUE);
  }
  return success;
}

/**
 * Saves portfolio to Firestore with fingerprint comparison to prevent duplicate writes.
 */
export async function savePortfolioToFirestore(
  data: Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion' | 'lastPriceWriteAt'>,
  allowEmpty = false,
  reason = 'full-save'
): Promise<boolean> {
  const posCount = (data.positions || []).length;
  const txCount = (data.transactions || []).length;
  if (!allowEmpty && posCount === 0 && txCount === 0) {
    console.warn('[Firestore] Skipped writing empty portfolio payload to prevent accidental data loss.');
    return false;
  }

  const fingerprint = generateFingerprint(data);
  const isForce = reason === 'full-save-restore' || reason === 'manual-force-full-sync';
  if (!isForce && fingerprint === lastSerializedPayload) {
    return true; // Skip redundant identical write
  }

  if (quotaExceededState) {
    enqueueWriteAction({ type: 'full_save', payload: data });
    return false;
  }

  const success = await directSavePortfolioToFirestore(data, allowEmpty, reason);
  if (!success) {
    enqueueWriteAction({ type: 'full_save', payload: data });
  }
  return success;
}

/**
 * Directly patches specific portfolio properties in Firestore.
 */
async function directPatchFirestoreDoc(partialData: Record<string, any>, reason: string): Promise<boolean> {
  const user = await ensureAuthUser();
  const uid = user?.uid;
  if (!uid) return false;

  const nowIso = new Date().toISOString();
  const sanitized = sanitizeForFirestore({
    ...partialData,
    updatedAt: nowIso,
  });

  markLocalMutation(2500);
  lastKnownRemoteTimestamp = nowIso;

  try {
    console.log(`[Firestore Write] ${reason} on portfolios/${uid}`);
    const docRef = doc(db, 'portfolios', uid);
    try {
      await updateDoc(docRef, sanitized);
    } catch {
      await setDoc(docRef, sanitized, { merge: true });
    }

    if (uid !== 'main_portfolio') {
      try {
        const mainRef = doc(db, 'portfolios', 'main_portfolio');
        try {
          await updateDoc(mainRef, sanitized);
        } catch {
          await setDoc(mainRef, sanitized, { merge: true });
        }
      } catch {
        // ignore
      }
    }

    setQuotaExceeded(false);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `portfolios/${uid}`);
    return false;
  }
}

export async function patchFirestoreDoc(partialData: Record<string, any>, reason = 'patch'): Promise<boolean> {
  if (quotaExceededState) {
    enqueueWriteAction({ type: 'patch', payload: partialData });
    return false;
  }
  const success = await directPatchFirestoreDoc(partialData, reason);
  if (!success) {
    enqueueWriteAction({ type: 'patch', payload: partialData });
  }
  return success;
}

export function updateFirestorePositions(positions: Position[]) {
  return patchFirestoreDoc({ positions }, 'positions-update');
}

export function updateFirestoreClosedTrades(closedTrades: ClosedTrade[]) {
  return patchFirestoreDoc({ closedTrades }, 'closed-trades-update');
}

export function updateFirestoreCashBalance(cashBalance: number, capitalDeposits?: number) {
  const payload: Record<string, any> = { cashBalance };
  if (capitalDeposits !== undefined) payload.capitalDeposits = capitalDeposits;
  return patchFirestoreDoc(payload, 'cash-balance-update');
}

export function updateFirestoreTickers(tickers: EGXTicker[]) {
  return patchFirestoreDoc({ tickers }, 'tickers-update');
}

export function updateFirestoreTransactions(
  transactions: TradeTransaction[],
  positions?: Position[],
  closedTrades?: ClosedTrade[],
  cashBalance?: number,
  capitalDeposits?: number
) {
  const payload: Partial<PortfolioDataDocument> = { transactions };
  if (positions) payload.positions = positions;
  if (closedTrades) payload.closedTrades = closedTrades;
  if (typeof cashBalance === 'number') payload.cashBalance = cashBalance;
  if (typeof capitalDeposits === 'number') payload.capitalDeposits = capitalDeposits;
  return patchFirestoreDoc(payload, 'transactions-update');
}

export async function appendTransactionToFirestore(
  tx: TradeTransaction,
  positions?: Position[],
  closedTrades?: ClosedTrade[],
  cashBalance?: number,
  capitalDeposits?: number
): Promise<boolean> {
  // Save consistent document with transactions and state
  const payload: Record<string, any> = {};
  if (positions) payload.positions = positions;
  if (closedTrades) payload.closedTrades = closedTrades;
  if (typeof cashBalance === 'number') payload.cashBalance = cashBalance;
  if (typeof capitalDeposits === 'number') payload.capitalDeposits = capitalDeposits;

  return patchFirestoreDoc(payload, 'trade-added');
}

let saveTimeout: NodeJS.Timeout | null = null;
export function debouncedSavePortfolioToFirestore(
  data: Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion' | 'lastPriceWriteAt'>,
  delayMs = 1500
) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    savePortfolioToFirestore(data, false, 'debounced-save');
  }, delayMs);
}

// Throttled price tick write: only writes at most once every 15 minutes
let lastPriceWriteTimestamp = 0;
const PRICE_WRITE_THROTTLE_MS = 15 * 60 * 1000;

export async function savePriceTickToFirestore(
  positions: Position[],
  tickers: EGXTicker[],
  force = false
): Promise<boolean> {
  const user = await ensureAuthUser();
  const uid = user?.uid;
  if (!uid || quotaExceededState) return false;

  const now = Date.now();
  if (!force && now - lastPriceWriteTimestamp < PRICE_WRITE_THROTTLE_MS) {
    return false; // Skip excessive write
  }

  try {
    lastPriceWriteTimestamp = now;
    markLocalMutation(3000);
    const nowIso = new Date().toISOString();
    const patch = {
      positions: sanitizeForFirestore(positions),
      tickers: sanitizeForFirestore(tickers),
      lastPriceWriteAt: nowIso,
      updatedAt: nowIso,
    };

    console.log(`[Firestore Write] ${force ? 'Forced/Scheduled' : 'Throttled'} price-tick on portfolios/${uid}`);
    const docRef = doc(db, 'portfolios', uid);
    try {
      await updateDoc(docRef, patch);
    } catch {
      await setDoc(docRef, patch, { merge: true });
    }

    if (uid !== 'main_portfolio') {
      try {
        const mainRef = doc(db, 'portfolios', 'main_portfolio');
        try {
          await updateDoc(mainRef, patch);
        } catch {
          await setDoc(mainRef, patch, { merge: true });
        }
      } catch {
        // ignore
      }
    }

    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `portfolios/${uid}`);
    return false;
  }
}

/**
 * Real-time listener for remote portfolio changes.
 * Defends against local write echoes, pending writes, and stale updates.
 */
export function subscribeToPortfolioFromFirestore(
  onData: (data: PortfolioDataDocument) => void,
  onError?: (err: any) => void
) {
  let unsubUid: (() => void) | null = null;
  let unsubMain: (() => void) | null = null;
  let isCancelled = false;

  ensureAuthUser().then((user) => {
    if (isCancelled || !user?.uid) return;
    const uid = user.uid;

    const handleSnap = (snapshot: any, sourceName: string) => {
      // 1. Ignore if local write is still pending in the Firestore client SDK
      if (snapshot.metadata?.hasPendingWrites) {
        return;
      }

      // 2. Ignore if local mutation occurred within the lock duration (fences off echo snapshots)
      if (isLocalMutationActive()) {
        return;
      }

      if (snapshot.exists()) {
        const data = snapshot.data() as PortfolioDataDocument;
        if (!data) return;

        // 3. Reject if incoming remote data is strictly older than what we have already recorded
        const incomingTime = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
        const currentKnownTime = lastKnownRemoteTimestamp ? new Date(lastKnownRemoteTimestamp).getTime() : 0;

        if (incomingTime > 0 && currentKnownTime > 0 && incomingTime < currentKnownTime) {
          return;
        }

        // 4. Reject if content is identical to our last known payload
        const fingerprint = generateFingerprint(data);
        if (fingerprint === lastSerializedPayload) {
          return;
        }

        // 5. Authoritative external update from another device/tab
        updateLastSavedSnapshot(data);
        console.log(`[Firestore Real-time] Received verified external update from ${sourceName}`);
        onData(data);
      }
    };

    // Listen to user document
    const docRef = doc(db, 'portfolios', uid);
    unsubUid = onSnapshot(
      docRef,
      { includeMetadataChanges: true },
      (snap) => handleSnap(snap, `uid:${uid}`),
      (error) => {
        handleFirestoreError(error, OperationType.GET, `portfolios/${uid}`);
        if (onError) onError(error);
      }
    );

    // If signed in, also listen to main_portfolio for multi-device sync
    if (uid !== 'main_portfolio') {
      const mainRef = doc(db, 'portfolios', 'main_portfolio');
      unsubMain = onSnapshot(
        mainRef,
        { includeMetadataChanges: true },
        (snap) => handleSnap(snap, 'main_portfolio'),
        () => {
          // silent error on main_portfolio
        }
      );
    }
  });

  return () => {
    isCancelled = true;
    if (unsubUid) unsubUid();
    if (unsubMain) unsubMain();
  };
}
