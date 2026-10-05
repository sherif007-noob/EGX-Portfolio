import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

const stripComments = (value: string) =>
  value.replace(/\/\*[\s\S]*?\*\//g, '').trim();

describe('Stage 4.5.3.2.1 Reports + dense-data material ownership', () => {
  it('moves canonical table-shell material out of the legacy stylesheet', () => {
    const materials = read('src/styles/materials.css');
    const legacy = read('src/index.css');

    expect(materials).toContain('.premium-table-shell {');
    expect(materials).toContain('.premium-table-shell thead {');
    expect(materials).toContain('.premium-table-shell tbody tr:hover {');

    expect(legacy).not.toContain('.premium-table-shell {\n  border: 1px solid var(--premium-border);');
    expect(legacy).not.toContain('.premium-table-shell thead {');
    expect(legacy).not.toContain('.premium-table-shell tbody tr:hover {');

    // Motion ownership is not pulled forward with the material.
    expect(legacy).toContain('.premium-table-shell tbody tr {\n  transition:');
  });

  it('moves Reports glass/table material and its mobile material overrides', () => {
    const materials = read('src/styles/materials.css');
    const legacy = read('src/index.css');

    for (const selector of [
      '.premium-report-glass {',
      '.premium-report-glass-soft {',
      '.premium-report-table {',
      '.premium-report-table thead {',
      '.premium-report-table tbody tr {',
      '.premium-report-table tbody tr:hover {',
    ]) {
      expect(materials).toContain(selector);
    }

    expect(materials).toContain('@media (max-width: 767px) {\n  .premium-report-glass {');
    expect(materials).toContain('backdrop-filter: blur(26px) saturate(155%)');

    expect(legacy).toContain('Stage 4.5.3.2.1: reports glass base moved to ./styles/materials.css.');
    expect(legacy).toContain('Stage 4.5.3.2.1: reports mobile material overrides moved to ./styles/materials.css.');
    expect(legacy).not.toContain('/* Reports & Performance glass hierarchy */\n.premium-report-glass {');
  });

  it('keeps report-soft and the shared soft composite material under the material owner', () => {
    const materials = read('src/styles/materials.css');
    const legacy = read('src/index.css');

    expect(materials).toContain('/* reports soft-glass stronger override */');
    expect(materials).toContain('.premium-report-glass-soft {\n  background:');
    expect(materials).toContain('.premium-subpanel,\n.premium-inset-glass,\n.premium-form-section,\n.premium-modal-section {');
    expect(legacy).not.toContain('.premium-report-glass-soft,\n.premium-subpanel,');
  });

  it('keeps controls and semantic aura out of the material owner', () => {
    const legacy = read('src/index.css');
    const materials = read('src/styles/materials.css');

    expect(legacy).toContain('.premium-action {');
    expect(legacy).toContain('.premium-field {');
    expect(legacy).toContain('.premium-card.premium-hierarchy-h1.premium-glow-win');

    expect(materials).toContain('.premium-report-summary-band {');
    expect(materials).toContain('.premium-dropdown {');
    expect(materials).toContain('.premium-modal {');
    expect(materials).not.toContain('.premium-action {');
    expect(materials).not.toContain('.premium-field {');
    expect(materials).not.toContain('.premium-glow-win');
    expect(materials).not.toContain('.premium-state-loss');
  });

  it('keeps later ownership modules empty until their dedicated passes', () => {
    for (const path of [
      'src/styles/semantics.css',
      'src/styles/hierarchy.css',
      'src/styles/controls.css',
      'src/styles/overlays.css',
      'src/styles/motion.css',
      'src/styles/responsive.css',
      'src/styles/features/index.css',
    ]) {
      expect(stripComments(read(path))).toBe('');
    }
  });
});
