import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 9.2 navigation refinement', () => {
  it('keeps the three navigation groups and all seven destinations intact', () => {
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

  it('uses explicit active and idle navigation roles without changing routing behavior', () => {
    const header = readRelative('./Header.tsx');

    expect(header).toContain('premium-nav-group');
    expect(header).toContain('premium-nav-active text-white font-semibold');
    expect(header).toContain("'premium-nav-idle'");
    expect(header).toContain('premium-nav-label-compact');
    expect(header).toContain('premium-nav-label-full');
    expect(header).toContain('onClick={() => setActiveTab(item.tab)}');
    expect(header).toContain('aria-current={active ? \'page\' : undefined}');
  });

  it('retains keyboard and overflow navigation contracts', () => {
    const header = readRelative('./Header.tsx');

    expect(header).toContain("['ArrowLeft', 'ArrowRight', 'Home', 'End']");
    expect(header).toContain('scrollNavItemIntoView');
    expect(header).toContain('canScrollNavLeft');
    expect(header).toContain('canScrollNavRight');
    expect(header).toContain('premium-nav-scroller');
  });

  it('keeps active accent localized and gives keyboard focus an explicit visible state', () => {
    const css = readRelative('../index.css');
    const start = css.indexOf('Phase 9.2 — navigation refinement');
    const end = css.indexOf('Phase 9.1 — command-zone header shell');

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const block = css.slice(start, end);
    expect(block).toContain('.premium-nav-item.premium-nav-idle');
    expect(block).toContain('.premium-nav-item.premium-nav-active::after');
    expect(block).toContain('.premium-nav-item:focus-visible');
    expect(block).toContain('.premium-nav-group:has(.premium-nav-active)');
    expect(block).not.toContain('.premium-card');
    expect(block).not.toContain('.premium-semantic-edge');
  });

  it('does not change Phase 8 material contracts while refining header navigation', () => {
    const css = [readRelative('../index.css'), readRelative('../styles/semantics.css')].join('\n');

    expect(css).toContain('Pass 8.3b: intensified resting aura/glow');
    expect(css).toContain('--premium-semantic-role-near-radius: 48px;');
    expect(css).toContain('--premium-semantic-role-near-alpha: 0.34;');
    expect(css).toContain('Additive semantic edge — aura/glass remain untouched');
    expect(css).toContain('border-radius: inherit');
  });
});
