import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Stage 5 R4 progressive Reports disclosure', () => {
  it('allows exactly one diagnostic preview state at a time', () => {
    const overview = readRelative('./reports/ReportsOverview.tsx');

    expect(overview).toContain("const [expandedPreview, setExpandedPreview] = useState<ReportsPreviewId | null>(null)");
    expect(overview).toContain("setExpandedPreview((current) => (current === previewId ? null : previewId))");
    expect(overview.match(/data-reports-preview-expanded=/g)).toHaveLength(5);
  });

  it('keeps all five diagnostics compact until explicitly expanded', () => {
    const overview = readRelative('./reports/ReportsOverview.tsx');

    for (const id of [
      'portfolio-state',
      'trading-quality',
      'risk-costs',
      'concentration',
      'current-month',
    ]) {
      expect(overview).toContain(`previewId="${id}"`);
      expect(overview).toContain(`expandedPreview === '${id}'`);
    }

    expect(overview).toContain("expanded ? 'Show less' : 'Inspect'");
    expect(overview).toContain('aria-expanded={expanded}');
    expect(overview).toContain('aria-controls={`reports-preview-${previewId}`}');
  });

  it('adds meaningful medium-detail content without embedding full reports', () => {
    const overview = readRelative('./reports/ReportsOverview.tsx');

    expect(overview).toContain('Combined realized + unrealized P&amp;L');
    expect(overview).toContain('Profit Factor');
    expect(overview).toContain('Brokerage Fees');
    expect(overview).toContain('Largest Sector');
    expect(overview).toContain('Liquidated');

    expect(overview).not.toContain('PerformanceTimeframeChart');
    expect(overview).not.toContain('TradingPerformanceReport');
    expect(overview).not.toContain('MonthlyPerformanceReport');
    expect(overview).not.toContain('<PieChart');
  });

  it('routes expanded previews to the natural full workspace through existing report mode state', () => {
    const overview = readRelative('./reports/ReportsOverview.tsx');
    const reports = readRelative('./PerformanceReports.tsx');

    expect(overview).toContain('destination="analytics"');
    expect(overview).toContain('destination="trading"');
    expect(overview).toContain('destination="allocation"');
    expect(overview).toContain('destination="monthly"');
    expect(overview).toContain('Open full report');
    expect(overview).toContain('onClick={() => onOpenReport(destination)}');

    expect(reports).toContain('onOpenReport={setReportMode}');
    expect(reports).toContain('persistReportsMode(reportMode)');
  });

  it('does not introduce a second Reports navigation or calculation engine', () => {
    const overview = readRelative('./reports/ReportsOverview.tsx');

    expect(overview).not.toContain('ReportsNavigation');
    expect(overview).not.toContain('calculateEquityBridge');
    expect(overview).not.toContain('calculateMonthlyAuditSummary');
    expect(overview).not.toContain('calculatePositionUnrealizedPnl');
  });
});
