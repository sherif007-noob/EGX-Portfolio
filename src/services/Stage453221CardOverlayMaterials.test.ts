import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.5.3.2.2.1 card + neutral overlay material ownership', () => {
  it('keeps card material in materials and card choreography in motion', () => {
    const materials = read('src/styles/materials.css');
    const motion = read('src/styles/motion.css');
    expect(materials).toContain('.premium-card {\n  overflow: hidden;');
    expect(materials).toContain('.premium-card::before {\n  content:');
    expect(materials).toContain('.premium-card:hover::before {');
    expect(motion).toContain('.premium-card {\n  transition:');
    expect(motion).toContain('.premium-card:hover {\n  transform: translateY(-2px);');
  });

  it('keeps overlay material separate from overlay geometry', () => {
    const materials = read('src/styles/materials.css');
    const overlays = read('src/styles/overlays.css');
    for (const selector of ['.premium-floating {','.premium-modal-backdrop {','.premium-modal {','.premium-dropdown {']) {
      expect(materials).toContain(selector);
    }
    expect(overlays).toContain('.premium-modal-viewport {');
    expect(overlays).toContain("premium-dropdown[data-premium-dropdown-portal='true']");
    expect(overlays).toContain('.premium-select-dropdown {');
  });

  it('keeps responsive dropdown material in materials and geometry in responsive/overlays', () => {
    const materials = read('src/styles/materials.css');
    const overlays = read('src/styles/overlays.css');
    const responsive = read('src/styles/responsive.css');
    expect(materials).toContain('@media (max-width: 767px) {\n  .premium-dropdown {\n    background:');
    expect(overlays).toContain('overscroll-behavior: contain;');
    expect(responsive).toContain('.premium-select-dropdown {');
  });

  it('leaves the legacy entry fully drained', () => {
    expect(read('src/index.css').trim()).toBe('@import "tailwindcss";\n@import "./styles/index.css";');
  });
});
