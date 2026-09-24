import type { EGXTicker, Sector } from '../types';
import { createEGXTickerRecord, mergeTickerDirectoryWithBaseline } from '../data/egxTickers';

export interface TickerRegistryRow {
  ticker: string;
  name_en?: string | null;
  name_ar?: string | null;
  isin?: string | null;
  sector?: string | null;
  market_sector?: string | null;
  industry?: string | null;
  logo_url?: string | null;
  currency?: string | null;
  status?: string | null;
  scanner_symbol?: string | null;
  history_symbol?: string | null;
  history_resolution_method?: string | null;
  history_verified_at?: string | null;
  updated_at?: string | null;
}

export interface TickerAliasRow {
  alias: string;
  canonical_ticker: string;
  alias_type?: string | null;
}

function normalize(value: unknown): string {
  return String(value || '').trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
}

function sector(value: unknown, fallback: Sector): Sector {
  const raw = String(value || '').trim();
  return raw ? raw as Sector : fallback;
}

export function buildTickerAliasIndex(rows: TickerAliasRow[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of rows || []) {
    const alias = normalize(row.alias);
    const canonical = normalize(row.canonical_ticker);
    if (alias && canonical && alias !== canonical) out.set(alias, canonical);
  }
  return out;
}

export function mergeTickerDirectoryWithRegistry(
  quoteTickers: EGXTicker[],
  registryRows: TickerRegistryRow[],
  aliasRows: TickerAliasRow[],
): EGXTicker[] {
  const quoteMap = new Map<string, EGXTicker>();
  for (const ticker of quoteTickers || []) {
    const key = normalize(ticker.ticker);
    if (key) quoteMap.set(key, { ...ticker, ticker: key });
  }

  const aliasesByCanonical = new Map<string, string[]>();
  for (const row of aliasRows || []) {
    const alias = normalize(row.alias);
    const canonical = normalize(row.canonical_ticker);
    if (!alias || !canonical || alias === canonical) continue;
    const list = aliasesByCanonical.get(canonical) ?? [];
    if (!list.includes(alias)) list.push(alias);
    aliasesByCanonical.set(canonical, list);
  }

  const merged = new Map<string, EGXTicker>();

  for (const row of registryRows || []) {
    const ticker = normalize(row.ticker);
    if (!ticker) continue;

    const quote = quoteMap.get(ticker);
    const fallback = createEGXTickerRecord(ticker, quote?.lastPrice ?? 0);
    const base = quote ?? fallback;
    const status = ['active', 'inactive', 'retired', 'unresolved'].includes(String(row.status))
      ? String(row.status) as EGXTicker['directoryStatus']
      : 'unresolved';

    merged.set(ticker, {
      ...base,
      ticker,
      nameEn: String(row.name_en || '').trim() || base.nameEn,
      nameAr: String(row.name_ar || '').trim() || base.nameAr,
      isin: String(row.isin || '').trim().toUpperCase() || base.isin,
      sector: sector(row.sector, base.sector),
      logoUrl: String(row.logo_url || '').trim() || base.logoUrl,
      marketSector: String(row.market_sector || '').trim() || base.marketSector,
      industry: String(row.industry || '').trim() || base.industry,
      metadataSource: 'registry',
      directoryStatus: status,
      aliases: (aliasesByCanonical.get(ticker) ?? []).sort(),
      scannerSymbol: normalize(row.scanner_symbol) || undefined,
      historySymbol: normalize(row.history_symbol) || undefined,
      historyResolutionMethod: String(row.history_resolution_method || '').trim() || undefined,
      historyVerifiedAt: row.history_verified_at || undefined,
      registryUpdatedAt: row.updated_at || undefined,
    });
  }

  for (const [ticker, quote] of quoteMap) {
    if (!merged.has(ticker)) merged.set(ticker, quote);
  }

  return mergeTickerDirectoryWithBaseline([...merged.values()]);
}

export function resolveTickerFromDirectory(
  input: string,
  tickers: EGXTicker[],
): string {
  const normalized = normalize(input);
  if (!normalized) return '';

  for (const ticker of tickers || []) {
    const canonical = normalize(ticker.ticker);
    if (canonical === normalized) return canonical;
    if ((ticker.aliases || []).some((alias) => normalize(alias) === normalized)) return canonical;
    if (normalize(ticker.isin) === normalized) return canonical;
  }

  return normalized;
}
