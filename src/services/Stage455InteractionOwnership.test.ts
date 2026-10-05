import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.5.5 interaction-surface ownership', () => {
  it('owns reusable shared controls in controls.css', () => {
    const controls = read('src/styles/controls.css');
    const legacy = read('src/index.css');

    for (const marker of [
      '.premium-action {',
      '.premium-field {',
      '.premium-filter-pill {',
      '.premium-checkbox {',
      '.premium-selector-shell',
      '.premium-compact-selector',
      '.premium-dense-search {',
      '.premium-select-trigger[aria-expanded=',
      '.premium-nav-scroller {',
    ]) {
      expect(controls).toContain(marker);
    }

    expect(legacy).not.toContain('/* Common action buttons. */\n.premium-action {');
    expect(legacy).not.toContain('/* Inputs that still carry legacy bg-slate utility classes inherit the glass field. */\n.premium-field {');
    expect(legacy).not.toContain('/* Phase 7.5 device correction — one segmented selector language everywhere.');
  });

  it('owns portaled/modal geometry and stacking in overlays.css', () => {
    const overlays = read('src/styles/overlays.css');
    const legacy = read('src/index.css');

    for (const marker of [
      '.premium-modal-viewport {',
      '.premium-modal-scroll-body {',
      '.premium-modal-backdrop-panel-scroll {',
      '.premium-fixed-overlay {',
      "premium-dropdown[data-premium-dropdown-portal='true']",
      'Analytics dropdowns must float above report/month cards rather than below them.',
    ]) {
      expect(overlays).toContain(marker);
    }

    expect(legacy).not.toContain('.premium-modal-viewport {');
    expect(legacy).not.toContain("premium-dropdown[data-premium-dropdown-portal='true']");
  });

  it('owns CSS choreography and Motion-for-React neutralization in motion.css', () => {
    const motion = read('src/styles/motion.css');
    const legacy = read('src/index.css');

    for (const marker of [
      'Phase 4 v3 — canonical motion tokens and CSS micro-interactions',
      '@keyframes premium-popover-strong-in',
      '@keyframes premium-modal-strong-in',
      '.premium-tab-stage {',
      '[data-motion-owned="react"].premium-motion-swap',
      '@media (prefers-reduced-motion: reduce)',
      'Phase 4 desktop performance pass — preserve choreography, reduce render cost',
    ]) {
      expect(motion).toContain(marker);
    }

    expect(legacy).not.toContain('Phase 4 v3 — canonical motion tokens and CSS micro-interactions');
    expect(legacy).not.toContain('@keyframes premium-popover-strong-in');
  });

  it('keeps financial hover presentation with semantics instead of motion or legacy', () => {
    const semantics = read('src/styles/semantics.css');
    const motion = read('src/styles/motion.css');
    const legacy = read('src/index.css');

    expect(semantics).toContain(
      'Stage 4.5.5 — generic semantic hover interaction presentation.',
    );
    expect(semantics).toContain('.premium-card.premium-glow-buy:hover');
    expect(semantics).toContain(
      '.premium-table-shell tbody tr.premium-row-win:hover',
    );

    expect(motion).toContain(
      'Semantic transition choreography; financial presentation remains in semantics.css.',
    );
    expect(motion).not.toContain(
      'Stage 4.5.5 — generic semantic hover interaction presentation.',
    );
    expect(legacy).not.toContain(
      'Interaction-only semantic transitions remain here until Stage 4.5.5.',
    );
  });

  it('hands responsive and feature-specific residue to the final 4.5.6 owners', () => {
    const legacy = read('src/index.css');
    const responsive = read('src/styles/responsive.css');
    const header = read('src/styles/features/header.css');
    const charts = read('src/styles/features/charts.css');

    expect(legacy.trim()).toBe('@import "tailwindcss";\n@import "./styles/index.css";');
    expect(responsive).toContain('@media (max-width: 767px), (pointer: coarse) {');
    expect(responsive).toContain('.premium-fixed-mobile-span {');
    expect(responsive).toContain('.premium-fixed-bottom-safe {');
    expect(responsive).toContain('.premium-fixed-bottom-above-status {');
    expect(responsive).toContain('Phase 10.9 — cross-app responsive containment');
    expect(header).toContain('Phase 9.6 — mobile command architecture');
    expect(header).toContain('.premium-header-action-rail .premium-action');
    expect(charts).toContain('.premium-chart-skeleton');
  });
});
