import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 9.9 header regression and closure', () => {
  it('freezes the final information architecture and every global command', () => {
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

    for (const id of [
      'header-price-alerts-btn',
      'header-live-sync-btn',
      'header-data-tools-btn',
      'header-settings-btn',
      'header-scan-btn',
      'header-add-trade-btn',
    ]) {
      expect(header).toContain(`id="${id}"`);
    }

    expect(header).toContain('id="header-google-sheets-btn"');
    expect(header).toContain('id="header-backup-reconcile-btn"');
  });

  it('freezes action priority and callback ownership', () => {
    const header = readRelative('./Header.tsx');

    const addStart = header.indexOf('id="header-add-trade-btn"');
    const scanStart = header.indexOf('id="header-scan-btn"');
    const settingsStart = header.indexOf('id="header-settings-btn"');

    const add = header.slice(addStart, addStart + 750);
    const scan = header.slice(scanStart, scanStart + 750);
    const settings = header.slice(settingsStart, settingsStart + 750);

    expect(add).toContain('data-action-priority="creation-primary"');
    expect(add).toContain('premium-action-primary');
    expect(scan).toContain('data-action-priority="creation-secondary"');
    expect(scan).not.toContain('premium-action-primary');
    expect(settings).toContain('premium-header-utility-action');
    expect(settings).not.toContain('premium-action-primary');

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

  it('freezes navigation accessibility and overflow recovery', () => {
    const header = readRelative('./Header.tsx');

    expect(header).toContain('aria-current={active ? \'page\' : undefined}');
    expect(header).toContain("['ArrowLeft', 'ArrowRight', 'Home', 'End']");
    expect(header).toContain('nextTab?.focus()');
    expect(header).toContain('scrollNavItemIntoView');
    expect(header).toContain('canScrollNavLeft');
    expect(header).toContain('canScrollNavRight');
    expect(header).toContain('const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth)');
    expect(header).toContain('container.scrollLeft = 0');
  });

  it('freezes viewport architecture from phone through 2XL', () => {
    const header = readRelative('./Header.tsx');
    const css = readRelative('../styles/features/header.css');

    expect(header.match(/xl:max-w-\[100rem\]/g)?.length).toBe(2);

    expect(css).toContain('@media (max-width: 639px)');
    expect(css).toContain('@media (max-width: 359px)');
    expect(css).toContain('@media (orientation: landscape) and (max-height: 520px)');
    expect(css).toContain('@media (min-width: 1024px) and (min-height: 521px)');
    expect(css).toContain('@media (min-width: 1024px) and (max-width: 1279px) and (min-height: 521px)');
    expect(css).toContain('@media (min-width: 1280px) and (min-height: 521px)');
    expect(css).toContain('@media (min-width: 1536px) and (min-height: 521px)');

    expect(css).toContain('min-width: var(--premium-touch-target)');
    expect(css).toContain('min-height: var(--premium-touch-target)');
    expect(css).toContain('env(safe-area-inset-left)');
    expect(css).toContain('env(safe-area-inset-right)');
    expect(css).toContain('env(safe-area-inset-top)');
  });

  it('freezes status, focus and reduced-motion semantics', () => {
    const header = readRelative('./Header.tsx');
    const css = readRelative('../styles/features/header.css');

    expect(header).toContain('data-status={unreadAlertCount > 0');
    expect(header).toContain("data-status={isSyncingPrices ? 'running' : 'idle'}");
    expect(header).toContain('data-status={isTokenExpired ?');
    expect(header).toContain('aria-expanded={isDataToolsOpen}');

    expect(css).toContain('.premium-nav-item:focus-visible');
    expect(css).toContain('.premium-header-action:focus-visible');
    expect(css).toContain('.premium-header-tools-item:focus-visible');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('.premium-header-action-running .animate-spin');
  });

  it('keeps Data & Tools viewport-safe and outside scroll clipping', () => {
    const header = readRelative('./Header.tsx');

    expect(header).toContain('createPortal(');
    expect(header).toContain('document.body');
    expect(header).toContain('premium-header-tools-menu fixed');
    expect(header).toContain("trigger.closest<HTMLElement>('.premium-safe-inline-header')");
    expect(header).toContain('Math.min(maxLeft, Math.max(safeLeft, preferredLeft))');
    expect(header).toContain("window.visualViewport?.addEventListener('resize', updateDataToolsMenuGeometry)");
  });

  it('freezes the Phase 8 material boundary and forbids financial semantics on header chrome', () => {
    const header = readRelative('./Header.tsx');
    const css = [readRelative('../styles/features/header.css'), readRelative('../styles/semantics.css')].join('\n');

    expect(header).not.toContain('premium-state-win');
    expect(header).not.toContain('premium-state-loss');
    expect(header).not.toContain('premium-glow-win');
    expect(header).not.toContain('premium-glow-loss');

    expect(css).toContain('Pass 8.3b: intensified resting aura/glow');
    expect(css).toContain('Additive semantic edge — aura/glass remain untouched');
    expect(css).toContain('--premium-semantic-role-near-radius: 48px;');
    expect(css).toContain('--premium-semantic-role-near-alpha: 0.34;');
  });
});
