import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.5.3.2.2.2.5 generic card hover material ownership', () => {
  it('moves hover material while leaving hover transform in the legacy motion owner', () => {
    const materials = read('src/styles/materials.css');
    const legacy = read('src/index.css');

    expect(legacy).toContain(`.premium-card:hover {
  transform: translateY(-2px);
}`);
    expect(legacy).toContain(
      'Stage 4.5.3.2.2.2.5: generic card hover material interaction moved to ./styles/materials.css.',
    );
    expect(materials).toContain(`.premium-card:hover {
  border-color: var(--premium-border-strong);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.07),
    0 24px 54px rgba(0, 0, 0, 0.34),
    0 0 28px rgba(34, 211, 238, 0.12),
    0 0 54px rgba(59, 130, 246, 0.07),
    var(--premium-refraction-shadow, 0 0 0 transparent);
}`);
    expect(materials).toContain(`.premium-card:hover::before {
  opacity: 0.62;
}`);
  });

  it('keeps generic hover material before the equal-specificity hierarchy-card body', () => {
    const materials = read('src/styles/materials.css');

    const hoverIndex = materials.indexOf('/* Stage 4.5.3.2.2.2.5 — generic card hover material interaction.');
    const hierarchyIndex = materials.indexOf('/* Stage 4.5.3.2.2.2.4 — hierarchy-card base material body. */');

    expect(hoverIndex).toBeGreaterThanOrEqual(0);
    expect(hierarchyIndex).toBeGreaterThan(hoverIndex);
  });

  it('does not pull the hierarchy highlight, hierarchy hover, explicit-tone body or semantics forward', () => {
    const legacy = read('src/index.css');
    const materials = read('src/styles/materials.css');

    for (const marker of [
      '.premium-card.premium-hierarchy-h1::before,',
      '.premium-card.premium-hierarchy-h1.premium-material-tone-cyan,',
      '.premium-card.premium-hierarchy-h1:hover,',
      '@media (max-width: 767px) {\n  /* Keep aura visible on touch devices; only motion/hover is omitted. */',
      '.premium-card.premium-hierarchy-h1.premium-glow-win',
      '.premium-card.premium-hierarchy-h1.premium-state-win',
    ]) {
      expect(legacy).toContain(marker);
    }

    expect(materials).not.toContain('.premium-card.premium-hierarchy-h1.premium-glow-win');
    expect(materials).not.toContain('.premium-card.premium-hierarchy-h1.premium-state-win');
  });
});
