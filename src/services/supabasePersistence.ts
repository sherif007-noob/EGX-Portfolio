import { auth, ensureAuthUser } from './firebaseAuth';
import { Position, ClosedTrade, TradeTransaction, EGXTicker } from '../types';

export interface SupabasePortfolioData {
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

async function firebaseIdToken(): Promise<string | null> {
  const user = await ensureAuthUser();
  if (!user) return null;
  return user.getIdToken();
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await firebaseIdToken();
  if (!token) throw new Error('No authenticated Firebase user is available for Supabase persistence.');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || `Supabase API request failed (${response.status}).`);
  return body as T;
}

export async function loadPortfolioFromSupabase(): Promise<SupabasePortfolioData | null> {
  try {
    const body = await apiFetch<{ data: SupabasePortfolioData | null }>('/api/supabase/portfolio');
    return body.data;
  } catch (error) {
    console.warn('[Supabase] Portfolio load failed:', error);
    return null;
  }
}

export async function savePortfolioToSupabase(
  data: Omit<SupabasePortfolioData, 'updatedAt' | 'schemaVersion' | 'lastPriceWriteAt'>,
): Promise<boolean> {
  try {
    await apiFetch('/api/supabase/portfolio', { method: 'PUT', body: JSON.stringify(data) });
    return true;
  } catch (error) {
    console.error('[Supabase] Portfolio save failed:', error);
    return false;
  }
}

export async function savePriceTickToSupabase(positions: Position[], tickers: EGXTicker[], force = false): Promise<boolean> {
  try {
    const body = await apiFetch<{ saved: boolean }>('/api/supabase/price-tick', {
      method: 'POST', body: JSON.stringify({ positions, tickers, force }),
    });
    return body.saved;
  } catch (error) {
    console.error('[Supabase] Price tick save failed:', error);
    return false;
  }
}

export async function loadHistoricalPricesFromSupabase(tickers: string[], startDate?: string, endDate?: string) {
  const params = new URLSearchParams({ tickers: tickers.join(',') });
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const body = await apiFetch<{ data: any[] }>(`/api/supabase/price-history?${params.toString()}`);
  return body.data;
}

export function getSupabaseAuthUserId(): string | null {
  return auth.currentUser?.uid ?? null;
}
