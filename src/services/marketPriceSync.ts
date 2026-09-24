import { EGXTicker, Position, LivePriceQuote } from '../types';
import { EGX_STOCK_DICTIONARY, LEGACY_TICKER_ALIASES, canonicalizeEGXSymbol, createEGXTickerRecord } from '../data/egxTickers';

/**
 * Maps legacy, alternate, or renamed EGX tickers to active TradingView scanner symbols.
 * Ported from sherif007-noob/glide-update
 */
export const TICKER_ALIASES: Record<string, string> = LEGACY_TICKER_ALIASES;

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
export async function fetchTradingViewEGXPrices(
  directory: EGXTicker[] = [],
): Promise<TradingViewScanResult> {
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
      'RSI',
      'industry',
      'isin',
      'currency'
    ],
    sort: { sortBy: 'name', sortOrder: 'asc' },
    range: [0, 500]
  };

  let json: any = null;

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
      const scannerSymbol = rawSymbol.replace(/^EGX:/, '').replace(/\.CA$/, '');
      const directRegistry = directory.find(
        (ticker) =>
          ticker.metadataSource === 'registry' &&
          ticker.directoryStatus !== 'inactive' &&
          ticker.directoryStatus !== 'retired' &&
          ticker.ticker.trim().toUpperCase() === scannerSymbol,
      );
      const aliasRegistry = directory.find(
        (ticker) =>
          ticker.metadataSource === 'registry' &&
          ticker.directoryStatus !== 'inactive' &&
          ticker.directoryStatus !== 'retired' &&
          (ticker.aliases || []).some((alias) => alias.trim().toUpperCase() === scannerSymbol),
      );
      const cleanTicker =
        directRegistry?.ticker.trim().toUpperCase() ||
        aliasRegistry?.ticker.trim().toUpperCase() ||
        canonicalizeEGXSymbol(scannerSymbol);
      const description = typeof item.d[1] === 'string' ? String(item.d[1] || '').trim() : '';
      const logoId = typeof item.d[2] === 'string' ? String(item.d[2] || '').trim() : '';
      const close = Number(item.d[3] || 0);
      const changePercent = Number(item.d[4] || 0);
      const changeAbs = item.d[5] !== null && item.d[5] !== undefined ? Number(item.d[5]) : 0;
      const volume = Number(item.d[6] || 0);
      const high = item.d[7] !== null && item.d[7] !== undefined ? Number(item.d[7]) : undefined;
      const low = item.d[8] !== null && item.d[8] !== undefined ? Number(item.d[8]) : undefined;
      const yearHigh = item.d[9] !== null && item.d[9] !== undefined ? Number(item.d[9]) : undefined;
      const yearLow = item.d[10] !== null && item.d[10] !== undefined ? Number(item.d[10]) : undefined;
      const marketSector = typeof item.d[11] === 'string' ? String(item.d[11] || '').trim() : '';
      const rsi = item.d[12] !== null && item.d[12] !== undefined ? Number(item.d[12]) : undefined;
      const industry = typeof item.d[13] === 'string' ? String(item.d[13] || '').trim() : '';
      const scannerIsin = typeof item.d[14] === 'string' ? String(item.d[14] || '').trim().toUpperCase() : '';
      const currency = typeof item.d[15] === 'string' ? String(item.d[15] || '').trim().toUpperCase() : '';

      // This portfolio is EGP-denominated. Ignore alternate USD share classes rather
      // than silently labeling a USD quote as EGP in the directory and valuation UI.
      if (close > 0 && (!currency || currency === 'EGP')) {
        const roundedPrice = Math.round(close * 100) / 100;
        const roundedChangePercent = Math.round(changePercent * 100) / 100;
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
        quotes[scannerSymbol] = quote;
        quotes[rawSymbol] = quote;
        const alias = resolveTickerSymbol(cleanTicker);
        if (alias && alias !== cleanTicker) {
          quotes[alias] = quote;
        }

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
          roundedChangeAbs,
          marketSector,
          industry,
          scannerIsin,
          true,
        );
        discoveredTickers.push(tickerObj);
      }
    }
  }

  return { quotes, discoveredTickers };
}

export function resolveTickerSymbol(ticker: string): string {
  const upper = canonicalizeEGXSymbol(ticker);
  return TICKER_ALIASES[upper] || upper;
}

export function applyLivePricesToPortfolio(
  positions: Position[],
  tickers: EGXTicker[],
  quotes: Record<string, LivePriceQuote>,
  discoveredTickers: EGXTicker[] = []
): { updatedPositions: Position[]; updatedTickers: EGXTicker[]; matchCount: number; hasChanges: boolean } {
  let matchCount = 0;
  let hasChanges = false;
  const nowIso = new Date().toISOString();

  const tickerMap = new Map<string, EGXTicker>();
  tickers.forEach((ticker) => {
    const raw = ticker.ticker.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
    const canonical = ticker.metadataSource === 'registry'
      ? raw
      : canonicalizeEGXSymbol(raw);
    tickerMap.set(canonical, { ...ticker, ticker: canonical });
  });

  discoveredTickers.forEach((dt) => {
    const rawKey = dt.ticker.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
    const aliasedExisting = [...tickerMap.values()].find(
      (ticker) => (ticker.aliases || []).some((alias) => alias.trim().toUpperCase() === rawKey),
    );
    const key = tickerMap.has(rawKey)
      ? rawKey
      : aliasedExisting?.ticker || canonicalizeEGXSymbol(rawKey);
    const existing = tickerMap.get(key);
    const fallback = EGX_STOCK_DICTIONARY[key];
    const registryIdentity = existing?.metadataSource === 'registry';

    const merged: EGXTicker = {
      ...(existing || dt),
      ...dt,
      ticker: key,
      nameEn: registryIdentity
        ? existing!.nameEn
        : (dt.nameEn || existing?.nameEn || fallback?.nameEn || key),
      nameAr: registryIdentity
        ? existing!.nameAr
        : (fallback?.nameAr || existing?.nameAr || dt.nameAr || `${key} مصر`),
      sector: registryIdentity
        ? existing!.sector
        : (dt.sector !== 'Other'
          ? dt.sector
          : (existing?.sector || fallback?.sector || 'Other')),
      isin: registryIdentity
        ? existing!.isin
        : (dt.isin || existing?.isin || fallback?.isin || ''),
      marketSector: registryIdentity
        ? existing!.marketSector
        : (dt.marketSector || existing?.marketSector),
      industry: registryIdentity
        ? existing!.industry
        : (dt.industry || existing?.industry),
      metadataSource: registryIdentity ? 'registry' : 'tradingview',
      directoryStatus: existing?.directoryStatus,
      aliases: existing?.aliases,
      scannerSymbol: existing?.scannerSymbol,
      historySymbol: existing?.historySymbol,
      historyResolutionMethod: existing?.historyResolutionMethod,
      historyVerifiedAt: existing?.historyVerifiedAt,
      registryUpdatedAt: existing?.registryUpdatedAt,
      lastUpdated: nowIso,
      priceUpdatedAt: nowIso,
    };

    if (
      !existing ||
      existing.nameEn !== merged.nameEn ||
      existing.nameAr !== merged.nameAr ||
      existing.sector !== merged.sector ||
      existing.isin !== merged.isin ||
      existing.marketSector !== merged.marketSector ||
      existing.industry !== merged.industry ||
      existing.lastPrice !== merged.lastPrice ||
      existing.change !== merged.change ||
      existing.changePercent !== merged.changePercent ||
      existing.volume !== merged.volume ||
      existing.dayHigh !== merged.dayHigh ||
      existing.dayLow !== merged.dayLow ||
      existing.yearHigh !== merged.yearHigh ||
      existing.yearLow !== merged.yearLow ||
      existing.rsi14 !== merged.rsi14
    ) {
      hasChanges = true;
    }

    tickerMap.set(key, merged);
  });

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

  let positionsChanged = false;
  const updatedPositions = positions.map(p => {
    const cleanSym = p.ticker.trim().toUpperCase();
    const symbol = tickerMap.has(cleanSym)
      ? cleanSym
      : ([...tickerMap.values()].find(
          (ticker) => (ticker.aliases || []).some((alias) => alias.trim().toUpperCase() === cleanSym),
        )?.ticker || resolveTickerSymbol(cleanSym));
    
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
    
    const liveMetadata =
      tickerMap.get(symbol) ||
      tickerMap.get(canonicalizeEGXSymbol(cleanSym));
    const fallbackMetadata =
      EGX_STOCK_DICTIONARY[symbol] ||
      EGX_STOCK_DICTIONARY[canonicalizeEGXSymbol(cleanSym)];
    const companyName = liveMetadata?.nameEn || fallbackMetadata?.nameEn || p.companyName;
    const sector = liveMetadata?.sector || fallbackMetadata?.sector || p.sector;

    if (
      newPrice !== p.currentPrice ||
      newDayChange !== p.dayChange ||
      newDayChangePercent !== p.dayChangePercent ||
      p.companyName !== companyName ||
      p.sector !== sector
    ) {
      positionsChanged = true;
      return {
        ...p,
        companyName,
        sector,
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
 * - Sunday–Thursday regular session: 10:00 AM – 02:30 PM Cairo time
 * - Friday & Saturday: Market closed, no syncing (isSessionActive: false)
 * - A separate closing-price snapshot is persisted at 03:15 PM Cairo time.
 */
export function getEGXSessionStatus(now = new Date()): EGXScheduleStatus {
  try {
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

    const cairoLocalTime = new Date(Date.UTC(year, month, day, hour, minute, second));
    const dayOfWeek = cairoLocalTime.getUTCDay();

    const isTradingDay = dayOfWeek >= 0 && dayOfWeek <= 4;
    const currentTotalMinutes = hour * 60 + minute;

    let inSession = false;

    if (isTradingDay && currentTotalMinutes >= 600 && currentTotalMinutes <= 870) {
      inSession = true;
    }

    let nextTickHour = hour;
    let nextTickMinute = minute;
    let millisUntilNextTick = 60000;

    if (inSession) {
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
      const targetsToday: number[] = [];
      if (isTradingDay) {
        const openMin = 600;
        if (openMin > currentTotalMinutes) targetsToday.push(openMin);
        if (915 > currentTotalMinutes) targetsToday.push(915);
      }

      if (targetsToday.length > 0) {
        const nextTargetMin = targetsToday[0];
        nextTickHour = Math.floor(nextTargetMin / 60);
        nextTickMinute = nextTargetMin % 60;
        const diffMins = nextTargetMin - currentTotalMinutes;
        const secRemaining = 60 - second;
        millisUntilNextTick = Math.max(1000, ((diffMins - 1) * 60 + secRemaining) * 1000);
      } else {
        let daysToAdd = 1;
        let nextDay = (dayOfWeek + 1) % 7;
        while (nextDay === 5 || nextDay === 6) {
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
