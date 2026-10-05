import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('rendered visual regression gate', () => {
  it('turns every over-threshold comparison into a process-failing error', () => {
    const script = read('scripts/renderedRegression.mjs');

    expect(script).toContain("if (item.status === 'failed')");
    expect(script).toContain("report.errors.push(\`${item.name}: ${detail}\`)");
    expect(script).toContain('process.exitCode = 1');
  });

  it('keeps the one-percent threshold explicit in both visual workflows', () => {
    const rendered = read('.github/workflows/rendered-regression.yml');
    const closure = read('.github/workflows/phase10-closure.yml');

    expect(rendered).toContain("VISUAL_MAX_DIFF_RATIO: '0.01'");
    expect(closure).toContain("VISUAL_MAX_DIFF_RATIO: '0.01'");
  });
});
