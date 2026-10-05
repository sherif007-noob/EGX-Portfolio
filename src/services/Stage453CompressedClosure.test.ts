import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.5.3 compressed materials closure', () => {
  it('keeps the safe mobile hierarchy material overrides in materials.css', () => {
    const materials = read('src/styles/materials.css');
    const legacy = read('src/index.css');

    expect(materials).toContain('Stage 4.5.3 compressed closure — safe mobile neutral material overrides.');
    expect(materials).toContain('blur(22px) saturate(150%) brightness(1.025)');
    expect(materials).toContain('blur(20px) saturate(145%)');
    expect(legacy).toContain(
      'Stage 4.5.3 compressed closure: mobile neutral material overrides moved to ./styles/materials.css.',
    );
  });

  it('hands the former cross-owner bridge to the 4.5.4 cascade contract', () => {
    const legacy = read('src/index.css');
    const materials = read('src/styles/materials.css');
    const semantics = read('src/styles/semantics.css');
    const bridge = read('src/styles/cascade-bridge.css');

    expect(bridge).toContain('rgba(10, 18, 36, 0.54) !important;');
    expect(materials).toContain('.premium-card.premium-hierarchy-h1.premium-material-tone-cyan,');
    expect(materials).toContain('.premium-card.premium-hierarchy-h1:hover,');
    expect(semantics).toContain('.premium-card.premium-hierarchy-h1.premium-glow-win,');
    expect(legacy).not.toContain('Stage 4.5.3.2.2.2.5 importance/interaction bridge.');
  });

  it('uses the compressed 4.5 roadmap instead of reopening 4.5.7 through 4.5.11', () => {
    const plan = read('docs/STAGE4_5_CSS_OWNERSHIP.md');

    expect(plan).toContain('4.5.3 — materials + cascade-safety closure — ACTIVE');
    expect(plan).toContain('4.5.4 — semantics + hierarchy');
    expect(plan).toContain('4.5.5 — interaction surfaces');
    expect(plan).toContain('4.5.6 — responsive + feature/legacy closure');
    expect(plan).toContain('former planned `4.5.7–4.5.11` scopes are folded');
  });
});
