import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 8.4 typography foundation', () => {
  it('defines exactly six hierarchy text roles plus a four-step metric scale', () => {
    const hierarchy = readRelative('./VisualHierarchy.tsx');

    for (const role of [
      "'page-title'",
      "'section-title'",
      "'metric'",
      "'metric-label'",
      "'metadata'",
      "'helper'",
    ]) {
      expect(hierarchy).toContain(role);
    }

    for (const scale of [
      "hero: 'premium-type-metric-hero'",
      "primary: 'premium-type-metric-primary'",
      "secondary: 'premium-type-metric-secondary'",
      "dense: 'premium-type-metric-dense'",
    ]) {
      expect(hierarchy).toContain(scale);
    }
  });

  it('keeps the typography scale material-neutral', () => {
    const css = readRelative('../index.css');
    const start = css.indexOf('/* Typography hierarchy only. */');
    const end = css.indexOf('/* Canonical spacing hierarchy. */');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const block = css.slice(start, end);
    expect(block).toContain('.premium-type-metric-hero');
    expect(block).toContain('.premium-type-metric-primary');
    expect(block).toContain('.premium-type-metric-secondary');
    expect(block).toContain('.premium-type-metric-dense');
    expect(block).toContain('.premium-type-unit');

    expect(block).not.toMatch(/box-shadow|background:|backdrop-filter|border-color|filter:/);
    expect(block).not.toContain('premium-semantic-edge');
    expect(block).not.toContain('premium-glow-');
  });

  it('keeps the accepted material and semantic-edge blocks intact and separate', () => {
    const css = readRelative('../index.css');
    expect(css).toContain('Phase 8 material restoration — Monthly Report quality reference');
    expect(css).toContain('Additive semantic edge — aura/glass remain untouched');
    expect(css).toContain('Pass 8.3b: intensified resting aura/glow');
  });
});
