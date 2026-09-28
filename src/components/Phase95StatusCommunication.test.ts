import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 9.5 status communication', () => {
  it('keeps alert state local instead of permanently promoting the entire button', () => {
    const header = readRelative('./Header.tsx');
    const start = header.indexOf('id="header-price-alerts-btn"');
    const block = header.slice(start, start + 1800);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(block).toContain("data-status={unreadAlertCount > 0 ? 'attention' : isAlertsActive ? 'active' : 'paused'}");
    expect(block).toContain("unreadAlertCount > 0 ? 'premium-header-action-attention' : ''");
    expect(block).toContain('premium-header-status-badge-amber');
    expect(block).toContain('premium-header-status-dot-connected');
    expect(block).toContain('premium-header-status-dot-muted');
    expect(block).not.toContain('animate-bounce');
  });

  it('communicates sync progress with running state, label and compact indicator', () => {
    const header = readRelative('./Header.tsx');
    const start = header.indexOf('id="header-live-sync-btn"');
    const block = header.slice(start, start + 1400);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(block).toContain("data-status={isSyncingPrices ? 'running' : 'idle'}");
    expect(block).toContain("isSyncingPrices ? 'premium-header-action-running' : ''");
    expect(block).toContain("isSyncingPrices ? 'Syncing...' : 'Sync Prices'");
    expect(block).toContain('premium-header-status-dot-running');
    expect(block).toContain('animate-spin');
  });

  it('temporarily promotes only the data warning while preserving connected status locally', () => {
    const header = readRelative('./Header.tsx');
    const start = header.indexOf('id="header-data-tools-btn"');
    const block = header.slice(start, start + 1900);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(block).toContain("data-status={isTokenExpired ? 'attention' : isSheetsConnected ? 'connected' : 'idle'}");
    expect(block).toContain("'premium-header-action-amber premium-header-action-attention'");
    expect(block).toContain("'premium-header-action-purple'");
    expect(block).toContain('premium-header-status-dot-warning');
    expect(block).toContain('premium-header-status-dot-connected');
  });

  it('uses one shared compact status vocabulary', () => {
    const css = readRelative('../index.css');
    const start = css.indexOf('Phase 9.5 — compact status communication');
    const end = css.indexOf('Phase 9.4 — utility/data-management consolidation');
    const block = css.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('.premium-header-action-running');
    expect(block).toContain('.premium-header-status-dot-connected');
    expect(block).toContain('.premium-header-status-dot-warning');
    expect(block).toContain('.premium-header-status-dot-running');
    expect(block).toContain('.premium-header-status-dot-muted');
    expect(block).toContain('.premium-header-status-badge-amber');
  });

  it('keeps Phase 8 material contracts untouched', () => {
    const css = readRelative('../index.css');

    expect(css).toContain('Pass 8.3b: intensified resting aura/glow');
    expect(css).toContain('Additive semantic edge — aura/glass remain untouched');
    expect(css).toContain('--premium-semantic-role-near-radius: 48px;');
    expect(css).toContain('--premium-semantic-role-near-alpha: 0.34;');
  });
});
