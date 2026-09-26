import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readCss = () =>
  readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8');

describe('Phase 8 semantic hierarchy contract', () => {
  it('restores one full-strength semantic halo engine for every semantic card', () => {
    const css = readCss();
    const start = css.indexOf('Phase 8 protected visual-language restoration');
    expect(start).toBeGreaterThanOrEqual(0);

    const protectedSection = css.slice(start);
    expect(protectedSection).toContain('.premium-card.premium-glow-win');
    expect(protectedSection).toContain('--premium-semantic-near-alpha: 0.22');
    expect(protectedSection).toContain('--premium-semantic-far-alpha: 0.10');
    expect(protectedSection).toContain('--premium-semantic-far-radius: 76px');
    expect(protectedSection).toContain('0 0 34px rgb(var(--premium-semantic-rgb)');
  });

  it('keeps the enlarged Overview hero stronger than the standard semantic card', () => {
    const css = readCss();
    const start = css.indexOf('Phase 8 protected visual-language restoration');
    const protectedSection = css.slice(start);

    expect(protectedSection).toContain('.premium-card.premium-hero-card.premium-glow-loss');
    expect(protectedSection).toContain('--premium-semantic-near-alpha: 0.32');
    expect(protectedSection).toContain('--premium-semantic-far-alpha: 0.16');
    expect(protectedSection).toContain('--premium-semantic-far-radius: 108px');
  });

  it('does not attenuate H2, H3, or H5 semantic cards in the protected layer', () => {
    const css = readCss();
    const start = css.indexOf('Phase 8 protected visual-language restoration');
    const protectedSection = css.slice(start);

    expect(protectedSection).not.toContain('--premium-semantic-near-alpha: 0.105');
    expect(protectedSection).not.toContain('--premium-semantic-far-alpha: 0.042');
    expect(protectedSection).toContain('.premium-card.premium-dense-row.premium-glow-win');
    expect(protectedSection).toContain('--premium-semantic-near-alpha: 0.22');
  });
});
