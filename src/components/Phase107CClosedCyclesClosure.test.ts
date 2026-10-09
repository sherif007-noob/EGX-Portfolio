import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 10.7C Closed Cycles closure', () => {


  it('assigns real financial summary cards semantic-card roles', () => {
    const cycles = readRelative('./ClosedCyclesView.tsx');

    expect(cycles).toContain("const realizedPnlState =");
    expect(cycles).toContain("summary.totalRealizedPnl > 0 ? 'WIN'");
    expect(cycles).toContain("const avgReturnState =");
    expect(cycles).toContain("summary.avgReturnPct > 0 ? 'WIN'");

    expect(
      cycles.match(
        /premium-card premium-semantic-card premium-hierarchy-h3 premium-dense-summary-card/g,
      )?.length,
    ).toBeGreaterThanOrEqual(2);

    expect(cycles).toContain(
      'premium-card premium-semantic-card premium-glow-breakeven premium-hierarchy-h3 premium-dense-summary-card',
    );
  });

  it('renders zero summary PnL/return as breakeven and keeps fees amber cost semantic', () => {
    const cycles = readRelative('./ClosedCyclesView.tsx');

    expect(cycles).toContain("{summary.totalRealizedPnl > 0 ? '+' : ''}");
    expect(cycles).toContain("{summary.avgReturnPct > 0 ? '+' : ''}");
    expect(cycles).not.toContain("summary.totalRealizedPnl >= 0 ? 'text-emerald-400'");
    expect(cycles).not.toContain("summary.avgReturnPct >= 0 ? 'text-emerald-400'");

    expect(cycles).toContain('Cycle Fees Paid');
    expect(cycles).toContain('text-amber-300');
    expect(cycles).toContain('Receipt className="w-3.5 h-3.5 text-amber-400"');
  });

  it('keeps structural duration and proceeds accents out of WIN/LOSS colors', () => {
    const cycles = readRelative('./ClosedCyclesView.tsx');

    expect(cycles).toContain('Avg Hold Duration');
    expect(cycles).toContain('premium-type-metric premium-type-metric-secondary mt-2 font-mono text-cyan-300');
    expect(cycles).toContain('Net Realized Proceeds');
    expect(cycles).toContain(
      'premium-type-metric premium-type-metric-dense font-mono text-cyan-300',
    );
  });



  it('expands based on the visible result set and disables expansion for empty results', () => {
    const cycles = readRelative('./ClosedCyclesView.tsx');

    expect(cycles).toContain('const allVisibleExpanded =');
    expect(cycles).toContain(
      'filteredCycles.every((cycle) => expandedCycleIds.has(cycle.id))',
    );
    expect(cycles).toContain('!allVisibleExpanded');
    expect(cycles).toContain('disabled={filteredCycles.length === 0}');
    expect(cycles).toContain(
      "{allVisibleExpanded ? 'Collapse All' : 'Expand All Phases'}",
    );
    expect(cycles).not.toContain(
      'expandedCycleIds.size < filteredCycles.length',
    );
  });

  it('keeps repeated cycles H5 semantic records with additive edge', () => {
    const cycles = readRelative('./ClosedCyclesView.tsx');

    expect(cycles).toContain('data-hierarchy="h5"');
    expect(cycles).toContain(
      'premium-card premium-semantic-record premium-semantic-edge premium-hierarchy-h5 premium-dense-row',
    );
    expect(cycles).toContain("'premium-glow-win'");
    expect(cycles).toContain("'premium-glow-loss'");
    expect(cycles).toContain("'premium-glow-breakeven'");
  });

  it('keeps cycle source-correction actions local, labeled and touch-safe', () => {
    const cycles = readRelative('./ClosedCyclesView.tsx');

    expect(cycles).toContain(
      'aria-label={`Review source ledger for ${cycle.ticker} closed cycle`}',
    );
    expect(cycles).toContain(
      'premium-icon-action flex h-11 w-11',
    );
    expect(cycles).toContain('title="Review source ledger transactions"');
    expect(cycles).toContain('sm:h-9 sm:w-9');
    expect(cycles).not.toContain('premium-icon-delete');
  });

  it('keeps expanded execution content subordinate and responsive', () => {
    const cycles = readRelative('./ClosedCyclesView.tsx');

    expect(cycles).toContain(
      'premium-inset-glass premium-hierarchy-h4 p-3.5 rounded-xl space-y-3',
    );
    expect(cycles).toContain(
      'flex flex-col gap-2 border-t border-slate-800/60 pt-2 sm:flex-row',
    );
    expect(cycles).toContain(
      'premium-inset-glass flex flex-col items-start gap-1.5 rounded-lg p-2 sm:flex-row',
    );
    expect(cycles).toContain(
      'premium-type-metadata w-full text-left sm:w-auto sm:text-right',
    );
  });

  it('distinguishes no closed cycles from a filter-empty result', () => {
    const cycles = readRelative('./ClosedCyclesView.tsx');

    expect(cycles).toContain('const hasClosedCycles = enrichedCycles.length > 0;');
    expect(cycles).toContain(
      "const hasActiveFilters = searchQuery.trim().length > 0 || outcomeFilter !== 'ALL';",
    );
    expect(cycles).toContain("'No closed cycles yet.'");
    expect(cycles).toContain("'No closed cycles match your filters.'");
    expect(cycles).toContain(
      "'Completed cycles will appear here after a position is fully exited.'",
    );
    expect(cycles).toContain(
      "'Clear your search or adjust the outcome filter to see closed trade cycles.'",
    );
    expect(cycles).toContain(
      'premium-subpanel premium-hierarchy-h4 premium-flow-control',
    );
    expect(cycles).toContain('hasClosedCycles && hasActiveFilters');
  });

  it('keeps visual, material, chart, and Header ownership while using canonical cycle economics', () => {
    const cycles = readRelative('./ClosedCyclesView.tsx');
    const css = readRelative('../index.css');
    const contract = readRelative('../../docs/PREMIUM_VISUAL_LANGUAGE_CONTRACT.md');
    const chart = readRelative('./charts/PerformanceTimeframeChart.tsx');
    const phase9 = readRelative('../../docs/PHASE9_HEADER_NAVIGATION_PLAN.md');

    expect(cycles).toContain('calculatePerformanceStats(enrichedCycles)');
    expect(cycles).toContain('grossSellProceeds - totalSellFees');
    expect(cycles).toContain('const weightedAvgBuyPrice = ct.buyPrice;');
    expect(cycles).toContain('netProceeds - ct.realizedPnlEgp');
    expect(css).not.toContain('Phase 10.7C');
    expect(contract).toContain('Hierarchy classes must never redefine material');
    expect(chart).toContain('weeklyLineInterpolator');
    expect(chart).toContain('TODAY_RESOLUTIONS');
    expect(phase9).toContain('PHASE 9 SOURCE-FROZEN');
  });
});
