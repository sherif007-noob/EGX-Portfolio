import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const workspaceBlock = (
  source: string,
  mode: 'overview' | 'analytics' | 'trading' | 'allocation' | 'monthly',
  nextMode?: 'analytics' | 'trading' | 'allocation' | 'monthly',
) => {
  const start = source.indexOf(`{reportMode === '${mode}' && (`);
  expect(start).toBeGreaterThanOrEqual(0);

  const end = nextMode
    ? source.indexOf(`{reportMode === '${nextMode}' && (`, start)
    : source.indexOf('        </div>\n      </MotionSwap>', start);

  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
};

describe('Stage 5 R2 Reports workspace split', () => {
  it('renders one explicit branch for every Reports mode', () => {
    const reports = readRelative('./PerformanceReports.tsx');

    for (const mode of ['overview', 'analytics', 'trading', 'allocation', 'monthly']) {
      expect(reports.match(new RegExp(`reportMode === '${mode}'`, 'g'))?.length).toBe(1);
      expect(reports).toContain(`data-reports-workspace="${mode}"`);
    }
  });

  it('keeps Overview isolated from every full workspace after the R3 diagnostic handoff', () => {
    const reports = readRelative('./PerformanceReports.tsx');
    const overview = workspaceBlock(reports, 'overview', 'analytics');

    expect(overview).toContain('<ReportsOverview');
    expect(overview).not.toContain('premium-report-summary-band');
    expect(overview).not.toContain('<TradingPerformanceReport');
    expect(overview).not.toContain('<PerformanceTimeframeChart');
    expect(overview).not.toContain('Portfolio Allocation');
    expect(overview).not.toContain('<MonthlyPerformanceReport');
  });

  it('moves performance evolution, realized trajectory and equity bridge into Analytics', () => {
    const reports = readRelative('./PerformanceReports.tsx');
    const analytics = workspaceBlock(reports, 'analytics', 'trading');

    expect(analytics).toContain('<PerformanceTimeframeChart');
    expect(analytics).toContain('<RealizedTrajectoryChart');
    expect(analytics).toContain('Portfolio Equity Bridge');
    expect(analytics).toContain('Reported NAV:');
    expect(analytics).not.toContain('<TradingPerformanceReport');
    expect(analytics).not.toContain('Portfolio Allocation');
    expect(analytics).not.toContain('<MonthlyPerformanceReport');
  });

  it('moves trading-quality surfaces together without changing their source components', () => {
    const reports = readRelative('./PerformanceReports.tsx');
    const trading = workspaceBlock(reports, 'trading', 'allocation');

    expect(trading).toContain(
      '<TradingPerformanceReport stats={stats} closedTrades={closedTrades} positions={positions} cashBalance={cashBalance} />',
    );
    expect(trading).toContain('Closed Trade Summary');
    expect(trading).toContain('Profit Factor');
    expect(trading).not.toContain('<PerformanceTimeframeChart');
    expect(trading).not.toContain('Portfolio Allocation');
  });

  it('keeps the complete existing allocation system isolated in Allocation', () => {
    const reports = readRelative('./PerformanceReports.tsx');
    const allocation = workspaceBlock(reports, 'allocation', 'monthly');

    expect(allocation).toContain('Portfolio Allocation');
    expect(allocation).toContain("setAllocationTab('sector')");
    expect(allocation).toContain("setAllocationTab('stock')");
    expect(allocation).toContain('aria-checked={includeCash}');
    expect(allocation).toContain('<PieChart>');
    expect(allocation).toContain('Concentration breakdown');
    expect(allocation).not.toContain('<MonthlyPerformanceReport');
  });

  it('keeps the existing monthly audit component as the Monthly workspace', () => {
    const reports = readRelative('./PerformanceReports.tsx');
    const monthly = workspaceBlock(reports, 'monthly');

    expect(monthly).toContain(
      '<MonthlyPerformanceReport closedTrades={closedTrades} positions={positions} />',
    );
    expect(monthly).not.toContain('<PerformanceTimeframeChart');
    expect(monthly).not.toContain('<TradingPerformanceReport');
  });

  it('keeps every trusted report surface exactly once and preserves calculation calls', () => {
    const reports = readRelative('./PerformanceReports.tsx');

    expect(reports.match(/<TradingPerformanceReport/g)).toHaveLength(1);
    expect(reports.match(/<PerformanceTimeframeChart/g)).toHaveLength(1);
    expect(reports.match(/<RealizedTrajectoryChart/g)).toHaveLength(1);
    expect(reports.match(/Portfolio Allocation/g)).toHaveLength(1);
    expect(reports.match(/Portfolio Equity Bridge/g)).toHaveLength(1);
    expect(reports.match(/Closed Trade Summary/g)).toHaveLength(1);
    expect(reports.match(/<MonthlyPerformanceReport/g)).toHaveLength(1);

    expect(reports).toContain('calculateEquityBridge(');
    expect(reports).toContain('calculatePortfolioValue(cashBalance, positions)');
    expect(reports).toContain('const sectorData = useMemo(');
    expect(reports).toContain('const stockData = useMemo(');
  });
});
