import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

const stripComments = (value: string) =>
  value.replace(/\/\*[\s\S]*?\*\//g, '').trim();

describe('Stage 4.5.3.2.2.1 card + neutral overlay material ownership', () => {
  it('moves card material while leaving card motion in the legacy owner', () => {
    const materials = read('src/styles/materials.css');
    const legacy = read('src/index.css');

    expect(materials).toContain('.premium-card {\n  overflow: hidden;');
    expect(materials).toContain('backdrop-filter: blur(14px) saturate(135%)');
    expect(materials).toContain('.premium-card::before {\n  content:');
    expect(materials).toContain('opacity: 0.38;');

    expect(legacy).toContain('Stage 4.5.3.2.2.1: base card material moved to ./styles/materials.css.');
    expect(legacy).toContain('.premium-card {\n  transition:');
    expect(legacy).toContain('.premium-card::before {\n  transition: opacity');
    expect(legacy).toContain('.premium-card:hover {');
    expect(legacy).toContain('.premium-card:hover::before {');
  });

  it('moves floating, modal, and dropdown material bodies without their geometry contracts', () => {
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
    expect(legacy).not.toContain('.premium-dropdown {\n  isolation: isolate;');
    expect(legacy).not.toContain('.premium-modal {\n  position: relative;');
  });

  it('keeps responsive dropdown material with materials but leaves responsive geometry in legacy', () => {
    const materials = read('src/styles/materials.css');
    const legacy = read('src/index.css');

    expect(materials).toContain('@media (max-width: 767px) {\n  .premium-dropdown {\n    background:');
    expect(materials).toContain('blur(26px) saturate(165%) brightness(1.05)');

    expect(legacy).toContain('Stage 4.5.3.2.2.1: dropdown mobile material moved to ./styles/materials.css.');
    expect(legacy).toContain('@media (max-width: 767px) {\n  .premium-dropdown {\n    max-width:');
    expect(legacy).toContain('overscroll-behavior: contain;');
  });

  it('moves the remaining shared soft composite material into materials.css', () => {
    const materials = read('src/styles/materials.css');
    const legacy = read('src/index.css');

    expect(materials).toContain('.premium-subpanel,\n.premium-inset-glass,\n.premium-form-section,\n.premium-modal-section {');
    expect(materials).toContain('backdrop-filter: blur(17px) saturate(140%)');
    expect(legacy).toContain('Stage 4.5.3.2.2.1: shared soft composite material moved to ./styles/materials.css.');
  });

  it('leaves semantic, hierarchy, control, motion and responsive owners untouched', () => {
    for (const path of [
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

    const materials = read('src/styles/materials.css');
    expect(materials).not.toContain('.premium-action {');
    expect(materials).not.toContain('.premium-field {');
    expect(materials).not.toContain('.premium-glow-win');
    expect(materials).not.toContain('.premium-state-loss');
    expect(materials).not.toContain('@keyframes');
  });

  it('keeps only cascade-sensitive Phase 8 card restoration in legacy after the safe retry', () => {
    const legacy = read('src/index.css');
    const materials = read('src/styles/materials.css');

    for (const marker of [
      '.premium-card.premium-hierarchy-h1,',
      '.premium-card.premium-hierarchy-h1::before',
      '.premium-card.premium-hierarchy-h1.premium-material-tone-cyan',
      '.premium-card.premium-hierarchy-h1:hover',
    ]) {
      expect(legacy).toContain(marker);
    }

    for (const marker of [
      '.premium-panel.premium-hierarchy-h2',
      '.premium-overview-market-strip.premium-material-tone-cyan {',
      '.premium-subpanel.premium-hierarchy-h4',
      '.premium-table-shell.premium-hierarchy-h5',
      '.premium-report-summary-band {',
    ]) {
      expect(materials).toContain(marker);
    }
  });
});
