export const API_CONTRACT_VERSION = 1 as const;
export const API_PREFIX = '/api/' as const;
export const SHEETS_API_PREFIX = '/api/sheets/' as const;

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

export type ApiRouteKey = keyof typeof API_ROUTES;
export type ApiMethod = typeof API_ROUTE_METHODS[ApiRouteKey][number];

const API_ROUTE_KEYS_BY_PATH = Object.fromEntries(
  Object.entries(API_ROUTES).map(([key, path]) => [path, key]),
) as Record<string, ApiRouteKey>;

export function apiRouteKeyForPath(path: string): ApiRouteKey | null {
  return API_ROUTE_KEYS_BY_PATH[path] ?? null;
}

export function allowedApiMethodsForPath(path: string): readonly ApiMethod[] | null {
  const key = apiRouteKeyForPath(path);
  return key ? API_ROUTE_METHODS[key] : null;
}

export function isApiRouteMethodAllowed(path: string, method: string): boolean {
  const allowed = allowedApiMethodsForPath(path);
  return Boolean(allowed?.includes(method.toUpperCase() as ApiMethod));
}

export type ApiRuntime = 'cloudflare-workers' | 'express-vite';

export interface ApiHealthResponse {
  status: 'ok';
  runtime: ApiRuntime;
  contractVersion: typeof API_CONTRACT_VERSION;
}

export type ApiAuthSource = 'service_account' | 'oauth_bearer';

export interface ApiErrorResponse {
  error: string;
  retryable?: boolean;
  isAuthError?: boolean;
  details?: unknown;
  authSource?: ApiAuthSource;
}

export interface ApiErrorOptions {
  retryable?: boolean;
  isAuthError?: boolean;
  details?: unknown;
  authSource?: ApiAuthSource;
}

export interface PriceTickRequest {
  positions: unknown[];
  tickers: unknown[];
  force: boolean;
}

export type PortfolioSaveRequest = Record<string, unknown>;

export interface HistoricalPriceQuery {
  tickers: string[];
  startDate?: string;
  endDate?: string;
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
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return String(error);
}

export function isAuthHttpStatus(status: number): boolean {
  return status === 401 || status === 403;
}

export function classifyAuthErrorStatus(error: unknown): 401 | 500 {
  const message = apiErrorMessage(error);
  return /(?:supabase|google|oauth|authorization|auth(?:entication)?|bearer|jwt|session|credential)[\s\S]{0,48}(?:token|missing|invalid|expired|denied|required|unauthenticated|credential)|(?:missing|invalid|expired)[\s\S]{0,32}(?:access token|bearer token|authorization)/i.test(message)
    ? 401
    : 500;
}

export function createApiErrorResponse(
  error: unknown,
  options: ApiErrorOptions = {},
): ApiErrorResponse {
  const body: ApiErrorResponse = {
    error: apiErrorMessage(error),
  };

  if (options.retryable !== undefined) body.retryable = options.retryable;
  if (options.isAuthError !== undefined) body.isAuthError = options.isAuthError;
  if (options.details !== undefined) body.details = options.details;
  if (options.authSource !== undefined) body.authSource = options.authSource;

  return body;
}

export function createClassifiedAuthErrorResponse(error: unknown): {
  status: 401 | 500;
  body: ApiErrorResponse;
} {
  const status = classifyAuthErrorStatus(error);
  return {
    status,
    body: createApiErrorResponse(error, {
      isAuthError: status === 401,
    }),
  };
}

export function parsePortfolioSaveRequest(body: unknown): PortfolioSaveRequest {
  return body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
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

export function parseHistoricalPriceQuery(input: {
  tickers: unknown;
  startDate?: unknown;
  endDate?: unknown;
}): HistoricalPriceQuery {
  const startDate = String(input.startDate ?? '').trim();
  const endDate = String(input.endDate ?? '').trim();
  return {
    tickers: requireTickerList(input.tickers),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  };
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
