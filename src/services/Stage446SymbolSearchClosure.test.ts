import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  API_ROUTES,
  parseTradingViewSymbolSearchResponse,
  requireSymbolSearchText,
} from '../api/contracts';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const read = (relativePath: string) =>
  readFileSync(join(projectRoot, relativePath), 'utf8');

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(root)) {
    const full = join(root, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name) || /\.test\.(ts|tsx)$/.test(name)) continue;
    out.push(full);
  }
  return out;
}

describe('Stage 4.4.6 symbol-search contract and Stage 4.4 exit closure', () => {
  it('normalizes both known TradingView symbol-search envelope shapes', () => {
    const legacyArray = [{
      symbol: 'SWDY',
      ticker: 'SWDY',
      description: 'Elsewedy Electric',
      exchange: 'EGX',
      logoid: 'elsewedy-electric',
      logo_urls: [' https://cdn.test/swdy.svg ', ''],
      providerOnly: 'ignored',
    }];

    expect(parseTradingViewSymbolSearchResponse(legacyArray)).toEqual([{
      symbol: 'SWDY',
      ticker: 'SWDY',
      description: 'Elsewedy Electric',
      exchange: 'EGX',
      logoid: 'elsewedy-electric',
      logo_urls: ['https://cdn.test/swdy.svg'],
    }]);

    expect(parseTradingViewSymbolSearchResponse({
      symbols: [{
        symbol: 'EGX:COMI',
        ticker: 'COMI',
        description: 'Commercial International Bank',
        type: 'stock',
        exchange: 'EGX',
      }],
      symbols_remaining: 0,
    })).toEqual([{
      symbol: 'EGX:COMI',
      ticker: 'COMI',
      description: 'Commercial International Bank',
      type: 'stock',
      exchange: 'EGX',
    }]);

    expect(parseTradingViewSymbolSearchResponse({
      data: [{ ticker: 'ORAS', logoid: 'orascom-construction' }],
    })).toEqual([{
      ticker: 'ORAS',
      logoid: 'orascom-construction',
    }]);
  });

  it('rejects malformed symbol-search envelopes while allowing empty valid results', () => {
    expect(parseTradingViewSymbolSearchResponse([])).toEqual([]);
    expect(parseTradingViewSymbolSearchResponse({ symbols: [] })).toEqual([]);
    expect(() => parseTradingViewSymbolSearchResponse({}))
      .toThrow('TradingView symbol search response is missing a symbol array.');
    expect(requireSymbolSearchText('  SWDY  ')).toBe('SWDY');
  });

  it('makes Worker and Express parse and normalize the same symbol-search response', () => {
    const worker = read('worker.ts');
    const server = read('server.ts');

    for (const runtime of [worker, server]) {
      expect(runtime).toContain('API_ROUTES.tradingViewSymbolSearch');
      expect(runtime).toContain('requireSymbolSearchText');
      expect(runtime).toContain('parseTradingViewSymbolSearchResponse');
      expect(runtime).toContain('TradingView symbol search returned invalid JSON.');
      expect(runtime).toContain('retryable: true');
      expect(runtime).toContain('502');
    }

    const workerStart = worker.indexOf('path === API_ROUTES.tradingViewSymbolSearch');
    const workerEnd = worker.indexOf('path === API_ROUTES.sheetsServiceAccountStatus', workerStart);
    const workerBlock = worker.slice(workerStart, workerEnd);

    const serverStart = server.indexOf('app.get(API_ROUTES.tradingViewSymbolSearch');
    const serverEnd = server.indexOf('const migrationPage', serverStart);
    const serverBlock = server.slice(serverStart, serverEnd);

    expect(workerBlock).not.toContain('new Response(tvResponse.body');
    expect(serverBlock).not.toContain('res.json(await tvResponse.json())');
  });

  it('keeps the browser logo consumer on the canonical route and response contract', () => {
    const logos = read('src/services/tradingviewLogos.ts');

    expect(logos).toContain('API_ROUTES.tradingViewSymbolSearch');
    expect(logos).toContain('parseTradingViewSymbolSearchResponse(await res.json())');
    expect(logos).not.toContain('/api/tradingview/symbol-search');
  });

  it('removes ordinary app-owned hard-coded API route literals at the Stage 4.4 exit', () => {
    const allowed = new Set([
      'src/api/contracts.ts',
    ]);

    const offenders = sourceFiles(join(projectRoot, 'src'))
      .map((file) => ({
        file,
        relative: relative(projectRoot, file).replace(/\\/g, '/'),
        content: readFileSync(file, 'utf8'),
      }))
      .filter(({ relative }) => !allowed.has(relative))
      .filter(({ content }) => /['"`]\/api\//.test(content))
      .map(({ relative }) => relative)
      .sort();

    expect(offenders).toEqual([]);
  });

  it('retains one canonical symbol-search route at Stage 4.4 exit', () => {
    expect(API_ROUTES.tradingViewSymbolSearch).toBe('/api/tradingview/symbol-search');
  });
});
