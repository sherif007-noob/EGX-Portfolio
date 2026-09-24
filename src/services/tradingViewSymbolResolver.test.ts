import { describe, expect, it, vi } from 'vitest';
import { resolveTradingViewInstrument, tradingViewCandidates } from './tradingViewSymbolResolver';

describe('tradingViewSymbolResolver', () => {
  it('builds deterministic ticker then ISIN fallbacks without hardcoding NAPR', () => {
    expect(tradingViewCandidates({ ticker: 'NAPR', isin: 'EGS370O1C013' })).toEqual([
      { symbol: 'NAPR', method: 'ticker' },
      { symbol: 'EGS370O1C013', method: 'isin' },
    ]);
  });

  it('tries the ISIN when TradingView rejects the canonical ticker', async () => {
    const resolve = vi.fn()
      .mockRejectedValueOnce(new Error('unknown symbol'))
      .mockResolvedValueOnce({ symbol: 'EGX:EGS370O1C013' });
    const result = await resolveTradingViewInstrument({ resolve } as any, {
      ticker: 'NAPR',
      isin: 'EGS370O1C013',
    });
    expect(resolve.mock.calls.map(([symbol]) => symbol)).toEqual(['NAPR', 'EGS370O1C013']);
    expect(result.symbol).toBe('EGS370O1C013');
    expect(result.method).toBe('isin');
    expect(result.attempts).toEqual([
      { symbol: 'NAPR', method: 'ticker', ok: false, error: 'unknown symbol' },
      { symbol: 'EGS370O1C013', method: 'isin', ok: true },
    ]);
  });

  it('uses a legacy rename before ISIN when one is known', () => {
    expect(tradingViewCandidates({ ticker: 'MNHD', isin: 'EGS65591C017' })).toEqual([
      { symbol: 'MASR', method: 'ticker' },
      { symbol: 'EGS65591C017', method: 'isin' },
    ]);
  });

  it('fails loudly when no candidate resolves', async () => {
    const resolve = vi.fn().mockRejectedValue(new Error('unknown symbol'));
    await expect(resolveTradingViewInstrument({ resolve } as any, {
      ticker: 'ZZZZ',
      isin: 'EGS000000000',
    })).rejects.toThrow(/TradingView resolution failed/);
  });
});
