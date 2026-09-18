import { getSupabaseBrowserClient } from './supabaseBrowser';
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

async function supabaseAccessToken(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.access_token ?? null;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await supabaseAccessToken();
  if (!token) throw new Error('No authenticated Supabase session is available for portfolio persistence.');

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  console.info(`[Supabase] ${init.method || 'GET'} ${path}`);
  const response = await fetch(path, { ...init, headers });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = body?.error || `Supabase API request failed (${response.status}).`;
    console.error(`[Supabase] ${init.method || 'GET'} ${path} failed (${response.status}):`, message);
    throw new Error(message);
  }

  return body as T;
}

function mapPosition(row: any): Position {
  return {
    id: String(row.id), ticker: String(row.ticker).toUpperCase(), companyName: row.company_name ?? '', sector: row.sector ?? 'Other',
    shares: Number(row.shares ?? 0), avgBuyPrice: Number(row.avg_buy_price ?? 0), currentPrice: Number(row.current_price ?? 0),
    dayChange: row.day_change == null ? undefined : Number(row.day_change), dayChangePercent: row.day_change_percent == null ? undefined : Number(row.day_change_percent),
    buyDate: row.buy_date ?? '', totalFees: Number(row.total_fees ?? 0), targetPrice: row.target_price == null ? undefined : Number(row.target_price),
    stopLoss: row.stop_loss == null ? undefined : Number(row.stop_loss), notes: row.notes ?? '', priceUpdatedAt: row.price_updated_at ?? undefined,
  };
}

function mapClosedTrade(row: any): ClosedTrade {
  return {
    id: String(row.id), ticker: String(row.ticker).toUpperCase(), companyName: row.company_name ?? '', sector: row.sector ?? 'Other', shares: Number(row.shares ?? 0),
    buyPrice: Number(row.buy_price ?? 0), sellPrice: Number(row.sell_price ?? 0), buyDate: row.buy_date ?? '', sellDate: row.sell_date ?? '', holdingDays: Number(row.holding_days ?? 0),
    realizedPnlEgp: Number(row.realized_pnl_egp ?? 0), realizedPnlPercent: Number(row.realized_pnl_percent ?? 0), buyFees: Number(row.buy_fees ?? 0), sellFees: Number(row.sell_fees ?? 0), totalFees: Number(row.total_fees ?? 0),
    outcome: row.outcome ?? 'BREAKEVEN', tradeType: row.trade_type ?? 'Swing', tradeCycle: row.trade_cycle ?? undefined, cycleTag: row.cycle_tag ?? undefined, notes: row.notes ?? '',
    buyTransactionIds: Array.isArray(row.buy_transaction_ids) ? row.buy_transaction_ids : [], sellTransactionIds: Array.isArray(row.sell_transaction_ids) ? row.sell_transaction_ids : [],
  };
}

function mapTransaction(row: any): TradeTransaction {
  return {
    id: String(row.id), type: row.transaction_type === 'SELL' ? 'SELL' : 'BUY', ticker: String(row.ticker ?? '').toUpperCase(), companyName: row.company_name ?? '', sector: row.sector ?? 'Other',
    shares: Number(row.shares ?? 0), price: Number(row.price ?? 0), date: row.transaction_date ?? '', executedAt: row.executed_at ?? undefined, fees: Number(row.fees ?? 0), totalAmount: Number(row.total_amount ?? 0),
    cashFlowType: row.cash_flow_type ?? undefined, cashFlowAmount: row.cash_flow_amount == null ? undefined : Number(row.cash_flow_amount), isDCA: Boolean(row.is_dca), notes: row.notes ?? '',
    targetPrice: row.target_price == null ? undefined : Number(row.target_price), stopLoss: row.stop_loss == null ? undefined : Number(row.stop_loss), tradeId: row.trade_id ?? undefined, tradeCycle: row.trade_cycle ?? undefined,
    cycleTag: row.cycle_tag ?? undefined, runningShares: row.running_shares ?? null, grossTradeValue: row.gross_trade_value ?? null, netCashImpact: row.net_cash_impact ?? null, realizedPnlEgp: row.realized_pnl_egp ?? null,
    realizedPnlPercent: row.realized_pnl_percent ?? null, outcome: row.outcome ?? null, holdingDays: row.holding_days ?? null, positionId: row.position_id ?? null,
  };
}

function mapTicker(row: any): EGXTicker {
  return {
    ticker: String(row.ticker).toUpperCase(), nameEn: row.name_en ?? '', nameAr: row.name_ar ?? '', isin: row.isin ?? '', sector: row.sector ?? 'Other',
    lastPrice: Number(row.last_price ?? 0), change: Number(row.change ?? 0), changePercent: Number(row.change_percent ?? 0), dayLow: Number(row.day_low ?? 0), dayHigh: Number(row.day_high ?? 0),
    yearLow: Number(row.year_low ?? 0), yearHigh: Number(row.year_high ?? 0), volume: Number(row.volume ?? 0), valueEgp: Number(row.value_egp ?? 0), trendStatus: row.trend_status ?? 'Rangebound Neutral',
    rsi14: Number(row.rsi14 ?? 0), support: Number(row.support ?? 0), resistance: Number(row.resistance ?? 0), targetPrice: Number(row.target_price ?? 0), stopLoss: Number(row.stop_loss ?? 0), notes: row.notes ?? '',
    lastUpdated: row.last_updated ?? '', priceUpdatedAt: row.price_updated_at ?? undefined, logoUrl: row.logo_url ?? undefined,
  };
}

export async function loadPortfolioFromSupabase(): Promise<SupabasePortfolioData | null> {
  try {
    const body = await apiFetch<{ data: any | null }>('/api/supabase/portfolio');
    if (!body.data) {
      console.error('[Supabase] Portfolio lookup returned no portfolio for the authenticated Firebase UID.');
      return null;
    }
    console.info('[Supabase] Portfolio loaded successfully:', {
      positions: Array.isArray(body.data.positions) ? body.data.positions.length : 0,
      transactions: Array.isArray(body.data.transactions) ? body.data.transactions.length : 0,
      closedTrades: Array.isArray(body.data.closedTrades) ? body.data.closedTrades.length : 0,
      tickers: Array.isArray(body.data.tickers) ? body.data.tickers.length : 0,
    });
    return {
      positions: (body.data.positions ?? []).map(mapPosition),
      closedTrades: (body.data.closedTrades ?? []).map(mapClosedTrade),
      transactions: (body.data.transactions ?? []).map(mapTransaction),
      cashBalance: Number(body.data.cashBalance ?? 0), capitalDeposits: Number(body.data.capitalDeposits ?? 0),
      tickers: (body.data.tickers ?? []).map(mapTicker), updatedAt: body.data.updatedAt, schemaVersion: Number(body.data.schemaVersion ?? 3), lastPriceWriteAt: body.data.lastPriceWriteAt,
    };
  } catch (error) {
    console.error('[Supabase] Portfolio load failed:', error);
    return null;
  }
}

export async function savePortfolioToSupabase(data: Omit<SupabasePortfolioData, 'updatedAt' | 'schemaVersion' | 'lastPriceWriteAt'>): Promise<boolean> {
  try { await apiFetch('/api/supabase/portfolio', { method: 'PUT', body: JSON.stringify(data) }); return true; }
  catch (error) { console.error('[Supabase] Portfolio save failed:', error); return false; }
}

export async function savePriceTickToSupabase(positions: Position[], tickers: EGXTicker[], force = false): Promise<boolean> {
  try {
    console.info('[Supabase] Price tick save requested:', { positions: positions.length, tickers: tickers.length, force });
    const body = await apiFetch<{ saved: boolean }>('/api/supabase/price-tick', { method: 'POST', body: JSON.stringify({ positions, tickers, force }) });
    console.info('[Supabase] Price tick save result:', body.saved);
    return body.saved;
  } catch (error) { console.error('[Supabase] Price tick save failed:', error); return false; }
}

export async function loadHistoricalPricesFromSupabase(tickers: string[], startDate?: string, endDate?: string) {
  const params = new URLSearchParams({ tickers: tickers.join(',') });
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const body = await apiFetch<{ data: any[] }>(`/api/supabase/price-history?${params.toString()}`);
  return body.data;
}

export async function getSupabaseAuthUserId(): Promise<string | null> {
  const { data } = await getSupabaseBrowserClient().auth.getUser();
  return data.user?.id ?? null;
}
