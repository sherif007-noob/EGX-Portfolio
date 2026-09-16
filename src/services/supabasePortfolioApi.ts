import { getSupabaseBrowserClient } from './supabaseBrowser';

/**
 * Temporary read-only adapter for the migration stage. Writes remain behind the
 * server API until Firebase Auth -> Supabase authorization is wired explicitly.
 */
export async function getSupabasePortfolio(ownerKey: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('owner_key', ownerKey)
    .maybeSingle();
  if (error) throw new Error(`Supabase portfolio read failed: ${error.message}`);
  return data;
}

export async function getSupabasePositions(portfolioId: string) {
  const { data, error } = await getSupabaseBrowserClient()
    .from('positions').select('*').eq('portfolio_id', portfolioId);
  if (error) throw new Error(`Supabase positions read failed: ${error.message}`);
  return data ?? [];
}

export async function getSupabaseTransactions(portfolioId: string) {
  const { data, error } = await getSupabaseBrowserClient()
    .from('transactions').select('*').eq('portfolio_id', portfolioId).order('transaction_date', { ascending: true });
  if (error) throw new Error(`Supabase transactions read failed: ${error.message}`);
  return data ?? [];
}

export async function getSupabaseClosedTrades(portfolioId: string) {
  const { data, error } = await getSupabaseBrowserClient()
    .from('closed_trades').select('*').eq('portfolio_id', portfolioId).order('sell_date', { ascending: true });
  if (error) throw new Error(`Supabase closed trades read failed: ${error.message}`);
  return data ?? [];
}
