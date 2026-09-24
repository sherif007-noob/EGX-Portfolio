import express from "express";
import path from "path";
import http from "http";
import { createServer as createViteServer } from "vite";
import {
  handleGetServiceAccountStatus, handleGetSpreadsheetMetadata, handleGetSheetValues,
  handlePutSheetValues, handleAppendSheetValues, handleBatchUpdate, handleListDriveSpreadsheets,
} from "./src/services/googleSheetsServer";
import { runFirestoreSupabaseMigration } from "./src/services/firestoreSupabaseMigrationServer";
import { verifySupabaseBearerToken, loadSupabasePortfolio, saveSupabasePortfolio, saveSupabasePriceTick, loadHistoricalPrices, ensurePortfolioHistoricalPrices } from "./src/services/supabasePortfolioServer";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  let migrationRunning = false;
  let migrationCompleted = false;
  const server = http.createServer(app);
  app.use(express.json({ limit: "10mb" }));

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/sheets/service-account-status", handleGetServiceAccountStatus);
  app.get("/api/sheets/metadata", handleGetSpreadsheetMetadata);
  app.get("/api/sheets/values", handleGetSheetValues);
  app.put("/api/sheets/values", handlePutSheetValues);
  app.post("/api/sheets/append", handleAppendSheetValues);
  app.post("/api/sheets/batchUpdate", handleBatchUpdate);
  app.get("/api/sheets/drive-files", handleListDriveSpreadsheets);

  const withSupabaseUser = async (req: express.Request, res: express.Response, handler: (uid: string) => Promise<unknown>) => {
    try {
      const uid = await verifySupabaseBearerToken(req.headers.authorization);
      res.json(await handler(uid));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = /token|authorization|unauthenticated|invalid/i.test(message) ? 401 : 500;
      console.error("[Supabase API]", message);
      res.status(status).json({ error: message });
    }
  };

  // Supabase authenticates the browser. The server verifies that Supabase access token,
  // scopes by Supabase user ID, and uses the Supabase secret key server-side only.
  app.get("/api/supabase/portfolio", (req, res) => withSupabaseUser(req, res, async (uid) => ({ data: await loadSupabasePortfolio(uid) })));
  app.put("/api/supabase/portfolio", (req, res) => withSupabaseUser(req, res, async (uid) => ({ data: await saveSupabasePortfolio(uid, req.body || {}) })));
  app.post("/api/supabase/price-tick", (req, res) => withSupabaseUser(req, res, async (uid) => ({ saved: await saveSupabasePriceTick(uid, req.body?.positions || [], req.body?.tickers || [], req.body?.force === true) })));
  app.get("/api/supabase/price-history", (req, res) => withSupabaseUser(req, res, async (uid) => {
    const tickers = String(req.query.tickers || '').split(',').map((t) => t.trim()).filter(Boolean);
    if (!tickers.length) throw new Error("At least one ticker is required.");
    return { data: await loadHistoricalPrices(uid, tickers, String(req.query.startDate || '') || undefined, String(req.query.endDate || '') || undefined) };
  }));
  app.post("/api/supabase/price-history/ensure", (req, res) => withSupabaseUser(req, res, async (uid) => {
    const targets = Array.isArray(req.body?.targets) ? req.body.targets : [];
    if (!targets.length) throw new Error("At least one historical backfill target is required.");
    return { data: await ensurePortfolioHistoricalPrices(uid, targets) };
  }));

  app.post("/api/migration/firestore-to-supabase", async (req, res) => {
    if (process.env.ENABLE_SUPABASE_MIGRATION_UI !== "true") return res.status(404).json({ error: "Migration endpoint is disabled." });
    if (migrationCompleted) return res.status(409).json({ error: "This server instance has already completed the migration." });
    if (migrationRunning) return res.status(409).json({ error: "A migration is already running." });
    if (req.body?.confirm !== true) return res.status(400).json({ error: "Explicit migration confirmation is required." });
    const required = ["FIREBASE_ADMIN_PROJECT_ID", "FIREBASE_ADMIN_CLIENT_EMAIL", "FIREBASE_ADMIN_PRIVATE_KEY", "FIREBASE_ADMIN_OWNER_UID", "SUPABASE_URL", "SUPABASE_SECRET_KEY"];
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length) return res.status(500).json({ error: `Server-side migration credentials are not configured: ${missing.join(", ")}` });
    if (!process.env.SUPABASE_SECRET_KEY!.startsWith("sb_secret_")) return res.status(500).json({ error: "SUPABASE_SECRET_KEY is not a current Supabase secret key (expected sb_secret_...)." });
    if (!process.env.FIREBASE_ADMIN_PRIVATE_KEY!.includes("BEGIN PRIVATE KEY")) return res.status(500).json({ error: "FIREBASE_ADMIN_PRIVATE_KEY does not look like a valid service-account private key." });
    migrationRunning = true;
    const events: Array<{ phase: string; message: string; counts?: Record<string, number> }> = [];
    try {
      const result = await runFirestoreSupabaseMigration({ confirm: true, onProgress: (event) => events.push(event) });
      if (!result.reconciliation.passed) return res.status(422).json({ ok: false, events, error: "Migration data was written, but field-level reconciliation FAILED. Do not switch the application to Supabase.", result });
      migrationCompleted = true;
      return res.json({ ok: true, events, result });
    } catch (error) {
      console.error("Firestore -> Supabase migration failed:", error);
      return res.status(500).json({ ok: false, events, error: error instanceof Error ? error.message : String(error) });
    } finally { migrationRunning = false; }
  });

  app.post("/api/egx/scan", async (_req, res) => {
    try {
      const tvUrl = "https://scanner.tradingview.com/egypt/scan";
      const payload = { filter: [], options: { lang: "en" }, symbols: { query: { types: [] }, tickers: [] }, columns: ["name","description","logoid","close","change","change_abs","volume","high","low","high_52_week","low_52_week","sector","RSI"], sort: { sortBy: "name", sortOrder: "asc" }, range: [0, 500] };
      const tvResponse = await fetch(tvUrl, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }, body: JSON.stringify(payload) });
      if (!tvResponse.ok) return res.status(tvResponse.status).json({ error: `TradingView returned status ${tvResponse.status}: ${tvResponse.statusText}` });
      res.json(await tvResponse.json());
    } catch (err: any) { console.error("Error proxying to TradingView Scanner:", err); res.status(500).json({ error: err.message || "Failed to fetch prices from TradingView" }); }
  });
  app.get("/api/tradingview/symbol-search", async (req, res) => {
    try {
      const query = String(req.query.text || "").trim();
      if (!query) return res.status(400).json({ error: "Query parameter 'text' is required" });
      const searchUrl = `https://symbol-search.tradingview.com/symbol_search/v3/?text=${encodeURIComponent(query)}&hl=1&exchange=EGX&lang=en`;
      const tvResponse = await fetch(searchUrl, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", Accept: "application/json" } });
      if (!tvResponse.ok) return res.status(tvResponse.status).json({ error: `TradingView Symbol Search status ${tvResponse.status}` });
      res.json(await tvResponse.json());
    } catch (err: any) { console.error("Error proxying to TradingView Symbol Search:", err); res.status(500).json({ error: err.message || "Failed to search TradingView symbols" }); }
  });

  const migrationPage = path.join(process.cwd(), "public", "supabase-migration.html");
  app.get("/supabase-migration.html", (_req, res) => res.sendFile(migrationPage));
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true, hmr: { server } }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
  server.listen(PORT, "0.0.0.0", () => console.log(`EGX Portfolio Server running on http://0.0.0.0:${PORT}`));
}
startServer();