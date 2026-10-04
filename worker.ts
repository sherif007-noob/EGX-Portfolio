import { EGX_SCANNER_PAYLOAD } from './src/services/scannerRequest';
import {
  API_PREFIX,
  API_ROUTES,
  SHEETS_API_PREFIX,
  allowedApiMethodsForPath,
  createApiErrorResponse,
  createClassifiedAuthErrorResponse,
  createHealthResponse,
  isAuthHttpStatus,
  isApiRouteMethodAllowed,
  parseHistoricalPriceQuery,
  parsePortfolioSaveRequest,
  parsePriceTickRequest,
  requireSymbolSearchText,
} from './src/api/contracts';
import {
  configureSupabaseServer,
  verifySupabaseBearerToken,
  loadSupabasePortfolio,
  saveSupabasePortfolio,
  saveSupabasePriceTick,
  loadHistoricalPrices,
} from "./src/services/supabasePortfolioServer";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const errorJson = (
  error: unknown,
  status = 500,
  options: Parameters<typeof createApiErrorResponse>[1] = {},
) => json(createApiErrorResponse(error, options), status);

async function withSupabaseUser(
  request: Request,
  handler: (uid: string) => Promise<unknown>,
): Promise<Response> {
  let uid: string;
  try {
    uid = await verifySupabaseBearerToken(request.headers.get("authorization") || undefined);
  } catch (error) {
    const classified = createClassifiedAuthErrorResponse(error);
    console.error("[Supabase API auth]", classified.body.error);
    return json(classified.body, classified.status);
  }

  try {
    return json(await handler(uid));
  } catch (error) {
    const body = createApiErrorResponse(error, { isAuthError: false });
    console.error("[Supabase API handler]", body.error);
    return json(body, 500);
  }
}

function googleBearer(request: Request): string {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    throw new Error("Google OAuth bearer token is required for Sheets access on the Cloudflare deployment.");
  }
  const token = authorization.slice(7).trim();
  if (!token) throw new Error("Google OAuth bearer token is missing.");
  return token;
}

async function googleJson(url: string, token: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let body: any;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { error: text }; }
  if (!response.ok) {
    return json({
      ...createApiErrorResponse(`Google API error (${response.status})`, {
        details: body,
        isAuthError: isAuthHttpStatus(response.status),
        authSource: "oauth_bearer",
      }),
    }, response.status);
  }
  return json(body);
}

async function handleApi(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const allowedMethods = allowedApiMethodsForPath(path);

  if (allowedMethods && !isApiRouteMethodAllowed(path, request.method)) {
    return new Response(
      JSON.stringify(createApiErrorResponse(`Method ${request.method} is not allowed for ${path}.`)),
      {
        status: 405,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "allow": allowedMethods.join(", "),
        },
      },
    );
  }

  if (path === API_ROUTES.health && request.method === "GET") {
    return json(createHealthResponse("cloudflare-workers"));
  }

  if (path === API_ROUTES.supabasePortfolio && request.method === "GET") {
    return withSupabaseUser(request, async (uid) => ({ data: await loadSupabasePortfolio(uid) }));
  }

  if (path === API_ROUTES.supabasePortfolio && request.method === "PUT") {
    return withSupabaseUser(request, async (uid) => ({
      data: await saveSupabasePortfolio(uid, parsePortfolioSaveRequest(await request.json())),
    }));
  }

  if (path === API_ROUTES.supabasePriceTick && request.method === "POST") {
    return withSupabaseUser(request, async (uid) => {
      const body = parsePriceTickRequest(await request.json());
      return {
        saved: await saveSupabasePriceTick(
          uid,
          body.positions as any[],
          body.tickers as any[],
          body.force,
        ),
      };
    });
  }

  if (path === API_ROUTES.supabasePriceHistory && request.method === "GET") {
    return withSupabaseUser(request, async (uid) => {
      const query = parseHistoricalPriceQuery({
        tickers: url.searchParams.get("tickers"),
        startDate: url.searchParams.get("startDate"),
        endDate: url.searchParams.get("endDate"),
      });
      return {
        data: await loadHistoricalPrices(
          uid,
          query.tickers,
          query.startDate,
          query.endDate,
        ),
      };
    });
  }

  if (path === API_ROUTES.supabaseIntradayHistoryEnsure && request.method === "POST") {
    // Backward compatibility for an older PWA bundle that requested repair on
    // app startup. The current client no longer calls this route. Returning a
    // successful no-op prevents already-open/cached clients from generating
    // error loops while TradingView ingestion stays in the Node workflow.
    return json({
      data: {
        requestedTickers: [],
        backfilledTickers: [],
        writtenRows: 0,
        failures: [],
      },
      deprecated: true,
    });
  }

  if (path === API_ROUTES.supabasePriceHistoryEnsure && request.method === "POST") {
    return json(createApiErrorResponse(
      "On-demand TradingView daily-history repair is not executed in the Cloudflare Worker. Daily history is maintained by the Node-based scheduled ingestion workflow.",
      { retryable: true },
    ), 503);
  }

  if (path === API_ROUTES.egxScan && request.method === "POST") {
    try {
      const payload = EGX_SCANNER_PAYLOAD;
      const tvResponse = await fetch("https://scanner.tradingview.com/egypt/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0",
        },
        signal: AbortSignal.timeout(12_000), body: JSON.stringify(payload),
      });
      if (!tvResponse.ok) {
        return json(
          createApiErrorResponse(`TradingView returned status ${tvResponse.status}: ${tvResponse.statusText}`),
          tvResponse.status,
        );
      }
      return new Response(tvResponse.body, {
        status: tvResponse.status,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    } catch (error) {
      console.error("Error proxying TradingView Scanner:", error);
      return errorJson(error);
    }
  }

  if (path === API_ROUTES.tradingViewSymbolSearch && request.method === "GET") {
    let query: string;
    try {
      query = requireSymbolSearchText(url.searchParams.get("text"));
    } catch (error) {
      return errorJson(error, 400);
    }
    try {
      const searchUrl =
        `https://symbol-search.tradingview.com/symbol_search/v3/?text=${encodeURIComponent(query)}&hl=1&exchange=EGX&lang=en`;
      const tvResponse = await fetch(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      });
      if (!tvResponse.ok) {
        return json(createApiErrorResponse(`TradingView Symbol Search status ${tvResponse.status}`), tvResponse.status);
      }
      return new Response(tvResponse.body, {
        status: tvResponse.status,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    } catch (error) {
      console.error("Error proxying TradingView Symbol Search:", error);
      return errorJson(error);
    }
  }

  // Google Sheets remains available through the browser's Google OAuth bearer
  // token. Service-account auth stays on the Node server and is intentionally
  // not exposed or emulated in this first Worker deployment.
  if (path === API_ROUTES.sheetsServiceAccountStatus && request.method === "GET") {
    return json({
      configured: false,
      serviceAccountEmail: null,
      instruction: "Cloudflare deployment uses Google OAuth bearer authentication for Sheets.",
    });
  }

  if (path.startsWith(SHEETS_API_PREFIX)) {
    try {
      const token = googleBearer(request);

      if (path === API_ROUTES.sheetsMetadata && request.method === "GET") {
        const spreadsheetId = (url.searchParams.get("spreadsheetId") || "").trim();
        if (!spreadsheetId) return errorJson('Missing required query parameter "spreadsheetId"', 400);
        const upstream = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: any = await upstream.json();
        if (!upstream.ok) {
          return json(createApiErrorResponse(
            `Google Sheets API error (${upstream.status})`,
            {
              details: data,
              isAuthError: isAuthHttpStatus(upstream.status),
              authSource: "oauth_bearer",
            },
          ), upstream.status);
        }
        return json({
          title: data.properties?.title || "",
          sheets: (data.sheets || []).map((s: any) => s.properties?.title || "").filter(Boolean),
          sheetsInfo: (data.sheets || []).map((s: any) => ({
            title: s.properties?.title || "",
            sheetId: s.properties?.sheetId ?? 0,
          })).filter((s: any) => Boolean(s.title)),
          authSource: "oauth_bearer",
        });
      }

      if (path === API_ROUTES.sheetsValues && request.method === "GET") {
        const spreadsheetId = (url.searchParams.get("spreadsheetId") || "").trim();
        const range = (url.searchParams.get("range") || "").trim();
        if (!spreadsheetId || !range) return errorJson('Missing "spreadsheetId" or "range"', 400);
        return googleJson(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
          token,
        );
      }

      if (path === API_ROUTES.sheetsValues && request.method === "PUT") {
        const body: any = await request.json();
        if (!body?.spreadsheetId || !body?.range || !Array.isArray(body?.values)) {
          return errorJson("Missing spreadsheetId, range, or values array", 400);
        }
        return googleJson(
          `https://sheets.googleapis.com/v4/spreadsheets/${body.spreadsheetId}/values/${encodeURIComponent(body.range)}?valueInputOption=${encodeURIComponent(body.valueInputOption || "USER_ENTERED")}`,
          token,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ values: body.values }),
          },
        );
      }

      if (path === API_ROUTES.sheetsAppend && request.method === "POST") {
        const body: any = await request.json();
        if (!body?.spreadsheetId || !body?.range || !Array.isArray(body?.values)) {
          return errorJson("Missing spreadsheetId, range, or values", 400);
        }
        return googleJson(
          `https://sheets.googleapis.com/v4/spreadsheets/${body.spreadsheetId}/values/${encodeURIComponent(body.range)}:append?valueInputOption=${encodeURIComponent(body.valueInputOption || "USER_ENTERED")}&insertDataOption=${encodeURIComponent(body.insertDataOption || "INSERT_ROWS")}`,
          token,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ values: body.values }),
          },
        );
      }

      if (path === API_ROUTES.sheetsBatchUpdate && request.method === "POST") {
        const body: any = await request.json();
        if (!body?.spreadsheetId || !Array.isArray(body?.requests)) {
          return errorJson("Missing spreadsheetId or requests array", 400);
        }
        return googleJson(
          `https://sheets.googleapis.com/v4/spreadsheets/${body.spreadsheetId}:batchUpdate`,
          token,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requests: body.requests }),
          },
        );
      }

      if (path === API_ROUTES.sheetsDriveFiles && request.method === "GET") {
        const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
        return googleJson(
          `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,webViewLink)&orderBy=modifiedTime desc&pageSize=30`,
          token,
        );
      }
    } catch (error) {
      const classified = createClassifiedAuthErrorResponse(error);
      return json(classified.body, classified.status);
    }
  }

  // Legacy migration is intentionally unavailable on the public Worker.
  if (path === API_ROUTES.firestoreSupabaseMigration) {
    return errorJson("Migration endpoint is disabled.", 404);
  }

  return errorJson("Not found", 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const supabaseUrlPresent = typeof env.SUPABASE_URL === "string" && env.SUPABASE_URL.trim().length > 0;
    const supabaseSecretPresent = typeof env.SUPABASE_SECRET_KEY === "string" && env.SUPABASE_SECRET_KEY.trim().length > 0;
    const supabaseSecretPrefixValid = supabaseSecretPresent && env.SUPABASE_SECRET_KEY.trim().startsWith("sb_secret_");
    if (!supabaseUrlPresent || !supabaseSecretPresent || !supabaseSecretPrefixValid) {
      console.error("[Worker Config] Supabase binding validation", {
        supabaseUrlPresent,
        supabaseSecretPresent,
        supabaseSecretPrefixValid,
      });
    }
    configureSupabaseServer(
      supabaseUrlPresent ? env.SUPABASE_URL.trim() : undefined,
      supabaseSecretPresent ? env.SUPABASE_SECRET_KEY.trim() : undefined,
    );
    const url = new URL(request.url);
    if (url.pathname.startsWith(API_PREFIX)) return handleApi(request);
    return env.ASSETS.fetch(request);
  },
};
