import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  API_ROUTES,
  API_ROUTE_METHODS,
  allowedApiMethodsForPath,
  apiRouteKeyForPath,
  isApiRouteMethodAllowed,
  parseHistoricalPriceQuery,
  parsePortfolioSaveRequest,
  parsePriceTickRequest,
  requireSymbolSearchText,
} from '../api/contracts';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

function expressRouteMatrix(source: string): Map<string, Set<string>> {
  const matrix = new Map<string, Set<string>>();
  const pattern = /app\.(get|post|put)\(API_ROUTES\.([A-Za-z0-9_]+)/g;
  for (const match of source.matchAll(pattern)) {
    const method = match[1].toUpperCase();
    const key = match[2];
    const methods = matrix.get(key) ?? new Set<string>();
    methods.add(method);
    matrix.set(key, methods);
  }
  return matrix;
}

describe('Stage 4.4.1 shared route/request contract authority', () => {
  it('resolves every canonical API path back to one route key and method set', () => {
    for (const [key, path] of Object.entries(API_ROUTES)) {
      expect(apiRouteKeyForPath(path)).toBe(key);
      expect(allowedApiMethodsForPath(path)).toEqual(API_ROUTE_METHODS[key as keyof typeof API_ROUTE_METHODS]);

      for (const method of API_ROUTE_METHODS[key as keyof typeof API_ROUTE_METHODS]) {
        expect(isApiRouteMethodAllowed(path, method)).toBe(true);
        expect(isApiRouteMethodAllowed(path, method.toLowerCase())).toBe(true);
      }
    }

    expect(apiRouteKeyForPath('/api/not-a-real-route')).toBeNull();
    expect(allowedApiMethodsForPath('/api/not-a-real-route')).toBeNull();
    expect(isApiRouteMethodAllowed('/api/not-a-real-route', 'GET')).toBe(false);
    expect(isApiRouteMethodAllowed(API_ROUTES.health, 'POST')).toBe(false);
  });

  it('keeps Express registrations exactly aligned with the shared method matrix', () => {
    const server = read('server.ts');
    const matrix = expressRouteMatrix(server);

    for (const [key, expectedMethods] of Object.entries(API_ROUTE_METHODS)) {
      expect([...matrix.get(key) ?? []].sort()).toEqual([...expectedMethods].sort());
    }

    expect(server).toContain('const allowedMethods = allowedApiMethodsForPath(req.path)');
    expect(server).toContain('isApiRouteMethodAllowed(req.path, req.method)');
    expect(server.indexOf('const allowedMethods = allowedApiMethodsForPath(req.path)'))
      .toBeLessThan(server.indexOf('app.get(API_ROUTES.health'));
    expect(server).toContain('res.setHeader("Allow", allowedMethods.join(", "))');
    expect(server).toContain('status(405)');
  });

  it('keeps Worker routing behind the same method authority and covers every declared route', () => {
    const worker = read('worker.ts');

    expect(worker).toContain('const allowedMethods = allowedApiMethodsForPath(path)');
    expect(worker).toContain('!isApiRouteMethodAllowed(path, request.method)');
    expect(worker.indexOf('const allowedMethods = allowedApiMethodsForPath(path)'))
      .toBeLessThan(worker.indexOf('path === API_ROUTES.health'));
    expect(worker).toContain('"allow": allowedMethods.join(", ")');
    expect(worker).toContain('status: 405');

    for (const key of Object.keys(API_ROUTES)) {
      expect(worker).toContain(`API_ROUTES.${key}`);
    }
  });

  it('keeps runtime route literals out of Worker and Express', () => {
    for (const source of [read('worker.ts'), read('server.ts')]) {
      expect(source).not.toMatch(/['"]\/api\//);
    }
  });

  it('normalizes shared portfolio and history requests identically before runtime handlers', () => {
    const worker = read('worker.ts');
    const server = read('server.ts');

    for (const runtime of [worker, server]) {
      expect(runtime).toContain('parsePortfolioSaveRequest');
      expect(runtime).toContain('parseHistoricalPriceQuery');
      expect(runtime).toContain('parsePriceTickRequest');
      expect(runtime).toContain('requireSymbolSearchText');
    }

    const payload = {
      positions: [{ ticker: 'COMI' }],
      transactions: [{ id: 'tx-1' }],
      cashBalance: 1000,
    };
    expect(parsePortfolioSaveRequest(payload)).toBe(payload);
    expect(parsePortfolioSaveRequest(null)).toEqual({});
    expect(parsePortfolioSaveRequest([])).toEqual({});

    expect(parseHistoricalPriceQuery({
      tickers: ' COMI, SWDY ,, ',
      startDate: ' 2026-09-01 ',
      endDate: ' 2026-10-01 ',
    })).toEqual({
      tickers: ['COMI', 'SWDY'],
      startDate: '2026-09-01',
      endDate: '2026-10-01',
    });

    expect(parseHistoricalPriceQuery({ tickers: 'COMI' })).toEqual({
      tickers: ['COMI'],
    });
    expect(() => parseHistoricalPriceQuery({ tickers: '' }))
      .toThrow('At least one ticker is required.');

    expect(parsePriceTickRequest({ positions: [], tickers: [], force: true }))
      .toEqual({ positions: [], tickers: [], force: true });
    expect(requireSymbolSearchText('  COMI  ')).toBe('COMI');
  });
});
