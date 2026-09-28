import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const componentsDir = fileURLToPath(new URL('./', import.meta.url));

const collectTsx = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return collectTsx(full);
    return entry.isFile() && entry.name.endsWith('.tsx') ? [full] : [];
  });

describe('canonical dropdown visual standard', () => {
  it('uses the Data & Tools reference recipe at the requested higher transparency', () => {
    const css = readRelative('../index.css');
    const start = css.indexOf('Canonical app dropdown surface — Data & Tools visual reference');
    const end = css.indexOf('Phase 5 canonical semantic halo system', start);
    const block = css.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('rgba(8, 15, 31, 0.60)');
    expect(block).toContain('rgba(8, 15, 31, 0.56)');
    expect(block).toContain('backdrop-filter: blur(34px) saturate(175%) brightness(1.06)');
    expect(block).toContain('backdrop-filter: blur(26px) saturate(165%) brightness(1.05)');
  });

  it('keeps every current custom dropdown owner on premium-dropdown', () => {
    const analyticsSelect = readRelative('./AnalyticsSelect.tsx');
    const addTrade = readRelative('./AddTradeModal.tsx');
    const chart = readRelative('./charts/PerformanceTimeframeChart.tsx');
    const header = readRelative('./Header.tsx');

    for (const source of [analyticsSelect, addTrade, chart, header]) {
      expect(source).toContain('premium-dropdown');
    }
  });

  it('renders content dropdowns in the same body-level overlay context as Data & Tools', () => {
    const analyticsSelect = readRelative('./AnalyticsSelect.tsx');
    const addTrade = readRelative('./AddTradeModal.tsx');
    const chart = readRelative('./charts/PerformanceTimeframeChart.tsx');
    const motion = readRelative('./PremiumMotion.tsx');
    const header = readRelative('./Header.tsx');

    for (const source of [analyticsSelect, addTrade, chart]) {
      expect(source).toContain('portal');
      expect(source).toContain('anchorRef=');
    }

    expect(motion).toContain("createPortal(dropdown, document.body)");
    expect(motion).toContain("data-premium-dropdown-portal={portal ? 'true' : undefined}");
    expect(header).toContain('createPortal(');
    expect(header).toContain('document.body');
  });

  it('rejects the legacy opaque slate dropdown surface anywhere in component TSX', () => {
    const sources = collectTsx(componentsDir).map((file) => readFileSync(file, 'utf8'));
    const joined = sources.join('\n');

    expect(joined).not.toContain('bg-slate-950/98');
    expect(joined).not.toContain('shadow-2xl shadow-black/50 backdrop-blur-xl');
  });

  it('requires every menu/listbox owner to opt into the canonical dropdown surface', () => {
    for (const file of collectTsx(componentsDir)) {
      const source = readFileSync(file, 'utf8');
      const ownsDropdown =
        source.includes('role="menu"') ||
        source.includes('role="listbox"') ||
        source.includes('role="menuitem"') ||
        source.includes('role="menuitemradio"');

      if (ownsDropdown) {
        expect(source, file).toContain('premium-dropdown');
      }
    }
  });

  it('keeps dropdown rows on the shared premium menu-item language', () => {
    const analyticsSelect = readRelative('./AnalyticsSelect.tsx');
    const addTrade = readRelative('./AddTradeModal.tsx');
    const chart = readRelative('./charts/PerformanceTimeframeChart.tsx');
    const header = readRelative('./Header.tsx');

    for (const source of [analyticsSelect, addTrade, chart, header]) {
      expect(
        source.includes('premium-menu-item') ||
          source.includes('PREMIUM_PRIMITIVE_CLASS.menuItem'),
      ).toBe(true);
    }
  });
});
