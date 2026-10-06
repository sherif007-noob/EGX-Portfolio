import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Stage 5 R1 Reports workspace architecture', () => {
  it('uses a dedicated internal Reports navigation with all five modes', () => {
    const navigation = readRelative('./reports/ReportsNavigation.tsx');
    const workspace = readRelative('../services/reportsWorkspace.ts');

    expect(workspace).toContain("'overview'");
    expect(workspace).toContain("'analytics'");
    expect(workspace).toContain("'trading'");
    expect(workspace).toContain("'allocation'");
    expect(workspace).toContain("'monthly'");
    expect(workspace).toContain("REPORTS_LAST_MODE_STORAGE_KEY = 'reports:lastMode'");

    expect(navigation).toContain('role="tablist"');
    expect(navigation).toContain('role="tab"');
    expect(navigation).toContain('aria-selected={active}');
    expect(navigation).toContain('overflow-x-auto');
    expect(navigation).toContain("scrollIntoView({");
    expect(navigation).toContain("inline: 'center'");
  });

  it('restores the remembered mode synchronously and persists explicit navigation', () => {
    const reports = readRelative('./PerformanceReports.tsx');

    expect(reports).toContain(
      'useState<ReportsMode>(() => readPersistedReportsMode())',
    );
    expect(reports).toContain('persistReportsMode(mode);');
    expect(reports).toContain(
      '<ReportsNavigation activeMode={reportMode} onModeChange={setReportMode} />',
    );
  });

  it('uses the established swap family for report-mode transitions', () => {
    const reports = readRelative('./PerformanceReports.tsx');

    expect(reports).toContain('motionKey={reportMode}');
    expect(reports).toContain('variant="state"');
    expect(reports).toContain('id="reports-active-workspace"');
    expect(reports).toContain('role="tabpanel"');
    expect(reports).toContain('data-reports-mode={reportMode}');
  });

  it('keeps the R1 navigation, persistence and swap shell authoritative after later workspace passes', () => {
    const reports = readRelative('./PerformanceReports.tsx');

    expect(reports).toContain('<TradingPerformanceReport');
    expect(reports).toContain('<PerformanceTimeframeChart');
    expect(reports).toContain('<RealizedTrajectoryChart');
    expect(reports).toContain('Portfolio Allocation');
    expect(reports).toContain('Portfolio Equity Bridge');
    expect(reports).toContain('Closed Trade Summary');
    expect(reports).toContain('<MonthlyPerformanceReport');
    expect(reports).toContain('motionKey={reportMode}');
    expect(reports).toContain('data-reports-mode={reportMode}');
  });
});
