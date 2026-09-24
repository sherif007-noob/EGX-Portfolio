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
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const errorJson = (error: unknown, status = 500) =>
  json({ error: error instanceof Error ? error.message : String(error) }, status);

async function withSupabaseUser(
  request: Request,
  handler: (uid: string) => Promise<unknown>,
): Promise<Response> {
  try {
    const uid = await verifySupabaseBearerToken(request.headers.get("authorization") || undefined);
    return json(await handler(uid));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /token|authorization|unauthenticated|invalid/i.test(message) ? 401 : 500;
    console.error("[Supabase API]", message);
    return json({ error: message }, status);
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
      error: `Google API error (${response.status})`,
      details: body,
      isAuthError: response.status === 401 || response.status === 403,
    }, response.status);
  }
  return json(body);
}

async function handleApi(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/health" && request.method === "GET") {
    return json({ status: "ok", runtime: "cloudflare-workers" });
  }

  if (path === "/api/supabase/portfolio" && request.method === "GET") {
    return withSupabaseUser(request, async (uid) => ({ data: await loadSupabasePortfolio(uid) }));
  }

  if (path === "/api/supabase/portfolio" && request.method === "PUT") {
    return withSupabaseUser(request, async (uid) => ({
      data: await saveSupabasePortfolio(uid, await request.json()),
    }));
  }

  if (path === "/api/supabase/price-tick" && request.method === "POST") {
    return withSupabaseUser(request, async (uid) => {
      const body: any = await request.json();
      return {
        saved: await saveSupabasePriceTick(
          uid,
          body?.positions || [],
          body?.tickers || [],
          body?.force === true,
        ),
      };
    });
  }

  if (path === "/api/supabase/price-history" && request.method === "GET") {
    return withSupabaseUser(request, async (uid) => {
      const tickers = (url.searchParams.get("tickers") || "")
        .split(",")
        .map((ticker) => ticker.trim())
        .filter(Boolean);
      if (!tickers.length) throw new Error("At least one ticker is required.");
      return {
        data: await loadHistoricalPrices(
          uid,
          tickers,
          url.searchParams.get("startDate") || undefined,
          url.searchParams.get("endDate") || undefined,
        ),
      };
    });
  }

  if (path === "/api/supabase/intraday-history/ensure" && request.method === "POST") {
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

  if (path === "/api/supabase/price-history/ensure" && request.method === "POST") {
    return json({
      error: "On-demand TradingView daily-history repair is not executed in the Cloudflare Worker. Daily history is maintained by the Node-based scheduled ingestion workflow.",
      retryable: true,
    }, 503);
  }

  if (path === "/api/egx/scan" && request.method === "POST") {
    try {
      const payload = {
        filter: [],
        options: { lang: "en" },
        symbols: { query: { types: [] }, tickers: [] },
        columns: [
          "name", "description", "logoid", "close", "change", "change_abs",
          "volume", "high", "low", "high_52_week", "low_52_week", "sector", "RSI",
        ],
        sort: { sortBy: "name", sortOrder: "asc" },
        range: [0, 500],
      };
      const tvResponse = await fetch("https://scanner.tradingview.com/egypt/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0",
        },
        body: JSON.stringify(payload),
      });
      if (!tvResponse.ok) {
        return json(
          { error: `TradingView returned status ${tvResponse.status}: ${tvResponse.statusText}` },
          tvResponse.status,
        );
      }
      return new Response(tvResponse.body, {
        status: tvResponse.status,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    } catch (error) {
      console.error("Error proxying TradingView Scanner:", error);
      return errorJson(error);
    }
  }

  if (path === "/api/tradingview/symbol-search" && request.method === "GET") {
    const query = (url.searchParams.get("text") || "").trim();
    if (!query) return json({ error: "Query parameter 'text' is required" }, 400);
    try {
      const searchUrl =
        `https://symbol-search.tradingview.com/symbol_search/v3/?text=${encodeURIComponent(query)}&hl=1&exchange=EGX&lang=en`;
      const tvResponse = await fetch(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      });
      if (!tvResponse.ok) {
        return json({ error: `TradingView Symbol Search status ${tvResponse.status}` }, tvResponse.status);
      }
      return new Response(tvResponse.body, {
        status: tvResponse.status,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    } catch (error) {
      console.error("Error proxying TradingView Symbol Search:", error);
      return errorJson(error);
    }
  }

  // Google Sheets remains available through the browser's Google OAuth bearer
  // token. Service-account auth stays on the Node server and is intentionally
  // not exposed or emulated in this first Worker deployment.
  if (path === "/api/sheets/service-account-status" && request.method === "GET") {
    return json({
      configured: false,
      serviceAccountEmail: null,
      instruction: "Cloudflare deployment uses Google OAuth bearer authentication for Sheets.",
    });
  }

  if (path.startsWith("/api/sheets/")) {
    try {
      const token = googleBearer(request);

      if (path === "/api/sheets/metadata" && request.method === "GET") {
        const spreadsheetId = (url.searchParams.get("spreadsheetId") || "").trim();
        if (!spreadsheetId) return json({ error: 'Missing required query parameter "spreadsheetId"' }, 400);
        const upstream = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: any = await upstream.json();
        if (!upstream.ok) return json({ error: data, isAuthError: upstream.status === 401 || upstream.status === 403 }, upstream.status);
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

      if (path === "/api/sheets/values" && request.method === "GET") {
        const spreadsheetId = (url.searchParams.get("spreadsheetId") || "").trim();
        const range = (url.searchParams.get("range") || "").trim();
        if (!spreadsheetId || !range) return json({ error: 'Missing "spreadsheetId" or "range"' }, 400);
        return googleJson(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
          token,
        );
      }

      if (path === "/api/sheets/values" && request.method === "PUT") {
        const body: any = await request.json();
        if (!body?.spreadsheetId || !body?.range || !Array.isArray(body?.values)) {
          return json({ error: "Missing spreadsheetId, range, or values array" }, 400);
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

      if (path === "/api/sheets/append" && request.method === "POST") {
        const body: any = await request.json();
        if (!body?.spreadsheetId || !body?.range || !Array.isArray(body?.values)) {
          return json({ error: "Missing spreadsheetId, range, or values" }, 400);
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

      if (path === "/api/sheets/batchUpdate" && request.method === "POST") {
        const body: any = await request.json();
        if (!body?.spreadsheetId || !Array.isArray(body?.requests)) {
          return json({ error: "Missing spreadsheetId or requests array" }, 400);
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

      if (path === "/api/sheets/drive-files" && request.method === "GET") {
        const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
        return googleJson(
          `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,webViewLink)&orderBy=modifiedTime desc&pageSize=30`,
          token,
        );
      }
    } catch (error) {
      return errorJson(error, /bearer|oauth/i.test(String(error)) ? 401 : 500);
    }
  }

  // Legacy migration is intentionally unavailable on the public Worker.
  if (path === "/api/migration/firestore-to-supabase") {
    return json({ error: "Migration endpoint is disabled." }, 404);
  }

  return json({ error: "Not found" }, 404);
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
    if (url.pathname.startsWith("/api/")) return handleApi(request);
    return env.ASSETS.fetch(request);
  },
};
