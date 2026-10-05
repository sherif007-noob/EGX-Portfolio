import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.5.3.2.2.2.3 neutral hero-card material ownership', () => {
  it('moves the neutral hero-card body into materials.css without changing values', () => {
    const materials = read('src/styles/materials.css');
    const legacy = read('src/index.css');

    const rule = `.premium-hero-card {
  background:
    radial-gradient(circle at 18% -15%, rgba(16, 185, 129, 0.12), transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(34, 211, 238, 0.075), transparent 42%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.034), transparent 44%),
    rgba(15, 23, 42, 0.66);
  border-color: rgba(52, 211, 153, 0.16);
}`;

    expect(materials).toContain(rule);
    expect(legacy).not.toContain(rule);
    expect(legacy).toContain(
      'Stage 4.5.3.2.2.2.3: neutral hero-card material body moved to ./styles/materials.css.',
    );
  });

  it('keeps the cascade-sensitive hierarchy-card bundle unlayered', () => {
    const legacy = read('src/index.css');
    const materials = read('src/styles/materials.css');

    for (const marker of [
      '.premium-card.premium-hierarchy-h1::before,',
      '.premium-card.premium-hierarchy-h1.premium-material-tone-cyan,',
      '.premium-card.premium-hierarchy-h1:hover,',
      '@media (max-width: 767px) {\n  /* Keep aura visible on touch devices; only motion/hover is omitted. */',
    ]) {
      expect(legacy).toContain(marker);
    }
    expect(materials).toContain('.premium-card.premium-hierarchy-h1,\n.premium-card.premium-hierarchy-h2,');
    expect(legacy).toContain('Stage 4.5.3.2.2.2.4: hierarchy-card base material body moved to ./styles/materials.css.');
  });

  it('leaves generic hover and semantic hero ownership unlayered', () => {
    const legacy = read('src/index.css');
    const materials = read('src/styles/materials.css');

    expect(legacy).toContain('.premium-card:hover {');
    expect(legacy).toContain('.premium-card:hover::before {');
    expect(legacy).toContain('.premium-overview-hero.premium-hero-card.premium-glow-win');
    expect(materials).not.toContain('.premium-overview-hero.premium-hero-card.premium-glow-win');
  });
});
