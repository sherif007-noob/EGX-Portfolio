import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

const hierarchySelector = `.premium-card.premium-hierarchy-h1,
.premium-card.premium-hierarchy-h2,
.premium-card.premium-hierarchy-h3,
.premium-card.premium-hierarchy-h4,
.premium-card.premium-hierarchy-h5`;

describe('Stage 4.5.3.2.2.2.5 cascade-safe hierarchy shell ownership', () => {
  it('keeps hierarchy custom properties and desktop backdrop material in materials.css', () => {
    const materials = read('src/styles/materials.css');

    const expected = `${hierarchySelector} {
  --phase8-material-rgb: var(--premium-material-rgb, 56 189 248);
  --phase8-material-deep-rgb: var(--premium-material-deep-rgb, 37 99 235);
  --premium-refraction-shadow: var(--premium-refraction-tier-primary);
  -webkit-backdrop-filter: blur(24px) saturate(155%) brightness(1.025);
  backdrop-filter: blur(24px) saturate(155%) brightness(1.025);
}`;

    expect(materials).toContain(expected);
  });

  it('advances the old unlayered bridge into material frame plus neutral important fallback', () => {
    const materials = read('src/styles/materials.css');
    const bridge = read('src/styles/cascade-bridge.css');
    const legacy = read('src/index.css');

    expect(materials).toContain('border-color: rgb(var(--phase8-material-rgb) / 0.30);');
    expect(materials).toContain('0 0 92px rgb(var(--phase8-material-deep-rgb) / 0.08)');
    expect(bridge).toContain('rgba(10, 18, 36, 0.54) !important;');

    expect(legacy).not.toContain('Stage 4.5.3.2.2.2.5 importance/interaction bridge.');
    expect(legacy).not.toContain('rgba(10, 18, 36, 0.54) !important;');
  });

  it('preserves explicit tone and financial semantic important precedence in their owners', () => {
    const materials = read('src/styles/materials.css');
    const semantics = read('src/styles/semantics.css');

    expect(materials).toContain('.premium-card.premium-hierarchy-h1.premium-material-tone-cyan,');
    expect(materials).toContain('rgba(12, 20, 39, 0.56) !important;');

    expect(semantics).toContain('.premium-card.premium-hierarchy-h1.premium-glow-win,');
    expect(semantics).toContain('.premium-card.premium-hierarchy-h1.premium-state-win,');
    expect(semantics).toContain('rgba(12, 20, 39, 0.58) !important;');
  });

  it('keeps Overview hero refraction after the safe shell inside egx-materials', () => {
    const materials = read('src/styles/materials.css');
    const shell = materials.indexOf('Stage 4.5.3.2.2.2.5 — hierarchy-card safe neutral shell');
    const overview = materials.indexOf('Stage 4.5.3.2.2.2.2 — Overview hero neutral refraction role');

    expect(shell).toBeGreaterThanOrEqual(0);
    expect(overview).toBeGreaterThan(shell);
  });

  it('documents the named-layer important-precedence hazard and explicit bridge solution', () => {
    const docs = read('docs/STAGE4_5_CSS_OWNERSHIP.md');
    const entry = read('src/styles/index.css');

    expect(docs).toContain('important-layer precedence');
    expect(docs).toContain('cascade-bridge.css');
    expect(entry).toContain('named-layer priority reverses for !important declarations');
    expect(entry).toContain('@import "./cascade-bridge.css";');
  });
});
