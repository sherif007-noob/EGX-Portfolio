import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

const stripComments = (value: string) =>
  value.replace(/\/\*[\s\S]*?\*\//g, '').trim();

describe('Stage 4.5.1 CSS ownership entry contract', () => {
  it('keeps one stable app stylesheet entry while attaching the ownership index after Tailwind', () => {
    const main = read('src/main.tsx');
    const legacy = read('src/index.css');

    expect(main).toContain("import './index.css'");
    expect(main).not.toContain("import './styles/");

    const tailwind = legacy.indexOf('@import "tailwindcss";');
    const ownership = legacy.indexOf('@import "./styles/index.css";');
    const firstLegacyRule = legacy.indexOf('.recharts-default-tooltip');

    expect(tailwind).toBe(0);
    expect(ownership).toBeGreaterThan(tailwind);
    expect(firstLegacyRule).toBeGreaterThan(ownership);
  });

  it('defines one canonical named-layer order for future extraction passes', () => {
    const entry = read('src/styles/index.css');
    const imports = [
      '@import "./tokens.css" layer(egx-tokens);',
      '@import "./materials.css" layer(egx-materials);',
      '@import "./semantics.css" layer(egx-semantics);',
      '@import "./hierarchy.css" layer(egx-hierarchy);',
      '@import "./controls.css" layer(egx-controls);',
      '@import "./overlays.css" layer(egx-overlays);',
      '@import "./motion.css" layer(egx-motion);',
      '@import "./responsive.css" layer(egx-responsive);',
      '@import "./features/index.css" layer(egx-features);',
    ];

    let previous = -1;
    for (const importRule of imports) {
      const current = entry.indexOf(importRule);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
  });

  it('advances only accepted ownership modules while later compressed passes stay empty', () => {
    for (const path of [
      'src/styles/tokens.css',
      'src/styles/materials.css',
      'src/styles/semantics.css',
      'src/styles/hierarchy.css',
      'src/styles/cascade-bridge.css',
      'src/styles/controls.css',
      'src/styles/overlays.css',
      'src/styles/motion.css',
    ]) {
      expect(stripComments(read(path))).not.toBe('');
    }

    for (const path of [
      'src/styles/responsive.css',
      'src/styles/features/index.css',
    ]) {
      expect(stripComments(read(path))).toBe('');
    }
  });

  it('does not move accepted Phase 7-10 visual families during the ownership bootstrap', () => {
    const legacy = read('src/index.css');

    for (const marker of [
      'Phase 7 chart visual system',
      'Premium visual system — presentation only',
      'Phase 5 canonical semantic halo system',
      'Stage 4.5.5: canonical v3 motion and desktop performance moved to ./styles/motion.css.',
      'Phase 9.6 — mobile command architecture',
      'Phase 8 hierarchy — MATERIAL-NEUTRAL restoration',
      'Phase 8 material restoration — Monthly Report quality reference',
      'Phase 10.9 — cross-app responsive containment',
    ]) {
      expect(legacy).toContain(marker);
    }
  });

  it('documents the measured legacy baseline and visual-preserving migration sequence', () => {
    const doc = read('docs/STAGE4_5_CSS_OWNERSHIP.md');

    expect(doc).toContain('**5,886 lines**');
    expect(doc).toContain('**158** `!important`');
    expect(doc).toContain('**62** `@media`');
    expect(doc).toContain('**23** `@keyframes`');
    expect(doc).toContain('4.5.2 — token extraction');
    expect(doc).toContain('4.5.6 — responsive + feature/legacy closure');
    expect(doc).toContain('former planned `4.5.7–4.5.11` scopes are folded');
    expect(doc).toContain('rendered visual regression');
  });
});
