import { describe, expect, it } from 'vitest';
import { getTradingViewLogoUrl } from './tradingviewLogos';

describe('TradingView logo resolution', () => {
  it('converts scanner logoid slugs into symbol-logo URLs', () => {
    expect(getTradingViewLogoUrl('HALN', 'mnt-halan'))
      .toBe('https://s3-symbol-logo.tradingview.com/mnt-halan.svg');
  });

  it('preserves a complete custom logo URL', () => {
    expect(getTradingViewLogoUrl('TEST', 'https://cdn.example.com/test.svg'))
      .toBe('https://cdn.example.com/test.svg');
  });

  it('keeps curated presets ahead of the generic Egypt fallback', () => {
    expect(getTradingViewLogoUrl('COMI')).toContain('commercial-international-bank-egypt.svg');
  });
});


  it('uses no fake country badge when a company logo is unavailable', () => {
    expect(getTradingViewLogoUrl('NOLOGO')).toBe('');
  });
