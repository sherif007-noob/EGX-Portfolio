import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 9 header button language', () => {
  it('keeps every utility button inside the shared premium header action family', () => {
    const header = readRelative('./Header.tsx');

    for (const id of [
      'header-price-alerts-btn',
      'header-live-sync-btn',
      'header-data-tools-btn',
      'header-settings-btn',
    ]) {
      const start = header.indexOf(`id="${id}"`);
      expect(start).toBeGreaterThanOrEqual(0);
      const block = header.slice(start, start + 900);
      expect(block).toContain('premium-header-action');
    }

    for (const id of ['header-google-sheets-btn', 'header-backup-reconcile-btn']) {
      const start = header.indexOf(`id="${id}"`);
      expect(start).toBeGreaterThanOrEqual(0);
      const block = header.slice(start, start + 900);
      expect(block).toContain('premium-header-tools-item');
    }

    expect(header).toContain('premium-header-action-amber');
    expect(header).toContain('premium-header-action-cyan');
    expect(header).toContain('premium-header-action-purple');
    expect(header).toContain('premium-header-action-neutral');
    expect(header).toContain('premium-header-tools-item-emerald');
  });

  it('keeps creation actions richer and Add Trade primary', () => {
    const header = readRelative('./Header.tsx');

    const scanStart = header.indexOf('id="header-scan-btn"');
    const addStart = header.indexOf('id="header-add-trade-btn"');
    const scan = header.slice(scanStart, scanStart + 700);
    const add = header.slice(addStart, addStart + 700);

    expect(scan).toContain('premium-header-create-secondary');
    expect(add).toContain('premium-header-create-primary');
    expect(add).toContain('premium-action-primary');
    expect(add).toContain('premium-shimmer-border');
  });

  it('uses premium glass/refraction/bloom for utilities instead of flattening them', () => {
    const css = readRelative('../index.css');
    const start = css.indexOf('Phase 9.3/9.4 header-button language');
    const end = css.indexOf('.premium-header-create-cluster', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const block = css.slice(start, end);
    expect(block).toContain('backdrop-filter: blur(18px)');
    expect(block).toContain('var(--premium-refraction-shadow');
    expect(block).toContain('0 0 18px rgb(var(--premium-header-action-rgb)');
    expect(block).toContain('.premium-header-action:focus-visible');
  });

  it('makes active navigation louder than idle navigation while preserving hierarchy', () => {
    const css = readRelative('../index.css');
    const start = css.indexOf('Phase 9.2 — navigation refinement');
    const end = css.indexOf('Phase 9.1 — command-zone header shell');
    const block = css.slice(start, end);

    expect(block).toContain('.premium-nav-item.premium-nav-idle');
    expect(block).toContain('border-color: rgba(148, 163, 184, 0.105)');
    expect(block).toContain('.premium-nav-item.premium-nav-active');
    expect(block).toContain('rgb(var(--premium-nav-accent) / 0.58)');
    expect(block).toContain('0 0 38px rgb(var(--premium-nav-accent) / 0.06)');
    expect(block).toContain('.premium-nav-item.premium-nav-active .premium-nav-icon');
  });

  it('does not modify Phase 8 card material contracts', () => {
    const css = readRelative('../index.css');
    expect(css).toContain('Pass 8.3b: intensified resting aura/glow');
    expect(css).toContain('Additive semantic edge — aura/glass remain untouched');
    expect(css).toContain('--premium-semantic-role-near-radius: 48px;');
    expect(css).toContain('--premium-semantic-role-near-alpha: 0.34;');
  });
});
