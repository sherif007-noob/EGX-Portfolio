import { createClient } from '@supabase/supabase-js';

const SUPABASE_JWT_RETRY_DELAYS_MS = [300, 900, 1800];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Supabase's new sb_secret_* keys are opaque API keys. The Supabase gateway
 * exchanges them for an internal short-lived JWT before PostgREST sees the
 * request. During a known hosted-platform clock/cache skew condition,
 * PostgREST can briefly reject that internal JWT with PGRST303 / "JWT issued
 * at future" even though the client supplied no JWT and the key is valid.
 *
 * Retry only that specific transient authentication error. Do not retry other
 * 401s or arbitrary failures, because those indicate real authorization or
 * application problems. The retry is intentionally bounded and jittered.
 */
async function supabaseFetchWithJwtRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const delays = [...SUPABASE_JWT_RETRY_DELAYS_MS];

  for (let attempt = 0; ; attempt += 1) {
    const requestInput = input instanceof Request ? input.clone() : input;
    const response = await fetch(requestInput, init);

    if (response.status !== 401 || attempt >= delays.length) return response;

    const body = await response.clone().text();
    const isJwtIssuedAtFuture = /PGRST303|JWT issued at future/i.test(body);
    if (!isJwtIssuedAtFuture) return response;

    const jitterMs = Math.floor(Math.random() * 150);
    const delayMs = delays[attempt] + jitterMs;
    console.warn(`[Supabase] Transient PGRST303 (JWT issued at future); retrying in ${delayMs}ms (attempt ${attempt + 1}/${delays.length}).`);
    await sleep(delayMs);
  }
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || !key.startsWith('sb_secret_')) throw new Error('Supabase server credentials are not configured correctly.');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: supabaseFetchWithJwtRetry },
  });
}

export async function verifySupabaseBearerToken(authorization?: string): Promise<string> {
  if (!authorization?.startsWith('Bearer ')) throw new Error('Missing Supabase access token.');
  const token = authorization.slice('Bearer '.length).trim();
  if (!token) throw new Error('Missing Supabase access token.');
  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data.user) throw new Error(error?.message || 'Invalid Supabase access token.');
  return data.user.id;
}

async function requirePortfolio(uid: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('portfolios').select('*').eq('owner_key', uid).maybeSingle();
  if (error) throw new Error(`Supabase portfolio lookup failed: ${error.message}`);
  return { supabase, portfolio: data };
}

function toDate(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mapPosition(row: any, portfolioId: string) {
  return {
    id: String(row.id), portfolio_id: portfolioId, ticker: String(row.ticker).toUpperCase(), company_name: row.companyName ?? '',
    sector: row.sector ?? 'Other', shares: Number(row.shares ?? 0), avg_buy_price: Number(row.avgBuyPrice ?? 0),
    current_price: Number(row.currentPrice ?? 0), day_change: Number(row.dayChange ?? 0), day_change_percent: Number(row.dayChangePercent ?? 0),
    buy_date: row.buyDate ?? null, total_fees: Number(row.totalFees ?? 0), target_price: row.targetPrice ?? null, stop_loss: row.stopLoss ?? null,
    notes: row.notes ?? '', price_updated_at: toDate(row.priceUpdatedAt), updated_at: new Date().toISOString(),
  };
}

function mapTransaction(row: any, portfolioId: string) {
  const rawType = String(row.type ?? row.transactionType ?? '').trim().toUpperCase();
  const cashFlowType = row.cashFlowType ?? row.cash_flow_type ?? null;
  const normalizedType = rawType === 'WITHDRAW' ? 'SELL' : rawType || 'BUY';
  const rawTicker = row.ticker ?? row.tickerSymbol ?? row.symbol ?? null;
  const ticker = rawTicker ? String(rawTicker).trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '') : '';
  const transactionDate = row.date ?? row.transactionDate ?? row.transaction_date ?? null;
  if (!ticker || !transactionDate) {
    throw new Error(`Invalid transaction ${String(row.id ?? '')}: ticker and transaction date are required.`);
  }
  return {
    id: String(row.id), portfolio_id: portfolioId, transaction_type: normalizedType,
    ticker, company_name: row.companyName ?? row.company_name ?? '', sector: row.sector ?? 'Other',
    shares: Number(row.shares ?? 0), price: Number(row.price ?? 0), transaction_date: transactionDate,
    executed_at: toDate(row.executedAt ?? row.executed_at), fees: Number(row.fees ?? 0), total_amount: Number(row.totalAmount ?? row.total_amount ?? 0),
    cash_flow_type: cashFlowType, cash_flow_amount: row.cashFlowAmount ?? row.cash_flow_amount ?? null, is_dca: Boolean(row.isDca ?? row.isDCA ?? row.is_dca ?? false),
    notes: row.notes ?? '', target_price: row.targetPrice ?? row.target_price ?? null, stop_loss: row.stopLoss ?? row.stop_loss ?? null, trade_id: row.tradeId ?? row.trade_id ?? null,
    trade_cycle: row.tradeCycle ?? row.trade_cycle ?? null, cycle_tag: row.cycleTag ?? row.cycle_tag ?? null, running_shares: row.runningShares ?? row.running_shares ?? null,
    gross_trade_value: row.grossTradeValue ?? row.gross_trade_value ?? null, net_cash_impact: row.netCashImpact ?? row.net_cash_impact ?? null, realized_pnl_egp: row.realizedPnlEgp ?? row.realized_pnl_egp ?? null,
    realized_pnl_percent: row.realizedPnlPercent ?? row.realized_pnl_percent ?? null, outcome: row.outcome ?? null, holding_days: row.holdingDays ?? row.holding_days ?? null,
    position_id: row.positionId ?? row.position_id ?? null, created_at: toDate(row.createdAt ?? row.created_at) ?? new Date().toISOString(), updated_at: new Date().toISOString(),
  };
}

function mapClosedTrade(row: any, portfolioId: string) {
  return {
    id: String(row.id), portfolio_id: portfolioId, ticker: String(row.ticker).toUpperCase(), company_name: row.companyName ?? '',
    sector: row.sector ?? 'Other', shares: Number(row.shares ?? 0), buy_price: Number(row.buyPrice ?? 0), sell_price: Number(row.sellPrice ?? 0),
    buy_date: row.buyDate, sell_date: row.sellDate, holding_days: Number(row.holdingDays ?? 0), realized_pnl_egp: Number(row.realizedPnlEgp ?? 0),
    realized_pnl_percent: Number(row.realizedPnlPercent ?? 0), buy_fees: Number(row.buyFees ?? 0), sell_fees: Number(row.sellFees ?? 0),
    total_fees: Number(row.totalFees ?? 0), outcome: row.outcome ?? null, trade_type: row.tradeType ?? null, trade_cycle: row.tradeCycle ?? null,
    cycle_tag: row.cycleTag ?? null, notes: row.notes ?? '', buy_transaction_ids: Array.isArray(row.buyTransactionIds) ? row.buyTransactionIds : [],
    sell_transaction_ids: Array.isArray(row.sellTransactionIds) ? row.sellTransactionIds : [], created_at: toDate(row.createdAt) ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Map a complete ticker snapshot. Required database fields are normalized to
 * their schema-safe defaults so an incomplete legacy ticker cannot send an
 * explicit null into a NOT NULL column during a full portfolio save.
 */
function mapTicker(row: any) {
  return {
    ticker: String(row.ticker).toUpperCase(), name_en: row.nameEn ?? '', name_ar: row.nameAr ?? '', isin: row.isin ?? '', sector: row.sector ?? 'Other',
    last_price: Number(row.lastPrice ?? 0), change: Number(row.change ?? 0), change_percent: Number(row.changePercent ?? 0),
    day_low: Number(row.dayLow ?? 0), day_high: Number(row.dayHigh ?? 0), year_low: Number(row.yearLow ?? 0), year_high: Number(row.yearHigh ?? 0),
    volume: Number(row.volume ?? 0), value_egp: Number(row.valueEGP ?? row.valueEgp ?? 0), trend_status: row.trendStatus ?? 'Rangebound Neutral', rsi14: Number(row.rsi14 ?? 0),
    support: Number(row.support ?? 0), resistance: Number(row.resistance ?? 0), target_price: Number(row.targetPrice ?? 0), stop_loss: Number(row.stopLoss ?? 0),
    notes: row.notes ?? null, last_updated: toDate(row.lastUpdated), price_updated_at: toDate(row.priceUpdatedAt), logo_url: row.logoUrl ?? null,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Price ticks must not destroy ticker metadata. The market-data layer can
 * legitimately provide only price fields for an existing ticker, so merge
 * the incoming snapshot with the existing database row before upserting.
 * This also guarantees required metadata such as ISIN survives price-only
 * updates and that a newly introduced ticker receives schema-safe defaults.
 */
async function mapPriceTickers(supabase: ReturnType<typeof getSupabaseAdmin>, tickers: any[]) {
  if (!tickers.length) return [];
  const symbols = [...new Set(tickers.map((t) => String(t.ticker ?? '').trim().toUpperCase()).filter(Boolean))];
  if (!symbols.length) return [];

  const { data: existing, error } = await supabase.from('tickers').select('*').in('ticker', symbols);
  if (error) throw new Error(`Supabase ticker lookup failed: ${error.message}`);

  const existingByTicker = new Map((existing ?? []).map((row: any) => [String(row.ticker).toUpperCase(), row]));
  return tickers.map((ticker) => {
    const symbol = String(ticker.ticker ?? '').trim().toUpperCase();
    const previous = existingByTicker.get(symbol) ?? {};
    const merged = {
      ...previous,
      ...ticker,
      ticker: symbol,
      nameEn: ticker.nameEn ?? previous.name_en ?? '',
      nameAr: ticker.nameAr ?? previous.name_ar ?? '',
      isin: ticker.isin ?? previous.isin ?? '',
      sector: ticker.sector ?? previous.sector ?? 'Other',
      lastPrice: ticker.lastPrice ?? previous.last_price ?? 0,
      change: ticker.change ?? previous.change ?? 0,
      changePercent: ticker.changePercent ?? previous.change_percent ?? 0,
      dayLow: ticker.dayLow ?? previous.day_low ?? 0,
      dayHigh: ticker.dayHigh ?? previous.day_high ?? 0,
      yearLow: ticker.yearLow ?? previous.year_low ?? 0,
      yearHigh: ticker.yearHigh ?? previous.year_high ?? 0,
      volume: ticker.volume ?? previous.volume ?? 0,
      valueEGP: ticker.valueEGP ?? ticker.valueEgp ?? previous.value_egp ?? 0,
      trendStatus: ticker.trendStatus ?? previous.trend_status ?? 'Rangebound Neutral',
      rsi14: ticker.rsi14 ?? previous.rsi14 ?? 0,
      support: ticker.support ?? previous.support ?? 0,
      resistance: ticker.resistance ?? previous.resistance ?? 0,
      targetPrice: ticker.targetPrice ?? previous.target_price ?? 0,
      stopLoss: ticker.stopLoss ?? previous.stop_loss ?? 0,
      notes: ticker.notes ?? previous.notes ?? null,
      lastUpdated: ticker.lastUpdated ?? previous.last_updated,
      priceUpdatedAt: ticker.priceUpdatedAt ?? previous.price_updated_at,
      logoUrl: ticker.logoUrl ?? previous.logo_url ?? null,
    };
    return mapTicker(merged);
  });
}

export async function loadSupabasePortfolio(uid: string) {
  const { supabase, portfolio } = await requirePortfolio(uid);
  if (!portfolio) return null;
  const [positions, transactions, closedTrades, tickers] = await Promise.all([
    supabase.from('positions').select('*').eq('portfolio_id', portfolio.id),
    supabase.from('transactions').select('*').eq('portfolio_id', portfolio.id).order('transaction_date', { ascending: true }),
    supabase.from('closed_trades').select('*').eq('portfolio_id', portfolio.id).order('sell_date', { ascending: true }),
    supabase.from('tickers').select('*').order('ticker', { ascending: true }),
  ]);
  for (const result of [positions, transactions, closedTrades, tickers]) if (result.error) throw new Error(`Supabase portfolio read failed: ${result.error.message}`);
  return {
    positions: positions.data ?? [], closedTrades: closedTrades.data ?? [], transactions: transactions.data ?? [],
    cashBalance: Number(portfolio.cash_balance ?? 0), capitalDeposits: Number(portfolio.capital_deposits ?? 0), tickers: tickers.data ?? [],
    updatedAt: portfolio.updated_at, schemaVersion: Number(portfolio.schema_version ?? 3), lastPriceWriteAt: portfolio.last_price_write_at ?? undefined,
  };
}

export async function saveSupabasePortfolio(uid: string, payload: any) {
  const { supabase, portfolio } = await requirePortfolio(uid);
  if (!portfolio) throw new Error('No Supabase portfolio exists for this authenticated user.');

  if (!Array.isArray(payload.transactions) || !Array.isArray(payload.positions) || !Array.isArray(payload.closedTrades)) {
    throw new Error('Supabase portfolio save requires a complete accounting snapshot: transactions, positions, and closedTrades.');
  }
  if (typeof payload.cashBalance !== 'number' || !Number.isFinite(payload.cashBalance)) {
    throw new Error('Supabase portfolio save requires a finite cashBalance derived from the ledger.');
  }
  if (typeof payload.capitalDeposits !== 'number' || !Number.isFinite(payload.capitalDeposits) || payload.capitalDeposits < 0) {
    throw new Error('Supabase portfolio save requires non-negative capitalDeposits.');
  }

  const portfolioId = portfolio.id;
  const txs = payload.transactions.map((r: any) => mapTransaction(r, portfolioId));
  const positions = payload.positions.map((r: any) => mapPosition(r, portfolioId));
  const closed = payload.closedTrades.map((r: any) => mapClosedTrade(r, portfolioId));

  const { data: accountingResult, error: accountingError } = await supabase.rpc('replace_portfolio_accounting_snapshot', {
    p_portfolio_id: portfolioId,
    p_owner_key: uid,
    p_cash_balance: payload.cashBalance,
    p_capital_deposits: payload.capitalDeposits,
    p_transactions: txs,
    p_positions: positions,
    p_closed_trades: closed,
  });
  if (accountingError) throw new Error(`Supabase atomic portfolio write failed: ${accountingError.message}`);

  // Ticker metadata is intentionally kept outside the accounting transaction.
  // Market-price persistence has its own 15-minute throttling path and must
  // remain independent from ledger mutations.
  if (Array.isArray(payload.tickers)) {
    const tickerRows = payload.tickers.map(mapTicker);
    if (tickerRows.length) {
      const { error } = await supabase.from('tickers').upsert(tickerRows, { onConflict: 'ticker' });
      if (error) throw new Error(`Supabase ticker write failed: ${error.message}`);
    }
  }

  return accountingResult ?? { success: true, updatedAt: new Date().toISOString() };
}

export async function saveSupabasePriceTick(uid: string, positions: any[], tickers: any[], force = false) {
  const { supabase, portfolio } = await requirePortfolio(uid);
  if (!portfolio) return false;
  const now = new Date().toISOString();
  if (!force && portfolio.last_price_write_at && Date.now() - new Date(portfolio.last_price_write_at).getTime() < 15 * 60 * 1000) return false;
  const positionRows = positions.map((p) => mapPosition(p, portfolio.id));
  if (positionRows.length) {
    const { error } = await supabase.from('positions').upsert(positionRows, { onConflict: 'id' });
    if (error) throw new Error(`Supabase price position write failed: ${error.message}`);
  }
  const tickerRows = await mapPriceTickers(supabase, tickers);
  if (tickerRows.length) {
    const { error } = await supabase.from('tickers').upsert(tickerRows, { onConflict: 'ticker' });
    if (error) throw new Error(`Supabase price ticker write failed: ${error.message}`);
  }
  const { error } = await supabase.from('portfolios').update({ last_price_write_at: now, updated_at: now }).eq('id', portfolio.id).eq('owner_key', uid);
  if (error) throw new Error(`Supabase price timestamp write failed: ${error.message}`);
  return true;
}

export async function loadHistoricalPrices(uid: string, tickers: string[], startDate?: string, endDate?: string) {
  const { supabase } = await requirePortfolio(uid);
  const normalized = tickers.map((t) => t.trim().toUpperCase()).filter(Boolean);
  if (!normalized.length) return [];
  let query = supabase.from('price_history').select('*').in('ticker', normalized).order('trading_date', { ascending: true });
  if (startDate) query = query.gte('trading_date', startDate);
  if (endDate) query = query.lte('trading_date', endDate);
  const { data, error } = await query;
  if (error) throw new Error(`Supabase historical price read failed: ${error.message}`);
  return data ?? [];
}
