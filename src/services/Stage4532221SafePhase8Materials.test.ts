import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

const stripComments = (value: string) =>
  value.replace(/\/\*[\s\S]*?\*\//g, '').trim();

describe('Stage 4.5.3.2.2.2.1 safe non-card Phase 8 material ownership', () => {
  it('keeps the accepted non-card Phase 8 material families in materials.css', () => {
    const materials = read('src/styles/materials.css');

    for (const marker of [
      '.premium-material-tone-cyan {',
      '.premium-material-tone-blue {',
      '.premium-material-tone-purple {',
      '.premium-material-tone-emerald {',
      '.premium-material-tone-rose {',
      '.premium-material-tone-amber {',
      '.premium-panel.premium-hierarchy-h2',
      '.premium-overview-market-strip.premium-material-tone-cyan {',
      '.premium-subpanel.premium-hierarchy-h4',
      '.premium-table-shell.premium-hierarchy-h5',
      '.premium-report-summary-band {',
      '.premium-report-structural.premium-hierarchy-h0',
    ]) {
      expect(materials).toContain(marker);
    }
  });

  it('keeps historical move markers while legacy declarations stay drained', () => {
    const legacy = read('src/index.css');

    expect(legacy).toContain('Stage 4.5.3.2.2.2.1: material tone cyan moved to ./styles/materials.css.');
    expect(legacy).toContain('Stage 4.5.3.2.2.2.1: Phase 8 structural surface restoration moved to ./styles/materials.css.');
    expect(legacy).toContain('Stage 4.5.3.2.2.2.1: Phase 8 report summary material moved to ./styles/materials.css.');
    expect(legacy).not.toContain('.premium-overview-market-strip.premium-material-tone-cyan {');
  });

  it('advances cascade-sensitive hierarchy material to the 4.5.4 contract', () => {
    const materials = read('src/styles/materials.css');
    const bridge = read('src/styles/cascade-bridge.css');

    expect(materials).toContain('.premium-card.premium-hierarchy-h1::before,');
    expect(materials).toContain('.premium-card.premium-hierarchy-h1.premium-material-tone-cyan,');
    expect(materials).toContain('.premium-card.premium-hierarchy-h1:hover,');
    expect(bridge).toContain('rgba(10, 18, 36, 0.54) !important;');
    expect(materials).toContain('blur(22px) saturate(150%) brightness(1.025)');
  });

  it('moves financial semantic Phase 8 rules to semantics, never materials', () => {
    const semantics = read('src/styles/semantics.css');
    const materials = read('src/styles/materials.css');

    expect(semantics).toContain('.premium-card.premium-hierarchy-h1.premium-glow-win');
    expect(semantics).toContain('.premium-card.premium-hierarchy-h1.premium-state-win');
    expect(semantics).toContain('Phase 8 semantic hover parity — never dim a semantic card on hover.');
    expect(materials).not.toContain('.premium-glow-win');
    expect(materials).not.toContain('.premium-state-loss');
  });

  it('advances interaction owners while responsive/feature closure remains deferred', () => {
    const materials = read('src/styles/materials.css');
    expect(materials).not.toContain('.premium-action {');
    expect(materials).not.toContain('.premium-field {');
    expect(materials).not.toContain('@keyframes');

    for (const path of [
      'src/styles/controls.css',
      'src/styles/overlays.css',
      'src/styles/motion.css',
      'src/styles/semantics.css',
      'src/styles/hierarchy.css',
    ]) {
      expect(stripComments(read(path))).not.toBe('');
    }

    for (const path of [
      'src/styles/responsive.css',
      'src/styles/features/index.css',
    ]) {
      expect(stripComments(read(path))).toBe('');
    }
  });
});
