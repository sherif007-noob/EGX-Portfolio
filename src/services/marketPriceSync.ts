import { EGXTicker, Position, LivePriceQuote } from '../types';

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

/**
 * Queries TradingView Egypt market scanner API for real-time closing prices.
 * Uses the backend server proxy (/api/egx/scan) to guarantee reliable requests without
 * browser CORS blocks, identical to the Python requests logic in sherif007-noob/glide-update.
 */
export async function fetchTradingViewEGXPrices(): Promise<Record<string, LivePriceQuote>> {
  const payload = {
    filter: [],
    options: { lang: 'en' },
    symbols: { query: { types: [] }, tickers: [] },
    columns: ['name', 'close', 'change', 'volume'],
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
  const priceMap: Record<string, LivePriceQuote> = {};

  for (const item of data) {
    if (Array.isArray(item.d) && item.d.length >= 2) {
      const rawSymbol = String(item.d[0] || '').trim().toUpperCase();
      const rawClose = item.d[1];
      const rawChange = item.d[2];
      const rawVol = item.d[3];

      if (rawClose !== null && rawClose !== undefined) {
        const quote: LivePriceQuote = {
          ticker: rawSymbol,
          price: Math.round(Number(rawClose) * 100) / 100,
          changePercent: rawChange !== null && rawChange !== undefined ? Math.round(Number(rawChange) * 100) / 100 : 0,
          volume: rawVol !== null && rawVol !== undefined ? Number(rawVol) : 0
        };

        priceMap[rawSymbol] = quote;
      }
    }
  }

  return priceMap;
}

/**
 * Resolves a ticker symbol using known aliases.
 */
export function resolveTickerSymbol(ticker: string): string {
  const upper = ticker.trim().toUpperCase();
  return TICKER_ALIASES[upper] || upper;
}

/**
 * Applies fetched quotes to both open positions and ticker directory.
 */
export function applyLivePricesToPortfolio(
  positions: Position[],
  tickers: EGXTicker[],
  quotes: Record<string, LivePriceQuote>
): { updatedPositions: Position[]; updatedTickers: EGXTicker[]; matchCount: number } {
  let matchCount = 0;
  const nowIso = new Date().toISOString();

  // 1. Update Tickers Directory
  const updatedTickers = tickers.map(t => {
    const symbol = resolveTickerSymbol(t.ticker);
    const quote = quotes[symbol] || quotes[t.ticker.toUpperCase()];
    if (quote) {
      matchCount++;
      const prevPrice = t.lastPrice;
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

  // 2. Update Positions with live prices
  const updatedPositions = positions.map(p => {
    const symbol = resolveTickerSymbol(p.ticker);
    const quote = quotes[symbol] || quotes[p.ticker.toUpperCase()];
    if (quote) {
      return {
        ...p,
        currentPrice: quote.price
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
 * Rules:
 * - Active days: Sunday (0) to Thursday (4)
 * - Session window: 09:47 to 16:30 Cairo time
 * - 15-minute cycles with 2-minute offset: :02, :17, :32, :47 past the hour
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

    // Cairo local date object
    const cairoLocalTime = new Date(Date.UTC(year, month, day, hour, minute, second));
    const dayOfWeek = cairoLocalTime.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 4 = Thu, 5 = Fri, 6 = Sat

    const isTradingDay = dayOfWeek >= 0 && dayOfWeek <= 4;
    const currentTotalMinutes = hour * 60 + minute;
    const startMinutes = 9 * 60 + 47; // 09:47
    const endMinutes = 16 * 60 + 30;  // 16:30

    const inSession = isTradingDay && currentTotalMinutes >= startMinutes && currentTotalMinutes <= endMinutes;

    // Find the next scheduled tick minute (:02, :17, :32, :47)
    const tickMinutes = [2, 17, 32, 47];
    let nextTickMinute = tickMinutes.find(m => m > minute);
    let nextTickHour = hour;

    if (nextTickMinute === undefined) {
      nextTickMinute = tickMinutes[0]; // :02 of next hour
      nextTickHour = (hour + 1) % 24;
    }

    const secRemainingInMinute = 60 - second;
    const minRemaining = (nextTickMinute >= minute ? nextTickMinute - minute : (nextTickMinute + 60) - minute) - 1;
    const millisUntilNextTick = Math.max(1000, (minRemaining * 60 + secRemainingInMinute) * 1000);

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
