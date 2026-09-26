import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readCss = () =>
  readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8');

describe('Phase 8 protected visual language', () => {
  it('forces strong frosted glass back onto hierarchy-bearing cards', () => {
    const css = readCss();
    const start = css.indexOf('Phase 8 visual-language hard reset');
    expect(start).toBeGreaterThanOrEqual(0);

    const protectedSection = css.slice(start);
    expect(protectedSection).toContain('rgba(10, 18, 36, 0.50) !important');
    expect(protectedSection).toContain('blur(26px) saturate(155%) !important');
    expect(protectedSection).toContain('rgba(255,255,255,0.060)');
  });

  it('uses a full hero-grade semantic halo for every semantic card', () => {
    const css = readCss();
    const start = css.indexOf('Phase 8 visual-language hard reset');
    const protectedSection = css.slice(start);

    expect(protectedSection).toContain('.premium-card.premium-glow-win');
    expect(protectedSection).toContain('0 0 40px rgb(var(--premium-semantic-rgb) / 0.30)');
    expect(protectedSection).toContain('0 0 92px rgb(var(--premium-semantic-deep-rgb) / 0.15)');
    expect(protectedSection).toContain('blur(24px) saturate(158%) !important');
  });

  it('keeps dense semantic cards haloed and treats the edge as an extra cue only', () => {
    const css = readCss();
    const start = css.indexOf('Phase 8 visual-language hard reset');
    const protectedSection = css.slice(start);

    expect(protectedSection).toContain('.premium-card.premium-dense-row.premium-glow-win');
    expect(protectedSection).toContain('inset 4px 0 0 rgb(var(--premium-semantic-rgb) / 0.78)');
    expect(protectedSection).toContain('0 0 40px rgb(var(--premium-semantic-rgb) / 0.30)');
    expect(protectedSection).toContain('0 0 92px rgb(var(--premium-semantic-deep-rgb) / 0.15)');
  });

  it('gives the enlarged Portfolio Value hero the strongest semantic environment', () => {
    const css = readCss();
    const start = css.indexOf('Phase 8 visual-language hard reset');
    const protectedSection = css.slice(start);

    expect(protectedSection).toContain('.premium-card.premium-hero-card.premium-glow-loss');
    expect(protectedSection).toContain('0 0 52px rgb(var(--premium-semantic-rgb) / 0.38)');
    expect(protectedSection).toContain('0 0 126px rgb(var(--premium-semantic-deep-rgb) / 0.20)');
    expect(protectedSection).toContain('blur(26px) saturate(165%) !important');
  });

  it('does not weaken semantic halos on mobile/coarse pointers', () => {
    const css = readCss();
    const start = css.indexOf('Phase 8 visual-language hard reset');
    const protectedSection = css.slice(start);

    expect(protectedSection).toContain('@media (max-width: 767px), (pointer: coarse)');
    expect(protectedSection).toContain('0 0 44px rgb(var(--premium-semantic-rgb) / 0.34)');
    expect(protectedSection).toContain('0 0 98px rgb(var(--premium-semantic-deep-rgb) / 0.17)');
    expect(protectedSection).toContain('0 0 58px rgb(var(--premium-semantic-rgb) / 0.42)');
    expect(protectedSection).toContain('0 0 138px rgb(var(--premium-semantic-deep-rgb) / 0.22)');
  });
});
