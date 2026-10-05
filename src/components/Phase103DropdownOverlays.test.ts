import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const componentsDir = fileURLToPath(new URL('./', import.meta.url));

const collectDropdownPresenceOpeningTags = (source: string): string[] => {
  const tags: string[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    const start = source.indexOf('<DropdownPresence', cursor);
    if (start < 0) break;

    const tokenEnd = start + '<DropdownPresence'.length;
    const nextChar = source[tokenEnd];
    if (nextChar && /[A-Za-z0-9_$]/.test(nextChar)) {
      cursor = tokenEnd;
      continue;
    }

    let braceDepth = 0;
    let quote: '"' | "'" | '`' | null = null;
    let escaped = false;
    let closed = false;

    for (let index = start; index < source.length; index += 1) {
      const char = source[index];

      if (quote) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === '\\') {
          escaped = true;
          continue;
        }
        if (char === quote) quote = null;
        continue;
      }

      if (char === '"' || char === "'" || char === '`') {
        quote = char;
        continue;
      }
      if (char === '{') {
        braceDepth += 1;
        continue;
      }
      if (char === '}') {
        braceDepth = Math.max(0, braceDepth - 1);
        continue;
      }
      if (char === '>' && braceDepth === 0) {
        tags.push(source.slice(start, index + 1));
        cursor = index + 1;
        closed = true;
        break;
      }
    }

    if (!closed) break;
  }

  return tags;
};

const collectTsx = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return collectTsx(full);
    return entry.isFile() && entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')
      ? [full]
      : [];
  });

describe('Phase 10.3 dropdowns, menus, popovers and overlays', () => {
  it('keeps body-portaled dropdowns fixed, viewport-aware, height-capped and internally scrollable', () => {
    const motion = readRelative('./PremiumMotion.tsx');

    expect(motion).toContain("createPortal(dropdown, document.body)");
    expect(motion).toContain("position: 'fixed'");
    expect(motion).toContain('window.visualViewport');
    expect(motion).toContain('computeDropdownViewportGeometry');
    expect(motion).toContain('maxHeight?: number | string');
    expect(motion).toContain("maxHeight = 'min(70dvh, 24rem)'");
    expect(motion).toContain(
      "maxHeight: `min(${geometry.maxHeight}px, ${resolvedMaxHeight})`",
    );
    expect(motion).toContain("overflowY: 'auto'");
    expect(motion).toContain("overscrollBehavior: 'contain'");
  });

  it('requires every DropdownPresence owner to opt into portal, anchor and an explicit content cap', () => {
    const owners: string[] = [];

    for (const file of collectTsx(componentsDir)) {
      const source = readFileSync(file, 'utf8');
      const tags = collectDropdownPresenceOpeningTags(source);
      if (tags.length === 0) continue;

      owners.push(file);
      for (const tag of tags) {
        expect(tag, file).toContain('portal');
        expect(tag, file).toContain('anchorRef=');
        expect(tag, file).toContain('maxHeight=');
      }
    }

    expect(owners.length).toBe(3);
  });

  it('preserves the intended scroll cap for each content dropdown family', () => {
    const select = readRelative('./AnalyticsSelect.tsx');
    const addTrade = readRelative('./AddTradeModal.tsx');
    const chart = readRelative('./charts/PerformanceTimeframeChart.tsx');

    expect(select).toContain('maxHeight="18rem"');
    expect(select).not.toContain("'max-h-72 overflow-y-auto'");

    expect(addTrade).toContain('maxHeight="16rem"');
    expect(addTrade).not.toContain('max-h-64 overflow-y-auto rounded-xl');

    expect(chart).toContain('maxHeight="24rem"');

    for (const source of [select, addTrade, chart]) {
      expect(source).toContain('premium-dropdown');
      expect(
        source.includes('premium-menu-item') ||
          source.includes('PREMIUM_PRIMITIVE_CLASS.menuItem'),
      ).toBe(true);
    }
  });

  it('keeps the Phase 9 Data & Tools menu as the frozen header-owned portal exception', () => {
    const header = readRelative('./Header.tsx');
    const phase9 = readRelative('../../docs/PHASE9_HEADER_NAVIGATION_PLAN.md');

    expect(phase9).toContain('PHASE 9 SOURCE-FROZEN');
    expect(header).toContain('createPortal(');
    expect(header).toContain('document.body');
    expect(header).toContain(
      'premium-floating premium-dropdown premium-header-tools-menu fixed z-[80] max-h-[min(70dvh,24rem)] overflow-y-auto overflow-x-hidden',
    );
    expect(header).toContain(
      "safeHost = trigger.closest<HTMLElement>('.premium-safe-inline-header')",
    );
  });

  it('keeps the canonical glass material and portaled geometry authoritative', () => {
    const materials = readRelative('../styles/materials.css');
    const overlays = readRelative('../styles/overlays.css');

    expect(overlays).toContain('Canonical app dropdown surface — Data & Tools visual reference');
    expect(materials).toContain('.premium-dropdown {');
    expect(overlays).toContain("premium-dropdown[data-premium-dropdown-portal='true']");
    expect(overlays).toContain('min-width: 0 !important');
    expect(overlays).toContain('max-width: none !important');
    expect(materials).toContain('backdrop-filter: blur(34px) saturate(175%) brightness(1.06)');
  });

  it('does not reopen Phase 8 material, Phase 9 header, chart or data behavior', () => {
    const contract = readRelative('../../docs/PREMIUM_VISUAL_LANGUAGE_CONTRACT.md');
    const phase9 = readRelative('../../docs/PHASE9_HEADER_NAVIGATION_PLAN.md');
    const chart = readRelative('./charts/PerformanceTimeframeChart.tsx');

    expect(contract).toContain('Hierarchy classes must never redefine material');
    expect(contract).toContain('edge must never replace the halo');
    expect(phase9).toContain('PHASE 9 SOURCE-FROZEN');
    expect(chart).toContain('weeklyLineInterpolator');
    expect(chart).toContain('TODAY_RESOLUTIONS');
    expect(chart).toContain('TIMEFRAMES');
  });
});
