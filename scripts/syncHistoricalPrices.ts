import 'dotenv/config';
import { cert, getApps as getAdminApps, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createClient } from '@supabase/supabase-js';
import { createChart, createSeries, createSession } from '@ch99q/twc';

type HistoryBar = [number, number, number, number, number, number?];
const TICKER_ALIASES: Record<string, string> = { QNBA: 'QNBF', MNHD: 'MASR', AUTO: 'GBCO', OTMT: 'OIH', UBEG: 'UBEE' };

function normalizeTicker(ticker: string): string { return ticker.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, ''); }
function toDate(timestamp: number): string { return new Date(timestamp * 1000).toISOString().slice(0, 10); }
function firebaseDb() {
  if (!getAdminApps().length) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) throw new Error('Missing Firebase Admin credentials.');
    initializeAdminApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return getFirestore();
}
function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key?.startsWith('sb_secret_')) throw new Error('Missing SUPABASE_URL / SUPABASE_SECRET_KEY.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function writeBars(sb: ReturnType<typeof supabase>, ticker: string, bars: HistoryBar[], startDate: string, endDate: string) {
  const retrievedAt = new Date().toISOString();
  const { data: existingRows, error: readError } = await sb.from('price_history').select('trading_date').eq('ticker', ticker);
  if (readError) throw new Error(`Existing history read failed: ${readError.message}`);
  const existingDates = new Set((existingRows ?? []).map((r: any) => String(r.trading_date).slice(0, 10)));
  const filtered = bars.map((bar) => ({
    trading_date: toDate(Number(bar[0])), open: Number(bar[1]), high: Number(bar[2]), low: Number(bar[3]), close: Number(bar[4]),
    volume: Number.isFinite(Number(bar[5])) ? Number(bar[5]) : null, source: 'tradingview', retrieved_at: retrievedAt,
  })).filter((bar) => bar.trading_date >= startDate && bar.trading_date <= endDate && Number.isFinite(bar.close) && bar.close > 0 && !existingDates.has(bar.trading_date));
  for (let offset = 0; offset < filtered.length; offset += 500) {
    const { error } = await sb.from('price_history').upsert(filtered.slice(offset, offset + 500), { onConflict: 'ticker,trading_date', ignoreDuplicates: true });
    if (error) throw new Error(`History write failed: ${error.message}`);
  }
  return { written: filtered.length, existing: existingDates.size };
}

async function main() {
  const ownerUid = process.env.FIREBASE_ADMIN_OWNER_UID;
  if (!ownerUid) throw new Error('Missing FIREBASE_ADMIN_OWNER_UID.');
  const startOverride = process.env.EGX_HISTORY_START?.slice(0, 10);
  const endDate = process.env.EGX_HISTORY_END?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const db = firebaseDb();
  const sb = supabase();
  const portfolio = await db.collection('portfolios').doc(ownerUid).get();
  if (!portfolio.exists) throw new Error(`Firebase portfolio ${ownerUid} does not exist.`);
  const data = portfolio.data() as { transactions?: Array<{ ticker: string; date: string }> };
  const transactions = Array.isArray(data.transactions) ? data.transactions : [];
  const tickers = [...new Set(transactions.map((tx) => normalizeTicker(tx.ticker)).filter((ticker) => ticker && ticker !== 'CASH'))];
  const firstTransactionDate = transactions.map((tx) => String(tx.date || '').slice(0, 10)).filter(Boolean).sort()[0];
  const startDate = startOverride || firstTransactionDate || endDate;
  if (!tickers.length) { console.log('No security tickers found in the portfolio ledger. Nothing to sync.'); return; }
  const startTimestamp = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000);
  const endTimestamp = Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000);
  if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp) || startTimestamp > endTimestamp) throw new Error(`Invalid historical range: ${startDate} → ${endDate}`);

  const session = await createSession();
  let failures = 0;
  try {
    const chart = await createChart(session);
    let totalRows = 0;
    let totalExisting = 0;
    for (const ticker of tickers) {
      try {
        const symbol = TICKER_ALIASES[ticker] || ticker;
        const resolved = await chart.resolve(symbol, 'EGX');
        const series = await createSeries(session, chart, resolved, '1D', 0, [startTimestamp, endTimestamp]);
        const result = await writeBars(sb, ticker, ((series.history || []) as HistoryBar[]), startDate, endDate);
        totalRows += result.written; totalExisting += result.existing;
        console.log(`${ticker}: ${result.written} new daily observations saved; ${result.existing} existing observations retained.`);
        await series.close();
      } catch (error) { failures += 1; console.error(`${ticker}: historical sync failed`, error); }
    }
    console.log(`Historical sync complete: ${tickers.length} tickers, ${totalRows} new observations written, ${totalExisting} existing observations checked, ${failures} failures.`);
    if (failures > 0) process.exitCode = 1;
  } finally { await session.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });