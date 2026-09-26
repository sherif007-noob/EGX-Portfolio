import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 8.4.4 canonical spacing rhythm', () => {
  it('defines a material-neutral spacing ladder and hierarchy padding helpers', () => {
    const css = readRelative('../index.css');
    const start = css.indexOf('Pass 8.4.4 — canonical spacing rhythm');
    const end = css.indexOf('/* Action importance only');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const block = css.slice(start, end);
    for (const token of [
      '.premium-flow-major',
      '.premium-flow-related',
      '.premium-flow-control',
      '.premium-gap-control',
      '.premium-gap-related',
      '.premium-pad-h1',
      '.premium-pad-h2',
      '.premium-pad-h3',
      '.premium-pad-h4',
      '.premium-pad-h5',
    ]) {
      expect(block).toContain(token);
    }

    expect(block).not.toMatch(/background:|box-shadow|border-color|backdrop-filter|filter:/);
  });

  it('applies major/related/control rhythm across Overview, Reports and dense workflows', () => {
    const overview = readRelative('./PortfolioSummary.tsx');
    const reports = readRelative('./PerformanceReports.tsx');
    const monthly = readRelative('./reports/MonthlyPerformanceReport.tsx');
    const trading = readRelative('./reports/TradingPerformanceReport.tsx');
    const positions = readRelative('./PositionsTable.tsx');
    const cycles = readRelative('./ClosedCyclesView.tsx');
    const journal = readRelative('./TradingJournal.tsx');
    const cash = readRelative('./CashBalanceView.tsx');
    const directory = readRelative('./TickerDirectoryView.tsx');

    expect(overview).toContain('premium-flow-related');
    expect(reports).toContain('premium-flow-major');
    expect(monthly).toContain('premium-flow-major');
    expect(trading).toContain('premium-flow-major');

    for (const source of [positions, cycles, journal, cash, directory]) {
      expect(source).toContain('premium-flow-related');
      expect(source).toContain('premium-pad-h');
    }
  });

  it('keeps accepted material, aura and semantic-edge recipes untouched', () => {
    const css = readRelative('../index.css');
    expect(css).toContain('Pass 8.3b: intensified resting aura/glow');
    expect(css).toContain('0 0 48px rgb(var(--premium-semantic-rgb) / 0.34)');
    expect(css).toContain('Additive semantic edge — aura/glass remain untouched');
    expect(css).toContain('border-radius: inherit');
  });
});
