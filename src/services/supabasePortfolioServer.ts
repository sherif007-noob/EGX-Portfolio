import { createClient } from '@supabase/supabase-js';
import { createChart, createSeries, createSession } from '@ch99q/twc';
import { resolveTradingViewInstrument } from './tradingViewSymbolResolver';

const SUPABASE_JWT_RETRY_DELAYS_MS = [300, 900, 1800];

type HistoryBar = [number, number, number, number, number, number?];

function normalizeHistoryTicker(ticker: string): string {
  return String(ticker || '').trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
}

function historyDateFromTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

export interface HistoricalBackfillTarget {
  ticker: string;
  startDate?: string;
}

export interface HistoricalBackfillResult {
  requestedTickers: string[];
  backfilledTickers: string[];
  writtenRows: number;
  failures: Array<{ ticker: string; error: string }>;
}



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

let configuredSupabaseUrl: string | undefined;
let configuredSupabaseSecretKey: string | undefined;

/**
 * @ch99q/twc detects Node by checking globalThis.process and then passes a
 * Node/ws options object as WebSocket's second constructor argument. Cloudflare
 * Workers with nodejs_compat expose process while using the browser-standard
 * WebSocket constructor, where argument #2 is a protocol list. That mismatch
 * throws "The protocol header token is invalid".
 *
 * createSession() reaches its WebSocket constructor synchronously before its
 * first await, so temporarily hiding the Node marker makes twc take its
 * browser/Workers path (new WebSocket(url)) without affecting the async session.
 */
async function createTradingViewSession() {
  const root = globalThis as any;
  const originalProcess = root.process;
  const hasStandardWebSocket = typeof root.WebSocket === 'function';
  const looksNodeCompatible = Boolean(originalProcess?.versions?.node);

  if (!hasStandardWebSocket || !looksNodeCompatible) {
    return createSession();
  }

  let sessionPromise: ReturnType<typeof createSession>;
  try {
    root.process = undefined;
    sessionPromise = createSession();
  } finally {
    root.process = originalProcess;
  }
  return sessionPromise;
}

export function configureSupabaseServer(url?: string, secretKey?: string) {
  configuredSupabaseUrl = url;
  configuredSupabaseSecretKey = secretKey;
}

function getSupabaseAdmin() {
  const url = configuredSupabaseUrl || process.env.SUPABASE_URL;
  const key = configuredSupabaseSecretKey || process.env.SUPABASE_SECRET_KEY;
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


export async function ensurePortfolioHistoricalPrices(
  uid: string,
  requestedTargets: HistoricalBackfillTarget[],
): Promise<HistoricalBackfillResult> {
  const { supabase, portfolio } = await requirePortfolio(uid);
  if (!portfolio) throw new Error('No Supabase portfolio exists for this authenticated user.');

  const requested = new Map<string, string | undefined>();
  for (const target of requestedTargets.slice(0, 25)) {
    const ticker = normalizeHistoryTicker(target?.ticker);
    const startDate = String(target?.startDate || '').slice(0, 10);
    if (!ticker || ticker === 'CASH') continue;
    requested.set(ticker, /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : undefined);
  }

  if (!requested.size) {
    return { requestedTickers: [], backfilledTickers: [], writtenRows: 0, failures: [] };
  }

  const { data: transactions, error: transactionError } = await supabase
    .from('transactions')
    .select('ticker,transaction_date')
    .eq('portfolio_id', portfolio.id)
    .in('ticker', [...requested.keys()]);
  if (transactionError) {
    throw new Error(`Supabase transaction lookup failed for historical backfill: ${transactionError.message}`);
  }

  const firstLedgerDate = new Map<string, string>();
  for (const row of transactions ?? []) {
    const ticker = normalizeHistoryTicker(String(row.ticker || ''));
    const date = String(row.transaction_date || '').slice(0, 10);
    if (!ticker || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const previous = firstLedgerDate.get(ticker);
    if (!previous || date < previous) firstLedgerDate.set(ticker, date);
  }

  const today = new Date().toISOString().slice(0, 10);
  const targets = [...requested.entries()]
    .map(([ticker, hintedDate]) => {
      const ledgerDate = firstLedgerDate.get(ticker);
      const startDate = ledgerDate ?? hintedDate;
      return startDate && startDate <= today ? { ticker, startDate } : null;
    })
    .filter((target): target is { ticker: string; startDate: string } => Boolean(target));

  if (!targets.length) {
    return {
      requestedTickers: [...requested.keys()],
      backfilledTickers: [],
      writtenRows: 0,
      failures: [],
    };
  }

  const session = await createTradingViewSession();
  const backfilledTickers: string[] = [];
  const failures: Array<{ ticker: string; error: string }> = [];
  let writtenRows = 0;

  try {
    const chart = await createChart(session);

    for (const { ticker, startDate } of targets) {
      try {
        const startTimestamp = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000);
        const endTimestamp = Math.floor(new Date(`${today}T23:59:59Z`).getTime() / 1000);
        const calendarDays = Math.max(1, Math.ceil((endTimestamp - startTimestamp) / 86_400) + 1);
        const requestedBars = Math.max(30, calendarDays + 30);

        const { data: existingRows, error: existingError } = await supabase
          .from('price_history')
          .select('trading_date')
          .eq('ticker', ticker)
          .gte('trading_date', startDate)
          .lte('trading_date', today);
        if (existingError) {
          throw new Error(`Existing history read failed: ${existingError.message}`);
        }
        const existingDates = new Set(
          (existingRows ?? []).map((row: any) => String(row.trading_date || '').slice(0, 10)),
        );

        const { data: tickerMetaRow, error: tickerMetaError } = await supabase
          .from('tickers')
          .select('isin')
          .eq('portfolio_id', portfolio.id)
          .eq('ticker', ticker)
          .maybeSingle();
        if (tickerMetaError) throw new Error(`Ticker metadata read failed for ${ticker}: ${tickerMetaError.message}`);
        const resolution = await resolveTradingViewInstrument(chart, {
          ticker,
          isin: String(tickerMetaRow?.isin || '').trim().toUpperCase() || undefined,
        });
        const resolved = resolution.resolved;
        const series = await createSeries(session, chart, resolved, '1D', requestedBars);
        try {
          const retrievedAt = new Date().toISOString();
          const rows = ((series.history || []) as HistoryBar[])
            .map((bar) => ({
              ticker,
              trading_date: historyDateFromTimestamp(Number(bar[0])),
              open: Number(bar[1]),
              high: Number(bar[2]),
              low: Number(bar[3]),
              close: Number(bar[4]),
              volume: Number.isFinite(Number(bar[5])) ? Number(bar[5]) : null,
              source: 'tradingview',
              retrieved_at: retrievedAt,
            }))
            .filter((row) =>
              row.trading_date >= startDate &&
              row.trading_date <= today &&
              Number.isFinite(row.close) &&
              row.close > 0 &&
              !existingDates.has(row.trading_date)
            );

          for (let offset = 0; offset < rows.length; offset += 500) {
            const batch = rows.slice(offset, offset + 500);
            const { error } = await supabase.from('price_history').upsert(batch, {
              onConflict: 'ticker,trading_date',
              ignoreDuplicates: true,
            });
            if (error) throw new Error(`History write failed: ${error.message}`);
          }

          if (rows.length) backfilledTickers.push(ticker);
          writtenRows += rows.length;
        } finally {
          await series.close();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ ticker, error: message });
        console.error(`[Historical backfill] ${ticker} failed:`, error);
      }
    }
  } finally {
    await session.close();
  }

  return {
    requestedTickers: [...requested.keys()],
    backfilledTickers,
    writtenRows,
    failures,
  };
}


export interface IntradayBackfillResult {
  requestedTickers: string[];
  backfilledTickers: string[];
  writtenRows: number;
  failures: Array<{ ticker: string; error: string }>;
}

export async function ensurePortfolioIntradayPrices(
  uid: string,
  requestedTargets: HistoricalBackfillTarget[],
): Promise<IntradayBackfillResult> {
  const { supabase, portfolio } = await requirePortfolio(uid);
  if (!portfolio) throw new Error('No Supabase portfolio exists for this authenticated user.');

  const intervalMinutes = 5;
  const today = new Date().toISOString().slice(0, 10);
  const retentionStart = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const requested = new Map<string, string | undefined>();
  for (const target of requestedTargets.slice(0, 25)) {
    const ticker = normalizeHistoryTicker(target?.ticker);
    const hinted = String(target?.startDate || '').slice(0, 10);
    if (!ticker || ticker === 'CASH') continue;
    requested.set(ticker, /^\d{4}-\d{2}-\d{2}$/.test(hinted) ? hinted : undefined);
  }
  if (!requested.size) return { requestedTickers: [], backfilledTickers: [], writtenRows: 0, failures: [] };

  const { data: txRows, error: txError } = await supabase
    .from('transactions')
    .select('ticker,transaction_date')
    .eq('portfolio_id', portfolio.id)
    .in('ticker', [...requested.keys()]);
  if (txError) throw new Error(`Supabase transaction lookup failed for intraday backfill: ${txError.message}`);

  const firstLedgerDate = new Map<string, string>();
  for (const row of txRows ?? []) {
    const ticker = normalizeHistoryTicker(String(row.ticker || ''));
    const date = String(row.transaction_date || '').slice(0, 10);
    if (!ticker || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const previous = firstLedgerDate.get(ticker);
    if (!previous || date < previous) firstLedgerDate.set(ticker, date);
  }

  const targets = [...requested.entries()].map(([ticker, hinted]) => ({
    ticker,
    startDate: [firstLedgerDate.get(ticker) ?? hinted ?? today, retentionStart].sort().at(-1)!,
  }));

  const session = await createTradingViewSession();
  const backfilledTickers: string[] = [];
  const failures: Array<{ ticker: string; error: string }> = [];
  let writtenRows = 0;

  try {
    const chart = await createChart(session);
    for (const { ticker, startDate } of targets) {
      try {
        const startIso = `${startDate}T00:00:00.000Z`;
        const { data: coverage, error: coverageError } = await supabase
          .from('intraday_price_history')
          .select('bar_timestamp')
          .eq('ticker', ticker)
          .eq('interval_minutes', intervalMinutes)
          .gte('bar_timestamp', startIso)
          .order('bar_timestamp', { ascending: true })
          .limit(1);
        if (coverageError) throw new Error(`Existing intraday history read failed: ${coverageError.message}`);

        const firstStored = coverage?.[0]?.bar_timestamp ? String(coverage[0].bar_timestamp) : null;
        const startMs = new Date(startIso).getTime();
        const calendarDays = Math.max(1, Math.ceil((Date.now() - startMs) / 86_400_000) + 1);
        const requestedBars = Math.min(7500, Math.max(256, Math.ceil(calendarDays * 5 / 7 + 5) * 66));

        const { data: tickerMetaRow, error: tickerMetaError } = await supabase
          .from('tickers')
          .select('isin')
          .eq('portfolio_id', portfolio.id)
          .eq('ticker', ticker)
          .maybeSingle();
        if (tickerMetaError) throw new Error(`Ticker metadata read failed for ${ticker}: ${tickerMetaError.message}`);
        const resolution = await resolveTradingViewInstrument(chart, {
          ticker,
          isin: String(tickerMetaRow?.isin || '').trim().toUpperCase() || undefined,
        });
        const resolved = resolution.resolved;
        const series = await createSeries(session, chart, resolved, '5', requestedBars);
        try {
          const retrievedAt = new Date().toISOString();
          const byTimestamp = new Map<string, any>();
          for (const bar of (series.history || []) as HistoryBar[]) {
            const timestamp = Number(bar[0]);
            const close = Number(bar[4]);
            if (!Number.isFinite(timestamp) || !Number.isFinite(close) || close <= 0) continue;
            const barTimestamp = new Date(timestamp * 1000).toISOString();
            if (barTimestamp < startIso || barTimestamp > new Date().toISOString()) continue;
            byTimestamp.set(barTimestamp, {
              ticker,
              interval_minutes: intervalMinutes,
              bar_timestamp: barTimestamp,
              open: Number(bar[1]),
              high: Number(bar[2]),
              low: Number(bar[3]),
              close,
              volume: Number.isFinite(Number(bar[5])) ? Number(bar[5]) : null,
              source: 'tradingview',
              retrieved_at: retrievedAt,
            });
          }
          const rows = [...byTimestamp.values()];
          for (let offset = 0; offset < rows.length; offset += 500) {
            const { error } = await supabase.from('intraday_price_history').upsert(rows.slice(offset, offset + 500), {
              onConflict: 'ticker,interval_minutes,bar_timestamp',
              ignoreDuplicates: false,
            });
            if (error) throw new Error(`Intraday history write failed: ${error.message}`);
          }
          if (rows.length && !firstStored) backfilledTickers.push(ticker);
          writtenRows += rows.length;
        } finally {
          await series.close();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ ticker, error: message });
        console.error(`[Intraday backfill] ${ticker} failed:`, error);
      }
    }
  } finally {
    await session.close();
  }

  return { requestedTickers: [...requested.keys()], backfilledTickers, writtenRows, failures };
}
