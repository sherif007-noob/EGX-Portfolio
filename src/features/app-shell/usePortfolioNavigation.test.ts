import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./usePortfolioNavigation.ts', import.meta.url)),
  'utf8',
);

describe('portfolio tab navigation scroll ownership', () => {
  it('resets document scroll after a real tab commit and skips the initial mount', () => {
    expect(source).toContain('const hasMountedRef = useRef(false)');
    expect(source).toContain("window.scrollTo({ top: 0, left: 0, behavior: 'auto' })");
    expect(source).toContain('}, [activeTab]);');
  });
});
