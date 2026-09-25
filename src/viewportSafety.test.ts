import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('mobile viewport safety contracts', () => {
  it('allows the app surface to paint through iPhone landscape safe areas', () => {
    const html = readRelative('../index.html');
    expect(html).toContain('viewport-fit=cover');
  });

  it('keeps header and main content inside safe-area insets', () => {
    const css = readRelative('./index.css');
    expect(css).toContain('.premium-safe-inline-header');
    expect(css).toContain('.premium-safe-inline-main');
    expect(css).toContain('env(safe-area-inset-left)');
    expect(css).toContain('env(safe-area-inset-right)');
  });
});
