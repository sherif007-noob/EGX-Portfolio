import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion, onSnapshot, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Position, ClosedTrade, TradeTransaction, EGXTicker } from '../types';
import { auth } from './firebaseAuth';

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
  type: 'full_save' | 'patch' | 'append_tx';
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

function setQuotaExceeded(exceeded: boolean) {
  if (quotaExceededState !== exceeded) {
    quotaExceededState = exceeded;
    quotaListeners.forEach((l) => l(exceeded));
  }
}

// --------------------------------------------------------------------------
// PERSISTENT WRITE QUEUE (localStorage backed)
// --------------------------------------------------------------------------
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
      localStorage.setItem(STORAGE_KEY_WRITE_QUEUE, JSON.stringify(queue.slice(-50))); // Keep at most 50
    }
  } catch (err) {
    console.warn('Failed saving Firestore write queue to localStorage:', err);
  }
}

export function enqueueWriteAction(action: Omit<QueuedWriteAction, 'id' | 'timestamp'>): void {
  const queue = getQueuedWrites();
  // Deduplicate full_save or coalescing
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
  if (isFlushingQueue || quotaExceededState) return 0;
  const queue = getQueuedWrites();
  if (queue.length === 0) return 0;

  isFlushingQueue = true;
  let flushedCount = 0;
  const remainingQueue: QueuedWriteAction[] = [];

  try {
    for (const item of queue) {
      if (quotaExceededState) {
        remainingQueue.push(item);
        continue;
      }

      let success = false;
      if (item.type === 'full_save') {
        success = await directSavePortfolioToFirestore(item.payload);
      } else if (item.type === 'patch') {
        success = await directPatchFirestoreDoc(item.payload);
      } else if (item.type === 'append_tx') {
        success = await directAppendTransactionToFirestore(
          item.payload.tx,
          item.payload.positions,
          item.payload.closedTrades,
          item.payload.cashBalance
        );
      }

      if (success) {
        flushedCount++;
      } else {
        remainingQueue.push(item);
      }
    }
  } catch (err) {
    console.warn('Error during Firestore queue flush:', err);
  } finally {
    saveQueuedWrites(remainingQueue);
    isFlushingQueue = false;
  }

  return flushedCount;
}

// Auto-flush queue on window online or visibility change, and probe for quota recovery
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    setQuotaExceeded(false);
    flushPendingWriteQueue();
  });
  window.addEventListener('focus', () => {
    if (quotaExceededState) {
      // Probe if Firestore has recovered
      testFirestoreConnection().then((isOk) => {
        if (isOk) {
          setQuotaExceeded(false);
          flushPendingWriteQueue();
        }
      });
    } else {
      flushPendingWriteQueue();
    }
  });

  // Periodic recovery check every 3 minutes if quota exceeded was flagged
  setInterval(() => {
    if (quotaExceededState) {
      testFirestoreConnection().then((isOk) => {
        if (isOk) {
          setQuotaExceeded(false);
          flushPendingWriteQueue();
        }
      });
    }
  }, 180000);
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  if (
    errMsg.includes('resource-exhausted') ||
    errMsg.includes('Quota limit exceeded') ||
    errMsg.includes('RESOURCE_EXHAUSTED') ||
    errMsg.includes('quota')
  ) {
    setQuotaExceeded(true);
    console.warn('Firestore daily write quota reached. Switched to Local Storage & write-queue fallback.');
  } else {
    const errInfo: FirestoreErrorInfo = {
      error: errMsg,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
      },
      operationType,
      path,
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
}

/**
 * Recursively strips out `undefined` values from objects and arrays
 * so that Firestore `setDoc` / `updateDoc` does not throw an
 * "Unsupported field value: undefined" error.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        sanitized[key] = sanitizeForFirestore(value);
      }
    }
    return sanitized as unknown as T;
  }
  return data;
}

export interface PortfolioDataDocument {
  positions: Position[];
  closedTrades: ClosedTrade[];
  transactions: TradeTransaction[];
  cashBalance: number;
  tickers?: EGXTicker[];
  updatedAt: string;
  schemaVersion: number;
}

const PORTFOLIO_DOC_PATH = 'portfolios/main_portfolio';

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'portfolios', 'main_portfolio'));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'portfolios/main_portfolio');
    return false;
  }
}

export function updateLastSavedSnapshot(data: {
  positions?: Position[];
  closedTrades?: ClosedTrade[];
  transactions?: TradeTransaction[];
  cashBalance?: number;
}) {
  const safePositions = data.positions || [];
  const safeClosedTrades = data.closedTrades || [];
  const safeTransactions = data.transactions || [];
  lastSerializedPayload = JSON.stringify({
    positions: safePositions.map((p) => ({ id: p.id, shares: p.shares, avgBuyPrice: p.avgBuyPrice })),
    closedTradesCount: safeClosedTrades.length,
    transactionsCount: safeTransactions.length,
    latestTxId: safeTransactions[0]?.id || '',
    cashBalance: data.cashBalance,
  });
}

export async function loadPortfolioFromFirestore(): Promise<PortfolioDataDocument | null> {
  try {
    const docRef = doc(db, 'portfolios', 'main_portfolio');
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      const data = snapshot.data() as PortfolioDataDocument;
      updateLastSavedSnapshot(data);
      return data;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, PORTFOLIO_DOC_PATH);
    return null;
  }
}

async function directSavePortfolioToFirestore(data: Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion'>): Promise<boolean> {
  try {
    const docRef = doc(db, 'portfolios', 'main_portfolio');
    const rawPayload: PortfolioDataDocument = {
      ...data,
      updatedAt: new Date().toISOString(),
      schemaVersion: 3,
    };
    const sanitizedPayload = sanitizeForFirestore(rawPayload);
    await setDoc(docRef, sanitizedPayload, { merge: true });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, PORTFOLIO_DOC_PATH);
    return false;
  }
}

export async function savePortfolioToFirestore(
  data: Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion'>,
  allowEmpty = false
): Promise<boolean> {
  // Destructive wipe prevention: Guard against saving completely empty arrays by mistake
  const posCount = (data.positions || []).length;
  const txCount = (data.transactions || []).length;
  if (!allowEmpty && posCount === 0 && txCount === 0) {
    console.warn('[Firestore] Skipped writing empty portfolio payload to prevent accidental data loss.');
    return false;
  }

  if (quotaExceededState) {
    enqueueWriteAction({ type: 'full_save', payload: data });
    return false;
  }

  const success = await directSavePortfolioToFirestore(data);
  if (!success) {
    enqueueWriteAction({ type: 'full_save', payload: data });
  }
  return success;
}

async function directPatchFirestoreDoc(partialData: Record<string, any>): Promise<boolean> {
  try {
    const docRef = doc(db, 'portfolios', 'main_portfolio');
    const sanitized = sanitizeForFirestore({
      ...partialData,
      updatedAt: new Date().toISOString(),
    });
    try {
      await updateDoc(docRef, sanitized);
    } catch {
      await setDoc(docRef, sanitized, { merge: true });
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, PORTFOLIO_DOC_PATH);
    return false;
  }
}

/**
 * Patch specific fields of the main portfolio document without replacing the entire document.
 * Minimizes Firestore write bandwidth and quota consumption.
 */
export async function patchFirestoreDoc(partialData: Record<string, any>): Promise<boolean> {
  if (quotaExceededState) {
    enqueueWriteAction({ type: 'patch', payload: partialData });
    return false;
  }
  const success = await directPatchFirestoreDoc(partialData);
  if (!success) {
    enqueueWriteAction({ type: 'patch', payload: partialData });
  }
  return success;
}

async function directAppendTransactionToFirestore(
  tx: TradeTransaction,
  positions?: Position[],
  closedTrades?: ClosedTrade[],
  cashBalance?: number
): Promise<boolean> {
  try {
    const docRef = doc(db, 'portfolios', 'main_portfolio');
    const sanitizedTx = sanitizeForFirestore(tx);
    const patchPayload: Record<string, any> = {
      transactions: arrayUnion(sanitizedTx),
      updatedAt: new Date().toISOString(),
    };
    if (positions) patchPayload.positions = sanitizeForFirestore(positions);
    if (closedTrades) patchPayload.closedTrades = sanitizeForFirestore(closedTrades);
    if (cashBalance !== undefined) patchPayload.cashBalance = cashBalance;

    try {
      await updateDoc(docRef, patchPayload);
    } catch {
      await setDoc(docRef, patchPayload, { merge: true });
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, PORTFOLIO_DOC_PATH);
    return false;
  }
}

/**
 * Appends a single transaction using arrayUnion and updates related state fields.
 */
export async function appendTransactionToFirestore(
  tx: TradeTransaction,
  positions?: Position[],
  closedTrades?: ClosedTrade[],
  cashBalance?: number
): Promise<boolean> {
  if (quotaExceededState) {
    enqueueWriteAction({
      type: 'append_tx',
      payload: { tx, positions, closedTrades, cashBalance },
    });
    return false;
  }
  const success = await directAppendTransactionToFirestore(tx, positions, closedTrades, cashBalance);
  if (!success) {
    enqueueWriteAction({
      type: 'append_tx',
      payload: { tx, positions, closedTrades, cashBalance },
    });
  }
  return success;
}

/**
 * Updates only the positions array in Firestore.
 */
export async function updateFirestorePositions(positions: Position[]): Promise<boolean> {
  return patchFirestoreDoc({ positions });
}

/**
 * Updates only the tickers directory array in Firestore.
 */
export async function updateFirestoreTickers(tickers: EGXTicker[]): Promise<boolean> {
  return patchFirestoreDoc({ tickers });
}

/**
 * Updates only the cash balance field in Firestore.
 */
export async function updateFirestoreCashBalance(cashBalance: number): Promise<boolean> {
  return patchFirestoreDoc({ cashBalance });
}

/**
 * Updates transactions, positions, closedTrades, and cashBalance when transactions are edited, deleted, or bulk imported.
 */
export async function updateFirestoreTransactions(
  transactions: TradeTransaction[],
  positions?: Position[],
  closedTrades?: ClosedTrade[],
  cashBalance?: number
): Promise<boolean> {
  const payload: Record<string, any> = { transactions };
  if (positions) payload.positions = positions;
  if (closedTrades) payload.closedTrades = closedTrades;
  if (cashBalance !== undefined) payload.cashBalance = cashBalance;
  return patchFirestoreDoc(payload);
}

let saveDebounceTimer: NodeJS.Timeout | null = null;
let lastSerializedPayload = '';

export function debouncedSavePortfolioToFirestore(
  data: Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion'>,
  delayMs = 5000,
  allowEmpty = false
): Promise<boolean> {
  return new Promise((resolve) => {
    const safePositions = data.positions || [];
    const safeClosedTrades = data.closedTrades || [];
    const safeTransactions = data.transactions || [];

    if (!allowEmpty && safePositions.length === 0 && safeTransactions.length === 0) {
      resolve(false);
      return;
    }

    if (quotaExceededState) {
      enqueueWriteAction({ type: 'full_save', payload: data });
      resolve(false);
      return;
    }

    const serialized = JSON.stringify({
      positions: safePositions.map((p) => ({ id: p.id, shares: p.shares, avgBuyPrice: p.avgBuyPrice })),
      closedTradesCount: safeClosedTrades.length,
      transactionsCount: safeTransactions.length,
      latestTxId: safeTransactions[0]?.id || '',
      cashBalance: data.cashBalance,
    });

    if (serialized === lastSerializedPayload) {
      resolve(true);
      return;
    }

    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
    }

    saveDebounceTimer = setTimeout(async () => {
      lastSerializedPayload = serialized;
      const success = await savePortfolioToFirestore(data, allowEmpty);
      resolve(success);
    }, delayMs);
  });
}

export function subscribeToPortfolioFromFirestore(
  onData: (data: PortfolioDataDocument) => void,
  onError?: (err: any) => void
) {
  const docRef = doc(db, 'portfolios', 'main_portfolio');
  return onSnapshot(
    docRef,
    { includeMetadataChanges: true },
    (snapshot) => {
      // Ignore local pending writes snapshots to prevent infinite echo loops
      if (snapshot.metadata.hasPendingWrites) {
        return;
      }
      if (snapshot.exists()) {
        const data = snapshot.data() as PortfolioDataDocument;
        updateLastSavedSnapshot(data);
        onData(data);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, PORTFOLIO_DOC_PATH);
      if (onError) onError(error);
    }
  );
}

