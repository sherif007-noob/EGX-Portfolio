import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

const stripComments = (value: string) =>
  value.replace(/\/\*[\s\S]*?\*\//g, '').trim();

describe('Stage 4.5.3.2.2.2 Phase 8 neutral material restoration closure', () => {
  it('moves all explicit material-tone owners into materials.css', () => {
    const materials = read('src/styles/materials.css');
    const legacy = read('src/index.css');

    for (const tone of ['cyan', 'blue', 'purple', 'emerald', 'rose', 'amber']) {
      expect(materials).toContain(`.premium-material-tone-${tone} {`);
      expect(legacy).toContain(
        `Stage 4.5.3.2.2.2: material tone ${tone} moved to ./styles/materials.css.`,
      );
    }
  });

  it('moves neutral hierarchy-card material and highlight while keeping semantic cards in legacy', () => {
    const materials = read('src/styles/materials.css');
    const legacy = read('src/index.css');

    expect(materials).toContain(
      '.premium-card.premium-hierarchy-h1,\n.premium-card.premium-hierarchy-h2,',
    );
    expect(materials).toContain(
      '.premium-card.premium-hierarchy-h1::before,\n.premium-card.premium-hierarchy-h2::before,',
    );
    expect(materials).toContain('--phase8-material-rgb: var(--premium-material-rgb, 56 189 248)');
    expect(materials).toContain('backdrop-filter: blur(24px) saturate(155%) brightness(1.025)');

    expect(legacy).not.toContain(
      '.premium-card.premium-hierarchy-h1,\n.premium-card.premium-hierarchy-h2,\n.premium-card.premium-hierarchy-h3,\n.premium-card.premium-hierarchy-h4,\n.premium-card.premium-hierarchy-h5 {',
    );
    expect(legacy).toContain('.premium-card.premium-hierarchy-h1.premium-glow-win');
    expect(legacy).toContain('.premium-card.premium-hierarchy-h1.premium-state-win');
  });

  it('moves neutral Phase 8 structural/inset/dense/report-summary material', () => {
    const materials = read('src/styles/materials.css');

    for (const marker of [
      '.premium-panel.premium-hierarchy-h2',
      '.premium-overview-market-strip.premium-material-tone-cyan {',
      '.premium-subpanel.premium-hierarchy-h4',
      '.premium-table-shell.premium-hierarchy-h5',
      '.premium-report-summary-band {',
      '.premium-report-structural.premium-hierarchy-h0',
    ]) {
      expect(materials).toContain(marker);
    }

    expect(materials).toContain('backdrop-filter: blur(22px) saturate(150%) brightness(1.02)');
    expect(materials).toContain('backdrop-filter: blur(15px) saturate(134%)');
    expect(materials).toContain('backdrop-filter: blur(16px) saturate(135%)');
  });

  it('moves explicit neutral-tone hierarchy cards but not financial semantic variants', () => {
    const materials = read('src/styles/materials.css');
    const legacy = read('src/index.css');

    expect(materials).toContain('.premium-card.premium-hierarchy-h1.premium-material-tone-cyan');
    expect(materials).toContain('0 0 42px rgb(var(--premium-material-rgb) / 0.24)');
    expect(materials).toContain('.premium-overview-hero.premium-hero-card {');

    expect(materials).not.toContain('.premium-glow-win');
    expect(materials).not.toContain('.premium-state-loss');
    expect(legacy).toContain('.premium-overview-hero.premium-hero-card.premium-glow-win');
  });

  it('splits neutral hover material from semantic hover material', () => {
    const materials = read('src/styles/materials.css');
    const legacy = read('src/index.css');

    expect(materials).toContain(
      '@media (hover: hover) and (pointer: fine) {\n  .premium-card.premium-hierarchy-h1:hover,',
    );
    expect(materials).toContain('0 0 116px rgb(var(--phase8-material-deep-rgb) / 0.12)');

    expect(legacy).toContain('.premium-card.premium-hierarchy-h1.premium-glow-win:hover');
    expect(legacy).toContain('Phase 8 semantic hover parity — never dim a semantic card on hover.');
  });

  it('moves the Phase 8 material-only mobile overrides without moving responsive ownership generally', () => {
    const materials = read('src/styles/materials.css');
    const legacy = read('src/index.css');

    expect(materials).toContain(
      '@media (max-width: 767px) {\n  /* Keep aura visible on touch devices; only motion/hover is omitted. */',
    );
    expect(materials).toContain('backdrop-filter: blur(22px) saturate(150%) brightness(1.025)');
    expect(materials).toContain('backdrop-filter: blur(20px) saturate(145%)');

    expect(legacy).toContain('Pass 8.6 — narrow-phone hierarchy guard.');
    expect(stripComments(read('src/styles/responsive.css'))).toBe('');
  });

  it('closes neutral material ownership without pulling later owners forward', () => {
    const materials = read('src/styles/materials.css');

    expect(materials).not.toContain('.premium-action {');
    expect(materials).not.toContain('.premium-field {');
    expect(materials).not.toContain('@keyframes');

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
  });
});
