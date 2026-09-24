import { describe, expect, it } from 'vitest';
import { applyLivePricesToPortfolio, getEGXSessionStatus } from './marketPriceSync';
import { INITIAL_EGX_TICKERS, canonicalizeEGXSymbol, createEGXTickerRecord, mergeTickerDirectoryWithBaseline } from '../data/egxTickers';

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
    expect(ticker.sector).toBe('Contracting & Construction');
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
    expect(kora?.sector).toBe('Contracting & Construction');
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
    expect(result.updatedPositions[0].sector).toBe('Contracting & Construction');
    expect(result.updatedTickers[0].nameEn).toBe('Korra for Energy and Investment Projects');
    expect(result.updatedTickers[0].sector).toBe('Contracting & Construction');
  });

  it('migrates renamed legacy symbols and does not seed them as duplicate active rows', () => {
    expect(canonicalizeEGXSymbol('QNBA')).toBe('QNBE');
    expect(canonicalizeEGXSymbol('QNBF')).toBe('QNBE');
    expect(canonicalizeEGXSymbol('MNHD')).toBe('MASR');
    expect(canonicalizeEGXSymbol('AUTO')).toBe('GBCO');
    expect(canonicalizeEGXSymbol('OTMT')).toBe('OIH');
    expect(canonicalizeEGXSymbol('UBEG')).toBe('UBEE');
    expect(canonicalizeEGXSymbol('AIH')).toBe('AIHC');
    expect(canonicalizeEGXSymbol('PIOH')).toBe('ASPI');
    expect(canonicalizeEGXSymbol('REAC')).toBe('NARE');

    const symbols = new Set(INITIAL_EGX_TICKERS.map((ticker) => ticker.ticker));
    for (const legacy of ['QNBA', 'QNBF', 'MNHD', 'AUTO', 'OTMT', 'UBEG', 'AIH', 'PIOH', 'ESRS', 'EKHO', 'KRRE']) {
      expect(symbols.has(legacy)).toBe(false);
    }
    for (const current of ['QNBE', 'MASR', 'GBCO', 'OIH', 'UBEE', 'AIHC', 'ASPI', 'NARE', 'NAPR', 'KORA', 'ECAP']) {
      expect(symbols.has(current)).toBe(true);
    }

    const migrated = mergeTickerDirectoryWithBaseline([
      createEGXTickerRecord('ESRS', 100),
      createEGXTickerRecord('EKHO', 30),
      createEGXTickerRecord('QNBA', 55),
    ]);
    const migratedSymbols = new Set(migrated.map((ticker) => ticker.ticker));
    expect(migratedSymbols.has('ESRS')).toBe(false);
    expect(migratedSymbols.has('EKHO')).toBe(false);
    expect(migratedSymbols.has('QNBA')).toBe(false);
    expect(migratedSymbols.has('QNBE')).toBe(true);
  });

  it('contains corrected current identities for known stale baseline records', () => {
    const bySymbol = new Map(INITIAL_EGX_TICKERS.map((ticker) => [ticker.ticker, ticker]));

    expect(bySymbol.get('CIEB')?.isin).toBe('EGS60041C018');
    expect(bySymbol.get('HDBK')?.isin).toBe('EGS60301C016');
    expect(bySymbol.get('QNBE')?.isin).toBe('EGS60081C014');
    expect(bySymbol.get('SAUD')?.nameEn).toBe('Al Baraka Bank Egypt');
    expect(bySymbol.get('SAUD')?.isin).toBe('EGS60101C010');
    expect(bySymbol.get('OBRI')?.nameEn).toBe('El Ebour Co. for Real Estate Investment');
    expect(bySymbol.get('OBRI')?.isin).toBe('EGS65551C011');
    expect(bySymbol.get('ORAS')?.isin).toBe('EGS95001C011');
    expect(bySymbol.get('NAPR')?.sector).toBe('Paper & Packaging');
    expect(bySymbol.get('KORA')?.sector).toBe('Contracting & Construction');
  });

  it('lets live scanner metadata override the offline fallback while retaining Arabic fallback', () => {
    const live = createEGXTickerRecord(
      'KORA',
      6.91,
      1.2,
      123456,
      7.0,
      6.7,
      8.2,
      2.1,
      55,
      'KORRA Energy',
      undefined,
      0.08,
      'Industrial Services',
      'Engineering & Construction',
      'EGS07911C018',
    );
    const merged = mergeTickerDirectoryWithBaseline([live]);
    const kora = merged.find((ticker) => ticker.ticker === 'KORA');

    expect(kora?.metadataSource).toBe('tradingview');
    expect(kora?.nameEn).toBe('KORRA Energy');
    expect(kora?.nameAr).toBe('قرة لمشروعات الطاقة والاستثمار');
    expect(kora?.sector).toBe('Contracting & Construction');
    expect(kora?.isin).toBe('EGS07911C018');
    expect(kora?.industry).toBe('Engineering & Construction');
  });

  it('classifies live-only scanner records without inventing fake Arabic metadata', () => {
    const live = createEGXTickerRecord(
      'NEWX',
      12.5,
      0,
      1000,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'Example Packaging Company',
      undefined,
      0,
      'Process Industries',
      'Containers / Packaging',
      'EGS00000X000',
    );

    expect(live.nameEn).toBe('Example Packaging Company');
    expect(live.nameAr).toBe('');
    expect(live.sector).toBe('Paper & Packaging');
    expect(live.isin).toBe('EGS00000X000');
    expect(live.metadataSource).toBe('tradingview');
  });


  it('keeps an active registry symbol canonical even when a static legacy alias disagrees', () => {
    const registryTicker = {
      ...createEGXTickerRecord('QNBA', 30, 0, 0, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, true),
      ticker: 'QNBA',
      nameEn: 'QNB Alahli',
      nameAr: 'بنك قطر الوطني الأهلي',
      isin: 'EGS60131C017',
      sector: 'Banking' as const,
      metadataSource: 'registry' as const,
      directoryStatus: 'active' as const,
      aliases: [],
    };
    const discovered = {
      ...createEGXTickerRecord('QNBA', 31.25, 1.5, 1000, undefined, undefined, undefined, undefined, undefined, 'Scanner Name', undefined, 0.46, 'Finance', 'Regional Banks', 'EGS60131C017', true),
      ticker: 'QNBA',
    };

    const result = applyLivePricesToPortfolio(
      [],
      [registryTicker],
      { QNBA: { ticker: 'QNBA', price: 31.25, change: 0.46, changePercent: 1.5, volume: 1000 } },
      [discovered],
    );

    expect(result.updatedTickers[0].ticker).toBe('QNBA');
    expect(result.updatedTickers[0].nameEn).toBe('QNB Alahli');
    expect(result.updatedTickers[0].isin).toBe('EGS60131C017');
    expect(result.updatedTickers[0].sector).toBe('Banking');
    expect(result.updatedTickers[0].lastPrice).toBe(31.25);
    expect(result.updatedTickers[0].metadataSource).toBe('registry');
  });
});
