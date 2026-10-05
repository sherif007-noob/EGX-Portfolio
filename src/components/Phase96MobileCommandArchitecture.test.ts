import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 9.6 mobile command architecture', () => {
  it('keeps mobile command ownership explicit and accessible', () => {
    const header = readRelative('./Header.tsx');

    expect(header).toContain('aria-label="Quick utilities"');
    expect(header).toContain('aria-label="Data and settings"');
    expect(header).toContain('aria-label="Create portfolio activity"');

    expect(header).toContain('id="header-price-alerts-btn"');
    expect(header).toContain('id="header-live-sync-btn"');
    expect(header).toContain('id="header-data-tools-btn"');
    expect(header).toContain('id="header-settings-btn"');
    expect(header).toContain('id="header-scan-btn"');
    expect(header).toContain('id="header-bonus-shares-btn"');
    expect(header).toContain('id="header-add-trade-btn"');
  });

  it('centers the active/focused navigation item on compact viewports', () => {
    const header = readRelative('./Header.tsx');

    expect(header).toContain('const compactViewport = container.clientWidth < 640');
    expect(header).toContain('itemRect.width / 2');
    expect(header).toContain('nextLeft = itemCenter - container.clientWidth / 2');
    expect(header).toContain('Math.min(maxLeft, Math.max(0, nextLeft))');
  });

  it('lets only quick utilities scroll while data/settings and creation remain fixed-access', () => {
    const css = readRelative('../index.css');
    const start = css.indexOf('Phase 9.6 — mobile command architecture');
    const end = css.indexOf('iPhone landscape edge-to-edge viewport', start);
    const block = css.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('grid-template-columns: minmax(0, 1fr) auto auto');
    expect(block).toContain('.premium-header-utility-scroller');
    expect(block).toContain('overflow-x: auto');
    expect(block).toContain('.premium-header-data-cluster');
    expect(block).toContain('.premium-header-create-cluster');
    expect(block).toContain('overflow: visible !important');
  });

  it('preserves 44px touch targets including short landscape', () => {
    const css = readRelative('../index.css');
    const start = css.indexOf('Phase 9.6 — mobile command architecture');
    const end = css.indexOf('iPhone landscape edge-to-edge viewport', start);
    const block = css.slice(start, end);

    expect(block).toContain('min-width: var(--premium-touch-target)');
    expect(block).toContain('min-height: var(--premium-touch-target)');
    expect(block).toContain('.premium-header-action-rail .premium-action');
  });

  it('keeps direct navigation and safe-area infrastructure intact', () => {
    const header = readRelative('./Header.tsx');
    const css = readRelative('../index.css');

    expect(header).toContain('premium-nav-scroller');
    expect(header).toContain('aria-current={active ? \'page\' : undefined}');
    expect(header).toContain("['ArrowLeft', 'ArrowRight', 'Home', 'End']");
    expect(css).toContain('env(safe-area-inset-left)');
    expect(css).toContain('env(safe-area-inset-right)');
    expect(css).toContain('env(safe-area-inset-top)');
  });

  it('does not reopen Phase 8 card material or semantic contracts', () => {
    const css = [readRelative('../index.css'), readRelative('../styles/semantics.css')].join('\n');

    expect(css).toContain('Pass 8.3b: intensified resting aura/glow');
    expect(css).toContain('Additive semantic edge — aura/glass remain untouched');
    expect(css).toContain('--premium-semantic-role-near-radius: 48px;');
    expect(css).toContain('--premium-semantic-role-near-alpha: 0.34;');
  });
});
