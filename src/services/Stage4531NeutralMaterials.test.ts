import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.5.3.1 neutral material primitive extraction', () => {
  it('keeps shared neutral primitives in materials.css', () => {
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
    ]) expect(materials).toContain(selector);
    expect(materials).toContain('var(--premium-refraction-shadow, 0 0 0 transparent)');
  });

  it('keeps Phase 8 material, semantic and important-fallback ownership separate', () => {
    const materials = read('src/styles/materials.css');
    const semantics = read('src/styles/semantics.css');
    const bridge = read('src/styles/cascade-bridge.css');
    expect(materials).toContain('.premium-card.premium-hierarchy-h1::before');
    expect(materials).toContain('.premium-card.premium-hierarchy-h1.premium-material-tone-cyan');
    expect(materials).toContain('.premium-card.premium-hierarchy-h1:hover');
    expect(semantics).toContain('.premium-card.premium-hierarchy-h1.premium-glow-win');
    expect(bridge).toContain('rgba(10, 18, 36, 0.54) !important;');
  });

  it('keeps material ownership free of financial semantics, controls and keyframes', () => {
    const materials = read('src/styles/materials.css');
    expect(materials).not.toContain('.premium-glow-win');
    expect(materials).not.toContain('.premium-state-loss');
    expect(materials).not.toContain('.premium-action {');
    expect(materials).not.toContain('@keyframes');
  });

  it('leaves no material declarations in the legacy entry', () => {
    expect(read('src/index.css').trim()).toBe('@import "tailwindcss";\n@import "./styles/index.css";');
  });
});
