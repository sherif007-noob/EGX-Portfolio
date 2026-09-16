import 'dotenv/config';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';
import firebaseConfig from '../firebase-applet-config.json';

const firebaseEmail = process.env.EGX_FIREBASE_EMAIL;
const firebasePassword = process.env.EGX_FIREBASE_PASSWORD;
const supabaseUrl = process.env.SUPABASE_URL || 'https://jhubsrbfiqjxdgngnwaq.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!firebaseEmail || !firebasePassword) throw new Error('Missing EGX_FIREBASE_EMAIL / EGX_FIREBASE_PASSWORD.');
if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.');

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const cleanTicker = (value: unknown) => String(value || '').trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
const money = (value: unknown) => Number(value || 0).toFixed(6);

async function main() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const credential = await signInWithEmailAndPassword(auth, firebaseEmail!, firebasePassword!);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  const uid = credential.user.uid;

  const userSnap = await getDoc(doc(db, 'portfolios', uid));
  const mainSnap = await getDoc(doc(db, 'portfolios', 'main_portfolio'));
  const userData = userSnap.exists() ? userSnap.data() as any : null;
  const mainData = mainSnap.exists() ? mainSnap.data() as any : null;
  const source = userData && mainData
    ? (new Date(userData.updatedAt || 0).getTime() >= new Date(mainData.updatedAt || 0).getTime() ? userData : mainData)
    : (userData || mainData);
  if (!source) throw new Error('No Firestore portfolio found.');

  const { data: portfolio, error: portfolioError } = await supabase.from('portfolios').select('*').eq('owner_key', uid).single();
  if (portfolioError || !portfolio) throw new Error(`Supabase portfolio not found: ${portfolioError?.message || 'unknown error'}`);

  const [positions, transactions, closedTrades, tickers] = await Promise.all([
    supabase.from('positions').select('id').eq('portfolio_id', portfolio.id),
    supabase.from('transactions').select('id').eq('portfolio_id', portfolio.id),
    supabase.from('closed_trades').select('id').eq('portfolio_id', portfolio.id),
    supabase.from('tickers').select('ticker'),
  ]);
  for (const result of [positions, transactions, closedTrades, tickers]) if (result.error) throw new Error(result.error.message);

  const firebasePositions = Array.isArray(source.positions) ? source.positions : [];
  const firebaseTransactions = Array.isArray(source.transactions) ? source.transactions : [];
  const firebaseClosedTrades = Array.isArray(source.closedTrades) ? source.closedTrades : [];
  const firebaseTickers = new Set((Array.isArray(source.tickers) ? source.tickers : []).map((t: any) => cleanTicker(t.ticker)).filter(Boolean));

  const checks: Array<[string, boolean, string]> = [];
  checks.push(['cash balance', money(source.cashBalance) === money(portfolio.cash_balance), `${money(source.cashBalance)} vs ${money(portfolio.cash_balance)}`]);
  checks.push(['capital deposits', money(source.capitalDeposits) === money(portfolio.capital_deposits), `${money(source.capitalDeposits)} vs ${money(portfolio.capital_deposits)}`]);
  checks.push(['position count', firebasePositions.length === (positions.data || []).length, `${firebasePositions.length} vs ${(positions.data || []).length}`]);
  checks.push(['transaction count', firebaseTransactions.length === (transactions.data || []).length, `${firebaseTransactions.length} vs ${(transactions.data || []).length}`]);
  checks.push(['closed trade count', firebaseClosedTrades.length === (closedTrades.data || []).length, `${firebaseClosedTrades.length} vs ${(closedTrades.data || []).length}`]);
  checks.push(['ticker count', firebaseTickers.size <= (tickers.data || []).length, `${firebaseTickers.size} source tickers vs ${(tickers.data || []).length} Supabase tickers`]);

  const sourceTxIds = new Set(firebaseTransactions.map((t: any) => String(t.id)));
  const sourcePositionIds = new Set(firebasePositions.map((p: any) => String(p.id)));
  const sourceClosedIds = new Set(firebaseClosedTrades.map((t: any) => String(t.id)));
  const missingTransactions = (transactions.data || []).filter((t: any) => !sourceTxIds.has(String(t.id))).map((t: any) => t.id);
  const missingPositions = (positions.data || []).filter((p: any) => !sourcePositionIds.has(String(p.id))).map((p: any) => p.id);
  const missingClosed = (closedTrades.data || []).filter((t: any) => !sourceClosedIds.has(String(t.id))).map((t: any) => t.id);
  checks.push(['transaction IDs', missingTransactions.length === 0, missingTransactions.slice(0, 10).join(', ') || 'match']);
  checks.push(['position IDs', missingPositions.length === 0, missingPositions.slice(0, 10).join(', ') || 'match']);
  checks.push(['closed-trade IDs', missingClosed.length === 0, missingClosed.slice(0, 10).join(', ') || 'match']);

  let failed = false;
  console.log('--- Firestore → Supabase verification ---');
  for (const [name, ok, detail] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
    if (!ok) failed = true;
  }
  if (failed) process.exitCode = 1;
  else console.log('All migration integrity checks passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
