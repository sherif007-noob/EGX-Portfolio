import { createChart } from '@ch99q/twc';
import { EGX_STOCK_DICTIONARY, LEGACY_TICKER_ALIASES, canonicalizeEGXSymbol } from '../data/egxTickers';

export interface TradingViewTickerMetadata {
  ticker: string;
  isin?: string | null;
  tradingviewSymbol?: string | null;
}

export interface TradingViewResolution {
  ticker: string;
  symbol: string;
  method: 'persisted' | 'ticker' | 'legacy-alias' | 'isin';
  resolved: Awaited<ReturnType<Awaited<ReturnType<typeof createChart>>['resolve']>>;
}

function clean(value: unknown): string {
  return String(value || '').trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
}

export function tradingViewCandidates(input: TradingViewTickerMetadata): Array<{ symbol: string; method: TradingViewResolution['method'] }> {
  const ticker = canonicalizeEGXSymbol(clean(input.ticker));
  const dictionaryIsin = EGX_STOCK_DICTIONARY[ticker]?.isin;
  const legacy = LEGACY_TICKER_ALIASES[clean(input.ticker)];
  const ordered: Array<{ symbol: string; method: TradingViewResolution['method'] }> = [
    { symbol: clean(input.tradingviewSymbol), method: 'persisted' },
    { symbol: ticker, method: 'ticker' },
    { symbol: clean(legacy), method: 'legacy-alias' },
    { symbol: clean(input.isin || dictionaryIsin), method: 'isin' },
  ];
  const seen = new Set<string>();
  return ordered.filter(({ symbol }) => symbol && !seen.has(symbol) && seen.add(symbol));
}

export async function resolveTradingViewInstrument(
  chart: Awaited<ReturnType<typeof createChart>>,
  input: TradingViewTickerMetadata,
): Promise<TradingViewResolution> {
  const ticker = canonicalizeEGXSymbol(clean(input.ticker));
  let lastError: unknown = null;

  for (const candidate of tradingViewCandidates(input)) {
    try {
      const resolved = await chart.resolve(candidate.symbol, 'EGX');
      return { ticker, symbol: candidate.symbol, method: candidate.method, resolved };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `${ticker}: TradingView resolution failed for ticker, legacy alias and ISIN candidates. ${lastError instanceof Error ? lastError.message : String(lastError || '')}`,
  );
}
