import { describe, expect, it } from 'vitest';
import { createEGXTickerRecord } from '../data/egxTickers';
import {
  buildTickerAliasIndex,
  mergeTickerDirectoryWithRegistry,
  resolveTickerFromDirectory,
} from './tickerRegistry';

describe('ticker registry', () => {
  it('keeps registry identity authoritative while preserving quote data', () => {
    const merged = mergeTickerDirectoryWithRegistry(
      [{
        ...createEGXTickerRecord('MASR', 8.75),
        nameEn: 'Wrong live quote-table name',
        sector: 'Other',
      }],
      [{
        ticker: 'MASR',
        name_en: 'Madinet Masr for Housing & Development',
        name_ar: 'مدينة مصر للإسكان والتعمير',
        isin: 'EGS65591C017',
        sector: 'Real Estate & Construction',
        status: 'active',
        scanner_symbol: 'MASR',
        history_symbol: 'MASR',
        history_resolution_method: 'ticker',
      }],
      [{ alias: 'MNHD', canonical_ticker: 'MASR', alias_type: 'legacy' }],
    );

    const masr = merged.find((ticker) => ticker.ticker === 'MASR');
    expect(masr?.lastPrice).toBe(8.75);
    expect(masr?.nameEn).toBe('Madinet Masr for Housing & Development');
    expect(masr?.sector).toBe('Real Estate & Construction');
    expect(masr?.aliases).toContain('MNHD');
    expect(masr?.metadataSource).toBe('registry');
  });

  it('resolves aliases and ISINs to the canonical registry ticker', () => {
    const tickers = mergeTickerDirectoryWithRegistry(
      [],
      [{
        ticker: 'NAPR',
        name_en: 'National Printing',
        isin: 'EGS370O1C013',
        sector: 'Paper & Packaging',
        status: 'active',
      }],
      [{ alias: 'OLDN', canonical_ticker: 'NAPR', alias_type: 'renamed' }],
    );

    expect(resolveTickerFromDirectory('OLDN', tickers)).toBe('NAPR');
    expect(resolveTickerFromDirectory('EGS370O1C013', tickers)).toBe('NAPR');
    expect(resolveTickerFromDirectory('NAPR.CA', tickers)).toBe('NAPR');
  });

  it('builds a normalized alias index', () => {
    const index = buildTickerAliasIndex([
      { alias: 'mnhd.ca', canonical_ticker: 'MASR' },
      { alias: 'EGX:QNBA', canonical_ticker: 'QNBE' },
    ]);
    expect(index.get('MNHD')).toBe('MASR');
    expect(index.get('QNBA')).toBe('QNBE');
  });
});
