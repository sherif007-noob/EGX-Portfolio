import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  API_CONTRACT_VERSION,
  API_ROUTES,
  API_ROUTE_METHODS,
  API_RUNTIME_CAPABILITIES,
  classifyAuthErrorStatus,
  createHealthResponse,
  parseHistoricalEnsureRequest,
  parseIntradayEnsureRequest,
  parsePriceTickRequest,
  requireSymbolSearchText,
  requireTickerList,
} from '../api/contracts';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.4 shared Worker/Express API contracts', () => {
  it('defines one route and method authority for both runtimes', () => {
    expect(API_ROUTES.health).toBe('/api/health');
    expect(API_ROUTES.supabasePortfolio).toBe('/api/supabase/portfolio');
    expect(API_ROUTES.supabasePriceTick).toBe('/api/supabase/price-tick');
    expect(API_ROUTES.supabasePriceHistoryEnsure).toBe('/api/supabase/price-history/ensure');
    expect(API_ROUTES.supabaseIntradayHistoryEnsure).toBe('/api/supabase/intraday-history/ensure');
    expect(API_ROUTES.egxScan).toBe('/api/egx/scan');
    expect(API_ROUTES.tradingViewSymbolSearch).toBe('/api/tradingview/symbol-search');

    expect(API_ROUTE_METHODS.supabasePortfolio).toEqual(['GET', 'PUT']);
    expect(API_ROUTE_METHODS.supabasePriceTick).toEqual(['POST']);
    expect(API_ROUTE_METHODS.egxScan).toEqual(['POST']);
    expect(API_ROUTE_METHODS.tradingViewSymbolSearch).toEqual(['GET']);
  });

  it('makes Worker and Express consume the shared route/request/auth contracts', () => {
    const worker = read('worker.ts');
    const server = read('server.ts');

    for (const runtime of [worker, server]) {
      expect(runtime).toContain("from './src/api/contracts'");
      expect(runtime).toContain('API_ROUTES.supabasePortfolio');
      expect(runtime).toContain('API_ROUTES.supabasePriceTick');
      expect(runtime).toContain('API_ROUTES.supabasePriceHistory');
      expect(runtime).toContain('API_ROUTES.supabasePriceHistoryEnsure');
      expect(runtime).toContain('API_ROUTES.supabaseIntradayHistoryEnsure');
      expect(runtime).toContain('API_ROUTES.egxScan');
      expect(runtime).toContain('API_ROUTES.tradingViewSymbolSearch');
      expect(runtime).toContain('parsePortfolioSaveRequest');
      expect(runtime).toContain('parsePriceTickRequest');
      expect(runtime).toContain('parseHistoricalPriceQuery');
      expect(runtime).toContain('requireSymbolSearchText');
      expect(runtime).toContain('classifyAuthErrorStatus');
      expect(runtime).toContain('createHealthResponse');
      expect(runtime).toContain('EGX_SCANNER_PAYLOAD');
    }

    expect(server).toContain('parseHistoricalEnsureRequest');
    expect(server).toContain('parseIntradayEnsureRequest');
  });

  it('keeps shared response and validation behavior deterministic', () => {
    expect(API_CONTRACT_VERSION).toBe(1);
    expect(createHealthResponse('cloudflare-workers')).toEqual({
      status: 'ok',
      runtime: 'cloudflare-workers',
      contractVersion: 1,
    });
    expect(createHealthResponse('express-vite')).toEqual({
      status: 'ok',
      runtime: 'express-vite',
      contractVersion: 1,
    });

    expect(classifyAuthErrorStatus(new Error('invalid authorization token'))).toBe(401);
    expect(classifyAuthErrorStatus(new Error('database unavailable'))).toBe(500);

    expect(parsePriceTickRequest({
      positions: [{ ticker: 'COMI' }],
      tickers: [{ ticker: 'COMI' }],
      force: true,
    })).toEqual({
      positions: [{ ticker: 'COMI' }],
      tickers: [{ ticker: 'COMI' }],
      force: true,
    });

    expect(requireTickerList(' COMI, SWDY ,,')).toEqual(['COMI', 'SWDY']);
    expect(() => requireTickerList('')).toThrow('At least one ticker is required.');
    expect(requireSymbolSearchText('  COMI  ')).toBe('COMI');
    expect(() => requireSymbolSearchText('')).toThrow("Query parameter 'text' is required");

    expect(parseHistoricalEnsureRequest({
      targets: [{ ticker: ' COMI ', startDate: '2026-09-01' }],
    })).toEqual({
      targets: [{ ticker: 'COMI', startDate: '2026-09-01' }],
    });
    expect(parseIntradayEnsureRequest({
      targets: [{ ticker: 'SWDY' }],
    })).toEqual({
      targets: [{ ticker: 'SWDY' }],
    });
  });

  it('documents intentional runtime capability differences instead of allowing silent drift', () => {
    expect(API_RUNTIME_CAPABILITIES['cloudflare-workers']).toEqual({
      dailyHistoryRepair: false,
      intradayHistoryRepair: false,
      googleServiceAccount: false,
      firestoreMigration: false,
    });
    expect(API_RUNTIME_CAPABILITIES['express-vite']).toEqual({
      dailyHistoryRepair: true,
      intradayHistoryRepair: true,
      googleServiceAccount: true,
      firestoreMigration: true,
    });

    const worker = read('worker.ts');
    expect(worker).toContain('deprecated: true');
    expect(worker).toContain('Daily history is maintained by the Node-based scheduled ingestion workflow.');
    expect(worker).toContain('Migration endpoint is disabled.');
  });
});
