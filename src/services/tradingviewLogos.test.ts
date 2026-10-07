import { describe, expect, it } from 'vitest';
import {
  getTradingViewLogoUrl,
  getTradingViewCompanyNameLogoUrl,
} from './tradingviewLogos';

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


describe('TradingView public symbol-page logo fallback', () => {
  it('builds the company-name big-logo asset path used by public symbol pages', () => {
    expect(getTradingViewCompanyNameLogoUrl('El Badr Investment and Development - BID'))
      .toBe('https://s3-symbol-logo.tradingview.com/el-badr-investment-and-development-bid--big.svg');
    expect(getTradingViewCompanyNameLogoUrl('National Asset Management And Investment'))
      .toBe('https://s3-symbol-logo.tradingview.com/national-asset-management-and-investment--big.svg');
  });
});
