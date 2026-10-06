import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Stage 5 R7 Reports motion and state polish', () => {
  it('keeps workspace restoration first-render authoritative and uses the shared workspace swap', () => {
    const reports = readRelative('./PerformanceReports.tsx');

    expect(reports).toContain(
      'useState<ReportsMode>(() => readPersistedReportsMode())',
    );
    expect(reports).toContain('motionKey={reportMode}');
    expect(reports).toContain('variant="state"');
    expect(reports).toContain('className="premium-reports-mode-stage"');
  });

  it('animates every diagnostic disclosure through one React-owned presence primitive', () => {
    const overview = readRelative('./reports/ReportsOverview.tsx');

    expect(overview).toContain("import { DisclosurePresence } from '../PremiumMotion';");

    for (const flag of [
      'portfolioExpanded',
      'tradingExpanded',
      'riskExpanded',
      'concentrationExpanded',
      'monthExpanded',
    ]) {
      expect(overview).toContain(
        `<DisclosurePresence isOpen={${flag}} className="mt-4">`,
      );
    }

    expect(overview).toContain(
      'const [expandedPreview, setExpandedPreview] = useState<ReportsPreviewId | null>(null);',
    );
    expect(overview).toContain(
      'setExpandedPreview((current) => (current === previewId ? null : previewId));',
    );
  });

  it('keeps disclosure enter and exit lifecycle in Motion for React with reduced-motion fallback', () => {
    const motion = readRelative('./PremiumMotion.tsx');

    expect(motion).toContain('export const DisclosurePresence');
    expect(motion).toContain('<AnimatePresence initial={false}>');
    expect(motion).toContain('const reduceMotion = useReducedMotion();');
    expect(motion).toContain("data-motion-owned=\"react\"");
    expect(motion).toContain("height: 'auto'");
    expect(motion).toContain('reduceMotion\n              ? { opacity: 0 }');
    expect(motion).toContain("transition: { duration: 0.08, ease: 'easeIn' }");
  });

  it('preserves the existing loading and empty-state owners instead of replacing them in Reports', () => {
    const reports = readRelative('./PerformanceReports.tsx');
    const analytics = readRelative('./charts/PerformanceTimeframeChart.tsx');

    expect(reports).toContain('historicalLoading={historicalLoading}');
    expect(reports).toContain('<AnalyticsEmptyState>No allocation data.</AnalyticsEmptyState>');
    expect(analytics).toContain('<AnalyticsChartLoadingState');
    expect(analytics).toContain('<AnalyticsEmptyState>');
  });

  it('does not add a Reports-only CSS animation language', () => {
    const reportsCss = readRelative('../styles/features/reports.css');
    const motionCss = readRelative('../styles/motion.css');

    expect(reportsCss).not.toContain('Stage 5 R7');
    expect(motionCss).not.toContain('reports-preview');
    expect(motionCss).not.toContain('reports-mode-stage');
  });
});
