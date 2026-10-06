import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Stage 5 R6 Reports responsive workspace', () => {
  it('renders a dedicated Reports geometry matrix across the required device tiers', () => {
    const harness = readRelative('../../scripts/renderedRegression.mjs');

    for (const viewport of [
      "['reports-phone-390', 390, 844]",
      "['reports-landscape-844', 844, 390]",
      "['reports-tablet-768', 768, 1024]",
      "['reports-desktop-1440', 1440, 1000]",
      "['reports-2xl-2560', 2560, 1440]",
    ]) {
      expect(harness).toContain(viewport);
    }

    expect(harness).toContain("const reportsModes = ['overview', 'analytics', 'trading', 'allocation', 'monthly'];");
    expect(harness).toContain("page.getByRole('button', { name: 'Inspect' }).first()");
    expect(harness).toContain('Reports mode rail wrapped');
    expect(harness).toContain('Reports workspace overflow');
  });

  it('keeps the Reports mode rail one horizontal scrollable row on small screens', () => {
    const navigation = readRelative('./reports/ReportsNavigation.tsx');

    expect(navigation).toContain('overflow-x-auto overscroll-x-contain');
    expect(navigation).toContain('shrink-0 whitespace-nowrap');
    expect(navigation).toContain("inline: 'center'");
  });

  it('keeps default and expanded Overview diagnostics progressively responsive', () => {
    const overview = readRelative('./reports/ReportsOverview.tsx');

    expect(overview).toContain('grid grid-cols-1 gap-4 md:grid-cols-2');
    expect(overview).toContain('grid grid-cols-1 gap-2.5 sm:grid-cols-3');
    expect(overview).toContain('flex flex-wrap items-center justify-between gap-2');
    expect(overview).toContain('grid grid-cols-1 gap-3 sm:grid-cols-2');
    expect(overview).toContain('grid grid-cols-3 gap-2');
  });

  it('keeps charts and dense report tables bounded by their owning workspace', () => {
    const reports = readRelative('./PerformanceReports.tsx');
    const trading = readRelative('./reports/TradingPerformanceReport.tsx');
    const monthly = readRelative('./reports/MonthlyPerformanceReport.tsx');

    expect(reports).toContain('<ResponsiveContainer width="100%" height="100%" debounce={80}>');
    expect(reports).toContain('allowEscapeViewBox={{ x: false, y: false }}');
    expect(trading).toContain('overflow-x-auto overscroll-x-contain');
    expect(trading).toContain('2xl:block');
    expect(monthly).toContain('overflow-x-auto overscroll-x-contain');
    expect(monthly).toContain('2xl:block');
  });

  it('inherits the accepted short-landscape and page-level containment contracts', () => {
    const responsive = readRelative('../styles/responsive.css');

    expect(responsive).toContain('@media (orientation: landscape) and (max-height: 520px)');
    expect(responsive).toContain('.premium-chart-stage,');
    expect(responsive).toContain('.premium-chart-plot {');
    expect(responsive).toContain('.premium-report-table,');
    expect(responsive).toContain('max-width: 100%;');
  });

  it('does not add Reports-only breakpoint CSS or change the golden screenshot set', () => {
    const features = readRelative('../styles/features/reports.css');
    const harness = readRelative('../../scripts/renderedRegression.mjs');

    expect(features).not.toContain('Stage 5 R6');
    expect(harness).not.toContain("name: 'reports-phone");
    expect(harness).not.toContain("name: 'reports-landscape");
    expect(harness).not.toContain("name: 'reports-tablet");
    expect(harness).not.toContain("name: 'reports-2xl");
  });
});
