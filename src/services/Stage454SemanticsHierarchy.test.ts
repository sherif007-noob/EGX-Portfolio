import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.5.4 semantics + hierarchy ownership', () => {
  it('keeps named owner order and attaches the neutral important fallback unlayered', () => {
    const entry = read('src/styles/index.css');

    const materials = entry.indexOf('@import "./materials.css" layer(egx-materials);');
    const semantics = entry.indexOf('@import "./semantics.css" layer(egx-semantics);');
    const hierarchy = entry.indexOf('@import "./hierarchy.css" layer(egx-hierarchy);');
    const bridge = entry.indexOf('@import "./cascade-bridge.css";');

    expect(materials).toBeGreaterThanOrEqual(0);
    expect(semantics).toBeGreaterThan(materials);
    expect(hierarchy).toBeGreaterThan(semantics);
    expect(bridge).toBeGreaterThan(hierarchy);
  });

  it('isolates the neutral important background below layered tone and semantic owners', () => {
    const materials = read('src/styles/materials.css');
    const semantics = read('src/styles/semantics.css');
    const hierarchy = read('src/styles/hierarchy.css');
    const bridge = read('src/styles/cascade-bridge.css');

    expect(bridge).toContain('rgba(10, 18, 36, 0.54) !important;');
    expect(bridge).not.toContain('.premium-glow-win');
    expect(bridge).not.toContain('.premium-material-tone-cyan');

    expect(materials).toContain('.premium-card.premium-hierarchy-h1.premium-material-tone-cyan,');
    expect(materials).toContain('rgba(12, 20, 39, 0.56) !important;');
    expect(materials).not.toContain('.premium-card.premium-hierarchy-h1.premium-glow-win');

    expect(semantics).toContain('.premium-card.premium-hierarchy-h1.premium-glow-win,');
    expect(semantics).toContain('rgba(12, 20, 39, 0.58) !important;');
    expect(semantics).not.toContain('.premium-material-tone-cyan');

    expect(hierarchy).not.toContain('rgba(10, 18, 36, 0.54)');
    expect(hierarchy).not.toContain('radial-gradient(');
    expect(hierarchy).not.toContain('.premium-glow-win');
    expect(hierarchy).not.toContain('.premium-material-tone-cyan');
  });

  it('moves canonical hierarchy and semantic presentation out of the legacy stylesheet', () => {
    const legacy = read('src/index.css');
    const semantics = read('src/styles/semantics.css');
    const hierarchy = read('src/styles/hierarchy.css');

    expect(legacy).not.toContain('/* Typography hierarchy only. */');
    expect(legacy).not.toContain('Additive semantic edge — aura/glass remain untouched');
    expect(legacy).not.toContain('.premium-card.premium-hierarchy-h1.premium-glow-win,');

    expect(hierarchy).toContain('/* Typography hierarchy only. */');
    expect(hierarchy).toContain('.premium-type-page-title {');
    expect(hierarchy).toContain('.premium-flow-major {');

    expect(semantics).toContain('Phase 5 canonical semantic halo system');
    expect(semantics).toContain('Additive semantic edge — aura/glass remain untouched');
    expect(semantics).toContain('.premium-semantic-card {');
  });

  it('leaves generic motion and responsive hierarchy work for later compressed passes', () => {
    const legacy = read('src/index.css');

    expect(legacy).toContain('.premium-card:hover {\n  transform: translateY(-2px);');
    expect(legacy).toContain('Interaction-only semantic transitions remain here until Stage 4.5.5.');
    expect(legacy).toContain('@media (max-width: 767px) {\n  :root {\n    --hierarchy-space-card: 0.875rem;');
    expect(legacy).toContain('Pass 8.6 — narrow-phone hierarchy guard.');
  });
});
