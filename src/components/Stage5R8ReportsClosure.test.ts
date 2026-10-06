import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Stage 5 R8 Reports full regression and closure', () => {
  it('keeps Overview diagnosis wired to the existing accounting/stat authorities', () => {
    const reports = readRelative('./PerformanceReports.tsx');
    const overview = readRelative('./reports/ReportsOverview.tsx');

    expect(reports).toContain('metrics?.totalValue ?? calculatePortfolioValue(cashBalance, positions)');
    expect(reports).toContain('metrics?.realizedPnlEgp ?? performanceBridge.realizedPnl');
    expect(reports).toContain('metrics?.unrealizedPnlEgp ?? performanceBridge.unrealizedPnl');
    expect(reports).toContain('winRate={stats.winRate}');
    expect(reports).toContain('profitFactor={stats.profitFactor}');
    expect(reports).toContain('expectancyEgp={stats.expectancyEgp ?? null}');
    expect(reports).toContain('const summary = calculateMonthlyAuditSummary([');

    for (const label of [
      'Portfolio State',
      'Trading Quality',
      'Risk &amp; Costs',
      'Concentration',
      'Current Month',
    ]) {
      expect(overview).toContain(label);
    }
  });

  it('keeps the complete Analytics mode/timeframe/resolution and synchronized-tooltip contracts', () => {
    const chart = readRelative('./charts/PerformanceTimeframeChart.tsx');
    const modes = readRelative('../services/analyticsModes.ts');
    const secondary = readRelative('./charts/SecondaryAnalyticsCharts.tsx');
    const weekly = readRelative('./charts/weeklyTransitionInterpolation.ts');
    const weeklyTests = readRelative('./charts/weeklyTransitionInterpolation.test.ts');

    for (const label of [
      'Portfolio vs Return',
      'Portfolio vs Net Deposits',
      'Performance (TWR)',
      'Performance (MWR)',
    ]) {
      expect(modes).toContain(label);
    }

    for (const resolution of [
      "{ value: 'AUTO', label: 'Auto' }",
      "{ value: 1, label: '1m' }",
      "{ value: 5, label: '5m' }",
      "{ value: 15, label: '15m' }",
      "{ value: 60, label: '1h' }",
    ]) {
      expect(chart).toContain(resolution);
    }

    for (const timeframe of [
      "{ value: 'TODAY', label: 'Today' }",
      "{ value: '1W', label: '1W' }",
      "{ value: '1M', label: '1M' }",
      "{ value: '90D', label: '90D' }",
      "{ value: 'YTD', label: 'YTD' }",
      "{ value: 'ALL', label: 'All' }",
    ]) {
      expect(chart).toContain(timeframe);
    }

    expect(chart).toContain('createWeeklyAreaInterpolator');
    expect(chart).toContain('createWeeklyLineInterpolator');
    expect(chart).toContain('matchWeeklyPointByDate');
    expect(weekly).toContain('matchWeeklyPointByDate');
    expect(weeklyTests).toContain("describe('weekly transition interpolation'");
    expect(chart).toContain('syncId="portfolio-secondary-analytics"');
    expect(secondary.match(/syncId="portfolio-secondary-analytics"/g)?.length).toBeGreaterThanOrEqual(3);
    expect(chart).toContain('tooltipsEnabled={chartTooltipsEnabled}');
    expect(chart).toContain('onChartInteraction={enableChartTooltips}');
  });

  it('keeps both realized-trajectory modes and every supported trajectory timeframe', () => {
    const trajectory = readRelative('./RealizedTrajectoryChart.tsx');
    const timeframes = readRelative('../services/realizedTrajectoryTimeframes.ts');

    expect(trajectory).toContain("setTrajectoryMode('cumulative')");
    expect(trajectory).toContain("setTrajectoryMode('discrete')");
    expect(trajectory).toContain('Cumulative Curve');
    expect(trajectory).toContain('Trade-by-Trade');
    expect(trajectory).toContain('aria-label="Realized trajectory timeframe"');

    for (const value of ['ALL', '1D', '1W', '1M', '90D', 'YTD']) {
      expect(timeframes).toContain(`{ value: '${value}'`);
    }
    expect(trajectory).toContain('filterRealizedTrajectoryTrades(');
  });

  it('keeps Trading filters, authoritative statistics, and export actions intact', () => {
    const trading = readRelative('./reports/TradingPerformanceReport.tsx');

    expect(trading).toContain("type TimeframeFilter = 'ALL' | 'YTD' | '90D' | '30D'");
    expect(trading).toContain("useState<'ALL' | 'Swing' | 'Day Trade' | 'Position'>('ALL')");
    expect(trading).toContain('calculateAccountingPerformanceStats(filteredTrades)');
    expect(trading).toContain('ariaLabel="Filter by trade type"');
    expect(trading).toContain("{ value: 'Swing', label: 'Swing Only' }");
    expect(trading).toContain("{ value: 'Day Trade', label: 'Day Trade Only' }");
    expect(trading).toContain("{ value: 'Position', label: 'Position Only' }");
    expect(trading).toContain('onClick={handleExportCSV}');
    expect(trading).toContain('title="Download CSV report"');
    expect(trading).toContain('onClick={handlePrint}');
    expect(trading).toContain('title="Print or Save PDF"');
  });

  it('keeps Allocation Sectors/Holdings/Cash on one trusted calculation path', () => {
    const reports = readRelative('./PerformanceReports.tsx');

    expect(reports).toContain("setAllocationTab('sector')");
    expect(reports).toContain("setAllocationTab('stock')");
    expect(reports).toContain('aria-pressed={allocationTab === \'sector\'}');
    expect(reports).toContain('aria-pressed={allocationTab === \'stock\'}');
    expect(reports).toContain('role="switch"');
    expect(reports).toContain('aria-checked={includeCash}');
    expect(reports).toContain('setIncludeCash((current) => !current)');
    expect(reports).toContain('value: position.shares * position.currentPrice');
    expect(reports).toContain("name: 'CASH'");
  });

  it('keeps Monthly All/Liquidated/Holdings filters and export actions intact', () => {
    const monthly = readRelative('./reports/MonthlyPerformanceReport.tsx');

    expect(monthly).toContain("type StatusFilter = 'ALL' | 'LIQUIDATED' | 'HOLDINGS'");
    expect(monthly).toContain("useState<string>('ALL')");
    expect(monthly).toContain("{ value: 'ALL', label: 'All Records' }");
    expect(monthly).toContain("{ value: 'LIQUIDATED', label: 'Liquidated Trades Only' }");
    expect(monthly).toContain("{ value: 'HOLDINGS', label: 'Month-End Holdings Only' }");
    expect(monthly).toContain('calculateMonthlyAuditSummary(auditRecords)');
    expect(monthly).toContain('onClick={() => handleExportCSV(selectedMonth)}');
    expect(monthly).toContain('title="Download CSV audit"');
    expect(monthly).toContain('onClick={() => window.print()}');
    expect(monthly).toContain('title="Print Monthly Report"');
  });

  it('keeps direct-mode opening and remembered-mode restoration on one atomic path', () => {
    const reports = readRelative('./PerformanceReports.tsx');
    const overview = readRelative('./reports/ReportsOverview.tsx');
    const workspace = readRelative('../services/reportsWorkspace.ts');

    expect(reports).toContain('useState<ReportsMode>(() => readPersistedReportsMode())');
    expect(reports).toContain('persistReportsMode(mode);');
    expect(reports).toContain('setReportMode(mode);');
    expect(reports).toContain('onOpenReport={handleReportModeChange}');
    expect(overview).toContain('aria-label={`Open full ${destination} report`}');
    expect(workspace).toContain("REPORTS_LAST_MODE_STORAGE_KEY = 'reports:lastMode'");
  });

  it('runs a browser interaction closure in addition to phone/landscape/tablet/desktop/2XL geometry', () => {
    const harness = readRelative('../../scripts/renderedRegression.mjs');

    expect(harness).toContain('reportsClosure: []');
    expect(harness).toContain("check: 'overview-diagnostics'");
    expect(harness).toContain("check: 'direct-mode-opening'");
    expect(harness).toContain("check: 'navigation-restoration'");
    expect(harness).toContain("check: 'analytics-controls'");
    expect(harness).toContain("check: 'trading-filters-and-exports'");
    expect(harness).toContain("check: 'allocation-sectors-holdings-cash'");
    expect(harness).toContain("check: 'monthly-filters-and-exports'");

    for (const viewport of [
      "['reports-phone-390', 390, 844]",
      "['reports-landscape-844', 844, 390]",
      "['reports-tablet-768', 768, 1024]",
      "['reports-desktop-1440', 1440, 1000]",
      "['reports-2xl-2560', 2560, 1440]",
    ]) {
      expect(harness).toContain(viewport);
    }
  });
});
