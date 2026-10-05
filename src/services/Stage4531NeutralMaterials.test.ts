import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

const stripComments = (value: string) =>
  value.replace(/\/\*[\s\S]*?\*\//g, '').trim();

describe('Stage 4.5.3.1 neutral material primitive extraction', () => {
  it('keeps the shared neutral material primitives in the material owner', () => {
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
  });

  it('keeps primitive owners drained from the legacy stylesheet', () => {
    const legacy = read('src/index.css');

    expect(legacy).not.toContain('.premium-surface,\n.premium-card,\n.premium-glass {');
    expect(legacy).not.toContain('.premium-surface {');
    expect(legacy).not.toContain('.premium-glass {');
    expect(legacy).toContain('Stage 4.5.3.1: panel material moved to ./styles/materials.css.');
  });

  it('advances Phase 8 hierarchy restoration into canonical owners', () => {
    const legacy = read('src/index.css');
    const materials = read('src/styles/materials.css');
    const semantics = read('src/styles/semantics.css');
    const bridge = read('src/styles/cascade-bridge.css');

    expect(legacy).toContain('Phase 8 material restoration — Monthly Report quality reference');
    expect(materials).toContain('.premium-card.premium-hierarchy-h1::before');
    expect(materials).toContain('.premium-card.premium-hierarchy-h1.premium-material-tone-cyan');
    expect(materials).toContain('.premium-card.premium-hierarchy-h1:hover');
    expect(semantics).toContain('.premium-card.premium-hierarchy-h1.premium-glow-win');
    expect(bridge).toContain('rgba(10, 18, 36, 0.54) !important;');
  });

  it('keeps material ownership free of semantic/control/motion implementation', () => {
    const materials = read('src/styles/materials.css');
    expect(materials).not.toContain('.premium-glow-win');
    expect(materials).not.toContain('.premium-state-loss');
    expect(materials).not.toContain('.premium-action {');
    expect(materials).not.toContain('@keyframes');

    expect(stripComments(read('src/styles/semantics.css'))).not.toBe('');
    expect(stripComments(read('src/styles/hierarchy.css'))).not.toBe('');
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
