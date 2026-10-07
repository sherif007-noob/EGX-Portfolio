import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 10.7B Open Positions closure', () => {
  it('uses an explicit H0 page shell with one page-level heading', () => {
    const app = readRelative('../App.tsx');
    const start = app.indexOf("{activeTab === 'positions'");
    const end = app.indexOf("{activeTab === 'closed_cycles'", start);
    const page = app.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(page).toContain(
      'className="premium-hierarchy-h0 premium-flow-related"',
    );
    expect(page).toContain('data-hierarchy="h0"');
    expect(page).toContain('data-page="positions"');
    expect(page).toContain('EGX Portfolio Positions');
    expect(page).toContain(
      'Track holdings, unrealized performance, price targets, and position actions.',
    );
  });

  it('keeps Add Trade as the single page-level creation action owner', () => {
    const app = readRelative('../App.tsx');
    const positions = readRelative('./PositionsTable.tsx');
    const start = app.indexOf("{activeTab === 'positions'");
    const end = app.indexOf("{activeTab === 'closed_cycles'", start);
    const page = app.slice(start, end);

    expect(page).not.toContain('+ Add Position');
    expect(positions).toContain('<span>Add Trade</span>');
    expect(positions).toContain(
      'premium-action premium-action-primary premium-shimmer-border',
    );
    expect(positions).toContain('{!isOverviewPreview && (');
  });

  it('preserves H3 context -> H4 toolbar -> H5 data hierarchy', () => {
    const positions = readRelative('./PositionsTable.tsx');

    expect(positions).toContain(
      'premium-hierarchy-h3 premium-dense-context premium-pad-h3',
    );
    expect(positions).toContain(
      'premium-panel premium-hierarchy-h4 premium-dense-toolbar premium-pad-h4',
    );
    expect(positions).toContain(
      'premium-table-shell premium-hierarchy-h5 premium-dense-data',
    );
    expect(positions).toContain(
      'premium-card premium-semantic-record premium-semantic-edge premium-hierarchy-h5 premium-dense-row',
    );
  });

  it('keeps canonical search and sector-filter controls in the H4 toolbar', () => {
    const positions = readRelative('./PositionsTable.tsx');

    expect(positions).toContain('premium-field premium-dense-search');
    expect(positions).toContain(
      'placeholder="Search ticker (e.g. COMI) or company..."',
    );
    expect(positions).toContain('<AnalyticsSelect');
    expect(positions).toContain('compact');
    expect(positions).toContain('ariaLabel="Filter positions by sector"');
    expect(positions).toContain("value: 'ALL', label: `All Sectors (${positions.length})`");
  });

  it('keeps row actions local and correction controls compact', () => {
    const positions = readRelative('./PositionsTable.tsx');

    expect(positions).toContain('title="Buy more shares of this stock (DCA / Accumulate)"');
    expect(positions).toContain('title="Sell Shares / Book P&L"');
    expect(positions).toContain('premium-icon-action premium-icon-edit');
    expect(positions).toContain('aria-label={`Edit ${pos.ticker} position`}');
    expect(positions).toContain('aria-label={`Review source ledger for ${pos.ticker}`}');
    expect(positions).toContain('title="Review source ledger transactions"');
    expect(positions).not.toContain('premium-icon-action premium-icon-delete');
  });

  it('keeps desktop table containment and semantic row-edge behavior', () => {
    const positions = readRelative('./PositionsTable.tsx');

    expect(positions).toContain(
      "isOverviewPreview ? 'min-w-[760px]' : 'min-w-[1080px]'",
    );
    expect(positions).toContain('overflow-x-auto overscroll-x-contain');
    expect(positions).toContain("'premium-row-win'");
    expect(positions).toContain("'premium-row-loss'");
    expect(positions).toContain("'premium-row-breakeven'");
    expect(positions).not.toMatch(/<tr[^>]*premium-glow-/);
  });

  it('keeps responsive records semantic and touch-safe', () => {
    const positions = readRelative('./PositionsTable.tsx');

    expect(positions).toContain(
      'premium-card premium-semantic-record premium-semantic-edge premium-hierarchy-h5 premium-dense-row',
    );
    expect(positions).toContain("'premium-glow-win'");
    expect(positions).toContain("'premium-glow-loss'");
    expect(positions).toContain("'premium-glow-breakeven'");
    expect(positions).toContain('w-11 h-11');
    expect(positions).toContain(
      'grid grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)_2.75rem_2.75rem]',
    );
  });

  it('distinguishes no-data and filter-empty states', () => {
    const positions = readRelative('./PositionsTable.tsx');

    expect(positions).toContain("const hasAnyPositions = positions.length > 0;");
    expect(positions).toContain("'No open positions yet.'");
    expect(positions).toContain("'No stock positions match your filters.'");
    expect(positions).toContain(
      "'Clear the search or sector filter to see your holdings.'",
    );
    expect(positions).toContain(
      "'Add your first trade from the toolbar to start tracking a position.'",
    );
    expect(positions).toContain(
      'premium-inset-glass premium-hierarchy-h4 p-8 text-center rounded-xl',
    );
  });

  it('does not reopen material, semantic, accounting, chart, or Header ownership', () => {
    const css = readRelative('../index.css');
    const contract = readRelative('../../docs/PREMIUM_VISUAL_LANGUAGE_CONTRACT.md');
    const chart = readRelative('./charts/PerformanceTimeframeChart.tsx');
    const phase9 = readRelative('../../docs/PHASE9_HEADER_NAVIGATION_PLAN.md');

    expect(css).not.toContain('Phase 10.7B');
    expect(contract).toContain('Hierarchy classes must never redefine material');
    expect(contract).toContain('Desktop rows remain table rows');
    expect(chart).toContain('weeklyLineInterpolator');
    expect(chart).toContain('TODAY_RESOLUTIONS');
    expect(phase9).toContain('PHASE 9 SOURCE-FROZEN');
  });
});
