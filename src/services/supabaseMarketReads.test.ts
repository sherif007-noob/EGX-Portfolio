import { describe, expect, it, vi, beforeEach } from 'vitest';
const state = vi.hoisted(() => ({ pages: [] as any[][], queries: [] as any[] }));
vi.mock('./supabaseBrowser', () => ({ getSupabaseBrowserClient: () => ({
  from: (table: string) => {
    const record = { table, orders: [] as string[], range: [] as number[] };
    state.queries.push(record);
    const q: any = {
      select: () => q, in: () => q, eq: () => q, gte: () => q, lte: () => q,
      order: (column: string) => { record.orders.push(column); return q; },
      range: (a: number, b: number) => { record.range = [a, b]; return Promise.resolve({ data: state.pages.shift(), error: null }); },
    };
    return q;
  },
}) }));
import { loadHistoricalPricesFromSupabase, loadIntradayPricesFromSupabase } from './supabasePersistence';
beforeEach(() => { state.pages = [Array.from({ length: 1000 }, (_, id) => ({ id })), [{ id: 1000 }]]; state.queries = []; });
describe('complete market history pagination', () => {
  it('loads daily history beyond the default 1000 row cap', async () => {
    const rows = await loadHistoricalPricesFromSupabase(['TEST'], '2020-01-01', '2026-09-27');
    expect(rows).toHaveLength(1001);
    expect(state.queries.map(q => q.range)).toEqual([[0, 999], [1000, 1999]]);
    expect(state.queries.every(q => q.orders.join() === 'trading_date,ticker')).toBe(true);
  });
  it('orders equal-time candles by ticker on every page', async () => {
    expect(await loadIntradayPricesFromSupabase(['AAA', 'BBB'], '2026-09-27T00:00:00Z', '2026-09-27T23:59:59Z', 1)).toHaveLength(1001);
    expect(state.queries.every(q => q.orders.join() === 'bar_timestamp,ticker')).toBe(true);
  });
});
