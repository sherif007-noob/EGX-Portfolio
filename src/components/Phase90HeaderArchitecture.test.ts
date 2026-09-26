import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 9.0–9.1 header architecture', () => {
  it('preserves all seven navigation destinations and the three navigation groups', () => {
    const header = readRelative('./Header.tsx');

    for (const group of ['Portfolio', 'Activity', 'Insights']) {
      expect(header).toContain(`label: '${group}'`);
    }

    for (const tab of [
      'overview',
      'positions',
      'closed_cycles',
      'journal',
      'cash',
      'reports',
      'directory',
    ]) {
      expect(header).toContain(`tab: '${tab}'`);
    }
  });

  it('keeps Add Trade as primary while Settings remains a subordinate future affordance', () => {
    const header = readRelative('./Header.tsx');

    const addStart = header.indexOf('id="header-add-trade-btn"');
    const settingsStart = header.indexOf('id="header-settings-btn"');
    expect(addStart).toBeGreaterThanOrEqual(0);
    expect(settingsStart).toBeGreaterThanOrEqual(0);

    const addBlock = header.slice(addStart, addStart + 700);
    const settingsBlock = header.slice(settingsStart, settingsStart + 700);

    expect(addBlock).toContain('premium-action-primary');
    expect(settingsBlock).toContain('premium-header-utility-action');
    expect(settingsBlock).not.toContain('premium-action-primary');
    expect(settingsBlock).toContain('reserved for a future phase');
  });

  it('separates utilities from creation actions without removing existing callbacks', () => {
    const header = readRelative('./Header.tsx');

    expect(header).toContain('premium-header-command-zone');
    expect(header).toContain('premium-header-utility-cluster');
    expect(header).toContain('premium-header-create-cluster');

    for (const callback of [
      'onOpenPriceAlerts',
      'onSyncLivePrices',
      'onOpenGoogleSheets',
      'onOpenBackupModal',
      'onOpenScreenshotModal',
      'onOpenAddTrade',
      'onOpenSettings',
    ]) {
      expect(header).toContain(callback);
    }
  });

  it('preserves keyboard, active-tab and overflow navigation behavior', () => {
    const header = readRelative('./Header.tsx');

    expect(header).toContain('aria-current={active ? \'page\' : undefined}');
    expect(header).toContain("['ArrowLeft', 'ArrowRight', 'Home', 'End']");
    expect(header).toContain('scrollNavItemIntoView');
    expect(header).toContain('canScrollNavLeft');
    expect(header).toContain('canScrollNavRight');
    expect(header).toContain('prefers-reduced-motion: reduce');
  });

  it('keeps the Phase 9 shell scoped to header classes and preserves Phase 8 material contracts', () => {
    const css = readRelative('../index.css');

    const start = css.indexOf('Phase 9.1 — command-zone header shell');
    const end = css.indexOf('/* A short landscape viewport needs a compact header layout');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const phase9 = css.slice(start, end);
    expect(phase9).toContain('.premium-header-command-zone');
    expect(phase9).toContain('.premium-header-utility-cluster');
    expect(phase9).toContain('.premium-header-create-cluster');
    expect(phase9).not.toContain('.premium-card');
    expect(phase9).not.toContain('.premium-semantic-edge');

    expect(css).toContain('Pass 8.3b: intensified resting aura/glow');
    expect(css).toContain('Additive semantic edge — aura/glass remain untouched');
  });
});
