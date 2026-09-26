import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 8.4.3 dense workflow typography migration', () => {
  it('keeps dense records compact while applying canonical labels, metrics and metadata', () => {
    const files = [
      readRelative('./PositionsTable.tsx'),
      readRelative('./ClosedCyclesView.tsx'),
      readRelative('./TradingJournal.tsx'),
      readRelative('./CashBalanceView.tsx'),
      readRelative('./TickerDirectoryView.tsx'),
    ];

    for (const source of files) {
      expect(source).toContain('premium-type-metric-dense');
    }

    expect(files[0]).toContain('premium-type-metric-label');
    expect(files[1]).toContain('premium-type-metric-secondary');
    expect(files[2]).toContain('premium-type-unit');
    expect(files[3]).toContain('premium-type-metric-primary');
    expect(files[4]).toContain('premium-type-metadata');
  });

  it('normalizes the main workflow headings without adding a new typography role', () => {
    const cycles = readRelative('./ClosedCyclesView.tsx');
    const journal = readRelative('./TradingJournal.tsx');
    const cash = readRelative('./CashBalanceView.tsx');
    const directory = readRelative('./TickerDirectoryView.tsx');

    expect(cycles).toContain('premium-type-section-title');
    expect(journal).toContain('premium-type-section-title');
    expect(cash).toContain('premium-type-section-title');
    expect(directory).toContain('premium-type-section-title');
  });

  it('does not touch the accepted material, aura or semantic-edge CSS', () => {
    const css = readRelative('../index.css');
    expect(css).toContain('Pass 8.3b: intensified resting aura/glow');
    expect(css).toContain('Additive semantic edge — aura/glass remain untouched');
    expect(css).toContain('0 0 48px rgb(var(--premium-semantic-rgb) / 0.34)');
    expect(css).toContain('border-radius: inherit');
  });
});
