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
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY environment variable is not configured on the server.",
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

      const promptText = `Analyze this stock trade receipt/confirmation screenshot. It is typically from Telda, Thndr, Mubasher, EFG Hermes, CI Capital, or another broker app.

Special Telda extraction rules:
1. Header / Ticker:
   - Telda often displays "[TICKER] order review" (e.g., "ORHD order review", "ELSH order review", "MPCO order review"). The ticker is the symbol before "order review" (e.g. ORHD, ELSH, MPCO).
   - Alternatively, it may display "Buy [TICKER]" or "Sell [TICKER]" with the company name directly beneath (e.g. "Buy MPCO" / "Mansoura Poultry").
2. Action Type (BUY or SELL):
   - If order type is "Market Buy", "Limit Buy", or header is "Buy [TICKER]", type is "BUY".
   - If order type is "Market Sell", "Limit Sell", or header is "Sell [TICKER]", type is "SELL".
3. Shares:
   - May be written as "300", "575 @ T+2", "8000 @ T+0", or "8000".
   - CRITICAL: Extract ONLY the number of shares (e.g., 575 or 8000). Discard "@ T+0", "@ T+2", or other settlement tags.
4. Execution Price:
   - Extract from "Average execution price", "Price", or "Order transactions" (e.g. "EGP 43.10", "EGP 13.50", "EGP 2.45"). Return as a clean number.
5. Fees:
   - Extract from "Total fees" or "Fees" (e.g. "EGP 11.68", "EGP 6.83", "EGP 10.8"). If none, return 0.
6. Date:
   - Look for "Date and time" (e.g., "10 Sep 26, 10:24 AM", "08 Sep 26, 12:40 PM", or "10 September 2026").
   - Notice that '26' means year 2026. Format accurately as YYYY-MM-DD (e.g., "2026-09-10", "2026-09-08").
7. Broker:
   - If the screenshot shows Telda's layout (dark design, circular verification checkmark, "order review", "Good till cancel", "@ T+0/@ T+2", "Report issue"), set brokerName to "Telda".
8. Common EGX tickers: ORHD, ELSH, MPCO, COMI, ESRS, TMGH, ETEL, EAST, MFPC, SWDY, FWRY, ISPH, HRHO, ABUK, AMOC, etc.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
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
            required: ["ticker", "type", "shares", "price", "date"],
          },
        },
      });

      const parsedJson = JSON.parse(response.text || "{}");
      res.json(parsedJson);
    } catch (err: any) {
      console.error("Error parsing trade screenshot with Gemini API:", err);
      res.status(500).json({ error: err.message || "Failed to analyze trade screenshot" });
    }
  });

  // Gemini API Endpoint: Batch Parse Stock Trade Screenshots
  app.post("/api/parse-trade-screenshots-batch", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY environment variable is not configured on the server.",
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

      const promptText = `Analyze this stock trade confirmation screenshot from Telda or other brokers.
Special Telda extraction rules:
1. Header: "[TICKER] order review" (e.g., ORHD, ELSH, MPCO) or "Buy/Sell [TICKER]".
2. Action: "BUY" or "SELL" based on "Market Buy", "Limit Buy", "Market Sell", "Limit Sell".
3. Shares: Pure number (ignore "@ T+0" or "@ T+2" settlement tags).
4. Price: Execution price per share in EGP (e.g., 43.10, 13.50, 2.60, 2.45).
5. Fees: Total fees / fees in EGP (e.g., 11.68, 6.83, 10.8).
6. Date: "Date and time" (e.g. "10 Sep 26" -> "2026-09-10", "08 Sep 26" -> "2026-09-08").
7. Broker: "Telda" if matching Telda's UI.`;

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
              model: "gemini-3.8-flash",
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
                  required: ["ticker", "type", "shares", "price", "date"],
                },
              },
            });

            const parsed = JSON.parse(response.text || "{}");
            return { index, success: true, data: parsed };
          } catch (itemErr: any) {
            console.error(`Failed parsing screenshot at index ${index}:`, itemErr);
            return { index, success: false, error: itemErr.message || "Failed to parse image" };
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
