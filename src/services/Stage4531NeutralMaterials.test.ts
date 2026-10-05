import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

const stripComments = (value: string) =>
  value.replace(/\/\*[\s\S]*?\*\//g, '').trim();

describe('Stage 4.5.3.1 neutral material primitive extraction', () => {
  it('moves the shared neutral material primitives into the material owner', () => {
    const materials = read('src/styles/materials.css');

    for (const selector of [
      '.premium-surface,\n.premium-card,\n.premium-glass {',
      '.premium-surface {',
      '.premium-glass {',
      '.premium-panel {',
      '.premium-subpanel {',
      '.premium-inset-glass {',
      '.premium-refraction {',
      '.premium-refraction-hero {',
      '.premium-refraction-overlay {',
      '.premium-surface,\n.premium-glass,\n.premium-card,\n.premium-panel,\n.premium-report-glass {',
      '.premium-subpanel,\n.premium-inset-glass,\n.premium-report-glass-soft,\n.premium-form-section,\n.premium-modal-section {',
      '.premium-hero-card,\n.premium-hero-metric,\n.premium-report-hero {',
      '.premium-modal,\n.premium-dropdown,\n.premium-floating {',
    ]) {
      expect(materials).toContain(selector);
    }

    expect(materials).toContain('var(--premium-refraction-shadow, 0 0 0 transparent)');
    expect(materials).toContain('backdrop-filter: blur(24px) saturate(155%)');
    expect(materials).toContain('--premium-refraction-shadow: var(--premium-refraction-tier-primary)');
    expect(materials).toContain('--premium-refraction-shadow: var(--premium-refraction-tier-secondary)');
    expect(materials).toContain('--premium-refraction-shadow: var(--premium-refraction-tier-hero)');
    expect(materials).toContain('--premium-refraction-shadow: var(--premium-refraction-tier-overlay)');
  });

  it('removes those primitive owners from the legacy stylesheet', () => {
    const legacy = read('src/index.css');

    expect(legacy).not.toContain('.premium-surface,\n.premium-card,\n.premium-glass {');
    expect(legacy).not.toContain('.premium-surface {');
    expect(legacy).not.toContain('.premium-glass {');

    expect(legacy).not.toMatch(/\/\* Premium pass 2:[\s\S]*?\.premium-panel\s*\{/);
    expect(legacy).toContain('Stage 4.5.3.1: panel material moved to ./styles/materials.css.');
    expect(legacy).toContain('Stage 4.5.3.1: inset glass material moved to ./styles/materials.css.');
    expect(legacy).toContain('Stage 4.5.3.1: refraction primary primitive moved to ./styles/materials.css.');
  });

  it('keeps the cascade-sensitive Phase 8 card restoration in legacy', () => {
    const legacy = read('src/index.css');

    expect(legacy).toContain('Phase 8 material restoration — Monthly Report quality reference');
    expect(legacy).toContain('.premium-card.premium-hierarchy-h1,');
    expect(legacy).toContain('.premium-card.premium-hierarchy-h1::before');
    expect(legacy).toContain('.premium-card.premium-hierarchy-h1.premium-material-tone-cyan');
    expect(legacy).toContain('.premium-card.premium-hierarchy-h1:hover');
    expect(legacy).toContain('@media (max-width: 767px) {');
  });

  it('does not move semantic, hierarchy, control, overlay, motion, or responsive ownership early', () => {
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

    const materials = read('src/styles/materials.css');
    expect(materials).not.toContain('.premium-glow-win');
    expect(materials).not.toContain('.premium-state-loss');
    expect(materials).not.toContain('.premium-action {');
    expect(materials).not.toContain('@keyframes');
  });

  it('keeps the canonical material layer directly after tokens', () => {
    const entry = read('src/styles/index.css');
    const tokens = entry.indexOf('@import "./tokens.css" layer(egx-tokens);');
    const materials = entry.indexOf('@import "./materials.css" layer(egx-materials);');
    const semantics = entry.indexOf('@import "./semantics.css" layer(egx-semantics);');

    expect(tokens).toBeGreaterThan(-1);
    expect(materials).toBeGreaterThan(tokens);
    expect(semantics).toBeGreaterThan(materials);
  });
});
