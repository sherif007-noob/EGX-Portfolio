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

  it('uses a compact holdings preview instead of embedding the full Positions workflow', () => {
    const app = readRelative('../App.tsx');
    const positions = readRelative('./PositionsTable.tsx');

    expect(app).toContain('data-overview-section="positions-preview"');
    expect(app).toContain('variant="overview"');
    expect(app).toContain('overviewLimit={4}');
    expect(app).toContain('premium-action-priority-secondary');
    expect(app).toContain('Open Positions →');

    expect(positions).toContain("variant?: 'full' | 'overview'");
    expect(positions).toContain("variant = 'full'");
    expect(positions).toContain("const isOverviewPreview = variant === 'overview';");
    expect(positions).toContain('positions.slice(0, overviewLimit)');
    expect(positions).toContain("data-positions-variant={variant}");
    expect(positions).toContain("isOverviewPreview ? 'min-w-[760px]' : 'min-w-[1080px]'");
  });

  it('keeps full operational controls owned by the dedicated Positions variant', () => {
    const positions = readRelative('./PositionsTable.tsx');

    expect(positions).toContain('{!isOverviewPreview && (');
    expect(positions).toContain('premium-hierarchy-h3 premium-dense-context');
    expect(positions).toContain('premium-hierarchy-h4 premium-dense-toolbar');
    expect(positions).toContain('placeholder="Search ticker (e.g. COMI) or company..."');
    expect(positions).toContain('<span>Add Trade</span>');
    expect(positions).toContain('title="Sell Shares / Book P&L"');
    expect(positions).toContain('title="Review source ledger transactions"');
    expect(positions).toContain('onCorrectLedger: (position: Position) => void');
    expect(positions).not.toContain('ConfirmDeleteModal');

    const app = readRelative('../App.tsx');
    const positionsTabStart = app.indexOf("{activeTab === 'positions'");
    expect(positionsTabStart).toBeGreaterThanOrEqual(0);
    const positionsTab = app.slice(positionsTabStart, positionsTabStart + 4500);
    expect(positionsTab).toContain('<PositionsTable');
    expect(positionsTab).not.toContain('variant="overview"');
  });

  it('makes Overview analytics subordinate to the portfolio hero while Reports keeps its analytics hierarchy', () => {
    const app = readRelative('../App.tsx');
    const primary = readRelative('./charts/PerformanceTimeframeChart.tsx');
    const secondary = readRelative('./charts/SecondaryAnalyticsCharts.tsx');
    const reports = readRelative('./PerformanceReports.tsx');

    expect(app).toContain('visualContext="overview"');
    expect(primary).toContain("visualContext?: 'overview' | 'reports'");
    expect(primary).toContain("visualContext = 'reports'");
    expect(primary).toContain(
      "const mainHierarchyLevel = visualContext === 'overview' ? 'h2' : 'h1';",
    );
    expect(primary).toContain(
      "const secondaryHierarchyLevel = visualContext === 'overview' ? 'h3' : 'h2';",
    );
    expect(primary).toContain('hierarchyLevel={secondaryHierarchyLevel}');

    expect(secondary).toContain("hierarchyLevel?: 'h2' | 'h3'");
    expect(secondary).toContain("hierarchyLevel = 'h2'");
    expect(secondary).toContain(
      "hierarchyLevel === 'h3' ? 'premium-hierarchy-h3' : 'premium-hierarchy-h2'",
    );

    // Reports intentionally consumes the default reports context: H1 main + H2 secondary.
    expect(reports).toContain('<PerformanceTimeframeChart');
    expect(reports).not.toContain('visualContext="overview"');
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
