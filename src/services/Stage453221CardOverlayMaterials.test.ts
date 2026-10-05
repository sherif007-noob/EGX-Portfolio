import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

const stripComments = (value: string) =>
  value.replace(/\/\*[\s\S]*?\*\//g, '').trim();

describe('Stage 4.5.3.2.2.1 card + neutral overlay material ownership', () => {
  it('keeps card material in materials while card motion remains legacy-owned', () => {
    const materials = read('src/styles/materials.css');
    const legacy = read('src/index.css');

    expect(materials).toContain('.premium-card {\n  overflow: hidden;');
    expect(materials).toContain('backdrop-filter: blur(14px) saturate(135%)');
    expect(materials).toContain('.premium-card::before {\n  content:');
    expect(materials).toContain('.premium-card:hover::before {');

    expect(legacy).toContain('Stage 4.5.3.2.2.1: base card material moved to ./styles/materials.css.');
    expect(legacy).toContain('.premium-card {\n  transition:');
    expect(legacy).toContain('.premium-card::before {\n  transition: opacity');
    expect(legacy).toContain('.premium-card:hover {\n  transform: translateY(-2px);');
  });

  it('keeps floating, modal, and dropdown material bodies without their geometry contracts', () => {
    const materials = read('src/styles/materials.css');
    const legacy = read('src/index.css');

    for (const selector of [
      '.premium-floating {',
      '.premium-modal-backdrop {',
      '.premium-modal {',
      '.premium-modal::before {',
      '.premium-dropdown {',
      '.premium-dropdown::before {',
    ]) {
      expect(materials).toContain(selector);
    }

    expect(legacy).toContain('.premium-modal-viewport {');
    expect(legacy).toContain(".premium-dropdown[data-premium-dropdown-portal='true']");
    expect(legacy).toContain('max-width: calc(100vw - (var(--premium-mobile-gutter) * 2));');
  });

  it('keeps responsive dropdown material with materials but leaves responsive geometry in legacy', () => {
    const materials = read('src/styles/materials.css');
    const legacy = read('src/index.css');

    expect(materials).toContain('@media (max-width: 767px) {\n  .premium-dropdown {\n    background:');
    expect(materials).toContain('blur(26px) saturate(165%) brightness(1.05)');
    expect(legacy).toContain('overscroll-behavior: contain;');
  });

  it('keeps the remaining shared soft composite material in materials.css', () => {
    const materials = read('src/styles/materials.css');

    expect(materials).toContain('.premium-subpanel,\n.premium-inset-glass,\n.premium-form-section,\n.premium-modal-section {');
    expect(materials).toContain('backdrop-filter: blur(17px) saturate(140%)');
  });

  it('advances semantic and hierarchy owners while later owners remain deferred', () => {
    expect(stripComments(read('src/styles/semantics.css'))).not.toBe('');
    expect(stripComments(read('src/styles/hierarchy.css'))).not.toBe('');

    for (const path of [
      'src/styles/controls.css',
      'src/styles/overlays.css',
      'src/styles/motion.css',
      'src/styles/responsive.css',
      'src/styles/features/index.css',
    ]) {
      expect(stripComments(read(path))).toBe('');
    }

    const materials = read('src/styles/materials.css');
    expect(materials).not.toContain('.premium-action {');
    expect(materials).not.toContain('.premium-field {');
    expect(materials).not.toContain('.premium-glow-win');
    expect(materials).not.toContain('.premium-state-loss');
    expect(materials).not.toContain('@keyframes');
  });

  it('owns the formerly cascade-sensitive hierarchy material while semantic state stays separate', () => {
    const materials = read('src/styles/materials.css');
    const semantics = read('src/styles/semantics.css');

    for (const marker of [
      '.premium-card.premium-hierarchy-h1,',
      '.premium-card.premium-hierarchy-h1::before',
      '.premium-card.premium-hierarchy-h1.premium-material-tone-cyan',
      '.premium-card.premium-hierarchy-h1:hover',
    ]) {
      expect(materials).toContain(marker);
    }

    expect(semantics).toContain('.premium-card.premium-hierarchy-h1.premium-glow-win');
  });
});
