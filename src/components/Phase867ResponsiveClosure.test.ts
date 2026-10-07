import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 8.6–8.7 responsive hierarchy + closure guard', () => {
  it('keeps the content shell bounded on desktop and tighter on narrow phones', () => {
    const app = readRelative('../App.tsx');
    const css = readRelative('../styles/responsive.css');

    expect(app).toContain('premium-safe-inline-main premium-flow-major');
    expect(app).toContain('max-w-7xl');
    expect(app).toContain('px-3 sm:px-6 lg:px-8');

    expect(css).toContain('Pass 8.6 — narrow-phone hierarchy guard');
    expect(css).toContain('@media (max-width: 390px)');
    expect(css).toContain('--hierarchy-metric-hero-size: clamp(1.55rem, 8vw, 1.9rem)');
    expect(css).toContain('--hierarchy-metric-dense-size: 0.95rem');
  });

  it('stacks collision-prone record headers on narrow phones while preserving desktop composition', () => {
    const positions = readRelative('./PositionsTable.tsx');
    const journal = readRelative('./TradingJournal.tsx');
    const monthly = readRelative('./reports/MonthlyPerformanceReport.tsx');
    const directory = readRelative('./TickerDirectoryView.tsx');

    expect(positions).toContain('flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between');
    expect(positions).toContain('w-full shrink-0 text-left sm:w-auto sm:text-right');

    expect(journal).toContain('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between');
    expect(journal).toContain('w-full items-center justify-between gap-3 text-left sm:w-auto sm:justify-end sm:text-right');

    expect(monthly).toContain('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between');
    expect(directory).toContain('flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between');
  });

  it('keeps report and dense-data layouts responsive instead of forcing desktop widths on phone', () => {
    const monthly = readRelative('./reports/MonthlyPerformanceReport.tsx');
    const trading = readRelative('./reports/TradingPerformanceReport.tsx');
    const cycles = readRelative('./ClosedCyclesView.tsx');
    const journal = readRelative('./TradingJournal.tsx');

    expect(monthly).toContain('overflow-x-auto');
    expect(trading).toContain('overflow-x-auto');
    expect(trading).toContain('grid grid-cols-1 gap-3 md:grid-cols-2');

    expect(cycles).toContain('w-full min-w-0 sm:w-auto sm:min-w-[205px]');
    expect(journal).toContain('w-full min-w-0 md:w-auto md:min-w-[170px]');
  });

  it('preserves the accepted Phase 8 semantic language while responsive rules stay material-neutral', () => {
    const responsive = readRelative('../styles/responsive.css');
    const semantics = readRelative('../styles/semantics.css');

    expect(semantics).toContain('Pass 8.3b: intensified resting aura/glow');
    expect(semantics).toContain('--premium-semantic-role-near-radius: 48px;');
    expect(semantics).toContain('--premium-semantic-role-near-alpha: 0.34;');
    expect(semantics).toContain('--premium-semantic-role-far-radius: 112px;');
    expect(semantics).toContain('--premium-semantic-role-far-alpha: 0.18;');
    expect(semantics).toContain('Additive semantic edge — aura/glass remain untouched');
    expect(semantics).toContain('border-radius: inherit');

    const start = responsive.indexOf('Pass 8.6 — narrow-phone hierarchy guard');
    expect(start).toBeGreaterThanOrEqual(0);
    const responsiveBlock = responsive.slice(start);
    expect(responsiveBlock).not.toMatch(/box-shadow|background:|border-color|backdrop-filter|filter:/);
  });

  it('keeps Phase 9 header ownership intact', () => {
    const header = readRelative('./Header.tsx');
    expect(header).toContain('max-w-7xl');
    expect(header).toContain('overflow-x-auto');
  });
});
