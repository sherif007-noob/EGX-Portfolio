import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Stage 5 R3 diagnostic Reports Overview', () => {
  it('builds exactly the five planned diagnostic contexts', () => {
    const overview = readRelative('./reports/ReportsOverview.tsx');

    for (const label of [
      'Portfolio State',
      'Trading Quality',
      'Risk &amp; Costs',
      'Concentration',
      'Current Month',
    ]) {
      expect(overview).toContain(label);
    }

    expect(overview).toContain('data-reports-diagnostic-overview="true"');
    expect(overview.match(/data-hierarchy="h2"/g)).toHaveLength(1);
    expect(overview.match(/data-hierarchy="h3"/g)).toHaveLength(4);
  });

  it('keeps Overview concise without embedding full-workspace components after R4', () => {
    const overview = readRelative('./reports/ReportsOverview.tsx');

    expect(overview).not.toContain('AnalyticsSelect');
    expect(overview).not.toContain('PerformanceTimeframeChart');
    expect(overview).not.toContain('TradingPerformanceReport');
    expect(overview).not.toContain('MonthlyPerformanceReport');
    expect(overview).not.toContain('<PieChart');
    expect(overview).toContain('onOpenReport');
  });

  it('uses trusted portfolio/stat authorities instead of recomputing report engines', () => {
    const reports = readRelative('./PerformanceReports.tsx');

    expect(reports).toContain('metrics?.totalValue ?? calculatePortfolioValue(cashBalance, positions)');
    expect(reports).toContain('metrics?.realizedPnlEgp ?? performanceBridge.realizedPnl');
    expect(reports).toContain('metrics?.unrealizedPnlEgp ?? performanceBridge.unrealizedPnl');
    expect(reports).toContain('winRate={stats.winRate}');
    expect(reports).toContain('profitFactor={stats.profitFactor}');
    expect(reports).toContain('expectancyEgp={stats.expectancyEgp ?? null}');
    expect(reports).toContain('maxDrawdownPercent={stats.maxDrawdownPercent ?? null}');
    expect(reports).toContain('maxDrawdownEgp={stats.maxDrawdownEgp ?? null}');
  });

  it('reuses the existing monthly audit and position P&L authorities for Current Month', () => {
    const reports = readRelative('./PerformanceReports.tsx');

    expect(reports).toContain("import { calculateMonthlyAuditSummary } from '../services/monthlyAuditSummary'");
    expect(reports).toContain('calculatePositionUnrealizedPnl(position)');
    expect(reports).toContain('const summary = calculateMonthlyAuditSummary([');
    expect(reports).toContain("kind: 'LIQUIDATED' as const");
    expect(reports).toContain("kind: 'HOLDING' as const");
    expect(reports).toContain("label: getMonthLabel(currentMonthKey, 'long')");
  });

  it('derives concentration from the same market-value inputs as Allocation', () => {
    const reports = readRelative('./PerformanceReports.tsx');

    expect(reports).toContain('value: position.shares * position.currentPrice');
    expect(reports).toContain('const topThreeConcentration = total > 0');
    expect(reports).toContain('largestSector = sectorData[0]');
    expect(reports).toContain('cashSharePercent = reportedNav > 0 ? (cashBalance / reportedNav) * 100 : 0');
  });

  it('keeps all four full workspaces intact and separate', () => {
    const reports = readRelative('./PerformanceReports.tsx');

    expect(reports.match(/<PerformanceTimeframeChart/g)).toHaveLength(1);
    expect(reports.match(/<RealizedTrajectoryChart/g)).toHaveLength(1);
    expect(reports.match(/<TradingPerformanceReport/g)).toHaveLength(1);
    expect(reports.match(/Portfolio Allocation/g)).toHaveLength(1);
    expect(reports.match(/<MonthlyPerformanceReport/g)).toHaveLength(1);
  });
});
