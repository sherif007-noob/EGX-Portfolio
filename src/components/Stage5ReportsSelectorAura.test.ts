import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Stage 5 Reports selector visual-language correction', () => {
  it('uses the shared selector shell with the structural emphasis treatment', () => {
    const navigation = readRelative('./reports/ReportsNavigation.tsx');

    expect(navigation).toContain(
      'premium-selector-shell premium-selector-shell-emphasis premium-reports-mode-rail',
    );
    expect(navigation).toContain('role="tab"');
    expect(navigation).toContain('aria-selected={active}');
    expect(navigation).toContain("active ? 'premium-filter-active-cyan' : ''");
  });

  it('treats aria-selected tabs as selected in the shared selector aura contract', () => {
    const controls = readRelative('../styles/controls.css');

    expect(controls).toContain(
      '.premium-filter-pill[role="tab"][aria-selected="true"]::before',
    );
    expect(controls).toContain('.premium-selector-shell-emphasis {');
    expect(controls).toContain('0 0 28px rgba(34, 211, 238, 0.13)');
    expect(controls).toContain('0 0 58px rgba(139, 92, 246, 0.06)');
  });

  it('gives the active structural tab a visible cyan near/far aura without financial semantics', () => {
    const controls = readRelative('../styles/controls.css');

    expect(controls).toContain(
      '.premium-filter-pill[role="tab"][aria-selected="true"].premium-filter-active-cyan',
    );
    expect(controls).toContain('0 0 22px rgba(34,211,238,0.22)');
    expect(controls).toContain('0 0 46px rgba(8,145,178,0.10)');
    expect(controls).not.toContain(
      '.premium-filter-pill[role="tab"][aria-selected="true"].premium-glow-win',
    );
    expect(controls).not.toContain(
      '.premium-filter-pill[role="tab"][aria-selected="true"].premium-glow-loss',
    );
  });
});
