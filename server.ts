import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy endpoint for TradingView EGX Market Scanner
  // Matches exact request logic from sherif007-noob/glide-update
  app.post("/api/egx/scan", async (_req, res) => {
    try {
      const tvUrl = "https://scanner.tradingview.com/egypt/scan";
      const payload = {
        filter: [],
        options: { lang: "en" },
        symbols: { query: { types: [] }, tickers: [] },
        columns: ["name", "close", "change", "volume"],
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`EGX Portfolio Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
