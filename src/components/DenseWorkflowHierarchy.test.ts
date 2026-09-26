import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 8.3 dense workflow hierarchy', () => {
  it('maps Open Positions to context -> H4 controls -> H5 data', () => {
    const source = readRelative('./PositionsTable.tsx');
    expect(source).toContain('premium-dense-context');
    expect(source).toContain('premium-hierarchy-h4 premium-dense-toolbar');
    expect(source).toContain('premium-hierarchy-h5 premium-dense-data');
    expect(source).toContain('premium-hierarchy-h5 premium-dense-row');
  });

  it('keeps Closed Cycles and Transactions summaries above H4 controls and H5 records', () => {
    const cycles = readRelative('./ClosedCyclesView.tsx');
    const journal = readRelative('./TradingJournal.tsx');

    for (const source of [cycles, journal]) {
      expect(source).toContain('premium-dense-workflow');
      expect(source).toContain('premium-dense-summary');
      expect(source).toContain('premium-hierarchy-h4 premium-dense-toolbar');
      expect(source).toContain('premium-hierarchy-h5 premium-dense-row');
    }
  });

  it('separates Cash summary/accounting surfaces from the H5 ledger', () => {
    const cash = readRelative('./CashBalanceView.tsx');
    expect(cash).toContain('premium-hierarchy-h2 premium-dense-summary');
    expect(cash).toContain('premium-hierarchy-h3 premium-dense-summary-card');
    expect(cash).toContain('premium-hierarchy-h5 premium-dense-data');
  });

  it('keeps Ticker Directory controls quiet and repeated ticker cards dense', () => {
    const directory = readRelative('./TickerDirectoryView.tsx');
    expect(directory).toContain('premium-hierarchy-h3 premium-dense-summary');
    expect(directory).toContain('premium-hierarchy-h4 premium-dense-toolbar');
    expect(directory).toContain('premium-hierarchy-h5 premium-dense-row');
  });

  it('keeps the full semantic halo on dense cards instead of replacing it with edge-only coding', () => {
    const css = readRelative('../index.css');
    const start = css.indexOf('Phase 8 protected visual-language restoration');
    const protectedSection = css.slice(start);

    expect(protectedSection).toContain('.premium-card.premium-dense-row.premium-glow-win');
    expect(protectedSection).toContain('inset 3px 0 0 rgb(var(--premium-semantic-rgb)');
    expect(protectedSection).toContain('0 0 34px rgb(var(--premium-semantic-rgb)');
    expect(protectedSection).toContain('--premium-semantic-far-radius: 76px');
  });
});
