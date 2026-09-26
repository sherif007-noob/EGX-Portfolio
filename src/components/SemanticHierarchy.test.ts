import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readCss = () =>
  readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8');

describe('Phase 8 semantic hierarchy contract', () => {
  it('preserves a visible semantic aura on H1, H2, and H3 financial surfaces', () => {
    const css = readCss();

    expect(css).toContain('Phase 8 semantic-soul correction');
    expect(css).toContain('.premium-hierarchy-h1:is(');
    expect(css).toContain('.premium-hierarchy-h2:is(');
    expect(css).toContain('.premium-hierarchy-h3:is(');

    expect(css).toContain('--premium-semantic-near-alpha: 0.24');
    expect(css).toContain('--premium-semantic-far-alpha: 0.11');
    expect(css).toContain('--premium-semantic-near-alpha: 0.17');
    expect(css).toContain('--premium-semantic-far-alpha: 0.075');
    expect(css).toContain('--premium-semantic-near-alpha: 0.13');
    expect(css).toContain('--premium-semantic-far-alpha: 0.055');
  });

  it('never zeros near/far glow on semantic H5 cards', () => {
    const css = readCss();
    const start = css.indexOf('Phase 8 semantic-soul correction');
    const semanticSection = css.slice(start);

    expect(semanticSection).toContain('--premium-semantic-near-alpha: 0.105');
    expect(semanticSection).toContain('--premium-semantic-far-alpha: 0.042');
    expect(semanticSection).toContain('0 0 20px rgb(var(--premium-semantic-rgb)');
    expect(semanticSection).toContain(
      '0 0 var(--premium-semantic-far-radius) rgb(var(--premium-semantic-deep-rgb)',
    );
  });
});
