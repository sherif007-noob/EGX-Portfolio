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

function toIso(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function requireAuthenticatedPortfolio() {
  const supabase = getSupabaseBrowserClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const user = userData.user;
  if (!user) throw new Error('No authenticated Supabase user.');

  const { data: portfolio, error: portfolioError } = await supabase
    .from('portfolios')
    .select('*')
    .eq('owner_key', user.id)
    .maybeSingle();

  if (portfolioError) throw portfolioError;
  if (!portfolio) throw new Error('No portfolio exists for the authenticated Supabase user.');

  return { supabase, user, portfolio };
}

function mapPosition(row: any): Position {
  return {
    id: String(row.id),
    ticker: String(row.ticker).toUpperCase(),
    companyName: row.company_name ?? '',
    sector: row.sector ?? 'Other',
    shares: Number(row.shares ?? 0),
    avgBuyPrice: Number(row.avg_buy_price ?? 0),
    currentPrice: Number(row.current_price ?? 0),
    dayChange: row.day_change == null ? undefined : Number(row.day_change),
    dayChangePercent: row.day_change_percent == null ? undefined : Number(row.day_change_percent),
    buyDate: row.buy_date ?? '',
    totalFees: Number(row.total_fees ?? 0),
    targetPrice: row.target_price == null ? undefined : Number(row.target_price),
    stopLoss: row.stop_loss == null ? undefined : Number(row.stop_loss),
    notes: row.notes ?? '',
    priceUpdatedAt: row.price_updated_at ?? undefined,
  };
}

function mapClosedTrade(row: any): ClosedTrade {
  return {
    id: String(row.id),
    ticker: String(row.ticker).toUpperCase(),
    companyName: row.company_name ?? '',
    sector: row.sector ?? 'Other',
    shares: Number(row.shares ?? 0),
    buyPrice: Number(row.buy_price ?? 0),
    sellPrice: Number(row.sell_price ?? 0),
    buyDate: row.buy_date ?? '',
    sellDate: row.sell_date ?? '',
    holdingDays: Number(row.holding_days ?? 0),
    realizedPnlEgp: Number(row.realized_pnl_egp ?? 0),
    realizedPnlPercent: Number(row.realized_pnl_percent ?? 0),
    buyFees: Number(row.buy_fees ?? 0),
    sellFees: Number(row.sell_fees ?? 0),
    totalFees: Number(row.total_fees ?? 0),
    outcome: row.outcome ?? 'BREAKEVEN',
    tradeType: row.trade_type ?? 'Swing',
    tradeCycle: row.trade_cycle ?? undefined,
    cycleTag: row.cycle_tag ?? undefined,
    notes: row.notes ?? '',
    buyTransactionIds: Array.isArray(row.buy_transaction_ids) ? row.buy_transaction_ids : [],
    sellTransactionIds: Array.isArray(row.sell_transaction_ids) ? row.sell_transaction_ids : [],
  };
}

function mapTransaction(row: any): TradeTransaction {
  return {
    id: String(row.id),
    type: row.transaction_type === 'SELL' ? 'SELL' : 'BUY',
    ticker: String(row.ticker ?? '').toUpperCase(),
    companyName: row.company_name ?? '',
    sector: row.sector ?? 'Other',
    shares: Number(row.shares ?? 0),
    price: Number(row.price ?? 0),
    date: row.transaction_date ?? '',
    executedAt: row.executed_at ?? undefined,
    fees: Number(row.fees ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    cashFlowType: row.cash_flow_type ?? undefined,
    cashFlowAmount: row.cash_flow_amount == null ? undefined : Number(row.cash_flow_amount),
    isDCA: Boolean(row.is_dca),
    notes: row.notes ?? '',
    targetPrice: row.target_price == null ? undefined : Number(row.target_price),
    stopLoss: row.stop_loss == null ? undefined : Number(row.stop_loss),
    tradeId: row.trade_id ?? undefined,
    tradeCycle: row.trade_cycle ?? undefined,
    cycleTag: row.cycle_tag ?? undefined,
    runningShares: row.running_shares ?? null,
    grossTradeValue: row.gross_trade_value ?? null,
    netCashImpact: row.net_cash_impact ?? null,
    realizedPnlEgp: row.realized_pnl_egp ?? null,
    realizedPnlPercent: row.realized_pnl_percent ?? null,
    outcome: row.outcome ?? null,
    holdingDays: row.holding_days ?? null,
    positionId: row.position_id ?? null,
  };
}

function mapTicker(row: any): EGXTicker {
  return {
    ticker: String(row.ticker).toUpperCase(),
    nameEn: row.name_en ?? '',
    nameAr: row.name_ar ?? '',
    isin: row.isin ?? '',
    sector: row.sector ?? 'Other',
    lastPrice: Number(row.last_price ?? 0),
    change: Number(row.change ?? 0),
    changePercent: Number(row.change_percent ?? 0),
    dayLow: Number(row.day_low ?? 0),
    dayHigh: Number(row.day_high ?? 0),
    yearLow: Number(row.year_low ?? 0),
    yearHigh: Number(row.year_high ?? 0),
    volume: Number(row.volume ?? 0),
    valueEgp: Number(row.value_egp ?? 0),
    trendStatus: row.trend_status ?? 'Rangebound Neutral',
    rsi14: Number(row.rsi14 ?? 0),
    support: Number(row.support ?? 0),
    resistance: Number(row.resistance ?? 0),
    targetPrice: Number(row.target_price ?? 0),
    stopLoss: Number(row.stop_loss ?? 0),
    notes: row.notes ?? '',
    lastUpdated: row.last_updated ?? '',
    priceUpdatedAt: row.price_updated_at ?? undefined,
    logoUrl: row.logo_url ?? undefined,
  };
}

function toDbPosition(row: Position, portfolioId: string) {
  return {
    id: String(row.id),
    portfolio_id: portfolioId,
    ticker: String(row.ticker).toUpperCase(),
    company_name: row.companyName ?? '',
    sector: row.sector ?? 'Other',
    shares: Number(row.shares ?? 0),
    avg_buy_price: Number(row.avgBuyPrice ?? 0),
    current_price: Number(row.currentPrice ?? 0),
    day_change: row.dayChange ?? null,
    day_change_percent: row.dayChangePercent ?? null,
    buy_date: row.buyDate || null,
    total_fees: Number(row.totalFees ?? 0),
    target_price: row.targetPrice ?? null,
    stop_loss: row.stopLoss ?? null,
    notes: row.notes ?? '',
    price_updated_at: toIso(row.priceUpdatedAt),
  };
}

function toDbTransaction(row: TradeTransaction, portfolioId: string) {
  return {
    id: String(row.id),
    portfolio_id: portfolioId,
    transaction_type: row.type === 'SELL' ? 'SELL' : 'BUY',
    ticker: String(row.ticker ?? '').trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, ''),
    company_name: row.companyName ?? '',
    sector: row.sector ?? 'Other',
    shares: Number(row.shares ?? 0),
    price: Number(row.price ?? 0),
    transaction_date: row.date,
    executed_at: toIso(row.executedAt),
    fees: Number(row.fees ?? 0),
    total_amount: Number(row.totalAmount ?? 0),
    cash_flow_type: row.cashFlowType ?? null,
    cash_flow_amount: row.cashFlowAmount ?? null,
    is_dca: Boolean(row.isDCA),
    notes: row.notes ?? '',
    target_price: row.targetPrice ?? null,
    stop_loss: row.stopLoss ?? null,
    trade_id: row.tradeId ?? null,
    trade_cycle: row.tradeCycle ?? null,
    cycle_tag: row.cycleTag ?? null,
    running_shares: row.runningShares ?? null,
    gross_trade_value: row.grossTradeValue ?? null,
    net_cash_impact: row.netCashImpact ?? null,
    realized_pnl_egp: row.realizedPnlEgp ?? null,
    realized_pnl_percent: row.realizedPnlPercent ?? null,
    outcome: row.outcome ?? null,
    holding_days: row.holdingDays ?? null,
    position_id: row.positionId ?? null,
  };
}

function toDbClosedTrade(row: ClosedTrade, portfolioId: string) {
  return {
    id: String(row.id),
    portfolio_id: portfolioId,
    ticker: String(row.ticker).toUpperCase(),
    company_name: row.companyName ?? '',
    sector: row.sector ?? 'Other',
    shares: Number(row.shares ?? 0),
    buy_price: Number(row.buyPrice ?? 0),
    sell_price: Number(row.sellPrice ?? 0),
    buy_date: row.buyDate,
    sell_date: row.sellDate,
    holding_days: Number(row.holdingDays ?? 0),
    realized_pnl_egp: Number(row.realizedPnlEgp ?? 0),
    realized_pnl_percent: Number(row.realizedPnlPercent ?? 0),
    buy_fees: Number(row.buyFees ?? 0),
    sell_fees: Number(row.sellFees ?? 0),
    total_fees: Number(row.totalFees ?? 0),
    outcome: row.outcome ?? null,
    trade_type: row.tradeType ?? null,
    trade_cycle: row.tradeCycle ?? null,
    cycle_tag: row.cycleTag ?? null,
    notes: row.notes ?? '',
    buy_transaction_ids: Array.isArray(row.buyTransactionIds) ? row.buyTransactionIds : [],
    sell_transaction_ids: Array.isArray(row.sellTransactionIds) ? row.sellTransactionIds : [],
  };
}

function toDbTicker(row: EGXTicker) {
  return {
    ticker: String(row.ticker).toUpperCase(),
    name_en: row.nameEn ?? '',
    name_ar: row.nameAr ?? '',
    isin: row.isin ?? '',
    sector: row.sector ?? 'Other',
    last_price: Number(row.lastPrice ?? 0),
    change: Number(row.change ?? 0),
    change_percent: Number(row.changePercent ?? 0),
    day_low: Number(row.dayLow ?? 0),
    day_high: Number(row.dayHigh ?? 0),
    year_low: Number(row.yearLow ?? 0),
    year_high: Number(row.yearHigh ?? 0),
    volume: Number(row.volume ?? 0),
    value_egp: Number(row.valueEgp ?? 0),
    trend_status: row.trendStatus ?? 'Rangebound Neutral',
    rsi14: Number(row.rsi14 ?? 0),
    support: Number(row.support ?? 0),
    resistance: Number(row.resistance ?? 0),
    target_price: Number(row.targetPrice ?? 0),
    stop_loss: Number(row.stopLoss ?? 0),
    notes: row.notes ?? null,
    last_updated: toIso(row.lastUpdated),
    price_updated_at: toIso(row.priceUpdatedAt),
    logo_url: row.logoUrl ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function loadPortfolioFromSupabase(): Promise<SupabasePortfolioData | null> {
  try {
    const { supabase, portfolio } = await requireAuthenticatedPortfolio();
    const [positions, transactions, closedTrades, tickers] = await Promise.all([
      supabase.from('positions').select('*').eq('portfolio_id', portfolio.id),
      supabase.from('transactions').select('*').eq('portfolio_id', portfolio.id).order('transaction_date', { ascending: true }),
      supabase.from('closed_trades').select('*').eq('portfolio_id', portfolio.id).order('sell_date', { ascending: true }),
      supabase.from('tickers').select('*').order('ticker', { ascending: true }),
    ]);

    for (const result of [positions, transactions, closedTrades, tickers]) {
      if (result.error) throw result.error;
    }

    return {
      positions: (positions.data ?? []).map(mapPosition),
      closedTrades: (closedTrades.data ?? []).map(mapClosedTrade),
      transactions: (transactions.data ?? []).map(mapTransaction),
      cashBalance: Number(portfolio.cash_balance ?? 0),
      capitalDeposits: Number(portfolio.capital_deposits ?? 0),
      tickers: (tickers.data ?? []).map(mapTicker),
      updatedAt: portfolio.updated_at,
      schemaVersion: Number(portfolio.schema_version ?? 3),
      lastPriceWriteAt: portfolio.last_price_write_at ?? undefined,
    };
  } catch (error) {
    console.error('[Supabase] Direct portfolio load failed:', error);
    return null;
  }
}

export async function savePortfolioToSupabase(
  data: Omit<SupabasePortfolioData, 'updatedAt' | 'schemaVersion' | 'lastPriceWriteAt'>,
): Promise<boolean> {
  try {
    const { supabase, user, portfolio } = await requireAuthenticatedPortfolio();
    const txs = data.transactions.map((row) => toDbTransaction(row, portfolio.id));
    const positions = data.positions.map((row) => toDbPosition(row, portfolio.id));
    const closed = data.closedTrades.map((row) => toDbClosedTrade(row, portfolio.id));

    const { error } = await supabase.rpc('replace_portfolio_accounting_snapshot', {
      p_portfolio_id: portfolio.id,
      p_owner_key: user.id,
      p_cash_balance: data.cashBalance,
      p_capital_deposits: data.capitalDeposits ?? 0,
      p_transactions: txs,
      p_positions: positions,
      p_closed_trades: closed,
    });
    if (error) throw error;

    if (Array.isArray(data.tickers) && data.tickers.length) {
      const { error: tickerError } = await supabase.from('tickers').upsert(data.tickers.map(toDbTicker), { onConflict: 'ticker' });
      if (tickerError) throw tickerError;
    }
    return true;
  } catch (error) {
    console.error('[Supabase] Direct portfolio save failed:', error);
    return false;
  }
}

export async function savePriceTickToSupabase(positions: Position[], tickers: EGXTicker[], force = false): Promise<boolean> {
  try {
    const { supabase, portfolio } = await requireAuthenticatedPortfolio();
    const now = new Date();
    if (!force && portfolio.last_price_write_at) {
      const age = now.getTime() - new Date(portfolio.last_price_write_at).getTime();
      if (age < 15 * 60 * 1000) return false;
    }

    if (positions.length) {
      const { error } = await supabase.from('positions').upsert(positions.map((row) => toDbPosition(row, portfolio.id)), { onConflict: 'id' });
      if (error) throw error;
    }
    if (tickers.length) {
      const { error } = await supabase.from('tickers').upsert(tickers.map(toDbTicker), { onConflict: 'ticker' });
      if (error) throw error;
    }

    const nowIso = now.toISOString();
    const { error: portfolioError } = await supabase
      .from('portfolios')
      .update({ last_price_write_at: nowIso, updated_at: nowIso })
      .eq('id', portfolio.id);
    if (portfolioError) throw portfolioError;

    return true;
  } catch (error) {
    console.error('[Supabase] Direct price tick save failed:', error);
    return false;
  }
}

export async function loadHistoricalPricesFromSupabase(tickers: string[], startDate?: string, endDate?: string) {
  const supabase = getSupabaseBrowserClient();
  const normalized = tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean);
  if (!normalized.length) return [];

  let query = supabase.from('price_history').select('*').in('ticker', normalized).order('trading_date', { ascending: true });
  if (startDate) query = query.gte('trading_date', startDate);
  if (endDate) query = query.lte('trading_date', endDate);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getSupabaseAuthUserId(): Promise<string | null> {
  const { data } = await getSupabaseBrowserClient().auth.getUser();
  return data.user?.id ?? null;
}
