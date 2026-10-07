import {
  API_ROUTES,
  parseTradingViewSymbolSearchResponse,
} from '../api/contracts';

/**
 * TradingView Stock Logo Resolution & Cache Service
 * Provides official TradingView symbol logos for EGX (Egyptian Exchange) equities.
 */

// Preset TradingView logo IDs for EGX tickers
export const TV_SYMBOL_LOGOS: Record<string, string> = {
  COMI: 'commercial-international-bank-egypt',
  TMGH: 'talaat-moustafa-group',
  ETEL: 'telecom-egypt',
  ORHD: 'orascom-development-egypt',
  ORAS: 'orascom-construction',
  FWRY: 'fawry-for-banking-and-payment-technology',
  HRHO: 'efg-hermes-holding',
  ESRS: 'ezz-steel',
  ABUK: 'abu-qir-fertilizers',
  MFPC: 'mopco',
  SWDY: 'elsewedy-electric',
  EKHO: 'egypt-kuwait-holding',
  AMOC: 'alexandria-mineral-oils',
  JUFO: 'juhayna-food-industries',
  HELI: 'heliopolis-housing',
  PHDC: 'palm-hills-developments',
  OCDI: 'sodic',
  EFIH: 'e-finance',
  ADIB: 'abu-dhabi-islamic-bank',
  CIEB: 'credit-agricole',
  HDBK: 'housing-and-development-bank',
  QNBF: 'qnb-alahli',
  QNBA: 'qnb-alahli',
  EGAL: 'egypt-aluminum',
  SKPC: 'sidi-kerir-petrochemicals',
  GBCO: 'gb-auto',
  AUTO: 'gb-auto',
  ALCN: 'alexandria-containers',
  CCAP: 'qalaa-holdings',
  OIH: 'orascom-investment-holding',
  OTMT: 'orascom-investment-holding',
  BTFH: 'beltone-financial-holding',
  TAQA: 'taqa-arabia',
  UBEE: 'the-united-bank',
  UBEG: 'the-united-bank',
  MASR: 'madinet-masr',
  MNHD: 'madinet-masr',
  ISPH: 'ibnsina-pharma',
  EAST: 'eastern-company',
  DOMT: 'domty',
  ORWE: 'oriental-weavers',
  CIRA: 'cira-education',
  KORA: 'egyptian-chemical-industries',
  KIMA: 'egyptian-chemical-industries',
  UEGC: 'upper-egypt-contracting',
  SCEM: 'sinai-cement',
  CANA: 'canal-shipping-agencies',
  CSAG: 'canal-shipping-agencies',
  ZMID: 'zahraa-maadi',
  LUTS: 'lotus',
  AFMC: 'alexandria-flour-mills',
  MCRO: 'macro-group-pharmaceuticals',
  BONY: 'bpe-holding',
  MPCO: 'mansoura-poultry',
  ELSH: 'el-shams-housing',
  EFIC: 'egyptian-financial-and-industrial',
};

const LOGO_CACHE_KEY = 'egx_tradingview_logo_cache_v1';

/**
 * Returns local logo cache from localStorage
 */
function getLogoCache(): Record<string, string> {
  try {
    const cached = localStorage.getItem(LOGO_CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
}

/**
 * Saves logo entry to cache
 */
function saveLogoToCache(ticker: string, url: string) {
  try {
    const cache = getLogoCache();
    cache[ticker.toUpperCase()] = url;
    localStorage.setItem(LOGO_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Returns the best TradingView logo URL for a ticker symbol.
 * 1. Custom provided logoUrl (if valid)
 * 2. Cached logo from localStorage
 * 3. Preset TradingView logo ID
 * 4. Fallback to TradingView Egypt country logo or generic logo
 */
export function getTradingViewLogoUrl(ticker: string, customLogoUrl?: string): string {
  const custom = String(customLogoUrl || '').trim();
  if (custom) {
    if (custom.startsWith('http://') || custom.startsWith('https://')) return custom;
    // TradingView scanner returns `logoid` as a slug, not a URL.
    // Treat it as authoritative and convert it to the public symbol-logo URL.
    if (!custom.includes('/') && !custom.includes(' ')) {
      return `https://s3-symbol-logo.tradingview.com/${custom.replace(/\.svg$/i, '')}.svg`;
    }
  }

  const clean = ticker.trim().toUpperCase().replace('.CA', '').replace('EGX:', '');
  const cache = getLogoCache();
  
  if (cache[clean]) {
    return cache[clean];
  }

  const presetId = TV_SYMBOL_LOGOS[clean];
  if (presetId) {
    if (presetId.startsWith('http')) return presetId;
    return `https://s3-symbol-logo.tradingview.com/${presetId}.svg`;
  }

  // No company-specific TradingView artwork is available. Return empty so
  // StockLogo renders the deliberate sector/initials fallback instead of a
  // misleading Egypt-country badge.
  return '';
}

/**
 * Dynamically queries TradingView Symbol Search API to resolve official logo URL for a given ticker symbol.
 */
export async function fetchTradingViewLogoForTicker(ticker: string): Promise<string | null> {
  const clean = ticker.trim().toUpperCase().replace('.CA', '').replace('EGX:', '');

  try {
    const endpoint =
      `${API_ROUTES.tradingViewSymbolSearch}?text=${encodeURIComponent(clean)}`;
    const res = await fetch(endpoint);
    if (!res.ok) return null;

    const data = parseTradingViewSymbolSearchResponse(await res.json());
    if (data.length > 0) {
      const match = data.find((item) =>
        item.symbol?.toUpperCase() === clean ||
        item.ticker?.toUpperCase() === clean
      ) || data[0];

      let logoUrl = '';
      if (match.logoid) {
        logoUrl = `https://s3-symbol-logo.tradingview.com/${match.logoid}.svg`;
      } else if (match.logo_urls?.length) {
        logoUrl = match.logo_urls[0];
      }

      if (logoUrl) {
        saveLogoToCache(clean, logoUrl);
        return logoUrl;
      }
    }
  } catch (err) {
    console.warn(`Failed to fetch TradingView logo for ${ticker}:`, err);
  }

  return null;
}

/**
 * Batch fetches logos for all tickers in the list from TradingView scanner / search
 */
export async function syncTradingViewLogosForTickers(tickers: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  for (const t of tickers) {
    const clean = t.trim().toUpperCase().replace('.CA', '').replace('EGX:', '');
    const existing = getTradingViewLogoUrl(clean);
    
    // If no company-specific logo is known, try fetching live.
    if (!existing) {
      const fetched = await fetchTradingViewLogoForTicker(clean);
      if (fetched) {
        result[clean] = fetched;
      } else {
        result[clean] = existing;
      }
    } else {
      result[clean] = existing;
    }
  }

  return result;
}
