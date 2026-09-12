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

let quotaExceededState = false;

export function getIsQuotaExceeded(): boolean {
  return quotaExceededState;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  if (errMsg.includes('resource-exhausted') || errMsg.includes('Quota limit exceeded')) {
    quotaExceededState = true;
    console.warn('Firestore daily write quota reached. Switched to Local Storage & Google Sheets fallback.');
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

export async function loadPortfolioFromFirestore(): Promise<PortfolioDataDocument | null> {
  try {
    const docRef = doc(db, 'portfolios', 'main_portfolio');
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return snapshot.data() as PortfolioDataDocument;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, PORTFOLIO_DOC_PATH);
    return null;
  }
}

export async function savePortfolioToFirestore(data: Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion'>): Promise<boolean> {
  if (quotaExceededState) {
    return false;
  }
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

/**
 * Patch specific fields of the main portfolio document without replacing the entire document.
 * Minimizes Firestore write bandwidth and quota consumption.
 */
export async function patchFirestoreDoc(partialData: Record<string, any>): Promise<boolean> {
  if (quotaExceededState) return false;
  try {
    const docRef = doc(db, 'portfolios', 'main_portfolio');
    const sanitized = sanitizeForFirestore({
      ...partialData,
      updatedAt: new Date().toISOString(),
    });
    try {
      await updateDoc(docRef, sanitized);
    } catch {
      // Fallback to merge if document does not exist yet
      await setDoc(docRef, sanitized, { merge: true });
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, PORTFOLIO_DOC_PATH);
    return false;
  }
}

/**
 * Appends a single transaction using arrayUnion and updates related state fields (positions, closedTrades, cashBalance).
 * Uses ~1-2KB write instead of ~20KB full portfolio overwrite.
 */
export async function appendTransactionToFirestore(
  tx: TradeTransaction,
  positions?: Position[],
  closedTrades?: ClosedTrade[],
  cashBalance?: number
): Promise<boolean> {
  if (quotaExceededState) return false;
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
      // Fallback if doc does not exist yet
      await setDoc(docRef, patchPayload, { merge: true });
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, PORTFOLIO_DOC_PATH);
    return false;
  }
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
  delayMs = 5000
): Promise<boolean> {
  return new Promise((resolve) => {
    if (quotaExceededState) {
      resolve(false);
      return;
    }

    // Serialization check focusing on structural transaction & position changes
    // Pure live price ticks (currentPrice) are excluded to preserve free daily write quota
    const safePositions = data.positions || [];
    const safeClosedTrades = data.closedTrades || [];
    const safeTransactions = data.transactions || [];

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
      const success = await savePortfolioToFirestore(data);
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
        onData(snapshot.data() as PortfolioDataDocument);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, PORTFOLIO_DOC_PATH);
      if (onError) onError(error);
    }
  );
}
