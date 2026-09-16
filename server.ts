import express from "express";
import path from "path";
import http from "http";
import { createServer as createViteServer } from "vite";
import {
  handleGetServiceAccountStatus,
  handleGetSpreadsheetMetadata,
  handleGetSheetValues,
  handlePutSheetValues,
  handleAppendSheetValues,
  handleBatchUpdate,
  handleListDriveSpreadsheets,
} from "./src/services/googleSheetsServer";
import { runFirestoreSupabaseMigration } from "./src/services/firestoreSupabaseMigrationServer";

async function startServer() {
  const app = express();
  const PORT = 3000;
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

  // ONE-TIME FIRESTORE -> SUPABASE MIGRATION. Disabled unless explicitly enabled.
  app.post("/api/migration/firestore-to-supabase", async (req, res) => {
    if (process.env.ENABLE_SUPABASE_MIGRATION_UI !== "true") return res.status(404).json({ error: "Migration endpoint is disabled." });
    if (migrationCompleted) return res.status(409).json({ error: "This server instance has already completed the migration." });
    if (migrationRunning) return res.status(409).json({ error: "A migration is already running." });
    if (req.body?.confirm !== true) return res.status(400).json({ error: "Explicit migration confirmation is required." });

    const firebaseEmail = process.env.EGX_FIREBASE_EMAIL;
    const firebasePassword = process.env.EGX_FIREBASE_PASSWORD;
    if (!firebaseEmail || !firebasePassword) return res.status(500).json({ error: "Server-side Firebase migration credentials are not configured." });
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: "Server-side Supabase service-role key is not configured." });

    migrationRunning = true;
    const events: Array<{ phase: string; message: string; counts?: Record<string, number> }> = [];
    try {
      const result = await runFirestoreSupabaseMigration({
        firebaseEmail,
        firebasePassword,
        confirm: true,
        onProgress: (event) => events.push(event),
      });
      if (!result.reconciliation.passed) {
        return res.status(422).json({ ok: false, events, error: "Migration data was written, but field-level reconciliation FAILED. Do not switch the application to Supabase.", result });
      }
      migrationCompleted = true;
      return res.json({ ok: true, events, result });
    } catch (error) {
      console.error("Firestore -> Supabase migration failed:", error);
      return res.status(500).json({ ok: false, events, error: error instanceof Error ? error.message : String(error) });
    } finally {
      migrationRunning = false;
    }
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
