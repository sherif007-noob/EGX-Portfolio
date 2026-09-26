import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 8.4.2 Overview + Reports typography migration', () => {
  it('maps Overview hero/support metrics and EGP units to the canonical scale', () => {
    const overview = readRelative('./PortfolioSummary.tsx');
    expect(overview).toContain('premium-type-metric premium-type-metric-hero');
    expect(overview).toContain('premium-type-metric premium-type-metric-primary');
    expect(overview).toContain('premium-type-metric premium-type-metric-secondary');
    expect(overview.match(/premium-type-unit/g)?.length).toBeGreaterThanOrEqual(5);
    expect(overview).not.toContain('premium-overview-hero-value');
    expect(overview).not.toContain('premium-overview-primary-value');
    expect(overview).not.toContain('premium-overview-secondary-value');
  });

  it('normalizes Reports summary, allocation, Monthly and Trading Performance typography', () => {
    const reports = readRelative('./PerformanceReports.tsx');
    const monthly = readRelative('./reports/MonthlyPerformanceReport.tsx');
    const trading = readRelative('./reports/TradingPerformanceReport.tsx');

    expect(reports.match(/premium-type-metric-secondary/g)?.length).toBeGreaterThanOrEqual(4);
    expect(reports).toContain('premium-type-unit');
    expect(reports).toContain('premium-type-metric-dense');

    expect(monthly).toContain('premium-type-section-title');
    expect(monthly).toContain('premium-type-metric-primary');
    expect(monthly).toContain('premium-type-metric-dense');
    expect(monthly).toContain('premium-type-unit');

    expect(trading).toContain('premium-type-section-title');
    expect(trading.match(/premium-type-metric-secondary/g)?.length).toBeGreaterThanOrEqual(5);
    expect(trading).toContain('premium-type-metric-label');
    expect(trading).toContain('premium-type-helper');
  });

  it('does not alter the protected material or semantic-edge implementation', () => {
    const css = readRelative('../index.css');
    expect(css).toContain('Pass 8.3b: intensified resting aura/glow');
    expect(css).toContain('Additive semantic edge — aura/glass remain untouched');
    expect(css).toContain('0 0 48px rgb(var(--premium-semantic-rgb) / 0.34)');
    expect(css).toContain('border-radius: inherit');
  });
});
