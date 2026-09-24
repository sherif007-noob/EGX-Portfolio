import { createChart } from '@ch99q/twc';
import { EGX_STOCK_DICTIONARY, LEGACY_TICKER_ALIASES, canonicalizeEGXSymbol } from '../data/egxTickers';

export interface TradingViewTickerMetadata {
  ticker: string;
  isin?: string | null;
  tradingviewSymbol?: string | null;
}

export type TradingViewResolutionMethod = 'persisted' | 'ticker' | 'legacy-alias' | 'isin';

export interface TradingViewResolutionAttempt {
  symbol: string;
  method: TradingViewResolutionMethod;
  ok: boolean;
  error?: string;
}

export interface TradingViewResolution {
  ticker: string;
  symbol: string;
  method: TradingViewResolutionMethod;
  attempts: TradingViewResolutionAttempt[];
  resolved: Awaited<ReturnType<Awaited<ReturnType<typeof createChart>>['resolve']>>;
}

function clean(value: unknown): string {
  return String(value || '').trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
}

export function tradingViewCandidates(input: TradingViewTickerMetadata): Array<{ symbol: string; method: TradingViewResolutionMethod }> {
  const rawTicker = clean(input.ticker);
  const ticker = clean(input.tradingviewSymbol)
    ? rawTicker
    : canonicalizeEGXSymbol(rawTicker);
  const dictionaryIsin = EGX_STOCK_DICTIONARY[ticker]?.isin;
  const legacy = LEGACY_TICKER_ALIASES[clean(input.ticker)];
  const ordered: Array<{ symbol: string; method: TradingViewResolutionMethod }> = [
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
  const rawTicker = clean(input.ticker);
  const ticker = clean(input.tradingviewSymbol)
    ? rawTicker
    : canonicalizeEGXSymbol(rawTicker);
  const attempts: TradingViewResolutionAttempt[] = [];

  for (const candidate of tradingViewCandidates(input)) {
    try {
      const resolved = await chart.resolve(candidate.symbol, 'EGX');
      attempts.push({ ...candidate, ok: true });
      return {
        ticker,
        symbol: candidate.symbol,
        method: candidate.method,
        attempts,
        resolved,
      };
    } catch (error) {
      attempts.push({
        ...candidate,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const path = attempts
    .map((attempt) => `${attempt.method}:${attempt.symbol}=${attempt.ok ? 'ok' : 'failed'}`)
    .join(' -> ');

  throw new Error(
    `${ticker}: TradingView resolution failed. attempts=[${path}]`,
  );
}
