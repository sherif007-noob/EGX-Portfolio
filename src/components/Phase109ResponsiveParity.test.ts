import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 10.9 responsive cross-app parity', () => {
  it('contains Motion-owned tab/result surfaces without clipping semantic effects', () => {
    const css = readRelative('../styles/responsive.css');

    expect(css).toContain('.premium-motion-swap-shell,');
    expect(css).toContain('.premium-motion-swap,');
    expect(css).toContain('.premium-tab-stage {');
    expect(css).toContain('min-width: 0;');
    expect(css).toContain('max-width: 100%;');

    const blockStart = css.indexOf('Phase 10.9 — cross-app responsive containment');
    const responsive = css.slice(blockStart);
    expect(responsive).not.toContain('overflow-x: hidden');
    expect(responsive).not.toContain('overflow-x: clip');
  });

  it('keeps dense tables and chart surfaces bounded by their owning viewport', () => {
    const css = readRelative('../styles/responsive.css');
    const positions = readRelative('./PositionsTable.tsx');
    const cash = readRelative('./CashBalanceView.tsx');
    const monthly = readRelative('./reports/MonthlyPerformanceReport.tsx');
    const trading = readRelative('./reports/TradingPerformanceReport.tsx');

    expect(css).toContain('.premium-table-shell,');
    expect(css).toContain('.premium-report-table,');
    expect(css).toContain('.premium-chart-stage,');
    expect(css).toContain('.premium-chart-plot {');

    expect(positions).toContain('overflow-x-auto overscroll-x-contain');
    expect(cash).toContain('overflow-x-auto overscroll-x-contain');
    expect(monthly).toContain('overflow-x-auto');
    expect(trading).toContain('overflow-x-auto');
  });

  it('gives the 320px Overview summary a single-column financial layout', () => {
    const summary = readRelative('./PortfolioSummary.tsx');
    const css = readRelative('../styles/responsive.css');

    expect(summary).toContain('premium-overview-primary-grid');
    expect(summary).toContain('premium-overview-support-grid');
    expect(css).toContain('@media (max-width: 359px)');
    expect(css).toContain('.premium-overview-primary-grid,');
    expect(css).toContain('.premium-overview-support-grid,');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) !important;');
    expect(css).toContain('.premium-overview-today');
  });

  it('keeps the diagnostic Reports Overview single-column on narrow phones', () => {
    const overview = readRelative('./reports/ReportsOverview.tsx');

    expect(overview).toContain('grid grid-cols-1 gap-4 md:grid-cols-2');
    expect(overview).toContain('grid grid-cols-1 gap-2.5 sm:grid-cols-3');
  });

  it('extends safe-area protection to short landscape overlays and modals', () => {
    const css = readRelative('../styles/responsive.css');

    expect(css).toContain('@media (orientation: landscape) and (max-height: 520px)');
    expect(css).toContain('max(0.75rem, env(safe-area-inset-right))');
    expect(css).toContain('max(0.75rem, env(safe-area-inset-left))');
    expect(css).toContain('.premium-fixed-overlay');
    expect(css).toContain('.premium-fixed-bottom-safe');
    expect(css).toContain('.premium-fixed-bottom-above-status');
  });

  it('keeps the deliberate desktop width bounds instead of stretching content at 2XL', () => {
    const app = readRelative('../App.tsx');
    const header = readRelative('./Header.tsx');

    expect(app).toContain('w-full max-w-7xl mx-auto');
    expect(header.match(/xl:max-w-\[100rem\]/g)?.length).toBe(2);
  });

  it('preserves the Phase 9 Header architecture and Phase 10.8 modal contract', () => {
    const header = readRelative('./Header.tsx');
    const modal = readRelative('./PremiumMotion.tsx');
    const phase9 = readRelative('../../docs/PHASE9_HEADER_NAVIGATION_PLAN.md');

    expect(header).toContain('premium-header-command-zone');
    expect(header).toContain('premium-nav-scroller');
    expect(phase9).toContain('PHASE 9 SOURCE-FROZEN');

    expect(modal).toContain('createPortal(modal, document.body)');
    expect(modal).toContain("'--premium-modal-visual-height'");
    expect(modal).toContain('aria-modal="true"');
  });
});
