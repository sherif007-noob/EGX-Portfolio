import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, orderBy, query } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';
import firebaseConfig from '../../firebase-applet-config.json';

type AnyRecord = Record<string, any>;

type ProgressEvent = {
  phase: string;
  message: string;
  counts?: Record<string, number>;
};

export type MigrationOptions = {
  firebaseEmail: string;
  firebasePassword: string;
  confirm: boolean;
  onProgress?: (event: ProgressEvent) => void;
};

function cleanTicker(value: unknown): string {
  return String(value || '').trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
}

function dateOnly(value: unknown): string {
  const text = String(value || '');
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date: ${text}`);
  return parsed.toISOString().slice(0, 10);
}

function nullableNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function numberOrZero(value: unknown): number {
  return nullableNumber(value) ?? 0;
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || 'https://jhubsrbfiqjxdgngnwaq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured on the server.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function upsert(table: string, rows: AnyRecord[], conflict: string) {
  const supabase = getSupabase();
  for (let offset = 0; offset < rows.length; offset += 500) {
    const chunk = rows.slice(offset, offset + 500);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: conflict });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
}

function progress(options: MigrationOptions, event: ProgressEvent) {
  options.onProgress?.(event);
  console.log(`[migration] ${event.phase}: ${event.message}`);
}

export async function runFirestoreSupabaseMigration(options: MigrationOptions) {
  if (!options.confirm) throw new Error('Migration was not explicitly confirmed.');
  if (!options.firebaseEmail || !options.firebasePassword) throw new Error('Firebase email and password are required.');

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const credential = await signInWithEmailAndPassword(auth, options.firebaseEmail, options.firebasePassword);
  const firebaseUid = credential.user.uid;
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  const supabase = getSupabase();

  progress(options, { phase: 'source', message: 'Reading Firestore portfolio snapshots.' });
  const userSnapshot = await getDoc(doc(db, 'portfolios', firebaseUid));
  const mainSnapshot = await getDoc(doc(db, 'portfolios', 'main_portfolio'));
  const userData = userSnapshot.exists() ? (userSnapshot.data() as AnyRecord) : null;
  const mainData = mainSnapshot.exists() ? (mainSnapshot.data() as AnyRecord) : null;
  if (!userData && !mainData) throw new Error('No portfolio document found in Firestore.');

  const userTime = new Date(userData?.updatedAt || 0).getTime();
  const mainTime = new Date(mainData?.updatedAt || 0).getTime();
  const portfolioData = userData && mainData
    ? (userTime >= mainTime ? userData : mainData)
    : (userData || mainData)!;

  progress(options, { phase: 'source', message: `Using the newer portfolio snapshot. Firebase UID: ${firebaseUid}` });

  const { data: existingPortfolio, error: existingPortfolioError } = await supabase
    .from('portfolios').select('id').eq('owner_key', firebaseUid).maybeSingle();
  if (existingPortfolioError) throw new Error(`Could not inspect Supabase portfolio: ${existingPortfolioError.message}`);

  let portfolioId = existingPortfolio?.id as string | undefined;
  const portfolioPayload = {
    owner_key: firebaseUid,
    name: 'Main Portfolio',
    cash_balance: numberOrZero(portfolioData.cashBalance),
    capital_deposits: numberOrZero(portfolioData.capitalDeposits),
    schema_version: Number(portfolioData.schemaVersion || 1),
    last_price_write_at: portfolioData.lastPriceWriteAt || null,
    updated_at: portfolioData.updatedAt || new Date().toISOString(),
  };

  if (portfolioId) {
    const { error } = await supabase.from('portfolios').update(portfolioPayload).eq('id', portfolioId);
    if (error) throw new Error(`Could not update Supabase portfolio: ${error.message}`);
  } else {
    const { data, error } = await supabase.from('portfolios').insert(portfolioPayload).select('id').single();
    if (error) throw new Error(`Could not create Supabase portfolio: ${error.message}`);
    portfolioId = data.id;
  }

  const positions = Array.isArray(portfolioData.positions) ? portfolioData.positions : [];
  const closedTrades = Array.isArray(portfolioData.closedTrades) ? portfolioData.closedTrades : [];
  const transactions = Array.isArray(portfolioData.transactions) ? portfolioData.transactions : [];
  const tickers = Array.isArray(portfolioData.tickers) ? portfolioData.tickers : [];

  const tickerMap = new Map<string, AnyRecord>();
  for (const raw of tickers) {
    const ticker = cleanTicker(raw.ticker);
    if (ticker) tickerMap.set(ticker, raw);
  }
  for (const raw of [...positions, ...transactions, ...closedTrades]) {
    const ticker = cleanTicker(raw.ticker);
    if (ticker && !tickerMap.has(ticker)) tickerMap.set(ticker, {
      ticker, nameEn: raw.companyName || '', nameAr: '', isin: '', sector: raw.sector || 'Other'
    });
  }

  const tickerRows = [...tickerMap.entries()].map(([ticker, raw]) => ({
    ticker, name_en: String(raw.nameEn || raw.companyName || ''), name_ar: String(raw.nameAr || ''),
    isin: String(raw.isin || ''), sector: String(raw.sector || 'Other'), last_price: numberOrZero(raw.lastPrice),
    change: numberOrZero(raw.change), change_percent: numberOrZero(raw.changePercent), day_low: numberOrZero(raw.dayLow),
    day_high: numberOrZero(raw.dayHigh), year_low: numberOrZero(raw.yearLow), year_high: numberOrZero(raw.yearHigh),
    volume: numberOrZero(raw.volume), value_egp: numberOrZero(raw.valueEgp), trend_status: String(raw.trendStatus || 'Rangebound Neutral'),
    rsi14: numberOrZero(raw.rsi14), support: numberOrZero(raw.support), resistance: numberOrZero(raw.resistance),
    target_price: numberOrZero(raw.targetPrice), stop_loss: numberOrZero(raw.stopLoss), notes: raw.notes ?? null,
    last_updated: raw.lastUpdated || null, price_updated_at: raw.priceUpdatedAt || null, logo_url: raw.logoUrl || null,
    updated_at: new Date().toISOString(),
  }));
  await upsert('tickers', tickerRows, 'ticker');
  progress(options, { phase: 'tickers', message: `Migrated ${tickerRows.length} tickers.`, counts: { tickers: tickerRows.length } });

  const positionRows = positions.map((p: AnyRecord) => ({
    id: String(p.id), portfolio_id: portfolioId, ticker: cleanTicker(p.ticker), company_name: String(p.companyName || ''),
    sector: String(p.sector || 'Other'), shares: numberOrZero(p.shares), avg_buy_price: numberOrZero(p.avgBuyPrice),
    current_price: numberOrZero(p.currentPrice), day_change: nullableNumber(p.dayChange), day_change_percent: nullableNumber(p.dayChangePercent),
    buy_date: dateOnly(p.buyDate), total_fees: numberOrZero(p.totalFees), target_price: nullableNumber(p.targetPrice),
    stop_loss: nullableNumber(p.stopLoss), notes: p.notes ?? null, price_updated_at: p.priceUpdatedAt || null,
  }));
  await upsert('positions', positionRows, 'id');
  progress(options, { phase: 'positions', message: `Migrated ${positionRows.length} positions.`, counts: { positions: positionRows.length } });

  const closedTradeRows = closedTrades.map((t: AnyRecord) => ({
    id: String(t.id), portfolio_id: portfolioId, ticker: cleanTicker(t.ticker), company_name: String(t.companyName || ''),
    sector: String(t.sector || 'Other'), shares: numberOrZero(t.shares), buy_price: numberOrZero(t.buyPrice), sell_price: numberOrZero(t.sellPrice),
    buy_date: dateOnly(t.buyDate), sell_date: dateOnly(t.sellDate), holding_days: Math.max(0, Math.trunc(numberOrZero(t.holdingDays))),
    realized_pnl_egp: numberOrZero(t.realizedPnlEgp), realized_pnl_percent: numberOrZero(t.realizedPnlPercent), buy_fees: numberOrZero(t.buyFees),
    sell_fees: numberOrZero(t.sellFees), total_fees: numberOrZero(t.totalFees), outcome: String(t.outcome || 'BREAKEVEN'), trade_type: String(t.tradeType || 'Core'),
    trade_cycle: nullableNumber(t.tradeCycle), cycle_tag: t.cycleTag ?? null, notes: t.notes ?? null,
    buy_transaction_ids: Array.isArray(t.buyTransactionIds) ? t.buyTransactionIds.map(String) : [],
    sell_transaction_ids: Array.isArray(t.sellTransactionIds) ? t.sellTransactionIds.map(String) : [],
  }));
  await upsert('closed_trades', closedTradeRows, 'id');
  progress(options, { phase: 'closed_trades', message: `Migrated ${closedTradeRows.length} closed trades.`, counts: { closedTrades: closedTradeRows.length } });

  const transactionRows = transactions.map((t: AnyRecord) => ({
    id: String(t.id), portfolio_id: portfolioId, transaction_type: String(t.type || 'BUY'), ticker: cleanTicker(t.ticker),
    company_name: String(t.companyName || ''), sector: String(t.sector || 'Other'), shares: numberOrZero(t.shares), price: numberOrZero(t.price),
    transaction_date: dateOnly(t.date), executed_at: t.executedAt || null, fees: numberOrZero(t.fees), total_amount: numberOrZero(t.totalAmount),
    cash_flow_type: t.cashFlowType || null, cash_flow_amount: nullableNumber(t.cashFlowAmount), is_dca: Boolean(t.isDCA), notes: t.notes ?? null,
    target_price: nullableNumber(t.targetPrice), stop_loss: nullableNumber(t.stopLoss), trade_id: t.tradeId == null ? (t.trade_id == null ? null : String(t.trade_id)) : String(t.tradeId),
    trade_cycle: nullableNumber(t.tradeCycle), cycle_tag: t.cycleTag ?? null, running_shares: nullableNumber(t.runningShares),
    gross_trade_value: nullableNumber(t.grossTradeValue), net_cash_impact: nullableNumber(t.netCashImpact), realized_pnl_egp: nullableNumber(t.realizedPnlEgp),
    realized_pnl_percent: nullableNumber(t.realizedPnlPercent), outcome: t.outcome || null, holding_days: nullableNumber(t.holdingDays), position_id: t.positionId || null,
  }));
  await upsert('transactions', transactionRows, 'id');
  progress(options, { phase: 'transactions', message: `Migrated ${transactionRows.length} transactions.`, counts: { transactions: transactionRows.length } });

  const cashTransactions = transactions
    .filter((t: AnyRecord) => ['DEPOSIT', 'WITHDRAWAL', 'DIVIDEND', 'FEE'].includes(String(t.cashFlowType || '')))
    .map((t: AnyRecord) => ({
      id: String(t.id), portfolio_id: portfolioId, transaction_type: String(t.cashFlowType), amount: numberOrZero(t.cashFlowAmount ?? t.totalAmount),
      transaction_date: dateOnly(t.date), notes: t.notes ?? null,
      // Preserve the source value only. Do not invent a zero balance when it is absent.
      balance_after: nullableNumber(t.balanceAfter),
    }));
  await upsert('cash_transactions', cashTransactions, 'id');
  progress(options, { phase: 'cash', message: `Migrated ${cashTransactions.length} cash transactions.`, counts: { cashTransactions: cashTransactions.length } });

  const securityTickers = [...tickerMap.keys()].filter((ticker) => ticker !== 'CASH');
  let historicalRows = 0;
  for (const ticker of securityTickers) {
    const snapshot = await getDocs(query(collection(db, 'historicalPrices', ticker, 'daily'), orderBy('date', 'asc')));
    const rows = snapshot.docs.map((snapshotDoc) => {
      const p = snapshotDoc.data() as AnyRecord;
      return {
        ticker, trading_date: dateOnly(p.date), open: nullableNumber(p.open), high: nullableNumber(p.high), low: nullableNumber(p.low),
        close: numberOrZero(p.close), volume: nullableNumber(p.volume), source: String(p.source || 'tradingview'), retrieved_at: p.retrievedAt || null,
      };
    }).filter((p) => p.close > 0);
    await upsert('price_history', rows, 'ticker,trading_date');
    historicalRows += rows.length;
    progress(options, { phase: 'history', message: `${ticker}: ${rows.length} historical price rows.`, counts: { historicalPrices: historicalRows } });
  }

  // Do not attempt to invent daily valuations. They are only migrated if they exist as a known source collection.
  // The current Firestore model derives performance history from the ledger + historical prices.
  progress(options, { phase: 'complete', message: 'Migration completed. Firebase was read only; no Firebase records were modified or deleted.', counts: {
    tickers: tickerRows.length, positions: positionRows.length, transactions: transactionRows.length,
    closedTrades: closedTradeRows.length, cashTransactions: cashTransactions.length, historicalPrices: historicalRows,
  } });

  return {
    portfolioId,
    firebaseUid,
    counts: { tickers: tickerRows.length, positions: positionRows.length, transactions: transactionRows.length,
      closedTrades: closedTradeRows.length, cashTransactions: cashTransactions.length, historicalPrices: historicalRows },
  };
}
