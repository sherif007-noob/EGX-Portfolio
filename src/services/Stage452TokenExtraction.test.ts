import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');
const stripComments = (value: string) => value.replace(/\/\*[\s\S]*?\*\//g, '').trim();
const declarationNames = (value: string) =>
  [...value.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]);

describe('Stage 4.5.2 canonical token extraction', () => {
  it('keeps all six base root blocks and 88 base declarations in tokens.css', () => {
    const tokens = read('src/styles/tokens.css');
    expect(tokens.match(/:root\s*\{/g)?.length).toBe(6);
    expect(declarationNames(tokens)).toHaveLength(88);
    for (const [token, value] of [
      ['--premium-bg', '#020617'],
      ['--premium-semantic-win-rgb', '16 185 129'],
      ['--premium-touch-target', '2.75rem'],
      ['--motion-instant', '120ms'],
      ['--motion-modal', '360ms'],
      ['--motion-family-chart', '520ms'],
      ['--hierarchy-space-section', '1.75rem'],
      ['--hierarchy-pad-h1', '1.25rem'],
    ]) expect(tokens).toContain(`${token}: ${value}`);
  });

  it('owns the two responsive hierarchy root overrides in responsive.css', () => {
    const responsive = read('src/styles/responsive.css');
    const rootBlocks = [...responsive.matchAll(/:root\s*\{([^{}]*)\}/g)];
    expect(rootBlocks).toHaveLength(2);
    const declarations = rootBlocks.flatMap((match) => declarationNames(match[0]));
    expect(declarations).toHaveLength(20);
    expect(declarations.every((name) => name.startsWith('--hierarchy-'))).toBe(true);
    expect(responsive).toContain('--hierarchy-space-card: 0.875rem');
    expect(responsive).toContain('--hierarchy-page-title-size: 1.2rem');
  });

  it('keeps tokens pure and non-responsive', () => {
    const tokens = stripComments(read('src/styles/tokens.css'));
    expect(tokens).not.toContain('@media');
    expect(tokens).not.toContain('@keyframes');
    const selectors = tokens.split('\n').map(x => x.trim()).filter(x => x.endsWith('{'));
    expect(selectors).toEqual([':root {', ':root {', ':root {', ':root {', ':root {', ':root {']);
  });

  it('keeps the token layer first and the legacy entry declaration-free', () => {
    const entry = read('src/styles/index.css');
    expect(entry.indexOf('@import "./tokens.css" layer(egx-tokens);'))
      .toBeLessThan(entry.indexOf('@import "./materials.css" layer(egx-materials);'));
    expect(read('src/index.css').trim()).toBe('@import "tailwindcss";\n@import "./styles/index.css";');
  });
});
