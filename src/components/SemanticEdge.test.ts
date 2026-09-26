import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Additive semantic edge', () => {
  it('adds the edge to transaction, open-position and closed-cycle cards', () => {
    const positions = readRelative('./PositionsTable.tsx');
    const cycles = readRelative('./ClosedCyclesView.tsx');
    const journal = readRelative('./TradingJournal.tsx');

    expect(positions).toContain('premium-card premium-semantic-edge premium-hierarchy-h5 premium-dense-row');
    expect(cycles).toContain('premium-card premium-semantic-edge premium-hierarchy-h5 premium-dense-row');
    expect(journal).toContain('premium-card premium-semantic-edge premium-hierarchy-h5 premium-dense-row');
  });

  it('adds the edge to Monthly Performance audit cards using report tone', () => {
    const monthly = readRelative('./reports/MonthlyPerformanceReport.tsx');
    expect(monthly).toContain('premium-semantic-edge premium-report-semantic-edge');
  });

  it('implements the edge as an additive pseudo-element without replacing host glow', () => {
    const css = readRelative('../index.css');
    const start = css.indexOf('Additive semantic edge — aura/glass remain untouched');
    expect(start).toBeGreaterThanOrEqual(0);

    const block = css.slice(start);
    expect(block).toContain('.premium-semantic-edge::after');
    expect(block).toContain('--premium-edge-rgb: var(--premium-semantic-rgb');
    expect(block).toContain('--premium-edge-rgb: var(--premium-report-hero-rgb');
    expect(block).toContain('border-radius: inherit');
    expect(block).toContain('border: 3px solid rgb(var(--premium-edge-rgb) / 0.96)');
    expect(block).toContain('-webkit-mask-image: linear-gradient(');
    expect(block).toContain('transparent 43%');
    expect(block).not.toMatch(/\.premium-semantic-edge\s*\{[^}]*box-shadow:/s);
    expect(block).not.toMatch(/\.premium-semantic-edge\s*\{[^}]*background:/s);
  });
});
