import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 9.7 desktop / 2XL header refinement', () => {
  it('uses a bounded desktop grid instead of stretching the header across the viewport', () => {
    const css = readRelative('../index.css');
    const start = css.indexOf('Phase 9.7 — desktop / 2XL header refinement');
    const block = css.slice(start);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(block).toContain('@media (min-width: 1024px) and (min-height: 521px)');
    expect(block).toContain('grid-template-columns: minmax(15.5rem, 0.72fr) max-content');
    expect(block).toContain('grid-template-columns: auto auto auto');
    expect(block).toContain('justify-self: end');
    expect(block).not.toContain('justify-content: space-between');
  });


  it('lets the desktop header use spare viewport width and clears stale nav scroll', () => {
    const header = readRelative('./Header.tsx');

    expect(header.match(/xl:max-w-\[100rem\]/g)?.length).toBe(2);
    expect(header).toContain('const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth)');
    expect(header).toContain('if (maxScrollLeft <= tolerance)');
    expect(header).toContain('container.scrollLeft = 0');
    expect(header).toContain('setCanScrollNavLeft(false)');
    expect(header).toContain('setCanScrollNavRight(false)');
  });

  it('keeps laptop-width desktop compact while preserving the primary creation label', () => {
    const css = readRelative('../index.css');
    const start = css.indexOf('@media (min-width: 1024px) and (max-width: 1279px) and (min-height: 521px)');
    const end = css.indexOf('/* Standard desktop has room', start);
    const block = css.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('#header-price-alerts-btn .premium-header-action-label');
    expect(block).toContain('#header-data-tools-btn .premium-header-action-label');
    expect(block).toContain('#header-scan-btn .premium-header-action-label');
    expect(block).toContain('display: none !important');
    expect(block).not.toContain('#header-add-trade-btn .premium-header-action-label');
  });

  it('uses wider screens for existing context rather than new functionality', () => {
    const header = readRelative('./Header.tsx');
    const css = readRelative('../index.css');
    const start = css.indexOf('@media (min-width: 1536px) and (min-height: 521px)');
    const block = css.slice(start);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(header).toContain('premium-nav-group-label hidden 2xl:inline-flex');
    expect(header).toContain('premium-nav-label-full hidden 2xl:inline');
    expect(header).toContain('premium-header-action-label hidden 2xl:inline">Settings</span>');
    expect(block).toContain('.premium-header-command-zone');
    expect(block).toContain('.premium-header-nav-row');
  });

  it('keeps mobile and short-landscape architecture isolated from desktop rules', () => {
    const css = readRelative('../index.css');

    const mobileStart = css.indexOf('Phase 9.6 — mobile command architecture');
    const desktopStart = css.indexOf('Phase 9.7 — desktop / 2XL header refinement');
    expect(mobileStart).toBeGreaterThanOrEqual(0);
    expect(desktopStart).toBeGreaterThan(mobileStart);

    const desktopBlock = css.slice(desktopStart);
    expect(desktopBlock).toContain('(min-height: 521px)');
    expect(desktopBlock).not.toContain('@media (max-width: 639px)');
    expect(css).toContain('@media (orientation: landscape) and (max-height: 520px)');
  });

  it('preserves navigation interaction and Phase 8 material contracts', () => {
    const header = readRelative('./Header.tsx');
    const css = [readRelative('../index.css'), readRelative('../styles/semantics.css')].join('\n');

    expect(header).toContain('aria-current={active ? \'page\' : undefined}');
    expect(header).toContain("['ArrowLeft', 'ArrowRight', 'Home', 'End']");
    expect(header).toContain('scrollNavItemIntoView');
    expect(css).toContain('Pass 8.3b: intensified resting aura/glow');
    expect(css).toContain('Additive semantic edge — aura/glass remain untouched');
  });
});
