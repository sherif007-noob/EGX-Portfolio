export const API_CONTRACT_VERSION = 1 as const;

export const API_ROUTES = {
  health: '/api/health',
  supabasePortfolio: '/api/supabase/portfolio',
  supabasePriceTick: '/api/supabase/price-tick',
  supabasePriceHistory: '/api/supabase/price-history',
  supabasePriceHistoryEnsure: '/api/supabase/price-history/ensure',
  supabaseIntradayHistoryEnsure: '/api/supabase/intraday-history/ensure',
  egxScan: '/api/egx/scan',
  tradingViewSymbolSearch: '/api/tradingview/symbol-search',
  sheetsServiceAccountStatus: '/api/sheets/service-account-status',
  sheetsMetadata: '/api/sheets/metadata',
  sheetsValues: '/api/sheets/values',
  sheetsAppend: '/api/sheets/append',
  sheetsBatchUpdate: '/api/sheets/batchUpdate',
  sheetsDriveFiles: '/api/sheets/drive-files',
  firestoreSupabaseMigration: '/api/migration/firestore-to-supabase',
} as const;

export const API_ROUTE_METHODS = {
  health: ['GET'],
  supabasePortfolio: ['GET', 'PUT'],
  supabasePriceTick: ['POST'],
  supabasePriceHistory: ['GET'],
  supabasePriceHistoryEnsure: ['POST'],
  supabaseIntradayHistoryEnsure: ['POST'],
  egxScan: ['POST'],
  tradingViewSymbolSearch: ['GET'],
  sheetsServiceAccountStatus: ['GET'],
  sheetsMetadata: ['GET'],
  sheetsValues: ['GET', 'PUT'],
  sheetsAppend: ['POST'],
  sheetsBatchUpdate: ['POST'],
  sheetsDriveFiles: ['GET'],
  firestoreSupabaseMigration: ['POST'],
} as const satisfies Record<keyof typeof API_ROUTES, readonly string[]>;

export type ApiRuntime = 'cloudflare-workers' | 'express-vite';

export interface ApiHealthResponse {
  status: 'ok';
  runtime: ApiRuntime;
  contractVersion: typeof API_CONTRACT_VERSION;
}

export interface ApiErrorResponse {
  error: string;
  retryable?: boolean;
  isAuthError?: boolean;
}

export interface PriceTickRequest {
  positions: unknown[];
  tickers: unknown[];
  force: boolean;
}

export interface HistoricalBackfillTargetContract {
  ticker: string;
  startDate?: string;
}

export interface HistoricalEnsureRequest {
  targets: HistoricalBackfillTargetContract[];
}

export function createHealthResponse(runtime: ApiRuntime): ApiHealthResponse {
  return {
    status: 'ok',
    runtime,
    contractVersion: API_CONTRACT_VERSION,
  };
}

export function apiErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function classifyAuthErrorStatus(error: unknown): 401 | 500 {
  return /token|authorization|unauthenticated|invalid/i.test(apiErrorMessage(error))
    ? 401
    : 500;
}

export function parsePriceTickRequest(body: unknown): PriceTickRequest {
  const input = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  return {
    positions: Array.isArray(input.positions) ? input.positions : [],
    tickers: Array.isArray(input.tickers) ? input.tickers : [],
    force: input.force === true,
  };
}

export function parseTickerList(value: unknown): string[] {
  return String(value ?? '')
    .split(',')
    .map((ticker) => ticker.trim())
    .filter(Boolean);
}

export function requireTickerList(value: unknown): string[] {
  const tickers = parseTickerList(value);
  if (!tickers.length) throw new Error('At least one ticker is required.');
  return tickers;
}

function parseBackfillTargets(
  body: unknown,
  emptyMessage: string,
): HistoricalBackfillTargetContract[] {
  const input = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const rawTargets = Array.isArray(input.targets) ? input.targets : [];
  const targets = rawTargets
    .filter((target): target is Record<string, unknown> => Boolean(target && typeof target === 'object'))
    .map((target) => ({
      ticker: String(target.ticker ?? '').trim(),
      ...(String(target.startDate ?? '').trim()
        ? { startDate: String(target.startDate).trim() }
        : {}),
    }))
    .filter((target) => Boolean(target.ticker));

  if (!targets.length) throw new Error(emptyMessage);
  return targets;
}

export function parseHistoricalEnsureRequest(body: unknown): HistoricalEnsureRequest {
  return {
    targets: parseBackfillTargets(
      body,
      'At least one historical backfill target is required.',
    ),
  };
}

export function parseIntradayEnsureRequest(body: unknown): HistoricalEnsureRequest {
  return {
    targets: parseBackfillTargets(
      body,
      'At least one intraday backfill target is required.',
    ),
  };
}

export function requireSymbolSearchText(value: unknown): string {
  const query = String(value ?? '').trim();
  if (!query) throw new Error("Query parameter 'text' is required");
  return query;
}

export const API_RUNTIME_CAPABILITIES = {
  'cloudflare-workers': {
    dailyHistoryRepair: false,
    intradayHistoryRepair: false,
    googleServiceAccount: false,
    firestoreMigration: false,
  },
  'express-vite': {
    dailyHistoryRepair: true,
    intradayHistoryRepair: true,
    googleServiceAccount: true,
    firestoreMigration: true,
  },
} as const satisfies Record<ApiRuntime, {
  dailyHistoryRepair: boolean;
  intradayHistoryRepair: boolean;
  googleServiceAccount: boolean;
  firestoreMigration: boolean;
}>;
