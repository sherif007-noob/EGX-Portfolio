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

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  // Create HTTP server instance explicitly to attach Vite's WebSocket server
  const server = http.createServer(app);

  app.use(express.json({ limit: "10mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // --------------------------------------------------------------------------
  // GOOGLE SHEETS & DRIVE API SERVER PROXY (Service Account & OAuth)
  // --------------------------------------------------------------------------
  app.get("/api/sheets/service-account-status", handleGetServiceAccountStatus);
  app.get("/api/sheets/metadata", handleGetSpreadsheetMetadata);
  app.get("/api/sheets/values", handleGetSheetValues);
  app.put("/api/sheets/values", handlePutSheetValues);
  app.post("/api/sheets/append", handleAppendSheetValues);
  app.post("/api/sheets/batchUpdate", handleBatchUpdate);
  app.get("/api/sheets/drive-files", handleListDriveSpreadsheets);

  // Proxy endpoint for TradingView EGX Market Scanner
  app.post("/api/egx/scan", async (_req, res) => {
    try {
      const tvUrl = "https://scanner.tradingview.com/egypt/scan";
      const payload = {
        filter: [],
        options: { lang: "en" },
        symbols: { query: { types: [] }, tickers: [] },
        columns: [
          "name",
          "description",
          "logoid",
          "close",
          "change",
          "volume",
          "high",
          "low",
          "high_52_week",
          "low_52_week",
          "sector",
          "RSI",
        ],
        sort: { sortBy: "name", sortOrder: "asc" },
        range: [0, 500],
      };

      const tvResponse = await fetch(tvUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
        body: JSON.stringify(payload),
      });

      if (!tvResponse.ok) {
        return res.status(tvResponse.status).json({
          error: `TradingView returned status ${tvResponse.status}: ${tvResponse.statusText}`,
        });
      }

      const tvData = await tvResponse.json();
      res.json(tvData);
    } catch (err: any) {
      console.error("Error proxying to TradingView Scanner:", err);
      res.status(500).json({ error: err.message || "Failed to fetch prices from TradingView" });
    }
  });

  // Proxy endpoint for TradingView Symbol Search to fetch logos for any ticker
  app.get("/api/tradingview/symbol-search", async (req, res) => {
    try {
      const query = String(req.query.text || "").trim();
      if (!query) {
        return res.status(400).json({ error: "Query parameter 'text' is required" });
      }

      const searchUrl = `https://symbol-search.tradingview.com/symbol_search/v3/?text=${encodeURIComponent(query)}&hl=1&exchange=EGX&lang=en`;
      const tvResponse = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          Accept: "application/json",
        },
      });

      if (!tvResponse.ok) {
        return res.status(tvResponse.status).json({ error: `TradingView Symbol Search status ${tvResponse.status}` });
      }

      const data = await tvResponse.json();
      res.json(data);
    } catch (err: any) {
      console.error("Error proxying to TradingView Symbol Search:", err);
      res.status(500).json({ error: err.message || "Failed to search TradingView symbols" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: { server } // Attach WebSocket server to avoid reconnection loops
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`EGX Portfolio Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

