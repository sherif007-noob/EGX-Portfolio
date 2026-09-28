import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const cssBlock = (source: string, selector: string) => {
  const start = source.indexOf(selector);
  expect(start).toBeGreaterThanOrEqual(0);
  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  return source.slice(start, close + 1);
};

describe('Phase 10.6 semantic-state consistency', () => {
  it('defines exactly the three canonical semantic surface roles', () => {
    const css = readRelative('../index.css');

    expect((css.match(/\.premium-semantic-hero\s*\{/g) || []).length).toBe(1);
    expect((css.match(/\.premium-semantic-card\s*\{/g) || []).length).toBe(1);
    expect((css.match(/\.premium-semantic-record\s*\{/g) || []).length).toBe(1);
  });

  it('keeps semantic roles geometry-only and independent from material/state color', () => {
    const css = readRelative('../index.css');

    for (const selector of [
      '.premium-semantic-hero',
      '.premium-semantic-card',
      '.premium-semantic-record',
    ]) {
      const block = cssBlock(css, selector);
      expect(block).toMatch(/--premium-semantic-role-/);
      expect(block).not.toMatch(/background\s*:|backdrop-filter\s*:|filter\s*:|--premium-semantic-rgb\s*:/);
    }
  });

  it('preserves accepted 8.3b hero/card aura strength while bounding repeated records', () => {
    const css = readRelative('../index.css');
    const hero = cssBlock(css, '.premium-semantic-hero');
    const card = cssBlock(css, '.premium-semantic-card');
    const record = cssBlock(css, '.premium-semantic-record');

    expect(hero).toContain('--premium-semantic-role-near-radius: 58px;');
    expect(hero).toContain('--premium-semantic-role-near-alpha: 0.40;');
    expect(hero).toContain('--premium-semantic-role-far-radius: 132px;');
    expect(hero).toContain('--premium-semantic-role-far-alpha: 0.24;');

    expect(card).toContain('--premium-semantic-role-near-radius: 48px;');
    expect(card).toContain('--premium-semantic-role-near-alpha: 0.34;');
    expect(card).toContain('--premium-semantic-role-far-radius: 112px;');
    expect(card).toContain('--premium-semantic-role-far-alpha: 0.18;');

    expect(record).toContain('--premium-semantic-role-near-radius: 48px;');
    expect(record).toContain('--premium-semantic-role-near-alpha: 0.34;');
    expect(record).toContain('--premium-semantic-role-far-radius: 96px;');
    expect(record).toContain('--premium-semantic-role-far-alpha: 0.18;');
    expect(record).toContain('--premium-semantic-role-hover-far-radius: 112px;');
  });

  it('maps Overview hero, standalone semantic cards and cost state correctly', () => {
    const overview = readRelative('./PortfolioSummary.tsx');

    expect(overview).toContain(
      'premium-card premium-hero-card premium-semantic-hero premium-hierarchy-h1',
    );
    expect(overview).toContain(
      'premium-card premium-semantic-card premium-hierarchy-h2',
    );
    expect(overview).toContain(
      'premium-card premium-semantic-card premium-hierarchy-h3',
    );
    expect(overview).toContain(
      'premium-card premium-semantic-card premium-glow-breakeven premium-hierarchy-h3 premium-overview-fees',
    );

    expect(overview).toContain(
      'premium-card premium-material-tone-cyan premium-hierarchy-h2',
    );
    expect(overview).toContain(
      'premium-card premium-material-tone-blue premium-hierarchy-h3',
    );
  });

  it('renders true zero PnL as breakeven instead of positive or negative', () => {
    const overview = readRelative('./PortfolioSummary.tsx');
    const positions = readRelative('./PositionsTable.tsx');
    const monthly = readRelative('./reports/MonthlyPerformanceReport.tsx');

    expect(overview).toContain('const isPositiveDay = metrics.dayChangeEgp > 0;');
    expect(overview).toContain('const isNegativeDay = metrics.dayChangeEgp < 0;');
    expect(overview).toContain('const isPositiveUnrealized = metrics.unrealizedPnlEgp > 0;');
    expect(overview).toContain('const isNegativeUnrealized = metrics.unrealizedPnlEgp < 0;');
    expect(overview).toContain('<Minus className="h-4 w-4 shrink-0" />');
    expect(overview).toContain("'text-amber-400'");

    expect(positions).toContain('const isProfit = pnlEgp > 0;');
    expect(positions).toContain('const isLoss = pnlEgp < 0;');
    expect(positions).toContain('<Minus className="w-3 h-3 inline" />');
    expect(positions).toContain("'text-amber-500'");

    expect(monthly).toContain("? 'premium-state-breakeven'");
    expect(monthly).toContain("? 'premium-report-tone-warning'");
    expect(monthly).toContain(
      "? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'",
    );
  });

  it('assigns semantic-record plus additive edge to repeated financial records', () => {
    const positions = readRelative('./PositionsTable.tsx');
    const cycles = readRelative('./ClosedCyclesView.tsx');
    const journal = readRelative('./TradingJournal.tsx');

    for (const source of [positions, cycles, journal]) {
      expect(source).toContain(
        'premium-card premium-semantic-record premium-semantic-edge premium-hierarchy-h5 premium-dense-row',
      );
    }

    expect(journal).toContain("'premium-glow-buy'");
    expect(journal).toContain("'premium-glow-win'");
    expect(journal).toContain("'premium-glow-loss'");
    expect(journal).toContain("'premium-glow-breakeven'");
  });

  it('keeps true desktop rows on the dense row-edge exception', () => {
    const positions = readRelative('./PositionsTable.tsx');

    expect(positions).toContain("'premium-row-win'");
    expect(positions).toContain("'premium-row-loss'");
    expect(positions).toContain("'premium-row-breakeven'");
    expect(positions).not.toMatch(/<tr[^>]*premium-glow-/);
  });

  it('keeps Monthly parent neutral while child state remains local', () => {
    const monthly = readRelative('./reports/MonthlyPerformanceReport.tsx');
    const marker =
      'premium-month-audit-shell premium-hierarchy-h3 overflow-hidden rounded-xl';
    const start = monthly.indexOf(marker);

    expect(start).toBeGreaterThanOrEqual(0);
    const shellOpening = monthly.slice(start, start + marker.length + 120);
    expect(shellOpening).not.toMatch(/premium-(?:glow|state|semantic)-(?:win|loss|breakeven|buy|hero|card|record)/);

    expect(monthly).toContain("'premium-state-win'");
    expect(monthly).toContain("'premium-state-loss'");
    expect(monthly).toContain("'premium-state-breakeven'");
  });

  it('uses semantic-card for standalone Trading Performance KPI state', () => {
    const trading = readRelative('./reports/TradingPerformanceReport.tsx');

    expect(
      trading.match(
        /premium-card premium-semantic-card premium-hierarchy-h4 premium-report-kpi/g,
      )?.length,
    ).toBe(4);
  });

  it('does not reinterpret cash operations or directory trend accents as portfolio PnL halos', () => {
    const cash = readRelative('./CashBalanceView.tsx');
    const directory = readRelative('./TickerDirectoryView.tsx');

    expect(cash).not.toContain('premium-semantic-record');
    expect(cash).not.toContain('premium-glow-win');
    expect(cash).not.toContain('premium-glow-loss');

    expect(directory).not.toContain('premium-semantic-record');
    expect(directory).not.toContain('premium-glow-win');
    expect(directory).not.toContain('premium-glow-loss');
  });

  it('keeps semantic edge additive instead of replacing the host aura', () => {
    const css = readRelative('../index.css');
    const start = css.indexOf('Additive semantic edge — aura/glass remain untouched');
    expect(start).toBeGreaterThanOrEqual(0);

    const edge = css.slice(start);
    expect(edge).toContain('.premium-semantic-edge::after');
    expect(edge).not.toMatch(/\.premium-semantic-edge\s*\{[^}]*box-shadow:/s);
    expect(edge).not.toMatch(/\.premium-semantic-edge\s*\{[^}]*background:/s);
  });

  it('keeps chart behavior and Phase 9 Header outside semantic work', () => {
    const chart = readRelative('./charts/PerformanceTimeframeChart.tsx');
    const phase9 = readRelative('../../docs/PHASE9_HEADER_NAVIGATION_PLAN.md');

    expect(chart).toContain('weeklyLineInterpolator');
    expect(chart).toContain('TODAY_RESOLUTIONS');
    expect(chart).toContain('TIMEFRAMES');
    expect(phase9).toContain('PHASE 9 SOURCE-FROZEN');
  });
});
