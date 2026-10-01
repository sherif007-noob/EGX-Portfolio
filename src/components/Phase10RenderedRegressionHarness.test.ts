import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 10 rendered browser regression harness', () => {
  it('uses an explicit visual-only mode instead of live production data', () => {
    const gate = readRelative('./SupabaseAuthGate.tsx');
    const portfolio = readRelative('../hooks/usePortfolioState.ts');
    const market = readRelative('../hooks/useMarketData.ts');
    const app = readRelative('../App.tsx');

    expect(gate).toContain('VISUAL_REGRESSION_MODE');
    expect(portfolio).toContain('VISUAL_REGRESSION_TRANSACTIONS');
    expect(portfolio).toContain('if (VISUAL_REGRESSION_MODE) return;');
    expect(market).toContain('VISUAL_SCHEDULE_STATUS');
    expect(market).toContain('Live sync disabled in visual regression mode');
    expect(app).toContain('if (VISUAL_REGRESSION_MODE)');
  });

  it('derives representative fixture state through the canonical reconciliation engine', () => {
    const fixture = readRelative('../data/visualRegressionFixture.ts');

    expect(fixture).toContain('reconcilePortfolioFromLedger(');
    expect(fixture).toContain('VISUAL_REGRESSION_POSITIONS');
    expect(fixture).toContain('VISUAL_REGRESSION_CLOSED_TRADES');
    expect(fixture).toContain("cashFlowType: 'DEPOSIT'");
    expect(fixture).toContain("cashFlowType: 'WITHDRAWAL'");
    expect(fixture).toContain("'visual-orhd-sell'");
    expect(fixture).toContain("'visual-fwry-sell'");
  });

  it('runs geometry checks across every required responsive width', () => {
    const script = readRelative('../../scripts/renderedRegression.mjs');

    for (const width of [320, 359, 390, 430, 768, 1024, 1280, 1440, 1600, 1920, 2560]) {
      expect(script).toContain(String(width));
    }
    expect(script).toContain("['phone-landscape', 844, 390]");
    expect(script).toContain('page-level horizontal overflow');
  });

  it('captures the roadmap golden states', () => {
    const script = readRelative('../../scripts/renderedRegression.mjs');

    for (const state of [
      'overview-phone-320',
      'overview-phone-390',
      'overview-landscape',
      'overview-desktop',
      'overview-2xl',
      'positions-desktop',
      'positions-phone',
      'closed-cycles-desktop',
      'reports-desktop',
      'journal-desktop',
      'cash-desktop',
      'add-trade-phone',
      'transaction-edit-desktop',
      'data-tools-dropdown-desktop',
      'semantic-summary-desktop',
    ]) {
      expect(script).toContain(state);
    }
  });

  it('uses fixed time, Cairo timezone, reduced motion, and pixel comparison', () => {
    const script = readRelative('../../scripts/renderedRegression.mjs');

    expect(script).toContain("timezoneId: 'Africa/Cairo'");
    expect(script).toContain("reducedMotion: 'reduce'");
    expect(script).toContain("2026-09-30T09:00:00.000Z");
    expect(script).toContain('comparePng');
    expect(script).toContain('VISUAL_MAX_DIFF_RATIO');
  });

  it('keeps Playwright isolated to the visual workflow', () => {
    const workflow = readRelative('../../.github/workflows/rendered-regression.yml');
    const pkg = readRelative('../../package.json');

    expect(workflow).toContain('playwright@1.55.0');
    expect(workflow).toContain("VITE_VISUAL_REGRESSION: 'true'");
    expect(workflow).toContain('actions/upload-artifact@v4');
    expect(pkg).not.toContain('"playwright"');
    expect(pkg).not.toContain('"@playwright/test"');
  });
});
