import 'dotenv/config';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, writeBatch } from 'firebase/firestore';
import { createChart, createSeries, createSession } from '@ch99q/twc';
import firebaseConfig from '../firebase-applet-config.json';

type HistoryBar = [number, number, number, number, number, number?];

type StoredHistoryRow = {
  date?: string;
};

const TICKER_ALIASES: Record<string, string> = {
  QNBA: 'QNBF', MNHD: 'MASR', AUTO: 'GBCO', OTMT: 'OIH', UBEG: 'UBEE',
};

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
}

function toDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

async function getExistingDates(db: ReturnType<typeof getFirestore>, ticker: string): Promise<Set<string>> {
  const snapshot = await getDocs(collection(db, 'historicalPrices', ticker, 'daily'));
  return new Set(
    snapshot.docs
      .map((snapshotDoc) => (snapshotDoc.data() as StoredHistoryRow).date)
      .filter((date): date is string => typeof date === 'string' && date.length >= 10)
      .map((date) => date.slice(0, 10))
  );
}

async function writeBars(
  db: ReturnType<typeof getFirestore>,
  ticker: string,
  bars: HistoryBar[],
  startDate: string,
  endDate: string,
) {
  const retrievedAt = new Date().toISOString();
  const existingDates = await getExistingDates(db, ticker);
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
    .filter((bar) =>
      bar.date >= startDate &&
      bar.date <= endDate &&
      Number.isFinite(bar.close) &&
      bar.close > 0 &&
      !existingDates.has(bar.date)
    );

  const unique = new Map(filtered.map((bar) => [bar.date, bar]));
  const rows = [...unique.values()].sort((a, b) => a.date.localeCompare(b.date));

  for (let offset = 0; offset < rows.length; offset += 400) {
    const batch = writeBatch(db);
    rows.slice(offset, offset + 400).forEach((bar) => {
      const ref = doc(collection(db, 'historicalPrices', ticker, 'daily'), bar.date);
      batch.set(ref, { ...bar, source: 'tradingview', retrievedAt });
    });
    await batch.commit();
  }

  return { written: rows.length, existing: existingDates.size };
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

  const startTimestamp = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000);
  const endTimestamp = Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000);
  if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp) || startTimestamp > endTimestamp) {
    throw new Error(`Invalid historical range: ${startDate} → ${endDate}`);
  }

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
        const history = (series.history || []) as HistoryBar[];
        const result = await writeBars(db, ticker, history, startDate, endDate);
        totalRows += result.written;
        totalExisting += result.existing;
        console.log(`${ticker}: ${result.written} new daily observations saved; ${result.existing} existing observations retained.`);
        await series.close();
      } catch (error) {
        failures += 1;
        console.error(`${ticker}: historical sync failed`, error);
      }
    }

    console.log(`Historical sync complete: ${tickers.length} tickers, ${totalRows} new observations written, ${totalExisting} existing observations checked, ${failures} failures.`);
    if (failures > 0) process.exitCode = 1;
  } finally {
    await session.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
