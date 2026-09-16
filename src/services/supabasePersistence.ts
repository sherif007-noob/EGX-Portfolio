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
  return user.getIdToken(true);
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

function mapPosition(row: any): Position {
  return { id: String(row.id), ticker: String(row.ticker).toUpperCase(), companyName: row.company_name ?? '', sector: row.sector ?? 'Other', shares: Number(row.shares ?? 0), avgBuyPrice: Number(row.avg_buy_price ?? 0), currentPrice: Number(row.current_price ?? 0), dayChange: row.day_change == null ? undefined : Number(row.day_change), dayChangePercent: row.day_change_percent == null ? undefined : Number(row.day_change_percent), buyDate: row.buy_date ?? '', totalFees: Number(row.total_fees ?? 0), targetPrice: row.target_price == null ? undefined : Number(row.target_price), stopLoss: row.stop_loss == null ? undefined : Number(row.stop_loss), notes: row.notes ?? '', priceUpdatedAt: row.price_updated_at ?? undefined };
}
function mapClosedTrade(row: any): ClosedTrade {
  return { id: String(row.id), ticker: String(row.ticker).toUpperCase(), companyName: row.company_name ?? '', sector: row.sector ?? 'Other', shares: Number(row.shares ?? 0), buyPrice: Number(row.buy_price ?? 0), sellPrice: Number(row.sell_price ?? 0), buyDate: row.buy_date ?? '', sellDate: row.sell_date ?? '', holdingDays: Number(row.holding_days ?? 0), realizedPnlEgp: Number(row.realized_pnl_egp ?? 0), realizedPnlPercent: Number(row.realized_pnl_percent ?? 0), buyFees: Number(row.buy_fees ?? 0), sellFees: Number(row.sell_fees ?? 0), totalFees: Number(row.total_fees ?? 0), outcome: row.outcome ?? 'BREAKEVEN', tradeType: row.trade_type ?? 'Swing', tradeCycle: row.trade_cycle ?? undefined, cycleTag: row.cycle_tag ?? undefined, notes: row.notes ?? '', buyTransactionIds: Array.isArray(row.buy_transaction_ids) ? row.buy_transaction_ids : [], sellTransactionIds: Array.isArray(row.sell_transaction_ids) ? row.sell_transaction_ids : [] };
}
function mapTransaction(row: any): TradeTransaction {
  return { id: String(row.id), type: row.transaction_type === 'SELL' ? 'SELL' : 'BUY', ticker: String(row.ticker ?? '').toUpperCase(), companyName: row.company_name ?? '', sector: row.sector ?? 'Other', shares: Number(row.shares ?? 0), price: Number(row.price ?? 0), date: row.transaction_date ?? '', executedAt: row.executed_at ?? undefined, fees: Number(row.fees ?? 0), totalAmount: Number(row.total_amount ?? 0), cashFlowType: row.cash_flow_type ?? undefined, cashFlowAmount: row.cash_flow_amount == null ? undefined : Number(row.cash_flow_amount), isDCA: Boolean(row.is_dca), notes: row.notes ?? '', targetPrice: row.target_price == null ? undefined : Number(row.target_price), stopLoss: row.stop_loss == null ? undefined : Number(row.stop_loss), tradeId: row.trade_id ?? undefined, tradeCycle: row.trade_cycle ?? undefined, cycleTag: row.cycle_tag ?? undefined, runningShares: row.running_shares == null ? undefined : Number(row.running_shares), grossTradeValue: row.gross_trade_value == null ? undefined : Number(row.gross_trade_value), netCashImpact: row.net_cash_impact == null ? undefined : Number(row.net_cash_impact), realizedPnlEgp: row.realized_pnl_egp == null ? undefined : Number(row.realized_pnl_egp), realizedPnlPercent: row.realized_pnl_percent == null ? undefined : Number(row.realized_pnl_percent), outcome: row.outcome ?? undefined, holdingDays: row.holding_days == null ? undefined : Number(row.holding_days), positionId: row.position_id ?? undefined };
}
function mapTicker(row: any): EGXTicker {
  return { ticker: String(row.ticker).toUpperCase(), nameEn: row.name_en ?? '', nameAr: row.name_ar ?? '', isin: row.isin ?? '', sector: row.sector ?? 'Other', lastPrice: Number(row.last_price ?? 0), change: Number(row.change ?? 0), changePercent: Number(row.change_percent ?? 0), dayLow: Number(row.day_low ?? 0), dayHigh: Number(row.day_high ?? 0), yearLow: Number(row.year_low ?? 0), yearHigh: Number(row.year_high ?? 0), volume: Number(row.volume ?? 0), valueEgp: Number(row.value_egp ?? 0), trendStatus: row.trend_status ?? 'Rangebound Neutral', rsi14: Number(row.rsi14 ?? 0), support: Number(row.support ?? 0), resistance: Number(row.resistance ?? 0), targetPrice: Number(row.target_price ?? 0), stopLoss: Number(row.stop_loss ?? 0), notes: row.notes ?? '', lastUpdated: row.last_updated ?? '', priceUpdatedAt: row.price_updated_at ?? undefined, logoUrl: row.logo_url ?? undefined };
}

export async function loadPortfolioFromSupabase(): Promise<SupabasePortfolioData | null> {
  try { const body = await apiFetch<{ data: any | null }>('/api/supabase/portfolio'); if (!body.data) return null; return { positions: (body.data.positions ?? []).map(mapPosition), closedTrades: (body.data.closedTrades ?? []).map(mapClosedTrade), transactions: (body.data.transactions ?? []).map(mapTransaction), cashBalance: Number(body.data.cashBalance ?? 0), capitalDeposits: Number(body.data.capitalDeposits ?? 0), tickers: (body.data.tickers ?? []).map(mapTicker), updatedAt: body.data.updatedAt, schemaVersion: Number(body.data.schemaVersion ?? 3), lastPriceWriteAt: body.data.lastPriceWriteAt }; }
  catch (error) { console.warn('[Supabase] Portfolio load failed:', error); return null; }
}
export async function savePortfolioToSupabase(data: Omit<SupabasePortfolioData, 'updatedAt' | 'schemaVersion' | 'lastPriceWriteAt'>): Promise<boolean> { try { await apiFetch('/api/supabase/portfolio', { method: 'PUT', body: JSON.stringify(data) }); return true; } catch (error) { console.error('[Supabase] Portfolio save failed:', error); return false; } }
export async function savePriceTickToSupabase(positions: Position[], tickers: EGXTicker[], force = false): Promise<boolean> { try { const body = await apiFetch<{ saved: boolean }>('/api/supabase/price-tick', { method: 'POST', body: JSON.stringify({ positions, tickers, force }) }); return body.saved; } catch (error) { console.error('[Supabase] Price tick save failed:', error); return false; } }
export async function loadHistoricalPricesFromSupabase(tickers: string[], startDate?: string, endDate?: string) { const params = new URLSearchParams({ tickers: tickers.join(',') }); if (startDate) params.set('startDate', startDate); if (endDate) params.set('endDate', endDate); const body = await apiFetch<{ data: any[] }>(`/api/supabase/price-history?${params.toString()}`); return body.data; }
export function getSupabaseAuthUserId(): string | null { return auth.currentUser?.uid ?? null; }
