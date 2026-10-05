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
  it('moves only hierarchy custom properties and desktop backdrop material into materials.css', () => {
    const materials = read('src/styles/materials.css');

    const expected = `${hierarchySelector} {
  --phase8-material-rgb: var(--premium-material-rgb, 56 189 248);
  --phase8-material-deep-rgb: var(--premium-material-deep-rgb, 37 99 235);
  --premium-refraction-shadow: var(--premium-refraction-tier-primary);
  -webkit-backdrop-filter: blur(24px) saturate(155%) brightness(1.025);
  backdrop-filter: blur(24px) saturate(155%) brightness(1.025);
}`;

    expect(materials).toContain(expected);

    const start = materials.indexOf(expected);
    const body = materials.slice(start, start + expected.length);
    expect(body).not.toContain('background:');
    expect(body).not.toContain('border-color:');
    expect(body).not.toContain('box-shadow:');
    expect(body).not.toContain('!important');
  });

  it('keeps the important background and interaction-sensitive border/shadow bridge unlayered', () => {
    const legacy = read('src/index.css');

    const bridgeStart = legacy.indexOf('Stage 4.5.3.2.2.2.5 importance/interaction bridge.');
    expect(bridgeStart).toBeGreaterThanOrEqual(0);

    const selectorStart = legacy.indexOf(hierarchySelector, bridgeStart);
    const nextHighlight = legacy.indexOf('.premium-card.premium-hierarchy-h1::before,', selectorStart);
    const bridge = legacy.slice(selectorStart, nextHighlight);

    expect(bridge).toContain('border-color: rgb(var(--phase8-material-rgb) / 0.30);');
    expect(bridge).toContain('rgba(10, 18, 36, 0.54) !important;');
    expect(bridge).toContain('box-shadow:');
    expect(bridge).not.toContain('--phase8-material-rgb:');
    expect(bridge).not.toContain('--phase8-material-deep-rgb:');
    expect(bridge).not.toContain('-webkit-backdrop-filter:');
    expect(bridge).not.toContain('backdrop-filter:');
  });

  it('preserves semantic/tone important precedence by keeping those owners unlayered', () => {
    const legacy = read('src/index.css');
    const materials = read('src/styles/materials.css');

    expect(legacy).toContain('.premium-card.premium-hierarchy-h1.premium-glow-win');
    expect(legacy).toContain('.premium-card.premium-hierarchy-h1.premium-state-win');
    expect(legacy).toContain('.premium-card.premium-hierarchy-h1.premium-material-tone-cyan,');
    expect(legacy).toContain('background:');
    expect(legacy).toContain('rgba(12, 20, 39, 0.58) !important;');

    expect(materials).not.toContain('.premium-card.premium-hierarchy-h1.premium-glow-win');
    expect(materials).not.toContain('.premium-card.premium-hierarchy-h1.premium-state-win');
  });

  it('keeps Overview hero refraction after the safe shell inside egx-materials', () => {
    const materials = read('src/styles/materials.css');
    const shell = materials.indexOf('Stage 4.5.3.2.2.2.5 — hierarchy-card safe neutral shell');
    const overview = materials.indexOf('Stage 4.5.3.2.2.2.2 — Overview hero neutral refraction role');

    expect(shell).toBeGreaterThanOrEqual(0);
    expect(overview).toBeGreaterThan(shell);
  });

  it('documents the named-layer important-precedence hazard in the ownership gate', () => {
    const docs = read('docs/STAGE4_5_CSS_OWNERSHIP.md');
    expect(docs).toContain('important-layer precedence');
    expect(docs).toContain('background');
    expect(docs).toContain('4.5.3.2.2.2.5');
  });
});
