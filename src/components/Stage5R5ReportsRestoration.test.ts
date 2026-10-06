import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Stage 5 R5 Reports persistence/restoration polish', () => {
  it('restores the remembered mode synchronously on the first render', () => {
    const reports = readRelative('./PerformanceReports.tsx');

    expect(reports).toContain(
      'useState<ReportsMode>(() => readPersistedReportsMode())',
    );
    expect(reports).not.toContain(
      'useEffect(() => {\n    setReportMode(readPersistedReportsMode())',
    );
    expect(reports).toContain('motionKey={reportMode}');
  });

  it('uses one atomic mode-change path for navigation and direct report opening', () => {
    const reports = readRelative('./PerformanceReports.tsx');

    expect(reports).toContain(
      'const handleReportModeChange = useCallback((mode: ReportsMode) => {',
    );

    const handlerStart = reports.indexOf(
      'const handleReportModeChange = useCallback((mode: ReportsMode) => {',
    );
    const handlerEnd = reports.indexOf('}, []);', handlerStart);
    const handler = reports.slice(handlerStart, handlerEnd);

    expect(handler.indexOf('persistReportsMode(mode);')).toBeGreaterThanOrEqual(0);
    expect(handler.indexOf('setReportMode(mode);')).toBeGreaterThan(
      handler.indexOf('persistReportsMode(mode);'),
    );

    expect(reports).toContain(
      '<ReportsNavigation activeMode={reportMode} onModeChange={handleReportModeChange} />',
    );
    expect(reports).toContain('onOpenReport={handleReportModeChange}');
  });

  it('does not wait for a post-render persistence effect', () => {
    const reports = readRelative('./PerformanceReports.tsx');

    expect(reports).not.toContain(
      'useEffect(() => {\n    persistReportsMode(reportMode);\n  }, [reportMode]);',
    );
  });

  it('keeps stale persisted values safely normalized by the existing workspace authority', () => {
    const workspace = readRelative('../services/reportsWorkspace.ts');
    const tests = readRelative('../services/reportsWorkspace.test.ts');

    expect(workspace).toContain(
      'export const parseReportsMode = (value: unknown): ReportsMode =>',
    );
    expect(workspace).toContain(
      'isReportsMode(value) ? value : DEFAULT_REPORTS_MODE',
    );
    expect(tests).toContain("parseReportsMode('legacy-report')");
    expect(tests).toContain(
      "window.localStorage.setItem(REPORTS_LAST_MODE_STORAGE_KEY, 'stale-mode')",
    );
    expect(tests).toContain("expect(readPersistedReportsMode()).toBe('overview')");
  });
});
