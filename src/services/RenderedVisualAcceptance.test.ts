import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('rendered visual exact-hash acceptance', () => {
  it('accepts only the inspected Stage 5 R3 Reports screenshot bytes', () => {
    const manifest = JSON.parse(read('visual-regression/accepted-changes.json'));

    expect(Object.keys(manifest)).toEqual(['reports-desktop']);
    expect(manifest['reports-desktop'].sha256).toBe(
      'a48aab3ab17c5a06e856ee1f2d02ec5f96e6ab7d376b7c6903e4466dbc786b5f',
    );
    expect(manifest['reports-desktop'].reason).toContain('Stage 5 R3');
  });

  it('does not weaken the global visual threshold', () => {
    const script = read('scripts/renderedRegression.mjs');

    expect(script).toContain("const maxDiffRatio = Number(process.env.VISUAL_MAX_DIFF_RATIO || 0.01)");
    expect(script).toContain("crypto.createHash('sha256')");
    expect(script).toContain("comparison.status === 'failed' && accepted?.sha256");
    expect(script).toContain("currentSha256 === accepted.sha256");
    expect(script).toContain("status: 'accepted-change'");
    expect(script).toContain("if (item.status === 'failed')");
  });

  it('reruns both visual gates whenever the acceptance manifest changes', () => {
    const rendered = read('.github/workflows/rendered-regression.yml');
    const closure = read('.github/workflows/phase10-closure.yml');

    expect(rendered).toContain("'visual-regression/accepted-changes.json'");
    expect(closure).toContain("'visual-regression/accepted-changes.json'");
  });
});
