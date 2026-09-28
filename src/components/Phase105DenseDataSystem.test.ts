import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 10.5 dense data and table system', () => {
  it('keeps dense operational tables horizontally contained instead of compressing columns', () => {
    const positions = readRelative('./PositionsTable.tsx');
    const cash = readRelative('./CashBalanceView.tsx');

    expect(positions).toContain(
      'premium-table-shell premium-hierarchy-h5 premium-dense-data overflow-x-auto overscroll-x-contain rounded-2xl',
    );
    expect(positions).toContain('min-w-[1080px]');
    expect(cash).toContain(
      'premium-table-shell premium-hierarchy-h5 premium-dense-data overflow-x-auto overscroll-x-contain rounded-xl',
    );
    expect(cash).toContain('min-w-[720px]');
  });

  it('uses metadata-grade table headers across operational and report tables', () => {
    const positions = readRelative('./PositionsTable.tsx');
    const cash = readRelative('./CashBalanceView.tsx');
    const monthly = readRelative('./reports/MonthlyPerformanceReport.tsx');
    const trading = readRelative('./reports/TradingPerformanceReport.tsx');

    for (const source of [positions, cash, monthly, trading]) {
      expect(source).toContain('premium-type-metadata border-b border-slate-800/70 font-semibold');
    }
  });

  it('declares report desktop tables as H5 data without replacing report material', () => {
    const monthly = readRelative('./reports/MonthlyPerformanceReport.tsx');
    const trading = readRelative('./reports/TradingPerformanceReport.tsx');

    expect(monthly).toContain(
      'premium-report-table hidden overflow-x-auto overscroll-x-contain 2xl:block" data-hierarchy="h5"',
    );
    expect(trading).toContain(
      'premium-report-table hidden overflow-x-auto overscroll-x-contain rounded-xl 2xl:block" data-hierarchy="h5"',
    );

    expect(monthly).not.toContain('premium-report-table premium-table-shell');
    expect(trading).not.toContain('premium-report-table premium-table-shell');
  });

  it('keeps repeated record families dense instead of promoting them to hero surfaces', () => {
    const positions = readRelative('./PositionsTable.tsx');
    const cycles = readRelative('./ClosedCyclesView.tsx');
    const journal = readRelative('./TradingJournal.tsx');
    const directory = readRelative('./TickerDirectoryView.tsx');

    expect(positions).toContain('premium-hierarchy-h5 premium-dense-row');
    expect(cycles).toContain('premium-hierarchy-h5 premium-dense-row');
    expect(journal).toContain('premium-hierarchy-h5 premium-dense-row');
    expect(directory).toContain('premium-hierarchy-h5 premium-dense-row');

    expect(cycles).not.toContain('premium-hierarchy-h1 premium-dense-row');
    expect(journal).not.toContain('premium-hierarchy-h1 premium-dense-row');
    expect(directory).not.toContain('premium-hierarchy-h1 premium-dense-row');
  });

  it('preserves desktop row semantics without adding indiscriminate row glow', () => {
    const positions = readRelative('./PositionsTable.tsx');
    const cash = readRelative('./CashBalanceView.tsx');
    const monthly = readRelative('./reports/MonthlyPerformanceReport.tsx');
    const trading = readRelative('./reports/TradingPerformanceReport.tsx');

    expect(positions).toContain('premium-row-win');
    expect(positions).toContain('premium-row-loss');
    expect(positions).toContain('premium-row-breakeven');

    for (const source of [positions, cash, monthly, trading]) {
      expect(source).not.toMatch(/<tr[^>]*premium-glow-/);
    }
  });

  it('keeps responsive report cards and true-desktop tables as separate density modes', () => {
    const monthly = readRelative('./reports/MonthlyPerformanceReport.tsx');
    const trading = readRelative('./reports/TradingPerformanceReport.tsx');

    expect(monthly).toContain('md:grid-cols-2 2xl:hidden');
    expect(monthly).toContain('2xl:block" data-hierarchy="h5"');

    expect(trading).toContain('premium-flow-control 2xl:hidden');
    expect(trading).toContain('2xl:block" data-hierarchy="h5"');
  });

  it('uses subordinate empty-state typography inside dense tables', () => {
    const positions = readRelative('./PositionsTable.tsx');
    const cash = readRelative('./CashBalanceView.tsx');

    expect(positions).toContain(
      'premium-type-helper py-10 text-center text-slate-400',
    );
    expect(cash).toContain(
      'premium-type-helper py-8 text-center text-slate-500 font-sans',
    );
  });

  it('does not reopen semantic-card, hierarchy-material, chart, or header ownership', () => {
    const contract = readRelative('../../docs/PREMIUM_VISUAL_LANGUAGE_CONTRACT.md');
    const css = readRelative('../index.css');
    const chart = readRelative('./charts/PerformanceTimeframeChart.tsx');
    const phase9 = readRelative('../../docs/PHASE9_HEADER_NAVIGATION_PLAN.md');

    expect(contract).toContain('Desktop rows remain table rows');
    expect(contract).toContain('Repeated mobile cards');
    expect(contract).toContain('Hierarchy classes must never redefine material');

    // 10.5 is a source-composition pass; it must not introduce another dense
    // visual override layer or a row-glow engine.
    expect(css).not.toContain('Phase 10.5');
    expect(css).not.toContain('.premium-dense-row-glow');

    expect(chart).toContain('weeklyLineInterpolator');
    expect(chart).toContain('TODAY_RESOLUTIONS');
    expect(phase9).toContain('PHASE 9 SOURCE-FROZEN');
  });
});
