import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 8.2 Reports composition hierarchy', () => {
  it('reserves H1 for the main analytics surface', () => {
    const primary = readRelative('./charts/PerformanceTimeframeChart.tsx');
    expect(primary).toContain('premium-report-main-analytics');
    expect(primary).toContain("visualContext = 'reports'");
    expect(primary).toContain("const mainHierarchyLevel = visualContext === 'overview' ? 'h2' : 'h1'");
    expect(primary).toContain("visualContext === 'overview' ? 'premium-hierarchy-h2' : 'premium-hierarchy-h1'");
    expect(primary).toContain('data-hierarchy={mainHierarchyLevel}');
  });

  it('keeps supporting visualizations below the main analytics hero', () => {
    const secondary = readRelative('./charts/SecondaryAnalyticsCharts.tsx');
    const trajectory = readRelative('./RealizedTrajectoryChart.tsx');
    const reports = readRelative('./PerformanceReports.tsx');

    expect(secondary).toContain("hierarchyLevel = 'h2'");
    expect(secondary).toContain("hierarchyLevel === 'h3' ? 'premium-hierarchy-h3' : 'premium-hierarchy-h2'");
    expect(secondary).toContain('premium-secondary-chart-card');
    expect(trajectory).toContain('premium-report-section premium-hierarchy-h2');
    expect(reports).toContain('premium-report-section premium-hierarchy-h2');
    expect(reports).toContain('Portfolio Allocation');
  });

  it('uses structural outer shells for the dense institutional reports', () => {
    const trading = readRelative('./reports/TradingPerformanceReport.tsx');
    const monthly = readRelative('./reports/MonthlyPerformanceReport.tsx');

    expect(trading).toContain('premium-report-structural premium-hierarchy-h0');
    expect(monthly).toContain('premium-report-structural premium-hierarchy-h0');
    expect(trading).not.toContain(
      'premium-trading-performance-results premium-report-glass rounded-2xl',
    );
    expect(monthly).not.toContain(
      'id="report-monthly-performance" className="premium-report-glass',
    );
  });

  it('demotes report detail/KPI surfaces to H3/H4 instead of peer hero cards', () => {
    const reports = readRelative('./PerformanceReports.tsx');
    const trading = readRelative('./reports/TradingPerformanceReport.tsx');
    const monthly = readRelative('./reports/MonthlyPerformanceReport.tsx');

    expect(reports).toContain('premium-report-summary-band');
    expect(reports).toContain('premium-report-section premium-hierarchy-h3');
    expect(trading).toContain('premium-card premium-semantic-card premium-hierarchy-h4 premium-report-kpi');
    expect(monthly).toContain('premium-month-audit-shell premium-hierarchy-h3');
  });
});
