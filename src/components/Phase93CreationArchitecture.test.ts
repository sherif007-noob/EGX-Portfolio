import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 9.3 primary creation architecture', () => {
  it('keeps Add Trade as the only primary creation action', () => {
    const header = readRelative('./Header.tsx');

    const addStart = header.indexOf('id="header-add-trade-btn"');
    const scanStart = header.indexOf('id="header-scan-btn"');
    expect(addStart).toBeGreaterThanOrEqual(0);
    expect(scanStart).toBeGreaterThanOrEqual(0);

    const add = header.slice(addStart, addStart + 800);
    const scan = header.slice(scanStart, scanStart + 800);

    expect(add).toContain('data-action-priority="creation-primary"');
    expect(add).toContain('premium-action-primary');
    expect(add).toContain('premium-header-create-primary');
    expect(add).toContain('premium-shimmer-border');

    expect(scan).toContain('data-action-priority="creation-secondary"');
    expect(scan).toContain('premium-header-create-secondary');
    expect(scan).not.toContain('premium-action-primary');
    expect(scan).not.toContain('premium-shimmer-border');
  });

  it('groups both creation paths into one dedicated premium creation cluster', () => {
    const header = readRelative('./Header.tsx');
    const clusterStart = header.indexOf('premium-header-create-cluster');
    const navStart = header.indexOf('Navigation Tabs Bar');

    expect(clusterStart).toBeGreaterThanOrEqual(0);
    expect(navStart).toBeGreaterThan(clusterStart);

    const cluster = header.slice(clusterStart, navStart);
    expect(cluster).toContain('header-scan-btn');
    expect(cluster).toContain('header-add-trade-btn');
    expect(cluster).toContain('aria-label="Scan receipt to add trade"');
    expect(cluster).toContain('aria-label="Add trade"');
  });

  it('uses the same premium material family while keeping primary stronger than secondary', () => {
    const css = readRelative('../styles/features/header.css');

    expect(css).toContain('.premium-header-create-cluster');
    expect(css).toContain('backdrop-filter: blur(16px) saturate(138%)');

    const secondaryStart = css.indexOf('.premium-header-create-secondary {');
    const primaryStart = css.indexOf('.premium-header-create-primary {');
    const clusterStart = css.indexOf('.premium-header-create-cluster {', primaryStart);

    const secondary = css.slice(secondaryStart, primaryStart);
    const primary = css.slice(primaryStart, clusterStart);

    expect(secondary).toContain('rgba(16, 185, 129, 0.11)');
    expect(primary).toContain('rgba(59, 130, 246, 0.17)');
    expect(primary).toContain('rgba(59, 130, 246, 0.07)');
    expect(primary).toContain('border-color: rgba(96, 165, 250, 0.58)');
  });

  it('preserves existing creation callbacks and Phase 8 material contracts', () => {
    const header = readRelative('./Header.tsx');
    const css = [readRelative('../styles/features/header.css'), readRelative('../styles/semantics.css')].join('\n');

    expect(header).toContain('onClick={onOpenScreenshotModal}');
    expect(header).toContain('onClick={onOpenAddTrade}');

    expect(css).toContain('Pass 8.3b: intensified resting aura/glow');
    expect(css).toContain('Additive semantic edge — aura/glass remain untouched');
    expect(css).toContain('--premium-semantic-role-near-radius: 48px;');
    expect(css).toContain('--premium-semantic-role-near-alpha: 0.34;');
  });
});
