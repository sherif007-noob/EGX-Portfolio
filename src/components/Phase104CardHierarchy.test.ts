import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 10.4 card hierarchy and surface consistency', () => {
  it('preserves the protected global PortfolioSummary hierarchy', () => {
    const summary = readRelative('./PortfolioSummary.tsx');

    expect(summary).toContain('premium-hero-card premium-semantic-hero premium-hierarchy-h1 premium-overview-hero');
    expect(summary).toContain('premium-card premium-semantic-card premium-hierarchy-h2');
    expect(summary).toContain('premium-card premium-material-tone-cyan premium-hierarchy-h2');
    expect(summary).toContain('premium-card premium-semantic-card premium-hierarchy-h3');
    expect(summary).toContain('premium-glass premium-material-tone-cyan premium-hierarchy-h4');
  });

  it('makes nested workflow detail surfaces explicitly H4 without changing the dense H5 records', () => {
    const positions = readRelative('./PositionsTable.tsx');
    const cycles = readRelative('./ClosedCyclesView.tsx');
    const journal = readRelative('./TradingJournal.tsx');

    expect(positions).toContain(
      'premium-subpanel premium-hierarchy-h4 grid grid-cols-2 sm:grid-cols-4',
    );
    expect(positions).toContain('data-hierarchy="h4"');
    expect(positions).toContain('premium-hierarchy-h5 premium-dense-row');

    expect(cycles.match(/premium-subpanel premium-hierarchy-h4 p-2\.5 rounded-xl/g)?.length)
      .toBeGreaterThanOrEqual(6);
    expect(cycles).toContain(
      'premium-inset-glass premium-hierarchy-h4 p-3.5 rounded-xl space-y-3',
    );
    expect(cycles).toContain('premium-hierarchy-h5 premium-dense-row');

    expect(journal).toContain(
      'premium-inset-glass premium-hierarchy-h4 grid grid-cols-2 sm:grid-cols-5',
    );
    expect(journal).toContain('premium-hierarchy-h5 premium-dense-row');
  });

  it('uses one H4 subpanel family for the five Cash reconciliation steps', () => {
    const cash = readRelative('./CashBalanceView.tsx');
    const auditStart = cash.indexOf('Capital Ledger &amp; Cash Balance Audit');
    const historyStart = cash.indexOf('Cash Transaction History', auditStart);
    const audit = cash.slice(auditStart, historyStart > auditStart ? historyStart : auditStart + 12000);

    expect(auditStart).toBeGreaterThanOrEqual(0);
    expect(audit.match(/premium-subpanel premium-hierarchy-h4 p-3 rounded-xl space-y-1/g)?.length)
      .toBe(5);
    expect(audit.match(/data-hierarchy="h4"/g)?.length).toBeGreaterThanOrEqual(5);

    expect(audit).not.toContain('bg-emerald-950/40 border border-emerald-500/40');
    expect(audit).not.toContain('bg-blue-950/40 border border-blue-500/40');
  });

  it('keeps Monthly Performance material independent from information hierarchy', () => {
    const monthly = readRelative('./reports/MonthlyPerformanceReport.tsx');

    expect(monthly).toContain(
      'premium-month-audit-shell premium-hierarchy-h3 overflow-hidden rounded-xl',
    );
    expect(monthly).toContain('data-hierarchy="h3"');

    expect(monthly.match(/data-hierarchy="h4"/g)?.length).toBeGreaterThanOrEqual(7);
    expect(monthly).toContain('data-hierarchy="h5"');
    expect(monthly).toContain('premium-report-hero-card premium-pad-h5');

    // The accepted Monthly audit-card material stays independent from the H5
    // information role; 10.4 must not add a hierarchy class merely to reduce it.
    const recordStart = monthly.indexOf('data-hierarchy="h5"');
    const recordBlock = monthly.slice(recordStart, recordStart + 600);
    expect(recordBlock).toContain('premium-report-hero-card');
    expect(recordBlock).not.toContain('premium-hierarchy-h5');
  });

  it('preserves the Reports H1 -> H2 -> H3/H4 composition', () => {
    const primary = readRelative('./charts/PerformanceTimeframeChart.tsx');
    const secondary = readRelative('./charts/SecondaryAnalyticsCharts.tsx');
    const reports = readRelative('./PerformanceReports.tsx');
    const trading = readRelative('./reports/TradingPerformanceReport.tsx');

    expect(primary).toContain('premium-hierarchy-h1 premium-report-main-analytics');
    expect(secondary).toContain('premium-secondary-chart-card premium-hierarchy-h2');
    expect(reports).toContain('premium-report-section premium-hierarchy-h2');
    expect(reports).toContain('premium-report-section premium-hierarchy-h3');
    expect(reports).toContain('premium-subpanel premium-hierarchy-h4');
    expect(trading).toContain('premium-report-structural premium-hierarchy-h0');
    expect(trading).toContain('premium-card premium-semantic-card premium-hierarchy-h4 premium-report-kpi');
  });

  it('does not reopen material, semantic, dense-data, chart, or header ownership', () => {
    const contract = readRelative('../../docs/PREMIUM_VISUAL_LANGUAGE_CONTRACT.md');
    const css = readRelative('../index.css');
    const phase9 = readRelative('../../docs/PHASE9_HEADER_NAVIGATION_PLAN.md');
    const chart = readRelative('./charts/PerformanceTimeframeChart.tsx');

    expect(contract).toContain('Hierarchy classes must never redefine material');
    expect(contract).toContain('Monthly Performance audit cards are the canonical material benchmark');
    expect(css).not.toContain('Phase 10.4');
    expect(phase9).toContain('PHASE 9 SOURCE-FROZEN');
    expect(chart).toContain('weeklyLineInterpolator');
    expect(chart).toContain('TODAY_RESOLUTIONS');
    expect(chart).toContain('TIMEFRAMES');
  });
});
