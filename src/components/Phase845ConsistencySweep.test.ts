import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const scopedFiles = [
  './PortfolioSummary.tsx',
  './PerformanceReports.tsx',
  './reports/MonthlyPerformanceReport.tsx',
  './reports/TradingPerformanceReport.tsx',
  './PositionsTable.tsx',
  './ClosedCyclesView.tsx',
  './TradingJournal.tsx',
  './CashBalanceView.tsx',
  './TickerDirectoryView.tsx',
];

describe('Phase 8.4.5 typography and spacing consistency sweep', () => {
  it('removes known hierarchy drift from Phase-8-owned screens', () => {
    for (const relative of scopedFiles) {
      const source = readRelative(relative);

      expect(source).not.toContain('text-[9px]');
      expect(source).not.toMatch(/tracking-\[0\.[0-9]+em\]/);
      expect(source).not.toContain('premium-overview-hero-value');
      expect(source).not.toContain('premium-overview-primary-value');
      expect(source).not.toContain('premium-overview-secondary-value');
    }
  });

  it('keeps every migrated screen on canonical typography and spacing primitives', () => {
    for (const relative of scopedFiles) {
      const source = readRelative(relative);
      expect(source).toMatch(/premium-type-(?:metric|metadata|helper|section-title|unit)/);
      expect(source).toMatch(/premium-(?:flow|gap|pad)-/);
    }
  });

  it('keeps compact 10px treatments limited to chips, statuses, or controls rather than financial hierarchy', () => {
    const overview = readRelative('./PortfolioSummary.tsx');
    const monthly = readRelative('./reports/MonthlyPerformanceReport.tsx');
    const trading = readRelative('./reports/TradingPerformanceReport.tsx');

    expect(overview).not.toMatch(/premium-type-metric[^"\n]*text-\[10px\]/);
    expect(monthly).not.toMatch(/premium-type-metric[^"\n]*text-\[10px\]/);
    expect(trading).not.toMatch(/premium-type-metric[^"\n]*text-\[10px\]/);
  });

  it('preserves the accepted glass, aura, glow and semantic-edge material language', () => {
    const css = readRelative('../index.css');

    expect(css).toContain('Pass 8.3b: intensified resting aura/glow');
    expect(css).toContain('0 0 48px rgb(var(--premium-semantic-rgb) / 0.34)');
    expect(css).toContain('0 0 112px rgb(var(--premium-semantic-deep-rgb) / 0.18)');
    expect(css).toContain('Additive semantic edge — aura/glass remain untouched');
    expect(css).toContain('border-radius: inherit');

    const spacingStart = css.indexOf('Pass 8.4.4 — canonical spacing rhythm');
    const actionStart = css.indexOf('/* Action importance only');
    const spacingBlock = css.slice(spacingStart, actionStart);
    expect(spacingBlock).not.toMatch(/background:|box-shadow|border-color|backdrop-filter|filter:/);
  });
});
