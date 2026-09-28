import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 10.2 buttons, selectors and interactive controls', () => {
  it('gives compact dropdowns and dense toolbar search fields one desktop height contract', () => {
    const select = readRelative('./AnalyticsSelect.tsx');
    const css = readRelative('../index.css');

    expect(select).toContain(
      "compact ? 'premium-compact-selector px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'",
    );

    expect(css).toContain('.premium-selector-shell > .premium-filter-pill');
    expect(css).toContain('.premium-compact-selector {');
    expect(css).toContain('min-height: 36px !important');

    expect(css).toContain('.premium-dense-search {');
    expect(css).toContain('min-height: 36px;');
    expect(css).toContain('Mobile/coarse-pointer 44px field rules still win');
  });

  it('uses the dense-search contract across the four dense page toolbars', () => {
    for (const file of [
      './PositionsTable.tsx',
      './ClosedCyclesView.tsx',
      './TradingJournal.tsx',
      './TickerDirectoryView.tsx',
    ]) {
      expect(readRelative(file)).toContain('premium-field premium-dense-search');
    }
  });

  it('uses the compact segmented-selector family for page-level filters', () => {
    const closed = readRelative('./ClosedCyclesView.tsx');
    const journal = readRelative('./TradingJournal.tsx');
    const cash = readRelative('./CashBalanceView.tsx');
    const monthly = readRelative('./reports/MonthlyPerformanceReport.tsx');
    const trading = readRelative('./reports/TradingPerformanceReport.tsx');
    const reports = readRelative('./PerformanceReports.tsx');
    const chart = readRelative('./charts/PerformanceTimeframeChart.tsx');

    expect(closed).toContain('premium-filter-pill premium-compact-selector');
    expect(journal).toContain(
      "premium-filter-pill premium-compact-selector shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${filterMode === 'ALL'",
    );
    expect(cash).toContain(
      "premium-filter-pill premium-compact-selector flex min-w-0 flex-1 items-center justify-center",
    );
    expect(cash).toContain(
      "premium-filter-pill premium-compact-selector min-w-0 flex-1 justify-center",
    );
    expect(monthly).toContain('premium-filter-pill premium-compact-selector');
    expect(trading).toContain('premium-filter-pill premium-compact-selector');
    expect(reports).toContain('premium-filter-pill premium-compact-selector');
    expect(chart).toContain('premium-filter-pill premium-compact-selector');
  });

  it('uses the same selector language for Cash Ledger edit transaction type', () => {
    const cash = readRelative('./CashBalanceView.tsx');
    const start = cash.indexOf('Transaction Type');
    const block = cash.slice(start, start + 1800);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(block).toContain('premium-selector-shell grid grid-cols-2');
    expect(block).toContain('premium-filter-pill premium-compact-selector');
    expect(block).toContain('premium-filter-active-emerald');
    expect(block).toContain('premium-filter-active-rose');
    expect(block).not.toContain('premium-choice-success');
    expect(block).not.toContain('premium-choice-danger');
  });

  it('keeps workflow choices and real switches intentionally distinct from toolbar filters', () => {
    const journal = readRelative('./TradingJournal.tsx');
    const reports = readRelative('./PerformanceReports.tsx');

    const editStart = journal.indexOf("aria-pressed={editType === 'BUY'}");
    const editBlock = journal.slice(editStart, editStart + 1400);
    expect(editBlock).toContain('premium-filter-pill');
    expect(editBlock).not.toContain('premium-compact-selector');

    expect(reports).toContain('role="switch"');
    expect(reports).toContain('className="premium-cash-toggle');
    expect(reports).toContain('aria-checked={includeCash}');
  });

  it('marks utility and secondary actions without demoting primary actions', () => {
    const closed = readRelative('./ClosedCyclesView.tsx');
    const directory = readRelative('./TickerDirectoryView.tsx');
    const monthly = readRelative('./reports/MonthlyPerformanceReport.tsx');
    const trading = readRelative('./reports/TradingPerformanceReport.tsx');
    const positions = readRelative('./PositionsTable.tsx');

    expect(closed).toContain(
      'premium-action premium-action-priority-secondary w-full justify-center',
    );
    expect(closed).toContain(
      'premium-action premium-action-priority-utility absolute right-2',
    );

    expect(directory).toContain(
      'premium-action premium-action-priority-utility flex w-full items-center',
    );

    expect(monthly.match(/premium-action-priority-utility/g)?.length).toBeGreaterThanOrEqual(2);
    expect(trading.match(/premium-action-priority-utility/g)?.length).toBeGreaterThanOrEqual(2);

    expect(positions).toContain(
      'premium-action premium-action-primary premium-shimmer-border',
    );
  });

  it('does not reopen material, semantic, chart-behavior or header architecture', () => {
    const contract = readRelative('../../docs/PREMIUM_VISUAL_LANGUAGE_CONTRACT.md');
    const phase9 = readRelative('../../docs/PHASE9_HEADER_NAVIGATION_PLAN.md');
    const chart = readRelative('./charts/PerformanceTimeframeChart.tsx');

    expect(contract).toContain('Hierarchy classes must never redefine material');
    expect(contract).toContain('edge must never replace the halo');
    expect(phase9).toContain('PHASE 9 SOURCE-FROZEN');

    expect(chart).toContain('weeklyLineInterpolator');
    expect(chart).toContain('TODAY_RESOLUTIONS');
    expect(chart).toContain('TIMEFRAMES');
  });
});
