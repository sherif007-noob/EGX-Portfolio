import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 9.4 Data & Tools viewport safety', () => {
  it('portals the menu outside sticky-header clipping contexts', () => {
    const header = readRelative('./Header.tsx');

    expect(header).toContain("import { createPortal } from 'react-dom'");
    expect(header).toContain('dataToolsMenuRef');
    expect(header).toContain('createPortal(');
    expect(header).toContain('document.body');
    expect(header).toContain('premium-header-tools-menu fixed');
  });

  it('clamps the menu to the visible safe-area content bounds', () => {
    const header = readRelative('./Header.tsx');

    expect(header).toContain("trigger.closest<HTMLElement>('.premium-safe-inline-header')");
    expect(header).toContain("window.getComputedStyle(safeHost)");
    expect(header).toContain('safeHostStyle?.paddingLeft');
    expect(header).toContain('safeHostStyle?.paddingRight');
    expect(header).toContain('const width = Math.min(304, availableWidth)');
    expect(header).toContain('Math.min(maxLeft, Math.max(safeLeft, preferredLeft))');
  });

  it('repositions when the viewport changes and keeps outside-click behavior working', () => {
    const header = readRelative('./Header.tsx');

    expect(header).toContain("window.addEventListener('resize', updateDataToolsMenuGeometry)");
    expect(header).toContain("window.visualViewport?.addEventListener('resize', updateDataToolsMenuGeometry)");
    expect(header).toContain("window.visualViewport?.addEventListener('scroll', updateDataToolsMenuGeometry)");
    expect(header).toContain('dataToolsMenuRef.current?.contains');
    expect(header).toContain('!clickedTrigger && !clickedMenu');
  });

  it('does not rely on right-aligned absolute positioning anymore', () => {
    const header = readRelative('./Header.tsx');
    const start = header.indexOf('id="header-data-tools-menu"');
    const block = header.slice(start, start + 700);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(block).toContain('premium-header-tools-menu fixed');
    expect(block).not.toContain('absolute right-0 top-full');
  });
});
