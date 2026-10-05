import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  API_ROUTES,
  parseEgxScannerRequest,
  parseEgxScannerResponse,
} from '../api/contracts';
import { EGX_SCANNER_PAYLOAD } from './scannerRequest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.4.5 scanner request/response contract closure', () => {
  it('keeps the app-facing scanner request small and backward-compatible', () => {
    expect(parseEgxScannerRequest({ purpose: 'portfolio-prices' })).toEqual({
      purpose: 'portfolio-prices',
    });
    expect(parseEgxScannerRequest({ purpose: 'sector-momentum' })).toEqual({
      purpose: 'sector-momentum',
    });

    // Older cached clients posted the raw TradingView payload. The app API
    // never consumed those provider fields, so a missing purpose remains valid.
    expect(parseEgxScannerRequest(EGX_SCANNER_PAYLOAD)).toEqual({
      purpose: 'portfolio-prices',
    });

    expect(() => parseEgxScannerRequest({ purpose: 'unknown-purpose' }))
      .toThrow('Unsupported EGX scanner purpose');
  });

  it('normalizes the TradingView scanner success shape and rejects malformed rows', () => {
    expect(parseEgxScannerResponse({
      totalCount: 2,
      data: [
        { s: 'EGX:COMI', d: ['COMI', 'Commercial International Bank', '', 75] },
        { d: ['SWDY', 'Elsewedy Electric', '', 82] },
      ],
      ignoredProviderField: true,
    })).toEqual({
      totalCount: 2,
      data: [
        { s: 'EGX:COMI', d: ['COMI', 'Commercial International Bank', '', 75] },
        { d: ['SWDY', 'Elsewedy Electric', '', 82] },
      ],
    });

    expect(() => parseEgxScannerResponse({}))
      .toThrow('TradingView scanner response is missing a data array.');
    expect(() => parseEgxScannerResponse({ data: [{ s: 'EGX:COMI' }] }))
      .toThrow('TradingView scanner response contains a row without positional data.');
  });

  it('makes Worker and Express validate scanner requests and normalize provider responses', () => {
    const worker = read('worker.ts');
    const server = read('server.ts');

    for (const runtime of [worker, server]) {
      expect(runtime).toContain('API_ROUTES.egxScan');
      expect(runtime).toContain('parseEgxScannerRequest');
      expect(runtime).toContain('parseEgxScannerResponse');
      expect(runtime).toContain('JSON.stringify(EGX_SCANNER_PAYLOAD)');
      expect(runtime).toContain('status');
      expect(runtime).toContain('502');
    }

    const workerScannerStart = worker.indexOf('path === API_ROUTES.egxScan');
    const workerScannerEnd = worker.indexOf('path === API_ROUTES.tradingViewSymbolSearch', workerScannerStart);
    const workerScannerBlock = worker.slice(workerScannerStart, workerScannerEnd);

    const serverScannerStart = server.indexOf('app.post(API_ROUTES.egxScan');
    const serverScannerEnd = server.indexOf('app.get(API_ROUTES.tradingViewSymbolSearch', serverScannerStart);
    const serverScannerBlock = server.slice(serverScannerStart, serverScannerEnd);

    expect(workerScannerBlock).not.toContain('new Response(tvResponse.body');
    expect(serverScannerBlock).not.toContain('res.json(await tvResponse.json())');
  });

  it('keeps provider payload ownership out of same-origin scanner consumers', () => {
    const market = read('src/services/marketPriceSync.ts');
    const sector = read('src/services/sectorMomentum.ts');

    expect(market).toContain('API_ROUTES.egxScan');
    expect(market).toContain("purpose: 'portfolio-prices'");
    expect(market).toContain("'https://scanner.tradingview.com/egypt/scan'");
    expect(market).toContain('body: EGX_SCANNER_PAYLOAD');

    expect(sector).toContain('endpoint = API_ROUTES.egxScan');
    expect(sector).toContain("purpose: 'sector-momentum'");
    expect(sector).toContain('parseEgxScannerResponse(payload)');
  });

  it('retains the positional provider column contract in one integration module', () => {
    expect(EGX_SCANNER_PAYLOAD.columns.slice(0, 16)).toEqual([
      'name',
      'description',
      'logoid',
      'close',
      'change',
      'change_abs',
      'volume',
      'high',
      'low',
      'high_52_week',
      'low_52_week',
      'sector',
      'RSI',
      'industry',
      'isin',
      'currency',
    ]);
    expect(EGX_SCANNER_PAYLOAD.columns).toContain('average_volume_10d_calc');
    expect(EGX_SCANNER_PAYLOAD.columns).toContain('relative_volume_10d_calc');
    expect(API_ROUTES.egxScan).toBe('/api/egx/scan');
  });
});
