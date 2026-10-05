import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.5.3.2.1 Reports + dense-data material ownership', () => {
  it('keeps canonical table/report glass material in materials.css', () => {
    const materials = read('src/styles/materials.css');
    for (const selector of [
      '.premium-table-shell {',
      '.premium-table-shell thead {',
      '.premium-table-shell tbody tr:hover {',
      '.premium-report-glass {',
      '.premium-report-glass-soft {',
      '.premium-report-table {',
      '.premium-report-table thead {',
      '.premium-report-table tbody tr {',
    ]) expect(materials).toContain(selector);
  });

  it('keeps report/table transition choreography in motion.css', () => {
    const motion = read('src/styles/motion.css');
    expect(motion).toContain('.premium-table-shell tbody tr');
    expect(motion).toContain('.premium-report-table tbody tr');
  });

  it('keeps report-specific structural/hero residue in the report feature owner', () => {
    const reports = read('src/styles/features/reports.css');
    expect(reports).toContain('.report-benchmark-table');
    expect(reports).toContain('.premium-report-hero-card');
    expect(reports).toContain('.premium-month-audit-shell');
  });

  it('keeps final interaction/responsive/feature owners populated', () => {
    for (const path of [
      'src/styles/controls.css',
      'src/styles/overlays.css',
      'src/styles/motion.css',
      'src/styles/responsive.css',
      'src/styles/features/index.css',
    ]) expect(read(path).trim()).not.toBe('');
  });
});
