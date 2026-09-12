import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Position, ClosedTrade, TradeTransaction, EGXTicker } from '../types';

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
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
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
  try {
    const docRef = doc(db, 'portfolios', 'main_portfolio');
    const payload: PortfolioDataDocument = {
      ...data,
      updatedAt: new Date().toISOString(),
      schemaVersion: 3,
    };
    await setDoc(docRef, payload, { merge: true });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, PORTFOLIO_DOC_PATH);
    return false;
  }
}

let saveDebounceTimer: NodeJS.Timeout | null = null;
let lastSerializedPayload = '';

export function debouncedSavePortfolioToFirestore(
  data: Omit<PortfolioDataDocument, 'updatedAt' | 'schemaVersion'>,
  delayMs = 2000
): Promise<boolean> {
  return new Promise((resolve) => {
    // Serialization check to avoid redundant identical writes
    const serialized = JSON.stringify({
      positions: data.positions.map((p) => ({ id: p.id, shares: p.shares, currentPrice: p.currentPrice })),
      closedTradesCount: data.closedTrades.length,
      transactionsCount: data.transactions.length,
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
