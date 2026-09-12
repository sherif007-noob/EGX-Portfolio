import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

// --------------------------------------------------------------------------
// CIRCUIT BREAKER & RETRY STATE FOR GEMINI API
// --------------------------------------------------------------------------
interface CircuitBreakerState {
  failures: number;
  isOpen: boolean;
  openUntil: number;
  lastFailureTime: number;
}

const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  isOpen: false,
  openUntil: 0,
  lastFailureTime: 0,
};

const MAX_CONSECUTIVE_QUOTA_FAILURES = 3;
const CIRCUIT_OPEN_DURATION_MS = 5 * 60 * 1000; // 5 minutes

function checkCircuitBreaker(): { isOpen: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  if (circuitBreaker.isOpen) {
    if (now < circuitBreaker.openUntil) {
      const remainingSeconds = Math.ceil((circuitBreaker.openUntil - now) / 1000);
      return { isOpen: true, retryAfterSeconds: remainingSeconds };
    }
    // Circuit breaker cooling off, half-open state
    circuitBreaker.isOpen = false;
    circuitBreaker.failures = 0;
  }
  return { isOpen: false, retryAfterSeconds: 0 };
}

function recordGeminiSuccess() {
  circuitBreaker.failures = 0;
  circuitBreaker.isOpen = false;
}

function recordGeminiFailure(isQuotaError: boolean) {
  const now = Date.now();
  circuitBreaker.lastFailureTime = now;
  if (isQuotaError) {
    circuitBreaker.failures += 1;
    if (circuitBreaker.failures >= MAX_CONSECUTIVE_QUOTA_FAILURES) {
      circuitBreaker.isOpen = true;
      circuitBreaker.openUntil = now + CIRCUIT_OPEN_DURATION_MS;
      console.warn(
        `[Gemini API] Circuit breaker OPENED for 5 minutes due to ${circuitBreaker.failures} consecutive quota errors.`
      );
    }
  }
}

interface ParsedApiError {
  isQuotaError: boolean;
  isApiKeyError: boolean;
  isTransient: boolean;
  message: string;
}

function parseGeminiError(err: unknown): ParsedApiError {
  const errStr = typeof err === "string" ? err : ((err as any)?.message || JSON.stringify(err));
  const isQuotaError =
    Boolean((err as any)?.isQuotaError) ||
    errStr.includes("429") ||
    errStr.includes("prepayment credits") ||
    errStr.includes("RESOURCE_EXHAUSTED") ||
    errStr.includes("quota") ||
    errStr.includes("rate limit");
  const isApiKeyError =
    Boolean((err as any)?.isApiKeyError) ||
    errStr.includes("API key") ||
    errStr.includes("API_KEY_INVALID") ||
    errStr.includes("INVALID_ARGUMENT") ||
    errStr.includes("code\":400") ||
    errStr.includes("API_KEY_MISSING");
  const isTransient =
    errStr.includes("503") ||
    errStr.includes("500") ||
    errStr.includes("502") ||
    errStr.includes("504") ||
    errStr.includes("ECONNRESET") ||
    errStr.includes("ETIMEDOUT") ||
    errStr.includes("fetch failed");

  let message = errStr;
  if (isQuotaError) {
    message = "Gemini API quota/prepayment credits depleted (HTTP 429: RESOURCE_EXHAUSTED).";
  } else if (isApiKeyError) {
    message = "Gemini API key is invalid or unconfigured.";
  }

  return { isQuotaError, isApiKeyError, isTransient, message };
}

async function callGeminiWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 800
): Promise<T> {
  let lastErr: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const breaker = checkCircuitBreaker();
    if (breaker.isOpen) {
      const err: any = new Error(
        `Gemini API circuit breaker is OPEN due to repeated quota exhaustion. Retry in ${breaker.retryAfterSeconds}s.`
      );
      err.isQuotaError = true;
      err.circuitBreakerOpen = true;
      err.retryAfterSeconds = breaker.retryAfterSeconds;
      throw err;
    }

    try {
      const result = await fn();
      recordGeminiSuccess();
      return result;
    } catch (err) {
      lastErr = err;
      const parsed = parseGeminiError(err);

      if (parsed.isQuotaError) {
        recordGeminiFailure(true);
        // Do not retry endlessly on quota exhaustion
        throw err;
      }

      if (parsed.isApiKeyError) {
        // Unrecoverable without new key
        throw err;
      }

      if (attempt < maxRetries && parsed.isTransient) {
        const delay = Math.min(
          initialDelayMs * Math.pow(2, attempt) + Math.random() * 400,
          8000
        );
        console.warn(
          `[Gemini API] Transient error on attempt ${attempt + 1}/${maxRetries}, retrying in ${Math.round(delay)}ms:`,
          parsed.message
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      recordGeminiFailure(false);
      throw err;
    }
  }

  throw lastErr;
}

const PROMPT_TRADE_EXTRACTION = `Analyze this stock trade receipt/confirmation screenshot from Telda or other Egyptian brokers.

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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "10mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    const breaker = checkCircuitBreaker();
    res.json({
      status: "ok",
      circuitBreaker: {
        isOpen: breaker.isOpen,
        retryAfterSeconds: breaker.retryAfterSeconds,
        consecutiveFailures: circuitBreaker.failures,
      },
    });
  });

  // Gemini API Endpoint: Parse Stock Trade Screenshot / Receipt (Single)
  app.post("/api/parse-trade-screenshot", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("MY_GEMINI")) {
        return res.status(400).json({
          error: "GEMINI_API_KEY is missing or invalid. Please configure a valid Gemini API key in AI Studio environment settings.",
          isApiKeyError: true,
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

      const response = await callGeminiWithRetry(async () => {
        return await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            PROMPT_TRADE_EXTRACTION,
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
      });

      const rawText = (response.text || "{}").replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      const parsedJson = JSON.parse(rawText || "{}");
      res.json(parsedJson);
    } catch (err: unknown) {
      const parsed = parseGeminiError(err);
      console.error("Error parsing trade screenshot with Gemini API:", parsed.message);
      if (parsed.isQuotaError) {
        return res.status(429).json({
          error: parsed.message,
          isQuotaError: true,
          circuitBreakerOpen: (err as any)?.circuitBreakerOpen || false,
          retryAfterSeconds: (err as any)?.retryAfterSeconds,
        });
      }
      if (parsed.isApiKeyError) {
        return res.status(400).json({
          error: parsed.message,
          isApiKeyError: true,
        });
      }
      res.status(500).json({ error: parsed.message, isTransient: parsed.isTransient });
    }
  });

  // Gemini API Endpoint: Batch Parse Stock Trade Screenshots with Partial Failure Handling
  app.post("/api/parse-trade-screenshots-batch", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("MY_GEMINI")) {
        return res.status(400).json({
          error: "GEMINI_API_KEY is missing or invalid. Please configure a valid Gemini API key in AI Studio environment settings.",
          isApiKeyError: true,
          results: [],
        });
      }

      const { images } = req.body;
      if (!Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: "Missing or invalid 'images' array.", results: [] });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      // Process images concurrently with per-item error containment & retries
      const results = await Promise.all(
        images.slice(0, 15).map(async (imgObj, index) => {
          try {
            const cleanBase64 = (imgObj.imageBase64 || "").replace(/^data:image\/\w+;base64,/, "");
            if (!cleanBase64) {
              return { index, success: false, error: "Empty image data" };
            }
            const mimeType = imgObj.mimeType || "image/jpeg";

            const response = await callGeminiWithRetry(async () => {
              return await ai.models.generateContent({
                model: "gemini-3.6-flash",
                contents: [
                  {
                    inlineData: {
                      mimeType,
                      data: cleanBase64,
                    },
                  },
                  PROMPT_TRADE_EXTRACTION,
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
            });

            const rawText = (response.text || "{}").replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
            const parsed = JSON.parse(rawText || "{}");
            return { index, success: true, data: parsed };
          } catch (itemErr: unknown) {
            const parsedErr = parseGeminiError(itemErr);
            console.error(`Failed parsing screenshot at index ${index}:`, parsedErr.message);
            return {
              index,
              success: false,
              isQuotaError: parsedErr.isQuotaError,
              isApiKeyError: parsedErr.isApiKeyError,
              error: parsedErr.message,
            };
          }
        })
      );

      const hasAnyQuotaError = results.some((r) => r.isQuotaError);
      res.json({
        results,
        partialFailure: results.some((r) => !r.success),
        isQuotaExhausted: hasAnyQuotaError,
      });
    } catch (err: unknown) {
      const parsed = parseGeminiError(err);
      console.error("Batch parse error:", parsed.message);
      res.status(500).json({ error: parsed.message, results: [] });
    }
  });

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

