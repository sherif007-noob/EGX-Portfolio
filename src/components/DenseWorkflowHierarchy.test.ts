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

  it('keeps semantic atmosphere on dense records while preserving the stronger edge cue', () => {
    const css = readRelative('../index.css');
    expect(css).toContain('Phase 8 semantic-soul correction');
    expect(css).toContain('.premium-dense-row.premium-hierarchy-h5:is(');
    expect(css).toContain('inset 3px 0 0 rgb(var(--premium-semantic-rgb)');
    expect(css).toContain('0 0 20px rgb(var(--premium-semantic-rgb)');
    expect(css).toContain('0 0 var(--premium-semantic-far-radius) rgb(var(--premium-semantic-deep-rgb)');
  });
});
