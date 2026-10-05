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

export type EgxScannerPurpose = 'portfolio-prices' | 'sector-momentum';

export interface EgxScannerRequest {
  purpose: EgxScannerPurpose;
}

export interface EgxScannerRowContract {
  s?: string;
  d: unknown[];
}

export interface EgxScannerResponse {
  totalCount?: number;
  data: EgxScannerRowContract[];
}

export interface SheetsMetadataQuery {
  spreadsheetId: string;
}

export interface SheetsValuesQuery extends SheetsMetadataQuery {
  range: string;
}

export interface SheetsValuesWriteRequest extends SheetsValuesQuery {
  values: unknown[];
  valueInputOption: string;
}

export interface SheetsAppendRequest extends SheetsValuesWriteRequest {
  insertDataOption: string;
}

export interface SheetsBatchUpdateRequest extends SheetsMetadataQuery {
  requests: unknown[];
}

export interface SheetsServiceAccountStatusResponse {
  configured: boolean;
  serviceAccountEmail: string | null;
  instruction: string;
}

export interface SheetsInfoItem {
  title: string;
  sheetId: number;
}

export interface SheetsMetadataResponse {
  title: string;
  sheets: string[];
  sheetsInfo: SheetsInfoItem[];
  authSource: ApiAuthSource;
}

export interface SheetsValuesResponse {
  values: unknown[];
  range?: string;
  authSource: ApiAuthSource;
}

export interface SheetsWriteValuesResponse {
  success: true;
  updatedCells?: number;
  authSource: ApiAuthSource;
}

export interface SheetsAppendResponse {
  success: true;
  updates?: unknown;
  authSource: ApiAuthSource;
}

export interface SheetsBatchUpdateResponse {
  success: true;
  replies: unknown[];
  authSource: ApiAuthSource;
}

export interface SheetsDriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface SheetsDriveFilesResponse {
  files: SheetsDriveFile[];
  authSource: ApiAuthSource;
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

function apiObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function apiString(value: unknown): string {
  return String(value ?? '').trim();
}

export function parseSheetsMetadataQuery(input: {
  spreadsheetId?: unknown;
}): SheetsMetadataQuery {
  const spreadsheetId = apiString(input.spreadsheetId);
  if (!spreadsheetId) {
    throw new Error('Missing required query parameter "spreadsheetId"');
  }
  return { spreadsheetId };
}

export function parseSheetsValuesQuery(input: {
  spreadsheetId?: unknown;
  range?: unknown;
}): SheetsValuesQuery {
  const spreadsheetId = apiString(input.spreadsheetId);
  const range = apiString(input.range);
  if (!spreadsheetId || !range) {
    throw new Error('Missing "spreadsheetId" or "range"');
  }
  return { spreadsheetId, range };
}

export function parseSheetsValuesWriteRequest(body: unknown): SheetsValuesWriteRequest {
  const input = apiObject(body);
  const spreadsheetId = apiString(input.spreadsheetId);
  const range = apiString(input.range);
  if (!spreadsheetId || !range || !Array.isArray(input.values)) {
    throw new Error('Missing spreadsheetId, range, or values array');
  }
  return {
    spreadsheetId,
    range,
    values: input.values,
    valueInputOption: apiString(input.valueInputOption) || 'USER_ENTERED',
  };
}

export function parseSheetsAppendRequest(body: unknown): SheetsAppendRequest {
  const input = apiObject(body);
  const spreadsheetId = apiString(input.spreadsheetId);
  const range = apiString(input.range);
  if (!spreadsheetId || !range || !Array.isArray(input.values)) {
    throw new Error('Missing spreadsheetId, range, or values');
  }
  return {
    spreadsheetId,
    range,
    values: input.values,
    valueInputOption: apiString(input.valueInputOption) || 'USER_ENTERED',
    insertDataOption: apiString(input.insertDataOption) || 'INSERT_ROWS',
  };
}

export function parseSheetsBatchUpdateRequest(body: unknown): SheetsBatchUpdateRequest {
  const input = apiObject(body);
  const spreadsheetId = apiString(input.spreadsheetId);
  if (!spreadsheetId || !Array.isArray(input.requests)) {
    throw new Error('Missing spreadsheetId or requests array');
  }
  return {
    spreadsheetId,
    requests: input.requests,
  };
}

export function createSheetsServiceAccountStatusResponse(
  configured: boolean,
  serviceAccountEmail: string | null,
  instruction: string,
): SheetsServiceAccountStatusResponse {
  return { configured, serviceAccountEmail, instruction };
}

export function createSheetsMetadataResponse(
  providerData: unknown,
  authSource: ApiAuthSource,
): SheetsMetadataResponse {
  const data = apiObject(providerData);
  const properties = apiObject(data.properties);
  const rawSheets = Array.isArray(data.sheets) ? data.sheets : [];
  const sheetsInfo = rawSheets
    .map((sheet) => apiObject(apiObject(sheet).properties))
    .map((properties) => ({
      title: apiString(properties.title),
      sheetId: Number.isFinite(Number(properties.sheetId)) ? Number(properties.sheetId) : 0,
    }))
    .filter((sheet) => Boolean(sheet.title));

  return {
    title: apiString(properties.title),
    sheets: sheetsInfo.map((sheet) => sheet.title),
    sheetsInfo,
    authSource,
  };
}

export function createSheetsValuesResponse(
  providerData: unknown,
  authSource: ApiAuthSource,
): SheetsValuesResponse {
  const data = apiObject(providerData);
  const range = apiString(data.range);
  return {
    values: Array.isArray(data.values) ? data.values : [],
    ...(range ? { range } : {}),
    authSource,
  };
}

export function createSheetsWriteValuesResponse(
  providerData: unknown,
  authSource: ApiAuthSource,
): SheetsWriteValuesResponse {
  const data = apiObject(providerData);
  const updatedCells = Number(data.updatedCells);
  return {
    success: true,
    ...(Number.isFinite(updatedCells) ? { updatedCells } : {}),
    authSource,
  };
}

export function createSheetsAppendResponse(
  providerData: unknown,
  authSource: ApiAuthSource,
): SheetsAppendResponse {
  const data = apiObject(providerData);
  return {
    success: true,
    ...(data.updates !== undefined ? { updates: data.updates } : {}),
    authSource,
  };
}

export function createSheetsBatchUpdateResponse(
  providerData: unknown,
  authSource: ApiAuthSource,
): SheetsBatchUpdateResponse {
  const data = apiObject(providerData);
  return {
    success: true,
    replies: Array.isArray(data.replies) ? data.replies : [],
    authSource,
  };
}

export function createSheetsDriveFilesResponse(
  providerData: unknown,
  authSource: ApiAuthSource,
): SheetsDriveFilesResponse {
  const data = apiObject(providerData);
  const files = (Array.isArray(data.files) ? data.files : [])
    .map((file) => apiObject(file))
    .map((file) => ({
      id: apiString(file.id),
      name: apiString(file.name),
      ...(apiString(file.modifiedTime) ? { modifiedTime: apiString(file.modifiedTime) } : {}),
      ...(apiString(file.webViewLink) ? { webViewLink: apiString(file.webViewLink) } : {}),
    }))
    .filter((file) => Boolean(file.id && file.name));

  return { files, authSource };
}

export function parseEgxScannerRequest(body: unknown): EgxScannerRequest {
  const input = apiObject(body);
  const purpose = apiString(input.purpose);

  // Older app bundles sent the raw TradingView scanner payload to this route.
  // The proxy has always owned the provider request, so preserve those callers
  // by treating a missing purpose as the portfolio-price use case.
  if (!purpose) return { purpose: 'portfolio-prices' };
  if (purpose === 'portfolio-prices' || purpose === 'sector-momentum') {
    return { purpose };
  }
  throw new Error(`Unsupported EGX scanner purpose: ${purpose}`);
}

export function parseEgxScannerResponse(payload: unknown): EgxScannerResponse {
  const input = apiObject(payload);
  if (!Array.isArray(input.data)) {
    throw new Error('TradingView scanner response is missing a data array.');
  }

  const rows: EgxScannerRowContract[] = [];
  for (const rawRow of input.data) {
    const row = apiObject(rawRow);
    if (!Array.isArray(row.d)) {
      throw new Error('TradingView scanner response contains a row without positional data.');
    }
    const symbol = apiString(row.s);
    rows.push({
      ...(symbol ? { s: symbol } : {}),
      d: row.d,
    });
  }

  const totalCount = Number(input.totalCount);
  return {
    ...(Number.isFinite(totalCount) ? { totalCount } : {}),
    data: rows,
  };
}

export function parsePortfolioSaveRequest(body: unknown): PortfolioSaveRequest {
  return apiObject(body);
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

/**
 * "Capability" means the runtime contains the implementation. It does not mean
 * an optional feature is currently enabled/configured (for example the local
 * migration UI or a Google service account).
 */
export type ApiRuntimeCapability =
  keyof typeof API_RUNTIME_CAPABILITIES['cloudflare-workers'];

export const API_RUNTIME_CAPABILITY_ROUTES = {
  dailyHistoryRepair: 'supabasePriceHistoryEnsure',
  intradayHistoryRepair: 'supabaseIntradayHistoryEnsure',
  googleServiceAccount: 'sheetsServiceAccountStatus',
  firestoreMigration: 'firestoreSupabaseMigration',
} as const satisfies Record<ApiRuntimeCapability, ApiRouteKey>;

export interface RuntimeCapabilityResponse {
  status: number;
  body: unknown;
}

export const API_RUNTIME_UNAVAILABLE_CAPABILITY_RESPONSES = {
  'cloudflare-workers': {
    dailyHistoryRepair: {
      status: 503,
      body: createApiErrorResponse(
        'On-demand TradingView daily-history repair is not executed in the Cloudflare Worker. Daily history is maintained by the Node-based scheduled ingestion workflow.',
        { retryable: true },
      ),
    },
    intradayHistoryRepair: {
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
    },
    googleServiceAccount: {
      status: 200,
      body: {
        configured: false,
        serviceAccountEmail: null,
        instruction: 'Cloudflare deployment uses Google OAuth bearer authentication for Sheets.',
      },
    },
    firestoreMigration: {
      status: 404,
      body: createApiErrorResponse('Migration endpoint is disabled.'),
    },
  },
  'express-vite': {},
} as const satisfies Record<
  ApiRuntime,
  Partial<Record<ApiRuntimeCapability, RuntimeCapabilityResponse>>
>;

export function runtimeSupportsCapability(
  runtime: ApiRuntime,
  capability: ApiRuntimeCapability,
): boolean {
  return API_RUNTIME_CAPABILITIES[runtime][capability];
}

export function unavailableRuntimeCapabilityResponse(
  runtime: ApiRuntime,
  capability: ApiRuntimeCapability,
): RuntimeCapabilityResponse | null {
  if (runtimeSupportsCapability(runtime, capability)) return null;
  const responses = API_RUNTIME_UNAVAILABLE_CAPABILITY_RESPONSES[runtime] as
    Partial<Record<ApiRuntimeCapability, RuntimeCapabilityResponse>>;
  return responses[capability] ?? null;
}

export function requireUnavailableRuntimeCapabilityResponse(
  runtime: ApiRuntime,
  capability: ApiRuntimeCapability,
): RuntimeCapabilityResponse {
  const response = unavailableRuntimeCapabilityResponse(runtime, capability);
  if (!response) {
    throw new Error(
      `Missing unavailable-capability response contract for ${runtime}:${capability}.`,
    );
  }
  return response;
}
