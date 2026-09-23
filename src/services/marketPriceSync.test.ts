import { describe, expect, it } from 'vitest';
import { applyLivePricesToPortfolio, getEGXSessionStatus } from './marketPriceSync';
import { canonicalizeEGXSymbol, createEGXTickerRecord, mergeTickerDirectoryWithBaseline } from '../data/egxTickers';

describe('EGX market session status', () => {
  it('treats Sunday 09:30 Cairo as pre-market and 10:00 as active', () => {
    expect(getEGXSessionStatus(new Date('2026-09-13T06:30:00Z')).isSessionActive).toBe(false);
    expect(getEGXSessionStatus(new Date('2026-09-13T07:00:00Z')).isSessionActive).toBe(true);
  });

  it('uses the regular 10:00-14:30 Cairo session Monday-Thursday', () => {
    expect(getEGXSessionStatus(new Date('2026-09-17T06:59:00Z')).isSessionActive).toBe(false);
    expect(getEGXSessionStatus(new Date('2026-09-17T07:00:00Z')).isSessionActive).toBe(true);
    expect(getEGXSessionStatus(new Date('2026-09-17T11:30:00Z')).isSessionActive).toBe(true);
    expect(getEGXSessionStatus(new Date('2026-09-17T11:31:00Z')).isSessionActive).toBe(false);
  });

  it('does not report the separate 15:15 closing snapshot window as an active session', () => {
    expect(getEGXSessionStatus(new Date('2026-09-17T12:15:00Z')).isSessionActive).toBe(false);
  });

  it('keeps Friday and Saturday closed', () => {
    expect(getEGXSessionStatus(new Date('2026-09-18T07:00:00Z')).isSessionActive).toBe(false);
    expect(getEGXSessionStatus(new Date('2026-09-19T07:00:00Z')).isSessionActive).toBe(false);
  });
});


describe('EGX ticker directory canonicalization', () => {
  it('maps National Printing TradingView ISIN symbol back to NAPR', () => {
    expect(canonicalizeEGXSymbol('EGS370O1C013')).toBe('NAPR');
    expect(canonicalizeEGXSymbol('NAPR.CA')).toBe('NAPR');
  });

  it('uses current KORA company identity and sector', () => {
    const ticker = createEGXTickerRecord('KORA', 6.5);
    expect(ticker.nameEn).toBe('Korra for Energy and Investment Projects');
    expect(ticker.nameAr).toBe('قرة لمشروعات الطاقة والاستثمار');
    expect(ticker.sector).toBe('Utilities');
    expect(ticker.isin).toBe('EGS07911C018');
  });

  it('adds newly seeded tickers to an existing persisted directory without losing prices', () => {
    const merged = mergeTickerDirectoryWithBaseline([
      {
        ...createEGXTickerRecord('KORA', 6.79),
        nameEn: 'stale KORA name',
        sector: 'Other',
      },
    ]);

    expect(merged.some((ticker) => ticker.ticker === 'NAPR')).toBe(true);
    const kora = merged.find((ticker) => ticker.ticker === 'KORA');
    expect(kora?.lastPrice).toBe(6.79);
    expect(kora?.nameEn).toBe('Korra for Energy and Investment Projects');
    expect(kora?.sector).toBe('Utilities');
  });

  it('repairs stale KORA metadata on open positions during live-price merge', () => {
    const staleTicker = {
      ...createEGXTickerRecord('KORA', 6.5),
      nameEn: 'Egyptian Chemical Industries (KIMA / KORRA)',
      sector: 'Petrochemicals & Fertilizers' as const,
    };
    const discovered = createEGXTickerRecord('KORA', 6.79, 3.66);
    const position = {
      id: 'pos-kora',
      ticker: 'KORA',
      companyName: 'Egyptian Chemical Industries (KIMA / KORRA)',
      sector: 'Petrochemicals & Fertilizers' as const,
      shares: 100,
      avgBuyPrice: 5,
      currentPrice: 6.5,
      buyDate: '2026-09-01',
    };

    const result = applyLivePricesToPortfolio(
      [position],
      [staleTicker],
      {
        KORA: {
          ticker: 'KORA',
          price: 6.79,
          change: 0.24,
          changePercent: 3.66,
          volume: 1000,
        },
      },
      [discovered],
    );

    expect(result.updatedPositions[0].companyName).toBe('Korra for Energy and Investment Projects');
    expect(result.updatedPositions[0].sector).toBe('Utilities');
    expect(result.updatedTickers[0].nameEn).toBe('Korra for Energy and Investment Projects');
    expect(result.updatedTickers[0].sector).toBe('Utilities');
  });
});
