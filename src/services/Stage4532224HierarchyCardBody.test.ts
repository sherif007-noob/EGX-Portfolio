import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.5.3.2.2.2.4 hierarchy-card base material ownership', () => {
  it('moves only the hierarchy-card base material body into materials.css', () => {
    const materials = read('src/styles/materials.css');
    const legacy = read('src/index.css');

    const rule = `.premium-card.premium-hierarchy-h1,
.premium-card.premium-hierarchy-h2,
.premium-card.premium-hierarchy-h3,
.premium-card.premium-hierarchy-h4,
.premium-card.premium-hierarchy-h5 {
  --phase8-material-rgb: var(--premium-material-rgb, 56 189 248);
  --phase8-material-deep-rgb: var(--premium-material-deep-rgb, 37 99 235);
  --premium-refraction-shadow: var(--premium-refraction-tier-primary);
  border-color: rgb(var(--phase8-material-rgb) / 0.30);
  background:
    radial-gradient(circle at 16% -18%, rgb(var(--phase8-material-rgb) / 0.145), transparent 40%),
    radial-gradient(circle at 102% 0%, rgb(var(--phase8-material-deep-rgb) / 0.085), transparent 46%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.052), rgba(255, 255, 255, 0.012) 42%, transparent 70%),
    rgba(10, 18, 36, 0.54) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.085),
    0 18px 44px rgba(0, 0, 0, 0.29),
    0 0 40px rgb(var(--phase8-material-rgb) / 0.16),
    0 0 92px rgb(var(--phase8-material-deep-rgb) / 0.08),
    var(--premium-refraction-shadow, 0 0 0 transparent);
  -webkit-backdrop-filter: blur(24px) saturate(155%) brightness(1.025);
  backdrop-filter: blur(24px) saturate(155%) brightness(1.025);
}`;

    expect(materials).toContain(rule);
    expect(legacy).not.toContain(rule);
    expect(legacy).toContain(
      'Stage 4.5.3.2.2.2.4: hierarchy-card base material body moved to ./styles/materials.css.',
    );
  });

  it('keeps highlight, explicit tone, neutral hover and mobile overrides unlayered', () => {
    const legacy = read('src/index.css');

    for (const marker of [
      '.premium-card.premium-hierarchy-h1::before,',
      '.premium-card.premium-hierarchy-h1.premium-material-tone-cyan,',
      '.premium-card.premium-hierarchy-h1:hover,',
      '@media (max-width: 767px) {\n  /* Keep aura visible on touch devices; only motion/hover is omitted. */',
    ]) {
      expect(legacy).toContain(marker);
    }
  });

  it('keeps generic hover and every semantic material owner unlayered', () => {
    const legacy = read('src/index.css');
    const materials = read('src/styles/materials.css');

    expect(legacy).toContain('.premium-card:hover {');
    expect(legacy).toContain('.premium-card:hover::before {');
    expect(legacy).toContain('.premium-card.premium-hierarchy-h1.premium-glow-win');
    expect(legacy).toContain('.premium-card.premium-hierarchy-h1.premium-state-win');
    expect(materials).not.toContain('.premium-card.premium-hierarchy-h1.premium-glow-win');
    expect(materials).not.toContain('.premium-card.premium-hierarchy-h1.premium-state-win');
  });
});
