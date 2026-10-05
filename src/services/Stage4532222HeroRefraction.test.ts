import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.5.3.2.2.2.2 Overview hero neutral refraction ownership', () => {
  it('moves only the Overview hero neutral refraction role into materials.css', () => {
    const materials = read('src/styles/materials.css');
    const legacy = read('src/index.css');

    const rule = `.premium-overview-hero.premium-hero-card {
  --premium-refraction-shadow: var(--premium-refraction-tier-hero);
}`;

    expect(materials).toContain(rule);
    expect(legacy).not.toContain(rule);
    expect(legacy).toContain(
      'Stage 4.5.3.2.2.2.2: Overview hero neutral refraction role moved to ./styles/materials.css.',
    );
  });

  it('keeps the remaining hierarchy-card material bundle unlayered', () => {
    const legacy = read('src/index.css');
    const materials = read('src/styles/materials.css');

    for (const marker of [
      '.premium-card.premium-hierarchy-h1,\n.premium-card.premium-hierarchy-h2,',
      '.premium-card.premium-hierarchy-h1::before,',
      '.premium-card.premium-hierarchy-h1.premium-material-tone-cyan,',
      '.premium-card.premium-hierarchy-h1:hover,',
      '@media (max-width: 767px) {\n  /* Keep aura visible on touch devices; only motion/hover is omitted. */',
    ]) {
      expect(legacy).toContain(marker);
    }

    expect(materials).not.toContain('/* Phase 8 hierarchy card material */');
    expect(materials).not.toContain('/* explicit material-tone hierarchy cards */');
    expect(materials).not.toContain('/* Phase 8 neutral card hover material */');
  });

  it('does not alter semantic hero ownership', () => {
    const legacy = read('src/index.css');
    const materials = read('src/styles/materials.css');

    expect(legacy).toContain('.premium-overview-hero.premium-hero-card.premium-glow-win');
    expect(materials).not.toContain('.premium-overview-hero.premium-hero-card.premium-glow-win');
    expect(materials).not.toContain('.premium-glow-loss');
  });
});
