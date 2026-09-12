import { EGXTicker, Position, LivePriceQuote } from '../types';
import { createEGXTickerRecord } from '../data/egxTickers';

/**
 * Maps legacy, alternate, or renamed EGX tickers to active TradingView scanner symbols.
 * Ported from sherif007-noob/glide-update
 */
export const TICKER_ALIASES: Record<string, string> = {
  "QNBA": "QNBF",   // QNB Alahli
  "MNHD": "MASR",   // Madinet Masr for Housing & Development
  "AUTO": "GBCO",   // GB Corp
  "OTMT": "OIH",    // Orascom Investment Holding
  "COMI": "COMI",
  "TMGH": "TMGH",
  "SWDY": "SWDY",
  "HRHO": "HRHO",
  "ETEL": "ETEL",
  "UBEG": "UBEE",   // United Bank
};

export interface EGXScheduleStatus {
  isSessionActive: boolean;
  cairoTimeString: string;
  cairoDateString: string;
  millisUntilNextTick: number;
  nextTickLabel: string;
}

export interface TradingViewScanResult {
  quotes: Record<string, LivePriceQuote>;
  discoveredTickers: EGXTicker[];
}

/**
 * Queries TradingView Egypt market scanner API for real-time closing prices and full stock data.
 * Uses the backend server proxy (/api/egx/scan) to guarantee reliable requests without CORS blocks.
 */
export async function fetchTradingViewEGXPrices(): Promise<TradingViewScanResult> {
  const payload = {
    filter: [],
    options: { lang: 'en' },
    symbols: { query: { types: [] }, tickers: [] },
    columns: [
      'name',
      'description',
      'logoid',
      'close',
      'change',
      'volume',
      'high',
      'low',
      'high_52_week',
      'low_52_week',
      'sector',
      'RSI'
    ],
    sort: { sortBy: 'name', sortOrder: 'asc' },
    range: [0, 500]
  };

  let json: any = null;

  // 1. Primary: Use the server API proxy (running on the app server, bypasses CORS restrictions)
  try {
    const proxyRes = await fetch('/api/egx/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (proxyRes.ok) {
      json = await proxyRes.json();
    }
  } catch (err) {
    console.warn('Proxy request failed, trying direct TradingView endpoint...', err);
  }

  // 2. Fallback: Direct call if proxy unavailable
  if (!json || !json.data) {
    const directRes = await fetch('https://scanner.tradingview.com/egypt/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!directRes.ok) {
      throw new Error(`TradingView Scanner HTTP ${directRes.status}: ${directRes.statusText}`);
    }

    json = await directRes.json();
  }

  const data = json.data || [];
  const quotes: Record<string, LivePriceQuote> = {};
  const discoveredTickers: EGXTicker[] = [];

  for (const item of data) {
    if (Array.isArray(item.d) && item.d.length >= 2) {
      const rawSymbol = String(item.d[0] || '').trim().toUpperCase();
      const cleanTicker = rawSymbol.replace(/^EGX:/, '').replace(/\.CA$/, '');
      
      // Parse columns according to payload format
      // columns: ['name', 'description', 'logoid', 'close', 'change', 'volume', 'high', 'low', 'high_52_week', 'low_52_week', 'sector', 'RSI']
      let description = '';
      let logoId = '';
      let close = 0;
      let change = 0;
      let volume = 0;
      let high: number | undefined;
      let low: number | undefined;
      let yearHigh: number | undefined;
      let yearLow: number | undefined;
      let rsi: number | undefined;

      if (typeof item.d[1] === 'string' && isNaN(Number(item.d[1]))) {
        // Extended payload with logoid
        description = String(item.d[1] || '');
        if (typeof item.d[2] === 'string' && isNaN(Number(item.d[2]))) {
          logoId = String(item.d[2] || '');
          close = Number(item.d[3] || 0);
          change = Number(item.d[4] || 0);
          volume = Number(item.d[5] || 0);
          high = item.d[6] !== null && item.d[6] !== undefined ? Number(item.d[6]) : undefined;
          low = item.d[7] !== null && item.d[7] !== undefined ? Number(item.d[7]) : undefined;
          yearHigh = item.d[8] !== null && item.d[8] !== undefined ? Number(item.d[8]) : undefined;
          yearLow = item.d[9] !== null && item.d[9] !== undefined ? Number(item.d[9]) : undefined;
          rsi = item.d[11] !== null && item.d[11] !== undefined ? Number(item.d[11]) : undefined;
        } else {
          close = Number(item.d[2] || 0);
          change = Number(item.d[3] || 0);
          volume = Number(item.d[4] || 0);
          high = item.d[5] !== null && item.d[5] !== undefined ? Number(item.d[5]) : undefined;
          low = item.d[6] !== null && item.d[6] !== undefined ? Number(item.d[6]) : undefined;
          yearHigh = item.d[7] !== null && item.d[7] !== undefined ? Number(item.d[7]) : undefined;
          yearLow = item.d[8] !== null && item.d[8] !== undefined ? Number(item.d[8]) : undefined;
          rsi = item.d[10] !== null && item.d[10] !== undefined ? Number(item.d[10]) : undefined;
        }
      } else {
        // Standard payload
        close = Number(item.d[1] || 0);
        change = Number(item.d[2] || 0);
        volume = Number(item.d[3] || 0);
      }

      if (close > 0) {
        const roundedPrice = Math.round(close * 100) / 100;
        const roundedChange = Math.round(change * 100) / 100;

        const quote: LivePriceQuote = {
          ticker: cleanTicker,
          price: roundedPrice,
          changePercent: roundedChange,
          volume: volume || 0
        };

        quotes[cleanTicker] = quote;
        quotes[rawSymbol] = quote;

        // Build rich ticker object with TradingView logo
        const tickerObj = createEGXTickerRecord(
          cleanTicker,
          roundedPrice,
          roundedChange,
          volume,
          high,
          low,
          yearHigh,
          yearLow,
          rsi,
          description,
          logoId
        );
        discoveredTickers.push(tickerObj);
      }
    }
  }

  return { quotes, discoveredTickers };
}

/**
 * Resolves a ticker symbol using known aliases.
 */
export function resolveTickerSymbol(ticker: string): string {
  const upper = ticker.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
  return TICKER_ALIASES[upper] || upper;
}

/**
 * Applies fetched quotes and discovered stocks to open positions and the ticker directory.
 */
export function applyLivePricesToPortfolio(
  positions: Position[],
  tickers: EGXTicker[],
  quotes: Record<string, LivePriceQuote>,
  discoveredTickers: EGXTicker[] = []
): { updatedPositions: Position[]; updatedTickers: EGXTicker[]; matchCount: number } {
  let matchCount = 0;
  const nowIso = new Date().toISOString();

  // Create a map of existing tickers by symbol for quick lookup
  const tickerMap = new Map<string, EGXTicker>();
  tickers.forEach(t => tickerMap.set(t.ticker.toUpperCase(), t));

  // Merge discovered tickers from TradingView into the directory
  discoveredTickers.forEach(dt => {
    const existing = tickerMap.get(dt.ticker.toUpperCase());
    if (existing) {
      // Update with live values
      tickerMap.set(dt.ticker.toUpperCase(), {
        ...existing,
        lastPrice: dt.lastPrice,
        change: dt.change,
        changePercent: dt.changePercent,
        volume: dt.volume || existing.volume,
        dayHigh: dt.dayHigh || existing.dayHigh,
        dayLow: dt.dayLow || existing.dayLow,
        yearHigh: dt.yearHigh || existing.yearHigh,
        yearLow: dt.yearLow || existing.yearLow,
        rsi14: dt.rsi14 || existing.rsi14,
        trendStatus: dt.trendStatus || existing.trendStatus,
        lastUpdated: nowIso
      });
    } else {
      // Add newly discovered EGX equity
      tickerMap.set(dt.ticker.toUpperCase(), dt);
    }
  });

  // Also apply direct quotes to any remaining tickers
  const updatedTickers = Array.from(tickerMap.values()).map(t => {
    const symbol = resolveTickerSymbol(t.ticker);
    const quote = quotes[symbol] || quotes[t.ticker.toUpperCase()];
    if (quote) {
      matchCount++;
      const changeEgp = Math.round((quote.price * (quote.changePercent / 100)) * 100) / 100;
      return {
        ...t,
        lastPrice: quote.price,
        change: changeEgp,
        changePercent: quote.changePercent,
        volume: quote.volume || t.volume,
        dayHigh: Math.max(t.dayHigh || quote.price, quote.price),
        dayLow: Math.min(t.dayLow || quote.price, quote.price),
        lastUpdated: nowIso
      };
    }
    return t;
  });

  // Sort tickers alphabetically by symbol
  updatedTickers.sort((a, b) => a.ticker.localeCompare(b.ticker));

  // Update Positions with live prices
  const updatedPositions = positions.map(p => {
    const cleanSym = p.ticker.trim().toUpperCase();
    const symbol = resolveTickerSymbol(cleanSym);
    const quote = quotes[symbol] || quotes[cleanSym] || quotes[p.ticker];
    if (quote && quote.price > 0) {
      return {
        ...p,
        currentPrice: quote.price
      };
    }
    const discovered = discoveredTickers.find(dt => dt.ticker.trim().toUpperCase() === cleanSym || dt.ticker.trim().toUpperCase() === symbol);
    if (discovered && discovered.lastPrice > 0) {
      return {
        ...p,
        currentPrice: discovered.lastPrice
      };
    }
    const matchedTicker = tickerMap.get(cleanSym) || tickerMap.get(symbol);
    if (matchedTicker && matchedTicker.lastPrice > 0) {
      return {
        ...p,
        currentPrice: matchedTicker.lastPrice
      };
    }
    return p;
  });

  return { updatedPositions, updatedTickers, matchCount };
}

/**
 * Evaluates whether Cairo EGX market session is currently active
 * and calculates precise milliseconds until the next scheduled update tick.
 * 
 * Schedule Rules:
 * - Sunday: 09:30 AM – 02:30 PM Cairo time
 * - Monday–Thursday: 10:00 AM – 02:30 PM Cairo time
 * - Friday & Saturday: Market closed, no syncing (isSessionActive: false)
 * - Additional sync windows: 03:30 PM (15:30) and 04:40 PM (16:40) on trading days only (Sunday–Thursday)
 */
export function getEGXSessionStatus(): EGXScheduleStatus {
  try {
    const now = new Date();
    // Get Cairo date components
    const cairoDateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });

    const parts = cairoDateFormatter.formatToParts(now);
    const getVal = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);

    const year = getVal('year');
    const month = getVal('month') - 1; // 0-indexed
    const day = getVal('day');
    const hour = getVal('hour');
    const minute = getVal('minute');
    const second = getVal('second');

    // Cairo local date object for day-of-week calculation (UTC matching local Y/M/D/H/M/S)
    const cairoLocalTime = new Date(Date.UTC(year, month, day, hour, minute, second));
    const dayOfWeek = cairoLocalTime.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 4 = Thu, 5 = Fri, 6 = Sat

    // Trading days: Sunday (0) to Thursday (4)
    const isTradingDay = dayOfWeek >= 0 && dayOfWeek <= 4;
    const currentTotalMinutes = hour * 60 + minute;

    let inSession = false;

    if (isTradingDay) {
      if (dayOfWeek === 0) {
        // Sunday session: 9:30 AM (570) to 2:30 PM (870)
        if (currentTotalMinutes >= 570 && currentTotalMinutes <= 870) {
          inSession = true;
        }
      } else {
        // Monday–Thursday session: 10:00 AM (600) to 2:30 PM (870)
        if (currentTotalMinutes >= 600 && currentTotalMinutes <= 870) {
          inSession = true;
        }
      }

      // Additional post-close sync windows on trading days:
      // 3:30 PM (930 to 945 mins) and 4:40 PM (1000 to 1015 mins)
      if ((currentTotalMinutes >= 930 && currentTotalMinutes <= 945) ||
          (currentTotalMinutes >= 1000 && currentTotalMinutes <= 1015)) {
        inSession = true;
      }
    }

    // Determine next tick time or next schedule window
    let nextTickHour = hour;
    let nextTickMinute = minute;
    let millisUntilNextTick = 60000;

    if (inSession) {
      // 15-minute cycles during active session window (:00, :15, :30, :45)
      const tickMinutes = [0, 15, 30, 45];
      let nextM = tickMinutes.find(m => m > minute);
      if (nextM === undefined) {
        nextM = 0;
        nextTickHour = (hour + 1) % 24;
      }
      nextTickMinute = nextM;
      const secRemaining = 60 - second;
      const minRemaining = (nextTickMinute >= minute ? nextTickMinute - minute : (nextTickMinute + 60) - minute) - 1;
      millisUntilNextTick = Math.max(1000, (minRemaining * 60 + secRemaining) * 1000);
    } else {
      // Outside active session windows: calculate target time for next window
      const targetsToday: number[] = [];
      if (isTradingDay) {
        const openMin = dayOfWeek === 0 ? 570 : 600; // 9:30 or 10:00
        if (openMin > currentTotalMinutes) targetsToday.push(openMin);
        if (930 > currentTotalMinutes) targetsToday.push(930);  // 3:30 PM
        if (1000 > currentTotalMinutes) targetsToday.push(1000); // 4:40 PM
      }

      if (targetsToday.length > 0) {
        const nextTargetMin = targetsToday[0];
        nextTickHour = Math.floor(nextTargetMin / 60);
        nextTickMinute = nextTargetMin % 60;
        const diffMins = nextTargetMin - currentTotalMinutes;
        const secRemaining = 60 - second;
        millisUntilNextTick = Math.max(1000, ((diffMins - 1) * 60 + secRemaining) * 1000);
      } else {
        // Find next trading day morning (Sun = 0)
        let daysToAdd = 1;
        let nextDay = (dayOfWeek + 1) % 7;
        while (nextDay === 5 || nextDay === 6) { // Skip Fri, Sat
          daysToAdd++;
          nextDay = (nextDay + 1) % 7;
        }
        const openHour = nextDay === 0 ? 9 : 10;
        const openMin = nextDay === 0 ? 30 : 0;
        nextTickHour = openHour;
        nextTickMinute = openMin;

        const minutesUntilMidnight = (24 * 60) - currentTotalMinutes;
        const minutesOnNextDay = openHour * 60 + openMin;
        const totalWaitMins = minutesUntilMidnight + (daysToAdd - 1) * 24 * 60 + minutesOnNextDay;
        const secRemaining = 60 - second;
        millisUntilNextTick = Math.max(1000, ((totalWaitMins - 1) * 60 + secRemaining) * 1000);
      }
    }

    const pad = (n: number) => n.toString().padStart(2, '0');
    const nextTickLabel = `${pad(nextTickHour)}:${pad(nextTickMinute)}`;
    const cairoTimeString = `${pad(hour)}:${pad(minute)}:${pad(second)}`;
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const cairoDateString = `${dayNames[dayOfWeek]} ${pad(day)}/${pad(month + 1)}`;

    return {
      isSessionActive: inSession,
      cairoTimeString,
      cairoDateString,
      millisUntilNextTick,
      nextTickLabel
    };
  } catch {
    return {
      isSessionActive: false,
      cairoTimeString: '--:--',
      cairoDateString: 'EGX',
      millisUntilNextTick: 60000,
      nextTickLabel: '--:--'
    };
  }
}

export function formatCairoTime(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    day: 'numeric',
    month: 'short'
  }).format(date);
}
