import 'dotenv/config';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, getDoc, getFirestore, writeBatch } from 'firebase/firestore';
import { createChart, createSeries, createSession } from '@ch99q/twc';
import firebaseConfig from '../firebase-applet-config.json';

type HistoryBar = [number, number, number, number, number, number?];

const TICKER_ALIASES: Record<string, string> = {
  QNBA: 'QNBF',
  MNHD: 'MASR',
  AUTO: 'GBCO',
  OTMT: 'OIH',
  UBEG: 'UBEE',
};

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
}

function tradingViewSymbol(ticker: string): string {
  const normalized = normalizeTicker(ticker);
  return `EGX:${TICKER_ALIASES[normalized] || normalized}`;
}

function toDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

async function writeBars(db: ReturnType<typeof getFirestore>, ticker: string, bars: HistoryBar[], startDate: string, endDate: string) {
  const retrievedAt = new Date().toISOString();
  const filtered = bars
    .filter((bar) => Array.isArray(bar) && bar.length >= 5 && Number.isFinite(bar[0]))
    .map((bar) => ({
      date: toDate(Number(bar[0])),
      open: Number(bar[1]),
      high: Number(bar[2]),
      low: Number(bar[3]),
      close: Number(bar[4]),
      volume: Number.isFinite(Number(bar[5])) ? Number(bar[5]) : undefined,
    }))
    .filter((bar) => bar.date >= startDate && bar.date <= endDate && Number.isFinite(bar.close) && bar.close > 0);

  const unique = new Map(filtered.map((bar) => [bar.date, bar]));
  const rows = [...unique.values()].sort((a, b) => a.date.localeCompare(b.date));
  for (let offset = 0; offset < rows.length; offset += 400) {
    const batch = writeBatch(db);
    rows.slice(offset, offset + 400).forEach((bar) => {
      const ref = doc(collection(db, 'historicalPrices', ticker, 'daily'), bar.date);
      batch.set(ref, { ...bar, source: 'tradingview', retrievedAt }, { merge: true });
    });
    await batch.commit();
  }
  return rows.length;
}

async function main() {
  const email = process.env.EGX_FIREBASE_EMAIL;
  const password = process.env.EGX_FIREBASE_PASSWORD;
  if (!email || !password) throw new Error('Missing EGX_FIREBASE_EMAIL / EGX_FIREBASE_PASSWORD GitHub secrets.');

  const startOverride = process.env.EGX_HISTORY_START?.slice(0, 10);
  const endDate = process.env.EGX_HISTORY_END?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, email, password);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

  const portfolio = await getDoc(doc(db, 'portfolios', 'main_portfolio'));
  if (!portfolio.exists()) throw new Error('portfolios/main_portfolio does not exist.');
  const data = portfolio.data() as { transactions?: Array<{ ticker: string; date: string }> };
  const transactions = Array.isArray(data.transactions) ? data.transactions : [];
  const tickers = [...new Set(transactions.map((tx) => normalizeTicker(tx.ticker)).filter((ticker) => ticker && ticker !== 'CASH'))];
  const firstTransactionDate = transactions.map((tx) => String(tx.date || '').slice(0, 10)).filter(Boolean).sort()[0];
  const startDate = startOverride || firstTransactionDate || endDate;
  if (!tickers.length) { console.log('No security tickers found in the portfolio ledger. Nothing to sync.'); return; }

  const session = await createSession();
  try {
    const chart = await createChart(session);
    let totalRows = 0;
    for (const ticker of tickers) {
      try {
        const resolved = await chart.resolve(normalizeTicker(TICKER_ALIASES[ticker] || ticker), 'EGX');
        const series = await createSeries(session, chart, resolved, '1D', 5000);
        const history = (series.history || []) as HistoryBar[];
        const rows = await writeBars(db, ticker, history, startDate, endDate);
        totalRows += rows;
        console.log(`${ticker}: ${rows} daily observations saved.`);
      } catch (error) {
        console.error(`${ticker}: historical sync failed`, error);
      }
    }
    console.log(`Historical sync complete: ${tickers.length} tickers, ${totalRows} observations.`);
  } finally {
    await session.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
