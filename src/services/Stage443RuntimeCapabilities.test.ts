import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  API_ROUTES,
  API_RUNTIME_CAPABILITIES,
  API_RUNTIME_CAPABILITY_ROUTES,
  API_RUNTIME_UNAVAILABLE_CAPABILITY_RESPONSES,
  requireUnavailableRuntimeCapabilityResponse,
  runtimeSupportsCapability,
  unavailableRuntimeCapabilityResponse,
  type ApiRuntimeCapability,
} from '../api/contracts';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.4.3 runtime capability/deprecation contract validation', () => {
  const capabilities = Object.keys(
    API_RUNTIME_CAPABILITY_ROUTES,
  ) as ApiRuntimeCapability[];

  it('defines one route owner for every runtime capability', () => {
    expect(capabilities.sort()).toEqual([
      'dailyHistoryRepair',
      'firestoreMigration',
      'googleServiceAccount',
      'intradayHistoryRepair',
    ].sort());

    for (const capability of capabilities) {
      const routeKey = API_RUNTIME_CAPABILITY_ROUTES[capability];
      expect(API_ROUTES[routeKey]).toMatch(/^\/api\//);
    }
  });

  it('treats capability booleans as implementation support, not current configuration', () => {
    for (const capability of capabilities) {
      expect(runtimeSupportsCapability('cloudflare-workers', capability))
        .toBe(API_RUNTIME_CAPABILITIES['cloudflare-workers'][capability]);
      expect(runtimeSupportsCapability('express-vite', capability))
        .toBe(API_RUNTIME_CAPABILITIES['express-vite'][capability]);
    }

    expect(runtimeSupportsCapability('express-vite', 'googleServiceAccount')).toBe(true);
    expect(runtimeSupportsCapability('express-vite', 'firestoreMigration')).toBe(true);
  });

  it('provides an explicit unavailable response for every unsupported Worker capability', () => {
    for (const capability of capabilities) {
      expect(API_RUNTIME_CAPABILITIES['cloudflare-workers'][capability]).toBe(false);
      expect(unavailableRuntimeCapabilityResponse('cloudflare-workers', capability))
        .toEqual(API_RUNTIME_UNAVAILABLE_CAPABILITY_RESPONSES['cloudflare-workers'][capability]);
    }

    expect(requireUnavailableRuntimeCapabilityResponse(
      'cloudflare-workers',
      'dailyHistoryRepair',
    )).toMatchObject({
      status: 503,
      body: {
        retryable: true,
      },
    });

    expect(requireUnavailableRuntimeCapabilityResponse(
      'cloudflare-workers',
      'intradayHistoryRepair',
    )).toEqual({
      status: 200,
      body: {
        data: {
          requestedTickers: [],
          backfilledTickers: [],
          writtenRows: 0,
          failures: [],
        },
        deprecated: true,
      },
    });

    expect(requireUnavailableRuntimeCapabilityResponse(
      'cloudflare-workers',
      'googleServiceAccount',
    )).toMatchObject({
      status: 200,
      body: {
        configured: false,
        serviceAccountEmail: null,
      },
    });

    expect(requireUnavailableRuntimeCapabilityResponse(
      'cloudflare-workers',
      'firestoreMigration',
    )).toEqual({
      status: 404,
      body: {
        error: 'Migration endpoint is disabled.',
      },
    });
  });

  it('does not manufacture unavailable responses for supported Express capabilities', () => {
    for (const capability of capabilities) {
      expect(API_RUNTIME_CAPABILITIES['express-vite'][capability]).toBe(true);
      expect(unavailableRuntimeCapabilityResponse('express-vite', capability)).toBeNull();
    }

    expect(() => requireUnavailableRuntimeCapabilityResponse(
      'express-vite',
      'dailyHistoryRepair',
    )).toThrow('Missing unavailable-capability response contract');
  });

  it('drives every intentional Worker limitation from the shared capability policy', () => {
    const worker = read('worker.ts');

    for (const capability of capabilities) {
      expect(worker).toContain(`"${capability}"`);
    }

    expect(worker.match(/requireUnavailableRuntimeCapabilityResponse\(/g)?.length).toBe(4);
    expect(worker).not.toContain('deprecated: true');
    expect(worker).not.toContain('Migration endpoint is disabled.');
    expect(worker).not.toContain('Daily history is maintained by the Node-based scheduled ingestion workflow.');
  });

  it('keeps Express handlers present for every capability it declares as supported', () => {
    const server = read('server.ts');

    for (const capability of capabilities) {
      const routeKey = API_RUNTIME_CAPABILITY_ROUTES[capability];
      expect(API_RUNTIME_CAPABILITIES['express-vite'][capability]).toBe(true);
      expect(server).toContain(`API_ROUTES.${routeKey}`);
    }

    expect(server).toContain('ensurePortfolioHistoricalPrices');
    expect(server).toContain('ensurePortfolioIntradayPrices');
    expect(server).toContain('handleGetServiceAccountStatus');
    expect(server).toContain('runFirestoreSupabaseMigration');
  });

  it('preserves the deprecated intraday no-op as an explicit compatibility contract', () => {
    const response = requireUnavailableRuntimeCapabilityResponse(
      'cloudflare-workers',
      'intradayHistoryRepair',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        requestedTickers: [],
        backfilledTickers: [],
        writtenRows: 0,
        failures: [],
      },
      deprecated: true,
    });
  });
});
