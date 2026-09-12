import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "10mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Gemini API Endpoint: Parse Stock Trade Screenshot / Receipt (Single)
  app.post("/api/parse-trade-screenshot", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("MY_GEMINI")) {
        return res.status(400).json({
          error: "GEMINI_API_KEY is missing or invalid. Please configure a valid Gemini API key in AI Studio environment settings.",
        });
      }

      const { imageBase64, mimeType = "image/png" } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Missing required parameter 'imageBase64'." });
      }

      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const promptText = `Analyze this stock trade receipt/confirmation screenshot from Telda or other Egyptian brokers.

Special Telda extraction rules for BOTH layouts:
Layout 1 - Trade Receipt / Execution Detail:
- Header: "Sell [TICKER]" or "Buy [TICKER]" (e.g., "Sell EFIC", "Buy COMI"). Ticker is EFIC, COMI, etc. Action is SELL or BUY.
- Subtitle: Full company name (e.g., "Egyptian Financial and Industrial SAE").
- Shares: "Shares 50 @ T+0" -> shares = 50 (pure integer; discard "@ T+0" or "@ T+2").
- Price: "Price EGP 217.9" -> price = 217.9 (execution price per share in EGP).
- Fees: "Fees ⓘ EGP 6.44" -> fees = 6.44.
- Total: "Total EGP 10,888.56".
- Date: "Date and time: 10 Sep 26, 01:15 PM" -> date = "2026-09-10" ('26' is year 2026).

Layout 2 - Order Review:
- Header: "[TICKER] order review" (e.g., "MPCO order review", "ORHD order review"). Ticker is MPCO, ORHD.
- Order type: "Limit Sell @ EGP 2.60" or "Market Buy". Action is SELL or BUY.
- Shares: "8000 @ T+0" -> shares = 8000.
- Price: "Average execution price ⓘ EGP 2.60" -> price = 2.60.
- Fees: "Total fees EGP 11.44" -> fees = 11.44.
- Total: "Total EGP 20,788.56".
- Date: "Date and time: 10 Sep 26, 10:39 AM" -> date = "2026-09-10".

Broker: "Telda" if matching Telda UI.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
          promptText,
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ticker: { type: Type.STRING, description: "Stock ticker symbol (e.g. ORHD, ELSH, MPCO)" },
              companyName: { type: Type.STRING, description: "Full or short company name (e.g. Mansoura Poultry, El Shams Housing)" },
              type: { type: Type.STRING, enum: ["BUY", "SELL"], description: "Trade action type" },
              shares: { type: Type.NUMBER, description: "Number of shares traded as a pure integer" },
              price: { type: Type.NUMBER, description: "Execution price per share in EGP" },
              fees: { type: Type.NUMBER, description: "Commission / fees in EGP if shown, else 0" },
              date: { type: Type.STRING, description: "Date of transaction in YYYY-MM-DD format" },
              brokerName: { type: Type.STRING, description: "Broker name (e.g. Telda, Thndr, Mubasher)" },
              notes: { type: Type.STRING, description: "Order type or execution notes" },
              confidenceScore: { type: Type.NUMBER, description: "Confidence score from 0 to 100" },
            },
            required: ["ticker", "type", "shares", "price"],
          },
        },
      });

      const rawText = (response.text || "{}").replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      const parsedJson = JSON.parse(rawText || "{}");
      res.json(parsedJson);
    } catch (err: any) {
      const errStr = typeof err === "string" ? err : (err?.message || JSON.stringify(err));
      console.error("Error parsing trade screenshot with Gemini API:", errStr);
      const isQuotaErr = errStr.includes("429") || errStr.includes("prepayment credits") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("quota");
      const isApiKeyErr = errStr.includes("API key") || errStr.includes("API_KEY_INVALID") || errStr.includes("INVALID_ARGUMENT") || errStr.includes("code\":400");
      if (isQuotaErr) {
        return res.status(429).json({
          error: "Your Gemini API prepayment credits are depleted (HTTP 429: RESOURCE_EXHAUSTED).",
          isQuotaError: true,
        });
      }
      if (isApiKeyErr) {
        return res.status(400).json({
          error: "Gemini API key is invalid or unauthorized. Please set a valid GEMINI_API_KEY in environment settings.",
          isApiKeyError: true,
        });
      }
      res.status(500).json({ error: err?.message || "Failed to analyze trade screenshot" });
    }
  });

  // Gemini API Endpoint: Batch Parse Stock Trade Screenshots
  app.post("/api/parse-trade-screenshots-batch", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("MY_GEMINI")) {
        return res.status(400).json({
          error: "GEMINI_API_KEY is missing or invalid. Please configure a valid Gemini API key in AI Studio environment settings.",
        });
      }

      const { images } = req.body;
      if (!Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: "Missing or invalid 'images' array." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const promptText = `Analyze this stock trade receipt/confirmation screenshot from Telda or other Egyptian brokers.

Special Telda extraction rules for BOTH layouts:
Layout 1 - Trade Receipt / Execution Detail:
- Header: "Sell [TICKER]" or "Buy [TICKER]" (e.g., "Sell EFIC", "Buy COMI"). Ticker is EFIC, COMI, etc. Action is SELL or BUY.
- Subtitle: Full company name (e.g., "Egyptian Financial and Industrial SAE").
- Shares: "Shares 50 @ T+0" -> shares = 50 (pure integer; discard "@ T+0" or "@ T+2").
- Price: "Price EGP 217.9" -> price = 217.9 (execution price per share in EGP).
- Fees: "Fees ⓘ EGP 6.44" -> fees = 6.44.
- Total: "Total EGP 10,888.56".
- Date: "Date and time: 10 Sep 26, 01:15 PM" -> date = "2026-09-10" ('26' is year 2026).

Layout 2 - Order Review:
- Header: "[TICKER] order review" (e.g., "MPCO order review", "ORHD order review"). Ticker is MPCO, ORHD.
- Order type: "Limit Sell @ EGP 2.60" or "Market Buy". Action is SELL or BUY.
- Shares: "8000 @ T+0" -> shares = 8000.
- Price: "Average execution price ⓘ EGP 2.60" -> price = 2.60.
- Fees: "Total fees EGP 11.44" -> fees = 11.44.
- Total: "Total EGP 20,788.56".
- Date: "Date and time: 10 Sep 26, 10:39 AM" -> date = "2026-09-10".

Broker: "Telda" if matching Telda UI.`;

      // Process images concurrently with Gemini Flash
      const results = await Promise.all(
        images.slice(0, 10).map(async (imgObj, index) => {
          try {
            const cleanBase64 = (imgObj.imageBase64 || "").replace(/^data:image\/\w+;base64,/, "");
            if (!cleanBase64) {
              return { index, error: "Empty image data" };
            }
            const mimeType = imgObj.mimeType || "image/jpeg";

            const response = await ai.models.generateContent({
              model: "gemini-3.6-flash",
              contents: [
                {
                  inlineData: {
                    mimeType,
                    data: cleanBase64,
                  },
                },
                promptText,
              ],
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    ticker: { type: Type.STRING },
                    companyName: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ["BUY", "SELL"] },
                    shares: { type: Type.NUMBER },
                    price: { type: Type.NUMBER },
                    fees: { type: Type.NUMBER },
                    date: { type: Type.STRING },
                    brokerName: { type: Type.STRING },
                    notes: { type: Type.STRING },
                    confidenceScore: { type: Type.NUMBER },
                  },
                  required: ["ticker", "type", "shares", "price"],
                },
              },
            });

            const rawText = (response.text || "{}").replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
            const parsed = JSON.parse(rawText || "{}");
            return { index, success: true, data: parsed };
          } catch (itemErr: any) {
            const errStr = typeof itemErr === "string" ? itemErr : (itemErr?.message || JSON.stringify(itemErr));
            console.error(`Failed parsing screenshot at index ${index}:`, errStr);
            const isQuotaErr = errStr.includes("429") || errStr.includes("prepayment credits") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("quota");
            const isApiKeyErr = errStr.includes("API key") || errStr.includes("API_KEY_INVALID") || errStr.includes("INVALID_ARGUMENT") || errStr.includes("code\":400") || errStr.includes("400");
            return {
              index,
              success: false,
              isQuotaError: isQuotaErr,
              isApiKeyError: isApiKeyErr,
              error: isQuotaErr
                ? "Gemini API prepayment credits are depleted (HTTP 429: RESOURCE_EXHAUSTED)."
                : isApiKeyErr
                ? "Gemini API Key is invalid or unauthorized."
                : errStr,
            };
          }
        })
      );

      res.json({ results });
    } catch (err: any) {
      console.error("Batch parse error:", err);
      res.status(500).json({ error: err.message || "Failed to process batch screenshots" });
    }
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
          "RSI"
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
      const query = String(req.query.text || '').trim();
      if (!query) {
        return res.status(400).json({ error: "Query parameter 'text' is required" });
      }

      const searchUrl = `https://symbol-search.tradingview.com/symbol_search/v3/?text=${encodeURIComponent(query)}&hl=1&exchange=EGX&lang=en`;
      const tvResponse = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Accept": "application/json",
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
