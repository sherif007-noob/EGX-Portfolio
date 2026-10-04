import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildDataHealthSnapshot, getExpectedEgxSessionDate } from './dataHealth';

const root = path.resolve(__dirname, '..', '..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const completeRows = {
  portfolio: {
    updated_at: '2026-10-05T09:00:00.000Z',
    last_price_write_at: '2026-10-05T09:00:00.000Z',
  },
  quotes: [
    { ticker: 'AAA', last_price: 10, price_updated_at: '2026-10-05T09:00:00.000Z' },
    { ticker: 'BBB', last_price: 20, price_updated_at: '2026-10-05T09:00:00.000Z' },
  ],
  raw1m: [
    { ticker: 'AAA', bar_timestamp: '2026-10-05T09:00:00.000Z', retrieved_at: '2026-10-05T09:00:30.000Z' },
    { ticker: 'BBB', bar_timestamp: '2026-10-05T09:00:00.000Z', retrieved_at: '2026-10-05T09:00:30.000Z' },
  ],
  derived5m: [
    { ticker: 'AAA', bar_timestamp: '2026-10-05T09:00:00.000Z', retrieved_at: '2026-10-05T09:00:40.000Z' },
    { ticker: 'BBB', bar_timestamp: '2026-10-05T09:00:00.000Z', retrieved_at: '2026-10-05T09:00:40.000Z' },
  ],
  daily: [
    { ticker: 'AAA', trading_date: '2026-10-05', retrieved_at: '2026-10-05T12:30:00.000Z' },
    { ticker: 'BBB', trading_date: '2026-10-05', retrieved_at: '2026-10-05T12:30:00.000Z' },
  ],
  registry: [
    { ticker: 'AAA', status: 'active', scanner_symbol: 'AAA', history_symbol: 'AAA', verification_error: null },
    { ticker: 'BBB', status: 'active', scanner_symbol: 'BBB', history_symbol: 'BBB', verification_error: null },
  ],
};

describe('Stage 3.6 Data Health Center', () => {
  it('selects the current trading date after EGX open and the previous trading date before open', () => {
    expect(getExpectedEgxSessionDate(new Date('2026-10-05T08:30:00.000Z'))).toBe('2026-10-05');
    expect(getExpectedEgxSessionDate(new Date('2026-10-05T05:30:00.000Z'))).toBe('2026-10-04');
    expect(getExpectedEgxSessionDate(new Date('2026-10-03T12:00:00.000Z'))).toBe('2026-10-01');
  });

  it('reports a fully aligned held universe as healthy', () => {
    const snapshot = buildDataHealthSnapshot(
      ['AAA', 'BBB'],
      completeRows,
      new Date('2026-10-05T09:05:00.000Z'),
      'abcdef12',
    );

    expect(snapshot.overallStatus).toBe('healthy');
    expect(snapshot.selectedSessionDate).toBe('2026-10-05');
    expect(snapshot.items.find((item) => item.id === 'raw_1m')?.value).toBe('2 / 2 covered');
    expect(snapshot.items.find((item) => item.id === 'derived_5m')?.value).toBe('2 / 2 aligned');
    expect(snapshot.items.find((item) => item.id === 'ticker_resolution')?.value).toBe('2 / 2 resolved');
    expect(snapshot.items.find((item) => item.id === 'app_build')?.value).toBe('abcdef12');
  });

  it('surfaces the exact Stage 3.5 failure mode instead of treating an older complete session as healthy', () => {
    const staleRows = {
      ...completeRows,
      raw1m: completeRows.raw1m.map((row) => ({
        ...row,
        bar_timestamp: row.bar_timestamp.replace('2026-10-05', '2026-10-04'),
        retrieved_at: row.retrieved_at.replace('2026-10-05', '2026-10-04'),
      })),
      derived5m: completeRows.derived5m.map((row) => ({
        ...row,
        bar_timestamp: row.bar_timestamp.replace('2026-10-05', '2026-10-04'),
        retrieved_at: row.retrieved_at.replace('2026-10-05', '2026-10-04'),
      })),
    };

    const snapshot = buildDataHealthSnapshot(
      ['AAA', 'BBB'],
      staleRows,
      new Date('2026-10-05T09:05:00.000Z'),
      'abcdef12',
    );

    expect(snapshot.overallStatus).toBe('warning');
    expect(snapshot.items.find((item) => item.id === 'selected_session')?.status).toBe('warning');
    expect(snapshot.items.find((item) => item.id === 'last_ingestion')?.status).toBe('warning');
    expect(snapshot.items.find((item) => item.id === 'selected_session')?.detail).toContain('Expected 2026-10-05');
  });

  it('keeps the Stage 3.6 surface inside the frozen Header and modal contracts', () => {
    const app = read('src/App.tsx');
    const header = read('src/components/Header.tsx');
    const modal = read('src/components/DataHealthCenterModal.tsx');
    const vite = read('vite.config.ts');

    expect(app).toContain('DataHealthCenterModal');
    expect(app).toContain('setIsDataHealthModalOpen(true)');
    expect(header).toContain('id="header-settings-btn"');
    expect(header).toContain('title="Data Health Center & diagnostics"');
    expect(modal).toContain('premium-modal-backdrop');
    expect(modal).toContain('premium-modal-viewport');
    expect(vite).toContain('VITE_BUILD_COMMIT');
  });
});
