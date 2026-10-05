import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.5.3.2.2.2.2 Overview hero neutral refraction ownership', () => {
  it('keeps the Overview hero neutral refraction role in materials.css', () => {
    const materials = read('src/styles/materials.css');
    const legacy = read('src/index.css');

    const rule = `.premium-overview-hero.premium-hero-card {
  --premium-refraction-shadow: var(--premium-refraction-tier-hero);
}`;

    expect(materials).toContain(rule);
    expect(legacy).not.toContain(rule);
  });

  it('advances the remaining hierarchy-card material bundle into 4.5.4 owners', () => {
    const materials = read('src/styles/materials.css');
    const bridge = read('src/styles/cascade-bridge.css');

    expect(materials).toContain('.premium-card.premium-hierarchy-h1::before,');
    expect(materials).toContain('.premium-card.premium-hierarchy-h1.premium-material-tone-cyan,');
    expect(materials).toContain('.premium-card.premium-hierarchy-h1:hover,');
    expect(bridge).toContain('rgba(10, 18, 36, 0.54) !important;');
    expect(materials).toContain('Stage 4.5.3 compressed closure — safe mobile neutral material overrides.');
  });

  it('moves semantic hero ownership to semantics without contaminating materials', () => {
    const semantics = read('src/styles/semantics.css');
    const materials = read('src/styles/materials.css');

    expect(semantics).toContain('.premium-overview-hero.premium-hero-card.premium-glow-win');
    expect(materials).not.toContain('.premium-overview-hero.premium-hero-card.premium-glow-win');
    expect(materials).not.toContain('.premium-glow-loss');
  });
});
