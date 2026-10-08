import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 10.7A Overview closure', () => {
  it('keeps the shared PortfolioSummary on the protected H1 -> H2 -> H3 -> H4 hierarchy', () => {
    const summary = readRelative('./PortfolioSummary.tsx');

    expect(summary).toContain(
      'premium-card premium-hero-card premium-semantic-hero premium-hierarchy-h1',
    );
    expect(summary).toContain(
      'premium-card premium-semantic-card premium-hierarchy-h2',
    );
    expect(summary).toContain(
      'premium-card premium-semantic-card premium-hierarchy-h3',
    );
    expect(summary).toContain(
      'premium-glass premium-material-tone-cyan premium-hierarchy-h4 premium-overview-market-strip',
    );
  });

  it('keeps Overview dense states readable and non-operational', () => {
    const positions = readRelative('./PositionsTable.tsx');

    expect(positions).toContain('premium-table-shell premium-hierarchy-h5 premium-dense-data');
    expect(positions).toContain(
      'premium-card premium-semantic-record premium-semantic-edge premium-hierarchy-h5 premium-dense-row',
    );
    expect(positions).toContain("isOverviewPreview ? 'No open positions yet.'");
    expect(positions).toContain(
      'Showing {visiblePositions.length} of {positions.length} active holdings',
    );

    // The overview branch suppresses row operations/alerts rather than inventing
    // a second compact action system.
    expect(positions.match(/!isOverviewPreview && \(/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it('classifies the reconciliation notice as H4 support rather than another primary card', () => {
    const app = readRelative('../App.tsx');

    expect(app).toContain(
      'premium-panel premium-hierarchy-h4 premium-pad-h4 rounded-xl border-blue-500/35',
    );
    expect(app).toContain('data-hierarchy="h4"');
    expect(app).toContain('Reconcile Portfolio Now');
  });

  it('does not reopen accepted material, semantic, Header, or chart-data behavior', () => {
    const css = readRelative('../index.css');
    const primary = readRelative('./charts/PerformanceTimeframeChart.tsx');
    const phase9 = readRelative('../../docs/PHASE9_HEADER_NAVIGATION_PLAN.md');

    expect(css).not.toContain('Phase 10.7A');
    expect(primary).toContain('weeklyLineInterpolator');
    expect(primary).toContain('TODAY_RESOLUTIONS');
    expect(primary).toContain('TIMEFRAMES');
    expect(primary).toContain('loadTodayIntraday');
    expect(primary).toContain('buildIntradayAnalyticsResult');
    expect(phase9).toContain('PHASE 9 SOURCE-FROZEN');
  });
});
