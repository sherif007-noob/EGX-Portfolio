import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

const stripComments = (value: string) =>
  value.replace(/\/\*[\s\S]*?\*\//g, '').trim();

const declarationNames = (value: string) =>
  [...value.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]);

describe('Stage 4.5.2 canonical token extraction', () => {
  it('moves all six base root blocks into the token owner without changing their declarations', () => {
    const tokens = read('src/styles/tokens.css');

    expect(tokens.match(/:root\s*\{/g)?.length).toBe(6);
    expect(declarationNames(tokens)).toHaveLength(88);

    for (const [token, value] of [
      ['--premium-bg', '#020617'],
      ['--premium-glass', 'rgba(8, 15, 31, 0.52)'],
      ['--premium-semantic-win-rgb', '16 185 129'],
      ['--premium-touch-target', '2.75rem'],
      ['--motion-emphasized', 'cubic-bezier(0.16, 1, 0.3, 1)'],
      ['--motion-instant', '120ms'],
      ['--motion-modal', '360ms'],
      ['--motion-family-chart', '520ms'],
      ['--hierarchy-space-section', '1.75rem'],
      ['--hierarchy-metric-hero-size', 'clamp(1.8rem, 1.35rem + 1.5vw, 2.7rem)'],
      ['--hierarchy-pad-h1', '1.25rem'],
    ]) {
      expect(tokens).toContain(`${token}: ${value}`);
    }
  });

  it('leaves only responsive hierarchy root overrides in the legacy stylesheet', () => {
    const legacy = read('src/index.css');
    const rootBlocks = [...legacy.matchAll(/:root\s*\{([^{}]*)\}/g)];

    expect(rootBlocks).toHaveLength(2);

    const remainingDeclarations = rootBlocks.flatMap((match) => declarationNames(match[0]));
    expect(remainingDeclarations).toHaveLength(20);
    expect(remainingDeclarations.every((name) => name.startsWith('--hierarchy-'))).toBe(true);

    expect(legacy).toContain('@media (max-width: 767px)');
    expect(legacy).toContain('@media (max-width: 390px)');
    expect(legacy).toContain('--hierarchy-space-card: 0.875rem');
    expect(legacy).toContain('--hierarchy-page-title-size: 1.2rem');

    expect(legacy).not.toContain('--premium-bg:');
    expect(legacy).not.toContain('--motion-instant:');
    expect(legacy).not.toContain('--motion-family-chart:');
    expect(legacy).not.toContain('--hierarchy-space-inline:');
  });

  it('keeps tokens pure: custom properties only, with no selectors other than root and no responsive extraction yet', () => {
    const tokens = stripComments(read('src/styles/tokens.css'));

    expect(tokens).not.toContain('@media');
    expect(tokens).not.toContain('@keyframes');

    const selectorLines = tokens
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.endsWith('{'));

    expect(selectorLines).toEqual([
      ':root {',
      ':root {',
      ':root {',
      ':root {',
      ':root {',
      ':root {',
    ]);
  });

  it('keeps every later ownership layer visually empty until its own pass', () => {
    for (const path of [
      'src/styles/materials.css',
      'src/styles/semantics.css',
      'src/styles/hierarchy.css',
      'src/styles/controls.css',
      'src/styles/overlays.css',
      'src/styles/motion.css',
      'src/styles/responsive.css',
      'src/styles/features/index.css',
    ]) {
      expect(stripComments(read(path))).toBe('');
    }
  });

  it('keeps the token layer first and legacy accepted visual families in place', () => {
    const entry = read('src/styles/index.css');
    const legacy = read('src/index.css');

    expect(entry.indexOf('@import "./tokens.css" layer(egx-tokens);')).toBeGreaterThan(-1);
    expect(entry.indexOf('@import "./tokens.css" layer(egx-tokens);'))
      .toBeLessThan(entry.indexOf('@import "./materials.css" layer(egx-materials);'));

    for (const marker of [
      'Phase 7 chart visual system',
      'Phase 5 canonical semantic halo system',
      'Phase 4 v3 — canonical motion tokens and CSS micro-interactions',
      'Phase 9.6 — mobile command architecture',
      'Phase 8 hierarchy — MATERIAL-NEUTRAL restoration',
      'Phase 8 material restoration — Monthly Report quality reference',
      'Phase 10.9 — cross-app responsive containment',
    ]) {
      expect(legacy).toContain(marker);
    }
  });
});
