import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTradingViewEGXPrices } from './marketPriceSync';
import { EGX_SCANNER_PAYLOAD } from './scannerRequest';
afterEach(() => vi.unstubAllGlobals());
const response = (currency = 'EGP') => ({ ok: true, json: async () => ({ data: [{ d: ['TEST', 'Test', '', 10, 0, 0, 100, 11, 9, 12, 8, 'Other', 50, 'Industry', 'ISIN', currency] }] }) });
describe('scanner recovery and decoding', () => {
  it('retries proxy errors and uses a bounded uncached request', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response());
    vi.stubGlobal('fetch', fetcher);
    const result = await fetchTradingViewEGXPrices();
    expect(result.quotes.TEST.price).toBe(10);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toBe('/api/egx/scan');
    expect(fetcher.mock.calls[1][1]).toMatchObject({ cache: 'no-store', body: JSON.stringify(EGX_SCANNER_PAYLOAD), signal: expect.any(AbortSignal) });
  });
  it('rejects alternate currency quotes with the shared proxy column contract', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response('USD')));
    expect((await fetchTradingViewEGXPrices()).quotes).toEqual({});
  });
  it('recovers from a successful HTTP response containing an invalid payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({}) }).mockResolvedValueOnce(response()));
    expect((await fetchTradingViewEGXPrices()).quotes.TEST.price).toBe(10);
  });
});
