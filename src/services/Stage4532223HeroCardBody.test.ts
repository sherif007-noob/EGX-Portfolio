import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.5.3.2.2.2.3 neutral hero-card material ownership', () => {
  it('keeps the neutral hero-card body in materials.css without changing values', () => {
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
  });

  it('advances the former hierarchy bundle into canonical material/semantic owners', () => {
    const materials = read('src/styles/materials.css');
    const semantics = read('src/styles/semantics.css');
    const bridge = read('src/styles/cascade-bridge.css');

    expect(materials).toContain('.premium-card.premium-hierarchy-h1::before,');
    expect(materials).toContain('.premium-card.premium-hierarchy-h1.premium-material-tone-cyan,');
    expect(materials).toContain('.premium-card.premium-hierarchy-h1:hover,');
    expect(semantics).toContain('.premium-card.premium-hierarchy-h1.premium-glow-win,');
    expect(bridge).toContain('rgba(10, 18, 36, 0.54) !important;');
  });

  it('keeps generic hover motion motion-owned while material light and semantic hero are owned', () => {
    const motion = read('src/styles/motion.css');
    const materials = read('src/styles/materials.css');
    const semantics = read('src/styles/semantics.css');

    expect(motion).toContain('.premium-card:hover {\n  transform: translateY(-2px);');
    expect(materials).toContain('.premium-card:hover::before {');
    expect(semantics).toContain('.premium-overview-hero.premium-hero-card.premium-glow-win');
    expect(materials).toContain('Stage 4.5.3 compressed closure — safe mobile neutral material overrides.');
  });
});
