import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 8 material restoration', () => {
  it('keeps hierarchy cards on the Monthly Report glass/aura family', () => {
    const css = readRelative('../index.css');
    expect(css).toContain('Phase 8 material restoration — Monthly Report quality reference');
    expect(css).toContain('0 0 48px rgb(var(--premium-semantic-rgb) / 0.34)');
    expect(css).toContain('0 0 112px rgb(var(--premium-semantic-deep-rgb) / 0.18)');
    expect(css).toContain('blur(24px) saturate(158%)');
    expect(css).toContain('rgba(12, 20, 39, 0.58)');
    expect(css).toContain('Pass 8.3b: intensified resting aura/glow');
    expect(css).toContain('0 0 58px rgb(var(--premium-semantic-rgb) / 0.40)');
    expect(css).toContain('0 0 132px rgb(var(--premium-semantic-deep-rgb) / 0.24)');
  });

  it('does not replace dense semantic cards with edge-only coding', () => {
    const css = readRelative('../index.css');
    const restoration = css.slice(
      css.indexOf('Phase 8 material restoration — Monthly Report quality reference'),
    );
    expect(restoration).not.toContain('inset 3px 0 0 rgb(var(--premium-semantic-rgb)');
    expect(restoration).not.toContain('premium-dense-row.premium-radial::after');
  });

  it('keeps Overview hierarchy while restoring hero, structural tones and feed glass', () => {
    const source = readRelative('./PortfolioSummary.tsx');
    expect(source).toContain('premium-hero-card premium-hierarchy-h1 premium-overview-hero');
    expect(source).toContain('premium-material-tone-cyan premium-hierarchy-h2');
    expect(source).toContain('premium-material-tone-amber premium-hierarchy-h3 premium-overview-fees');
    expect(source).toContain('premium-glass premium-material-tone-cyan premium-hierarchy-h4 premium-overview-market-strip');
  });
});
