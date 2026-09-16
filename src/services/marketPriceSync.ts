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
 * Queries TradingView Egypt market scanner API for delayed market data and closing-price data.
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
      'change_abs',
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
      
      // Parse columns according to payload format:
      // columns: ['name', 'description', 'logoid', 'close', 'change', 'change_abs', 'volume', 'high', 'low', 'high_52_week', 'low_52_week', 'sector', 'RSI']
      let description = '';
      let logoId = '';
      let close = 0;
      let changePercent = 0;
      let changeAbs = 0;
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
          changePercent = Number(item.d[4] || 0);
          changeAbs = item.d[5] !== null && item.d[5] !== undefined ? Number(item.d[5]) : 0;
          volume = Number(item.d[6] || 0);
          high = item.d[7] !== null && item.d[7] !== undefined ? Number(item.d[7]) : undefined;
          low = item.d[8] !== null && item.d[8] !== undefined ? Number(item.d[8]) : undefined;
          yearHigh = item.d[9] !== null && item.d[9] !== undefined ? Number(item.d[9]) : undefined;
          yearLow = item.d[10] !== null && item.d[10] !== undefined ? Number(item.d[10]) : undefined;
          rsi = item.d[12] !== null && item.d[12] !== undefined ? Number(item.d[12]) : undefined;
        } else {
          close = Number(item.d[2] || 0);
          changePercent = Number(item.d[3] || 0);
          changeAbs = item.d[4] !== null && item.d[4] !== undefined ? Number(item.d[4]) : 0;
          volume = Number(item.d[5] || 0);
          high = item.d[6] !== null && item.d[6] !== undefined ? Number(item.d[6]) : undefined;
          low = item.d[7] !== null && item.d[7] !== undefined ? Number(item.d[7]) : undefined;
          yearHigh = item.d[8] !== null && item.d[8] !== undefined ? Number(item.d[8]) : undefined;
          yearLow = item.d[9] !== null && item.d[9] !== undefined ? Number(item.d[9]) : undefined;
          rsi = item.d[11] !== null && item.d[11] !== undefined ? Number(item.d[11]) : undefined;
        }
      } else {
        // Standard payload
        close = Number(item.d[1] || 0);
        changePercent = Number(item.d[2] || 0);
        changeAbs = item.d[3] !== null && item.d[3] !== undefined ? Number(item.d[3]) : 0;
        volume = Number(item.d[4] || 0);
      }

      if (close > 0) {
        const roundedPrice = Math.round(close * 100) / 100;
        const roundedChangePercent = Math.round(changePercent * 100) / 100;
        
        // Exact change in EGP from TradingView or exact difference from previous close
        let calculatedChangeAbs = changeAbs;
        if ((calculatedChangeAbs === 0 || isNaN(calculatedChangeAbs)) && roundedChangePercent !== 0) {
          const prevClose = roundedPrice / (1 + roundedChangePercent / 100);
          calculatedChangeAbs = roundedPrice - prevClose;
        }
        const roundedChangeAbs = Math.round(calculatedChangeAbs * 100) / 100;

        const quote: LivePriceQuote = {
          ticker: cleanTicker,
          price: roundedPrice,
          change: roundedChangeAbs,
          changePercent: roundedChangePercent,
          volume: volume || 0,
          dayHigh: high,
          dayLow: low
        };

        quotes[cleanTicker] = quote;
        quotes[rawSymbol] = quote;
        const alias = resolveTickerSymbol(cleanTicker);
        if (alias && alias !== cleanTicker) {
          quotes[alias] = quote;
        }

        // Build rich ticker object with TradingView logo
        const tickerObj = createEGXTickerRecord(
          cleanTicker,
          roundedPrice,
          roundedChangePercent,
          volume,
          high,
          low,
          yearHigh,
          yearLow,
          rsi,
          description,
          logoId,
          roundedChangeAbs
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
): { updatedPositions: Position[]; updatedTickers: EGXTicker[]; matchCount: number; hasChanges: boolean } {
  let matchCount = 0;
  let hasChanges = false;
  const nowIso = new Date().toISOString();

  // Create a map of existing tickers by symbol for quick lookup
  const tickerMap = new Map<string, EGXTicker>();
  tickers.forEach(t => tickerMap.set(t.ticker.toUpperCase(), t));

  // Merge discovered tickers from TradingView into the directory
  discoveredTickers.forEach(dt => {
    const existing = tickerMap.get(dt.ticker.toUpperCase());
    if (existing) {
      if (
        existing.lastPrice !== dt.lastPrice ||
        existing.change !== dt.change ||
        existing.volume !== dt.volume ||
        existing.dayHigh !== dt.dayHigh ||
        existing.dayLow !== dt.dayLow
      ) {
        hasChanges = true;
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
          lastUpdated: nowIso,
          priceUpdatedAt: nowIso
        });
      }
    } else {
      // Add newly discovered EGX equity
      hasChanges = true;
      dt.lastUpdated = nowIso;
      dt.priceUpdatedAt = nowIso;
      tickerMap.set(dt.ticker.toUpperCase(), dt);
    }
  });

  // Also apply direct quotes to any remaining tickers
  const updatedTickers = Array.from(tickerMap.values()).map(t => {
    const symbol = resolveTickerSymbol(t.ticker);
    const quote = quotes[symbol] || quotes[t.ticker.toUpperCase()];
    if (quote) {
      matchCount++;
      const changeEgp = quote.change !== undefined && !isNaN(quote.change)
        ? quote.change
        : (quote.changePercent !== 0 && quote.price > 0
            ? Math.round((quote.price - (quote.price / (1 + quote.changePercent / 100))) * 100) / 100
            : 0);
      const newDayHigh = Math.max(t.dayHigh || quote.price, quote.price);
      const newDayLow = Math.min(t.dayLow || quote.price, quote.price);
      
      if (
        t.lastPrice !== quote.price ||
        t.change !== changeEgp ||
        t.changePercent !== quote.changePercent ||
        t.volume !== (quote.volume || t.volume) ||
        t.dayHigh !== newDayHigh ||
        t.dayLow !== newDayLow
      ) {
        hasChanges = true;
        return {
          ...t,
          lastPrice: quote.price,
          change: changeEgp,
          changePercent: quote.changePercent,
          volume: quote.volume || t.volume,
          dayHigh: newDayHigh,
          dayLow: newDayLow,
          lastUpdated: nowIso,
          priceUpdatedAt: nowIso
        };
      }
    }
    return t;
  });

  if (hasChanges) {
    updatedTickers.sort((a, b) => a.ticker.localeCompare(b.ticker));
  }

  // Update Positions with live prices and day changes
  let positionsChanged = false;
  const updatedPositions = positions.map(p => {
    const cleanSym = p.ticker.trim().toUpperCase();
    const symbol = resolveTickerSymbol(cleanSym);
    
    let newPrice = p.currentPrice;
    let newDayChange = p.dayChange;
    let newDayChangePercent = p.dayChangePercent;
    
    const quote = quotes[symbol] || quotes[cleanSym] || quotes[p.ticker];
    if (quote && quote.price > 0) {
      newPrice = quote.price;
      newDayChange = quote.change !== undefined ? quote.change : newDayChange;
      newDayChangePercent = quote.changePercent !== undefined ? quote.changePercent : newDayChangePercent;
    } else {
      const discovered = discoveredTickers.find(dt => dt.ticker.trim().toUpperCase() === cleanSym || dt.ticker.trim().toUpperCase() === symbol);
      if (discovered && discovered.lastPrice > 0) {
        newPrice = discovered.lastPrice;
        newDayChange = discovered.change !== undefined ? discovered.change : newDayChange;
        newDayChangePercent = discovered.changePercent !== undefined ? discovered.changePercent : newDayChangePercent;
      } else {
        const matchedTicker = tickerMap.get(cleanSym) || tickerMap.get(symbol);
        if (matchedTicker && matchedTicker.lastPrice > 0) {
          newPrice = matchedTicker.lastPrice;
          newDayChange = matchedTicker.change !== undefined ? matchedTicker.change : newDayChange;
          newDayChangePercent = matchedTicker.changePercent !== undefined ? matchedTicker.changePercent : newDayChangePercent;
        }
      }
    }
    
    if (newPrice !== p.currentPrice || newDayChange !== p.dayChange || newDayChangePercent !== p.dayChangePercent) {
      positionsChanged = true;
      return {
        ...p,
        currentPrice: newPrice,
        dayChange: newDayChange,
        dayChangePercent: newDayChangePercent,
        priceUpdatedAt: nowIso
      };
    }
    return p;
  });

  return { 
    updatedPositions: positionsChanged ? updatedPositions : positions, 
    updatedTickers: hasChanges ? updatedTickers : tickers, 
    matchCount, 
    hasChanges: hasChanges || positionsChanged 
  };
}

/**
 * Evaluates whether Cairo EGX market session is currently active
 * and calculates precise milliseconds until the next scheduled update tick.
 * 
 * Schedule Rules:
 * - Sunday: 09:30 AM – 02:30 PM Cairo time
 * - Monday–Thursday: 10:00 AM – 02:30 PM Cairo time
 * - Friday & Saturday: Market closed, no syncing (isSessionActive: false)
 * - Closing session final price update: 03:15 PM (15:15 Cairo time) on trading days (Sunday–Thursday)
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
    const month = getVal('month') - 1;
    const day = getVal('day');
    const hour = getVal('hour');
    const minute = getVal('minute');
    const second = getVal('second');
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    const totalMinutes = hour * 60 + minute;

    const isTradingDay = dayOfWeek >= 0 && dayOfWeek <= 4;
    const sessionStartMinutes = dayOfWeek === 0 ? 9 * 60 + 30 : 10 * 60;
    const sessionEndMinutes = 14 * 60 + 30;
    const isSessionActive = isTradingDay && totalMinutes >= sessionStartMinutes && totalMinutes <= sessionEndMinutes;

    let millisUntilNextTick = 0;
    let nextTickLabel = '';

    if (isSessionActive) {
      const nextQuarter = Math.ceil((totalMinutes * 60 + second + 1) / 900) * 900;
      const currentSeconds = totalMinutes * 60 + second;
      millisUntilNextTick = Math.max(1000, (nextQuarter - currentSeconds) * 1000);
      nextTickLabel = 'Next 15-minute market refresh';
    } else if (isTradingDay && totalMinutes < sessionStartMinutes) {
      const currentSeconds = totalMinutes * 60 + second;
      const startSeconds = sessionStartMinutes * 60;
      millisUntilNextTick = Math.max(1000, (startSeconds - currentSeconds) * 1000);
      nextTickLabel = 'Market opens';
    } else if (isTradingDay && totalMinutes < CLOSING_HOUR_CAIRO * 60 + CLOSING_MINUTE_CAIRO + CLOSING_WINDOW_MINUTES) {
      const currentSeconds = totalMinutes * 60 + second;
      const closingSeconds = (CLOSING_HOUR_CAIRO * 60 + CLOSING_MINUTE_CAIRO) * 60;
      millisUntilNextTick = Math.max(1000, (closingSeconds - currentSeconds) * 1000);
      nextTickLabel = '3:15 PM closing valuation write';
    } else {
      nextTickLabel = 'Market closed';
      millisUntilNextTick = 0;
    }

    return {
      isSessionActive,
      cairoTimeString: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`,
      cairoDateString: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      millisUntilNextTick,
      nextTickLabel,
    };
  } catch (error) {
    console.error('Failed to calculate EGX schedule status:', error);
    return {
      isSessionActive: false,
      cairoTimeString: '',
      cairoDateString: '',
      millisUntilNextTick: 0,
      nextTickLabel: 'Schedule unavailable',
    };
  }
}
