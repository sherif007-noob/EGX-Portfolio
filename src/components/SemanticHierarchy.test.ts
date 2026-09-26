import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readCss = () =>
  readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8');

describe('Phase 8 protected visual-language contract', () => {
  it('keeps hierarchy structural and material-agnostic', () => {
    const css = readCss();
    const start = css.indexOf('Phase 8 — structural hierarchy language');
    expect(start).toBeGreaterThanOrEqual(0);

    const phase8 = css.slice(start);
    for (const level of ['h1', 'h2', 'h3', 'h4', 'h5']) {
      expect(phase8).not.toContain(`.premium-hierarchy-${level} {`);
      expect(phase8).not.toContain(`.premium-card.premium-hierarchy-${level}`);
    }
  });

  it('defines exactly three semantic surface roles with bounded accepted strength', () => {
    const css = readCss();
    const start = css.indexOf('Canonical semantic surface roles');
    const roles = css.slice(start);

    expect(roles).toContain('.premium-semantic-hero');
    expect(roles).toContain('.premium-semantic-card');
    expect(roles).toContain('.premium-semantic-record');

    // Hero uses the accepted Phase 5 hero values rather than the later overblown patch.
    expect(roles).toContain('--premium-semantic-near-alpha: 0.22');
    expect(roles).toContain('--premium-semantic-far-alpha: 0.095');
    expect(roles).toContain('--premium-semantic-far-radius: 72px');

    // Standard card is the accepted Phase 5 semantic card.
    expect(roles).toContain('--premium-semantic-near-alpha: 0.18');
    expect(roles).toContain('--premium-semantic-far-alpha: 0.075');
    expect(roles).toContain('--premium-semantic-far-radius: 68px');

    // Record stays visible but uses a tighter far field.
    expect(roles).toContain('--premium-semantic-far-alpha: 0.065');
    expect(roles).toContain('--premium-semantic-far-radius: 60px');
  });

  it('keeps record edge coding as an additional cue, not a halo replacement', () => {
    const css = readCss();
    const start = css.indexOf('Canonical semantic surface roles');
    const roles = css.slice(start);

    expect(roles).toContain('.premium-card.premium-semantic-record:is(');
    expect(roles).toContain('inset 3px 0 0 rgb(var(--premium-semantic-rgb) / 0.66)');
    expect(roles).toContain('0 0 30px rgb(var(--premium-semantic-rgb) / var(--premium-semantic-near-alpha))');
    expect(roles).toContain('0 0 var(--premium-semantic-far-radius) rgb(var(--premium-semantic-deep-rgb) / var(--premium-semantic-far-alpha))');
  });

  it('does not reintroduce the emergency Phase 8 repair layers', () => {
    const css = readCss();

    expect(css).not.toContain('Phase 8 semantic-soul correction');
    expect(css).not.toContain('Phase 8 protected visual-language restoration');
    expect(css).not.toContain('Phase 8 visual-language hard reset');
  });
});
