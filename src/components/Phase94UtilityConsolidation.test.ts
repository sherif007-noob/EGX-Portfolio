import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 9.4 utility/data-management consolidation', () => {
  it('keeps frequent utilities direct and consolidates lower-frequency data tools', () => {
    const header = readRelative('./Header.tsx');

    expect(header).toContain('id="header-price-alerts-btn"');
    expect(header).toContain('id="header-live-sync-btn"');
    expect(header).toContain('id="header-data-tools-btn"');
    expect(header).toContain('id="header-settings-btn"');

    expect(header).toContain('id="header-google-sheets-btn"');
    expect(header).toContain('id="header-backup-reconcile-btn"');
    expect(header).toContain('role="menu"');
    expect(header).toContain('role="menuitem"');
  });

  it('preserves data-management callbacks while moving their presentation', () => {
    const header = readRelative('./Header.tsx');

    expect(header).toContain('onOpenGoogleSheets();');
    expect(header).toContain('onOpenBackupModal();');
    expect(header).toContain('setIsDataToolsOpen(false);');
    expect(header).toContain("if (event.key === 'Escape') setIsDataToolsOpen(false)");
    expect(header).toContain('dataToolsRef.current.contains');
  });

  it('keeps Sheets state visible on the consolidated trigger', () => {
    const header = readRelative('./Header.tsx');

    expect(header).toContain('premium-header-status-dot-warning');
    expect(header).toContain('Google Sheets needs reconnection');
    expect(header).toContain('premium-header-status-dot-connected');
    expect(header).toContain('Google Sheets connected');
  });

  it('keeps Settings a visible direct premium utility affordance', () => {
    const header = readRelative('./Header.tsx');
    const start = header.indexOf('id="header-settings-btn"');
    const block = header.slice(start, start + 800);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(block).toContain('premium-header-action');
    expect(block).toContain('premium-header-action-neutral');
    expect(block).toContain('Settings — reserved for a future phase');
  });

  it('uses premium glass/refraction for the data cluster and menu items', () => {
    const css = readRelative('../index.css');
    const start = css.indexOf('Phase 9.4 — utility/data-management consolidation');
    const end = css.indexOf('.premium-header-create-secondary', start);
    const block = css.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('.premium-header-data-cluster');
    expect(block).toContain('backdrop-filter: blur(14px) saturate(136%)');
    expect(block).toContain('.premium-header-tools-trigger[aria-expanded=\'true\']');
    expect(block).toContain('.premium-header-tools-item');
    expect(block).toContain('.premium-header-tools-icon-wrap');
    expect(block).toContain('var(--premium-refraction-tier-overlay)');
  });

  it('does not touch Phase 8 content material contracts', () => {
    const css = readRelative('../index.css');

    expect(css).toContain('Pass 8.3b: intensified resting aura/glow');
    expect(css).toContain('Additive semantic edge — aura/glass remain untouched');
    expect(css).toContain('0 0 48px rgb(var(--premium-semantic-rgb) / 0.34)');
  });
});
