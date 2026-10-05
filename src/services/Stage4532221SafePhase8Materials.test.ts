import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

const stripComments = (value: string) =>
  value.replace(/\/\*[\s\S]*?\*\//g, '').trim();

describe('Stage 4.5.3.2.2.2.1 safe non-card Phase 8 material ownership', () => {
  it('moves the non-card Phase 8 material families into materials.css', () => {
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

  it('removes only those safe families from the legacy Phase 8 section', () => {
    const legacy = read('src/index.css');

    expect(legacy).toContain('Stage 4.5.3.2.2.2.1: material tone cyan moved to ./styles/materials.css.');
    expect(legacy).toContain('Stage 4.5.3.2.2.2.1: Phase 8 structural surface restoration moved to ./styles/materials.css.');
    expect(legacy).toContain('Stage 4.5.3.2.2.2.1: Phase 8 report summary material moved to ./styles/materials.css.');

    expect(legacy).not.toContain('.premium-overview-market-strip.premium-material-tone-cyan {');
    expect(legacy).not.toContain('.premium-report-summary-band {\n  border: 1px solid rgba(148, 163, 184, 0.18);');
  });

  it('leaves every cascade-sensitive hierarchy-card material block unlayered', () => {
    const legacy = read('src/index.css');
    const materials = read('src/styles/materials.css');

    for (const marker of [
      '.premium-card.premium-hierarchy-h1,\n.premium-card.premium-hierarchy-h2,',
      '.premium-card.premium-hierarchy-h1::before,',
      '.premium-card.premium-hierarchy-h1.premium-material-tone-cyan,',
      '.premium-card.premium-hierarchy-h1:hover,',
    ]) {
      expect(legacy).toContain(marker);
    }

    expect(materials).toContain('.premium-overview-hero.premium-hero-card {');
    expect(materials).toContain('--premium-refraction-shadow: var(--premium-refraction-tier-hero);');
    expect(materials).not.toContain('/* Phase 8 hierarchy card material */');
    expect(materials).not.toContain('/* explicit material-tone hierarchy cards */');
    expect(materials).not.toContain('/* Phase 8 neutral card hover material */');
    expect(materials).toContain('Stage 4.5.3 compressed closure — safe mobile neutral material overrides.');
    expect(materials).toContain('blur(22px) saturate(150%) brightness(1.025)');
  });

  it('keeps financial semantic Phase 8 rules in legacy', () => {
    const legacy = read('src/index.css');
    const materials = read('src/styles/materials.css');

    expect(legacy).toContain('.premium-card.premium-hierarchy-h1.premium-glow-win');
    expect(legacy).toContain('.premium-card.premium-hierarchy-h1.premium-state-win');
    expect(legacy).toContain('Phase 8 semantic hover parity — never dim a semantic card on hover.');
    expect(materials).not.toContain('.premium-glow-win');
    expect(materials).not.toContain('.premium-state-loss');
  });

  it('does not pull later ownership layers forward', () => {
    const materials = read('src/styles/materials.css');
    expect(materials).not.toContain('.premium-action {');
    expect(materials).not.toContain('.premium-field {');
    expect(materials).not.toContain('@keyframes');

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
