import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ operations: [] as any[], error: null as any }));
vi.mock('./supabaseBrowser', () => ({ getSupabaseBrowserClient: () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
  from: (table: string) => {
    const op: any = { table, filters: [] };
    state.operations.push(op);
    const q: any = {
      select: () => q, eq: (key: string, value: any) => { op.filters.push([key, value]); return q; },
      or: (filter: string) => { op.or = filter; return q; },
      maybeSingle: async () => ({ data: { id: 'portfolio' }, error: null }),
      update: (value: any) => { op.update = value; return q; },
      upsert: (value: any, options: any) => { op.upsert = value; op.options = options; return q; },
      then: (resolve: any) => resolve({ error: state.error }),
    };
    return q;
  },
}) }));
import { savePriceTickToSupabase } from './supabasePersistence';
import type { Position, EGXTicker } from '../types';
beforeEach(() => { state.operations = []; state.error = null; });
it('updates only valuation fields on existing owned positions with an atomic freshness predicate', async () => {
  const time = '2026-09-27T10:00:00Z';
  await savePriceTickToSupabase([{ id: 'p', ticker: 'TEST', shares: 999, currentPrice: 10, priceUpdatedAt: time } as Position], [], true);
  const op = state.operations.find(op => op.table === 'positions');
  expect(op.upsert).toBeUndefined();
  expect(op.update).toEqual({ current_price: 10, day_change: null, day_change_percent: null, price_updated_at: time });
  expect(op.filters).toEqual([['id', 'p'], ['portfolio_id', 'portfolio']]);
  expect(op.or).toContain(`price_updated_at.lte.${time}`);
});
it('inserts missing symbols without overwriting existing quotes, then conditionally updates', async () => {
  await savePriceTickToSupabase([], [{ ticker: 'TEST', lastPrice: 10, priceUpdatedAt: '2026-09-27T10:00:00Z' } as EGXTicker], true);
  const ops = state.operations.filter(op => op.table === 'tickers');
  expect(ops[0].options.ignoreDuplicates).toBe(true);
  expect(ops[1].or).toBe('price_updated_at.is.null,price_updated_at.lte.2026-09-27T10:00:00.000Z');
});
it('surfaces database failure so sync cannot claim persistence succeeded', async () => {
  state.error = new Error('database unavailable');
  await expect(savePriceTickToSupabase([], [], true)).rejects.toThrow('database unavailable');
});
