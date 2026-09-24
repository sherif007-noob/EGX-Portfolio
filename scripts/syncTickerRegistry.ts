import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createChart, createSession } from '@ch99q/twc';
import {
  EGX_STOCK_DICTIONARY,
  RETIRED_BASELINE_TICKERS,
  mapMarketClassificationToSector,
} from '../src/data/egxTickers';
import { getTradingViewLogoUrl } from '../src/services/tradingviewLogos';
import { resolveTradingViewInstrument } from '../src/services/tradingViewSymbolResolver';

type SupabaseClient = ReturnType<typeof createSupabase>;

interface ScannerSecurity {
  ticker: string;
  scannerSymbol: string;
  description: string;
  logoId: string;
  marketSector: string;
  industry: string;
  isin: string;
  currency: string;
}

interface RegistryRow {
  ticker: string;
  name_en: string;
  name_ar: string;
  isin: string;
  sector: string;
  market_sector: string | null;
  industry: string | null;
  logo_url: string | null;
  currency: string;
  status: 'active' | 'inactive' | 'retired' | 'unresolved';
  scanner_symbol: string | null;
  history_symbol: string | null;
  history_resolution_method: string | null;
  resolution_attempts: unknown;
  verification_error: string | null;
  metadata_source: string;
  first_seen_at: string;
  last_seen_at: string | null;
  missing_since: string | null;
  history_verified_at: string | null;
  updated_at: string;
}

function normalize(value: unknown): string {
  return String(value || '').trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
}

function createSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url) throw new Error('Missing SUPABASE_URL.');
  if (!key?.startsWith('sb_secret_')) {
    throw new Error('Missing or invalid SUPABASE_SECRET_KEY; expected sb_secret_ server key.');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function fetchScannerUniverse(): Promise<ScannerSecurity[]> {
  const response = await fetch('https://scanner.tradingview.com/egypt/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
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
        'currency',
      ],
      sort: { sortBy: 'name', sortOrder: 'asc' },
      range: [0, 500],
    }),
  });

  if (!response.ok) {
    throw new Error(`TradingView Scanner HTTP ${response.status}: ${response.statusText}`);
  }

  const json = await response.json() as any;
  const rows: ScannerSecurity[] = [];
  const seen = new Set<string>();

  for (const item of json?.data ?? []) {
    if (!Array.isArray(item?.d)) continue;
    const ticker = normalize(item.d[0]);
    const currency = normalize(item.d[15]);
    if (!ticker || (currency && currency !== 'EGP') || seen.has(ticker)) continue;
    seen.add(ticker);
    rows.push({
      ticker,
      scannerSymbol: ticker,
      description: String(item.d[1] || '').trim(),
      logoId: String(item.d[2] || '').trim(),
      marketSector: String(item.d[11] || '').trim(),
      industry: String(item.d[13] || '').trim(),
      isin: normalize(item.d[14]),
      currency: currency || 'EGP',
    });
  }

  return rows;
}

async function loadRegistry(sb: SupabaseClient): Promise<RegistryRow[]> {
  const rows: RegistryRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb
      .from('ticker_registry')
      .select('*')
      .order('ticker', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Ticker registry read failed: ${error.message}`);
    rows.push(...((data ?? []) as RegistryRow[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function ageDays(value: string | null, nowMs: number): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? (nowMs - ms) / 86_400_000 : Number.POSITIVE_INFINITY;
}

async function upsertAliases(
  sb: SupabaseClient,
  rows: Array<{ alias: string; canonical_ticker: string; alias_type: string; source: string }>,
  nowIso: string,
) {
  const unique = new Map<string, typeof rows[number]>();
  for (const row of rows) {
    const alias = normalize(row.alias);
    const canonical = normalize(row.canonical_ticker);
    if (!alias || !canonical || alias === canonical) continue;
    unique.set(alias, { ...row, alias, canonical_ticker: canonical });
  }
  if (!unique.size) return 0;

  const payload = [...unique.values()].map((row) => ({
    ...row,
    last_verified_at: nowIso,
  }));
  const { error } = await sb.from('ticker_aliases').upsert(payload, {
    onConflict: 'alias',
    ignoreDuplicates: false,
  });
  if (error) throw new Error(`Ticker alias upsert failed: ${error.message}`);
  return payload.length;
}

async function main() {
  const sb = createSupabase();
  const now = new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  const verifyLimit = Math.max(1, Number(process.env.EGX_TICKER_VERIFY_LIMIT || 100));
  const verifyAfterDays = Math.max(1, Number(process.env.EGX_TICKER_VERIFY_AFTER_DAYS || 30));
  const inactiveAfterDays = Math.max(1, Number(process.env.EGX_TICKER_INACTIVE_AFTER_DAYS || 14));

  const [rawScannerRows, existing] = await Promise.all([
    fetchScannerUniverse(),
    loadRegistry(sb),
  ]);

  const existingByTicker = new Map(existing.map((row) => [normalize(row.ticker), row]));
  const existingByIsin = new Map<string, RegistryRow[]>();
  for (const row of existing) {
    const isin = normalize(row.isin);
    if (!isin) continue;
    const list = existingByIsin.get(isin) ?? [];
    list.push(row);
    existingByIsin.set(isin, list);
  }

  const baselineByIsin = new Map<string, string[]>();
  for (const [ticker, metadata] of Object.entries(EGX_STOCK_DICTIONARY)) {
    const isin = normalize(metadata.isin);
    if (!isin || RETIRED_BASELINE_TICKERS.has(ticker)) continue;
    const list = baselineByIsin.get(isin) ?? [];
    list.push(ticker);
    baselineByIsin.set(isin, list);
  }

  const isinPattern = /^EGS[0-9A-Z]{9}$/;
  const canonicalScanner = new Map<string, ScannerSecurity>();
  for (const raw of rawScannerRows) {
    let ticker = raw.ticker;
    if (isinPattern.test(raw.scannerSymbol)) {
      const trustedExisting = (existingByIsin.get(raw.isin) ?? []).filter(
        (row) =>
          row.metadata_source === 'tradingview-scanner' &&
          !isinPattern.test(normalize(row.ticker)),
      );
      const baselineMatches = baselineByIsin.get(raw.isin) ?? [];
      const legacyExisting = (existingByIsin.get(raw.isin) ?? []).filter(
        (row) => !isinPattern.test(normalize(row.ticker)),
      );

      if (trustedExisting.length === 1) ticker = normalize(trustedExisting[0].ticker);
      else if (baselineMatches.length === 1) ticker = normalize(baselineMatches[0]);
      else if (legacyExisting.length === 1) ticker = normalize(legacyExisting[0].ticker);
    }

    const candidate = { ...raw, ticker };
    const current = canonicalScanner.get(ticker);
    // Prefer a normal exchange ticker over an ISIN-shaped scanner alias.
    if (!current || isinPattern.test(current.scannerSymbol) && !isinPattern.test(raw.scannerSymbol)) {
      canonicalScanner.set(ticker, candidate);
    }
  }
  const scannerRows = [...canonicalScanner.values()];

  const scannerTickers = new Set(scannerRows.map((row) => row.ticker));
  const scannerIsinCounts = new Map<string, number>();
  for (const row of scannerRows) {
    if (row.isin) scannerIsinCounts.set(row.isin, (scannerIsinCounts.get(row.isin) ?? 0) + 1);
  }

  // Rebuild evidence-derived aliases every run. Baseline aliases are fallback code,
  // not authoritative registry facts, and stale first-pass rename guesses must not persist.
  const { error: evidenceAliasDeleteError } = await sb
    .from('ticker_aliases')
    .delete()
    .in('source', ['baseline', 'isin-reconciliation']);
  if (evidenceAliasDeleteError) {
    throw new Error(`Evidence alias cleanup failed: ${evidenceAliasDeleteError.message}`);
  }

  // A symbol that exists in the current canonical scanner universe is canonical by definition.
  if (scannerTickers.size) {
    const { error: activeAliasDeleteError } = await sb
      .from('ticker_aliases')
      .delete()
      .in('alias', [...scannerTickers]);
    if (activeAliasDeleteError) {
      throw new Error(`Active-symbol alias cleanup failed: ${activeAliasDeleteError.message}`);
    }
  }

  const aliasRows: Array<{ alias: string; canonical_ticker: string; alias_type: string; source: string }> = [];

  const upserts: any[] = [];
  const renamedOldTickers = new Set<string>();

  for (const scan of scannerRows) {
    const baseline = EGX_STOCK_DICTIONARY[scan.ticker];
    const current = existingByTicker.get(scan.ticker);
    const sameIsin = scan.isin ? (existingByIsin.get(scan.isin) ?? []) : [];

    if (scan.scannerSymbol !== scan.ticker) {
      aliasRows.push({
        alias: scan.scannerSymbol,
        canonical_ticker: scan.ticker,
        alias_type: isinPattern.test(scan.scannerSymbol) ? 'isin' : 'scanner',
        source: 'tradingview-scanner',
      });
    }

    if (scan.isin && scannerIsinCounts.get(scan.isin) === 1 && scan.isin !== scan.ticker) {
      aliasRows.push({
        alias: scan.isin,
        canonical_ticker: scan.ticker,
        alias_type: 'isin',
        source: 'tradingview-scanner',
      });

      for (const old of sameIsin) {
        const oldTicker = normalize(old.ticker);
        const trustedHistoricalIdentity =
          old.metadata_source === 'tradingview-scanner' &&
          Boolean(old.last_seen_at);
        if (
          trustedHistoricalIdentity &&
          !isinPattern.test(oldTicker) &&
          oldTicker !== scan.scannerSymbol &&
          oldTicker !== scan.ticker &&
          !scannerTickers.has(oldTicker)
        ) {
          renamedOldTickers.add(oldTicker);
          aliasRows.push({
            alias: oldTicker,
            canonical_ticker: scan.ticker,
            alias_type: 'renamed',
            source: 'isin-reconciliation',
          });
        }
      }
    }

    const sector = mapMarketClassificationToSector(
      scan.marketSector,
      scan.industry,
      (baseline?.sector || current?.sector || 'Other') as any,
      scan.description,
    );

    upserts.push({
      ticker: scan.ticker,
      name_en: scan.description || current?.name_en || baseline?.nameEn || scan.ticker,
      name_ar: current?.name_ar || baseline?.nameAr || '',
      isin: scan.isin || current?.isin || baseline?.isin || '',
      sector,
      market_sector: scan.marketSector || current?.market_sector || null,
      industry: scan.industry || current?.industry || null,
      logo_url: getTradingViewLogoUrl(scan.ticker, scan.logoId) || current?.logo_url || null,
      currency: scan.currency || 'EGP',
      status: 'active',
      scanner_symbol: scan.scannerSymbol,
      history_symbol: current?.history_symbol || null,
      history_resolution_method: current?.history_resolution_method || null,
      resolution_attempts: current?.resolution_attempts || [],
      verification_error: current?.verification_error || null,
      metadata_source: 'tradingview-scanner',
      first_seen_at: current?.first_seen_at || nowIso,
      last_seen_at: nowIso,
      missing_since: null,
      history_verified_at: current?.history_verified_at || null,
      updated_at: nowIso,
    });
  }

  if (upserts.length) {
    const { error } = await sb.from('ticker_registry').upsert(upserts, {
      onConflict: 'ticker',
      ignoreDuplicates: false,
    });
    if (error) throw new Error(`Ticker registry upsert failed: ${error.message}`);
  }

  const missingUpdates: any[] = [];
  for (const row of existing) {
    const ticker = normalize(row.ticker);
    if (!ticker || scannerTickers.has(ticker)) continue;

    if (renamedOldTickers.has(ticker) || RETIRED_BASELINE_TICKERS.has(ticker)) {
      missingUpdates.push({
        ticker,
        status: 'retired',
        missing_since: row.missing_since || nowIso,
        updated_at: nowIso,
      });
      continue;
    }

    const missingSince = row.missing_since || nowIso;
    const shouldDeactivate = ageDays(missingSince, nowMs) >= inactiveAfterDays;
    missingUpdates.push({
      ticker,
      status: shouldDeactivate ? 'inactive' : row.status,
      missing_since: missingSince,
      updated_at: nowIso,
    });
  }

  if (missingUpdates.length) {
    const { error } = await sb.from('ticker_registry').upsert(missingUpdates, {
      onConflict: 'ticker',
      ignoreDuplicates: false,
    });
    if (error) throw new Error(`Ticker lifecycle update failed: ${error.message}`);
  }

  const aliasCount = await upsertAliases(sb, aliasRows, nowIso);

  const refreshed = await loadRegistry(sb);
  const changedTickers = new Set(upserts.map((row) => row.ticker));
  const verifyCandidates = refreshed
    .filter((row) => row.status === 'active')
    .filter((row) =>
      !row.history_symbol ||
      !row.history_verified_at ||
      ageDays(row.history_verified_at, nowMs) >= verifyAfterDays ||
      changedTickers.has(row.ticker) && row.verification_error,
    )
    .sort((a, b) => {
      const aAge = ageDays(a.history_verified_at, nowMs);
      const bAge = ageDays(b.history_verified_at, nowMs);
      return bAge - aAge || a.ticker.localeCompare(b.ticker);
    })
    .slice(0, verifyLimit);

  let verified = 0;
  let unresolved = 0;
  if (verifyCandidates.length) {
    const session = await createSession();
    try {
      const chart = await createChart(session);
      for (const row of verifyCandidates) {
        try {
          const resolution = await resolveTradingViewInstrument(chart, {
            ticker: row.ticker,
            isin: row.isin,
            tradingviewSymbol: row.history_symbol || row.scanner_symbol,
          });
          const { error } = await sb.from('ticker_registry').update({
            history_symbol: resolution.symbol,
            history_resolution_method: resolution.method,
            resolution_attempts: resolution.attempts,
            verification_error: null,
            history_verified_at: nowIso,
            updated_at: nowIso,
          }).eq('ticker', row.ticker);
          if (error) throw error;
          verified += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const { error: updateError } = await sb.from('ticker_registry').update({
            status: 'unresolved',
            verification_error: message,
            history_verified_at: nowIso,
            updated_at: nowIso,
          }).eq('ticker', row.ticker);
          if (updateError) throw updateError;
          unresolved += 1;
        }
      }
    } finally {
      await session.close();
    }
  }

  const { count: activeCount } = await sb
    .from('ticker_registry')
    .select('ticker', { head: true, count: 'exact' })
    .eq('status', 'active');

  console.log(
    `Ticker registry sync complete: scanner=${rawScannerRows.length}, canonical=${scannerRows.length}, active=${activeCount ?? 0}, metadataUpserts=${upserts.length}, lifecycleUpdates=${missingUpdates.length}, aliases=${aliasCount}, historyVerified=${verified}, unresolved=${unresolved}, verifyLimit=${verifyLimit}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
