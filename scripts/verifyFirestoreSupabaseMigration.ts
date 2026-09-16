import 'dotenv/config';
import { cert, getApps as getAdminApps, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { createClient } from '@supabase/supabase-js';

type R = Record<string, any>;

const required = [
  'FIREBASE_ADMIN_PROJECT_ID',
  'FIREBASE_ADMIN_CLIENT_EMAIL',
  'FIREBASE_ADMIN_PRIVATE_KEY',
  'FIREBASE_ADMIN_OWNER_UID',
  'SUPABASE_URL',
  'SUPABASE_SECRET_KEY',
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Missing verification environment variables: ${missing.join(', ')}`);
if (!process.env.SUPABASE_SECRET_KEY!.startsWith('sb_secret_')) throw new Error('SUPABASE_SECRET_KEY must be a current Supabase secret key (sb_secret_...).');

const adminApp = getAdminApps().length
  ? getAdminApps()[0]
  : initializeAdminApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      }),
    });
const db = getAdminFirestore(adminApp);
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const uid = process.env.FIREBASE_ADMIN_OWNER_UID!;
const cleanTicker = (value: unknown) => String(value || '').trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
const money = (value: unknown) => Number(value || 0).toFixed(6);

async function main() {
  const userSnap = await db.collection('portfolios').doc(uid).get();
  const mainSnap = await db.collection('portfolios').doc('main_portfolio').get();
  const userData = userSnap.exists ? (userSnap.data() as R) : null;
  const mainData = mainSnap.exists ? (mainSnap.data() as R) : null;
  const source = userData && mainData
    ? (new Date(userData.updatedAt || 0).getTime() >= new Date(mainData.updatedAt || 0).getTime() ? userData : mainData)
    : (userData || mainData);
  if (!source) throw new Error('No Firestore portfolio found.');

  const { data: portfolio, error: portfolioError } = await supabase
    .from('portfolios')
    .select('*')
    .eq('owner_key', uid)
    .single();
  if (portfolioError || !portfolio) throw new Error(`Supabase portfolio not found: ${portfolioError?.message || 'unknown error'}`);

  const [positions, transactions, closedTrades, tickers, cashTransactions] = await Promise.all([
    supabase.from('positions').select('id').eq('portfolio_id', portfolio.id),
    supabase.from('transactions').select('id').eq('portfolio_id', portfolio.id),
    supabase.from('closed_trades').select('id').eq('portfolio_id', portfolio.id),
    supabase.from('tickers').select('ticker'),
    supabase.from('cash_transactions').select('id').eq('portfolio_id', portfolio.id),
  ]);
  for (const result of [positions, transactions, closedTrades, tickers, cashTransactions]) {
    if (result.error) throw new Error(result.error.message);
  }

  const sourcePositions = Array.isArray(source.positions) ? source.positions : [];
  const sourceTransactions = Array.isArray(source.transactions) ? source.transactions : [];
  const sourceClosedTrades = Array.isArray(source.closedTrades) ? source.closedTrades : [];
  const sourceTickers = new Set((Array.isArray(source.tickers) ? source.tickers : []).map((t: R) => cleanTicker(t.ticker)).filter(Boolean));
  const sourceCashTransactions = sourceTransactions.filter((t: R) => ['DEPOSIT', 'WITHDRAWAL', 'DIVIDEND', 'FEE'].includes(String(t.cashFlowType || '')));

  const checks: Array<[string, boolean, string]> = [];
  checks.push(['cash balance', money(source.cashBalance) === money(portfolio.cash_balance), `${money(source.cashBalance)} vs ${money(portfolio.cash_balance)}`]);
  checks.push(['capital deposits', money(source.capitalDeposits) === money(portfolio.capital_deposits), `${money(source.capitalDeposits)} vs ${money(portfolio.capital_deposits)}`]);
  checks.push(['position count', sourcePositions.length === (positions.data || []).length, `${sourcePositions.length} vs ${(positions.data || []).length}`]);
  checks.push(['transaction count', sourceTransactions.length === (transactions.data || []).length, `${sourceTransactions.length} vs ${(transactions.data || []).length}`]);
  checks.push(['closed trade count', sourceClosedTrades.length === (closedTrades.data || []).length, `${sourceClosedTrades.length} vs ${(closedTrades.data || []).length}`]);
  checks.push(['cash transaction count', sourceCashTransactions.length === (cashTransactions.data || []).length, `${sourceCashTransactions.length} vs ${(cashTransactions.data || []).length}`]);
  checks.push(['ticker coverage', sourceTickers.size <= (tickers.data || []).length, `${sourceTickers.size} source tickers vs ${(tickers.data || []).length} Supabase tickers`]);

  const checkIds = (name: string, sourceRows: R[], destinationRows: R[]) => {
    const sourceIds = new Set(sourceRows.map((r) => String(r.id)));
    const missingRows = destinationRows.filter((r) => !sourceIds.has(String(r.id))).map((r) => r.id);
    checks.push([name, missingRows.length === 0, missingRows.slice(0, 10).join(', ') || 'match']);
  };
  checkIds('transaction IDs', sourceTransactions, transactions.data || []);
  checkIds('position IDs', sourcePositions, positions.data || []);
  checkIds('closed-trade IDs', sourceClosedTrades, closedTrades.data || []);
  checkIds('cash-transaction IDs', sourceCashTransactions, cashTransactions.data || []);

  let failed = false;
  console.log('--- Firestore -> Supabase verification ---');
  for (const [name, ok, detail] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
    if (!ok) failed = true;
  }
  if (failed) {
    process.exitCode = 1;
    return;
  }
  console.log('All migration integrity checks passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
