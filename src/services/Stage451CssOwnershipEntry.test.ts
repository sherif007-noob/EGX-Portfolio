import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');
const stripComments = (value: string) => value.replace(/\/\*[\s\S]*?\*\//g, '').trim();

describe('Stage 4.5.1 CSS ownership entry contract', () => {
  it('keeps one stable app stylesheet entry and a fully drained legacy entry', () => {
    const main = read('src/main.tsx');
    const entry = read('src/index.css').trim();

    expect(main).toContain("import './index.css'");
    expect(main).not.toContain("import './styles/");
    expect(entry).toBe('@import "tailwindcss";\n@import "./styles/index.css";');
  });

  it('keeps the canonical named-layer order through final closure', () => {
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
    for (const rule of imports) {
      const current = entry.indexOf(rule);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
  });

  it('has every canonical owner populated at final closure', () => {
    for (const path of [
      'src/styles/tokens.css',
      'src/styles/materials.css',
      'src/styles/semantics.css',
      'src/styles/hierarchy.css',
      'src/styles/cascade-bridge.css',
      'src/styles/controls.css',
      'src/styles/overlays.css',
      'src/styles/motion.css',
      'src/styles/responsive.css',
      'src/styles/features/index.css',
    ]) {
      expect(stripComments(read(path))).not.toBe('');
    }
  });

  it('routes former Phase 7-10 families to explicit final owners', () => {
    expect(read('src/styles/features/charts.css')).toContain('Phase 7 chart visual system');
    expect(read('src/styles/features/header.css')).toContain('Phase 9.6 — mobile command architecture');
    expect(read('src/styles/responsive.css')).toContain('Phase 10.9 — cross-app responsive containment');
    expect(read('src/styles/materials.css')).toContain('.premium-card.premium-hierarchy-h1');
    expect(read('src/styles/semantics.css')).toContain('Additive semantic edge — aura/glass remain untouched');
  });

  it('keeps the measured baseline and compressed closure documented', () => {
    const doc = read('docs/STAGE4_5_CSS_OWNERSHIP.md');
    expect(doc).toContain('**5,886 lines**');
    expect(doc).toContain('**158** `!important`');
    expect(doc).toContain('**62** `@media`');
    expect(doc).toContain('**23** `@keyframes`');
    expect(doc).toContain('4.5.6 — responsive + feature/legacy closure');
  });
});
