import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import type { Position, TradeTransaction } from '../src/types';
import { reconcilePortfolioFromLedger } from '../src/services/portfolioReconciliation';

const EPSILON = 0.0001;
const normalizeTicker = (value: unknown) => String(value ?? '').trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
const num = (value: unknown) => Number(value ?? 0);

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url) throw new Error('Missing SUPABASE_URL.');
  if (!key?.startsWith('sb_secret_')) throw new Error('Missing or invalid SUPABASE_SECRET_KEY.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

async function resolvePortfolioId(sb: ReturnType<typeof client>) {
  const explicit = process.env.EGX_PORTFOLIO_ID?.trim();
  if (explicit) return explicit;
  const { data, error } = await sb.from('portfolios').select('id').order('created_at', { ascending: true }).limit(2);
  if (error) throw new Error(`Portfolio discovery failed: ${error.message}`);
  if (!data?.length) throw new Error('No portfolio exists.');
  if (data.length > 1) throw new Error('Multiple portfolios exist; set EGX_PORTFOLIO_ID.');
  return String(data[0].id);
}

function mapTransaction(row: any): TradeTransaction {
  return {
    id: String(row.id),
    type: row.transaction_type === 'SELL' ? 'SELL' : 'BUY',
    ticker: String(row.ticker ?? ''),
    companyName: row.company_name ?? '',
    sector: row.sector ?? 'Other',
    shares: num(row.shares),
    price: num(row.price),
    date: String(row.transaction_date ?? ''),
    executedAt: row.executed_at ?? undefined,
    fees: num(row.fees),
    totalAmount: num(row.total_amount),
    cashFlowType: row.cash_flow_type ?? undefined,
    cashFlowAmount: row.cash_flow_amount == null ? undefined : num(row.cash_flow_amount),
    notes: row.notes ?? undefined,
    tradeId: row.trade_id ?? undefined,
    tradeCycle: row.trade_cycle ?? undefined,
    cycleTag: row.cycle_tag ?? undefined,
    runningShares: row.running_shares == null ? undefined : num(row.running_shares),
    grossTradeValue: row.gross_trade_value == null ? undefined : num(row.gross_trade_value),
    netCashImpact: row.net_cash_impact == null ? undefined : num(row.net_cash_impact),
    realizedPnlEgp: row.realized_pnl_egp == null ? undefined : num(row.realized_pnl_egp),
    realizedPnlPercent: row.realized_pnl_percent == null ? undefined : num(row.realized_pnl_percent),
    holdingDays: row.holding_days == null ? undefined : num(row.holding_days),
    positionId: row.position_id ?? undefined,
  } as TradeTransaction;
}

function duplicateKey(tx: TradeTransaction) {
  return [
    tx.type,
    normalizeTicker(tx.ticker),
    tx.date,
    tx.executedAt ?? '',
    tx.shares,
    tx.price,
    tx.fees,
    tx.totalAmount,
    tx.cashFlowType ?? '',
    tx.cashFlowAmount ?? '',
  ].join('|');
}

function cairoDateKey(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${read('year')}-${read('month')}-${read('day')}`;
}

async function main() {
  const sb = client();
  const portfolioId = await resolvePortfolioId(sb);
  const [
    { data: portfolio, error: pe },
    { data: positionRows, error: pose },
    { data: txRows, error: te },
    { data: closedRows, error: ce },
  ] = await Promise.all([
    sb.from('portfolios').select('id,cash_balance,capital_deposits').eq('id', portfolioId).single(),
    sb.from('positions').select('id,ticker,company_name,sector,shares,avg_buy_price,current_price,day_change,day_change_percent,buy_date,total_fees').eq('portfolio_id', portfolioId),
    sb.from('transactions').select('*').eq('portfolio_id', portfolioId),
    sb.from('closed_trades').select('id,realized_pnl_egp').eq('portfolio_id', portfolioId),
  ]);
  if (pe) throw new Error(`Portfolio read failed: ${pe.message}`);
  if (pose) throw new Error(`Position read failed: ${pose.message}`);
  if (te) throw new Error(`Transaction read failed: ${te.message}`);
  if (ce) throw new Error(`Closed-trade read failed: ${ce.message}`);

  const positions: Position[] = (positionRows ?? []).map((row: any) => ({
    id: String(row.id), ticker: String(row.ticker ?? ''), companyName: row.company_name ?? '', sector: row.sector ?? 'Other',
    shares: num(row.shares), avgBuyPrice: num(row.avg_buy_price), currentPrice: num(row.current_price),
    dayChange: num(row.day_change), dayChangePercent: num(row.day_change_percent), buyDate: String(row.buy_date ?? ''),
    totalFees: num(row.total_fees),
  } as Position));
  const transactions = (txRows ?? []).map(mapTransaction);
  const capital = num(portfolio.capital_deposits);
  const storedCash = num(portfolio.cash_balance);
  const reconciliation = reconcilePortfolioFromLedger(transactions, [], capital, positions);

  const issues: string[] = [...reconciliation.discrepanciesFound];
  const storedByTicker = new Map(positions.map(p => [normalizeTicker(p.ticker), p.shares]));
  const rebuiltByTicker = new Map(reconciliation.reconciledPositions.map(p => [normalizeTicker(p.ticker), p.shares]));
  for (const ticker of new Set([...storedByTicker.keys(), ...rebuiltByTicker.keys()])) {
    const stored = storedByTicker.get(ticker) ?? 0;
    const rebuilt = rebuiltByTicker.get(ticker) ?? 0;
    if (Math.abs(stored - rebuilt) > EPSILON) issues.push(`Position drift ${ticker}: stored=${stored}, ledger=${rebuilt}.`);
  }
  if (Math.abs(storedCash - reconciliation.reconciledCashBalance) > 0.01) {
    issues.push(`Cash drift: stored=${storedCash.toFixed(2)}, ledger=${reconciliation.reconciledCashBalance.toFixed(2)}.`);
  }

  const duplicateGroups = new Map<string, string[]>();
  for (const tx of transactions) {
    const key = duplicateKey(tx);
    const ids = duplicateGroups.get(key) ?? [];
    ids.push(tx.id);
    duplicateGroups.set(key, ids);
  }
  const duplicates = [...duplicateGroups.entries()].filter(([, ids]) => ids.length > 1);
  for (const [key, ids] of duplicates) issues.push(`Duplicate-equivalent ledger rows: ${ids.join(', ')} [${key}]`);

  const storedClosedCount = (closedRows ?? []).length;
  const rebuiltClosedCount = reconciliation.reconciledClosedTrades.length;
  if (storedClosedCount !== rebuiltClosedCount) {
    issues.push(`Closed-trade count drift: stored=${storedClosedCount}, ledger=${rebuiltClosedCount}.`);
  }

  const storedRealized = (closedRows ?? []).reduce((sum: number, row: any) => sum + num(row.realized_pnl_egp), 0);
  const rebuiltRealized = reconciliation.reconciledClosedTrades.reduce(
    (sum, trade) => sum + num(trade.realizedPnlEgp),
    0,
  );
  if (Math.abs(storedRealized - rebuiltRealized) > 0.01) {
    issues.push(
      `Closed-trade realized P&L drift: stored=${storedRealized.toFixed(2)}, ledger=${rebuiltRealized.toFixed(2)}.`,
    );
  }

  const missingExecutionTimestamps = transactions.filter(
    (tx) => normalizeTicker(tx.ticker) !== 'CASH' && !tx.executedAt,
  );
  if (missingExecutionTimestamps.length) {
    issues.push(
      `Market trades missing executedAt: ${missingExecutionTimestamps.map((tx) => tx.id).join(', ')}.`,
    );
  }

  const securityTickers = [...new Set(transactions.map(tx => normalizeTicker(tx.ticker)).filter(t => t && t !== 'CASH'))];
  const historyCoverage = await Promise.all(securityTickers.map(async ticker => {
    const { count, error } = await sb.from('price_history').select('ticker', { count: 'exact', head: true }).eq('ticker', ticker);
    if (error) throw new Error(`Historical coverage read failed for ${ticker}: ${error.message}`);
    return { ticker, rows: count ?? 0 };
  }));
  for (const item of historyCoverage.filter(item => item.rows === 0)) {
    issues.push(`Missing historical prices for ${item.ticker}.`);
  }

  const openTickers = [...new Set(positions.filter((p) => p.shares > EPSILON).map((p) => normalizeTicker(p.ticker)))];

  const { data: latestDailyRows, error: latestDailyError } = await sb
    .from('price_history')
    .select('trading_date')
    .order('trading_date', { ascending: false })
    .limit(1);
  if (latestDailyError) throw new Error(`Latest daily-price read failed: ${latestDailyError.message}`);
  const latestDailyDate = latestDailyRows?.[0]?.trading_date ? String(latestDailyRows[0].trading_date) : null;

  let openTickersMissingLatestDaily: string[] = [];
  if (latestDailyDate && openTickers.length) {
    const { data, error } = await sb
      .from('price_history')
      .select('ticker')
      .in('ticker', openTickers)
      .eq('trading_date', latestDailyDate);
    if (error) throw new Error(`Latest daily coverage read failed: ${error.message}`);
    const covered = new Set((data ?? []).map((row: any) => normalizeTicker(row.ticker)));
    openTickersMissingLatestDaily = openTickers.filter((ticker) => !covered.has(ticker));
    for (const ticker of openTickersMissingLatestDaily) {
      issues.push(`Open ticker missing latest daily price (${latestDailyDate}): ${ticker}.`);
    }
  }

  const { data: latestIntradayRows, error: latestIntradayError } = await sb
    .from('intraday_price_history')
    .select('bar_timestamp')
    .order('bar_timestamp', { ascending: false })
    .limit(1);
  if (latestIntradayError) throw new Error(`Latest intraday-price read failed: ${latestIntradayError.message}`);

  const latestIntradayTimestamp = latestIntradayRows?.[0]?.bar_timestamp
    ? String(latestIntradayRows[0].bar_timestamp)
    : null;
  const latestIntradayDate = latestIntradayTimestamp ? cairoDateKey(latestIntradayTimestamp) : null;

  let openTickersMissingLatestIntraday: string[] = [];
  if (!latestIntradayDate) {
    issues.push('Intraday price history is empty.');
  } else if (openTickers.length) {
    const utcWindowStart = `${latestIntradayDate}T00:00:00.000Z`;
    const nextUtcDate = new Date(utcWindowStart);
    nextUtcDate.setUTCDate(nextUtcDate.getUTCDate() + 1);
    const { data, error } = await sb
      .from('intraday_price_history')
      .select('ticker,bar_timestamp')
      .in('ticker', openTickers)
      .gte('bar_timestamp', utcWindowStart)
      .lt('bar_timestamp', nextUtcDate.toISOString());
    if (error) throw new Error(`Latest intraday coverage read failed: ${error.message}`);

    const covered = new Set(
      (data ?? [])
        .filter((row: any) => cairoDateKey(String(row.bar_timestamp)) === latestIntradayDate)
        .map((row: any) => normalizeTicker(row.ticker)),
    );
    openTickersMissingLatestIntraday = openTickers.filter((ticker) => !covered.has(ticker));
    for (const ticker of openTickersMissingLatestIntraday) {
      issues.push(`Open ticker missing latest intraday session (${latestIntradayDate}): ${ticker}.`);
    }
  }

  console.log(JSON.stringify({
    portfolioId,
    transactions: transactions.length,
    storedPositions: positions.length,
    rebuiltPositions: reconciliation.reconciledPositions.length,
    storedCash,
    rebuiltCash: reconciliation.reconciledCashBalance,
    duplicateGroups: duplicates.map(([key, ids]) => ({ key, ids })),
    missingExecutionTimestamps: missingExecutionTimestamps.map((tx) => tx.id),
    storedClosedTrades: storedClosedCount,
    rebuiltClosedTrades: rebuiltClosedCount,
    storedRealizedPnl: storedRealized,
    rebuiltRealizedPnl: rebuiltRealized,
    historyCoverage,
    latestDailyDate,
    openTickersMissingLatestDaily,
    latestIntradayDate,
    openTickersMissingLatestIntraday,
    issues,
    passed: issues.length === 0,
  }, null, 2));

  if (issues.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
