import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.5.3.2.2.2.5 generic card hover material ownership', () => {
  it('moves hover material while leaving translation in legacy motion ownership', () => {
    const materials = read('src/styles/materials.css');
    const legacy = read('src/index.css');

    expect(legacy).toContain(`.premium-card:hover {
  transform: translateY(-2px);
}`);
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

  it('keeps the rejected hierarchy-card body and all later Phase 8 competitors unlayered', () => {
    const materials = read('src/styles/materials.css');
    const legacy = read('src/index.css');

    for (const marker of [
      '.premium-card.premium-hierarchy-h1,\n.premium-card.premium-hierarchy-h2,',
      '.premium-card.premium-hierarchy-h1::before,',
      '.premium-card.premium-hierarchy-h1.premium-material-tone-cyan,',
      '.premium-card.premium-hierarchy-h1:hover,',
      '.premium-card.premium-hierarchy-h1.premium-glow-win',
      '.premium-card.premium-hierarchy-h1.premium-state-win',
    ]) {
      expect(legacy).toContain(marker);
    }

    expect(materials).not.toContain('.premium-card.premium-hierarchy-h1,\n.premium-card.premium-hierarchy-h2,');
    expect(materials).not.toContain('.premium-card.premium-hierarchy-h1.premium-glow-win');
  });
});
