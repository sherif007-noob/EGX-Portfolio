import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 3.4 exact-head production candidate gate', () => {
  it('binds all required release checks into one workflow', () => {
    const workflow = read('.github/workflows/production-candidate-gate.yml');

    expect(workflow).toContain('npm ci --no-audit --no-fund');
    expect(workflow).toContain('git diff --check');
    expect(workflow).toContain('npm run lint');
    expect(workflow).toContain('npm test');
    expect(workflow).toContain('src/services/intradayPolicy.test.ts');
    expect(workflow).toContain('src/services/tickerRegistry.test.ts');
    expect(workflow).toContain('npm run build:cloudflare');
    expect(workflow).toContain('wrangler deploy --dry-run');
    expect(workflow).toContain('npm run verify:production-data');
  });

  it('keeps the production candidate gate non-writing', () => {
    const workflow = read('.github/workflows/production-candidate-gate.yml');

    expect(workflow).toContain('permissions:');
    expect(workflow).toContain('contents: read');
    expect(workflow).not.toContain('npm run sync:intraday');
    expect(workflow).not.toContain('npm run sync:ticker-registry');
    expect(workflow).not.toContain('wrangler deploy\n');
  });

  it('keeps the production audit implementation read-only', () => {
    const audit = read('scripts/verifyProductionData.ts');

    expect(audit).toContain(".from('portfolios').select");
    expect(audit).toContain(".from('transactions').select");
    expect(audit).toContain(".from('price_history').select");
    expect(audit).toContain(".from('intraday_price_history')");
    expect(audit).not.toMatch(/\.insert\s*\(/);
    expect(audit).not.toMatch(/\.update\s*\(/);
    expect(audit).not.toMatch(/\.upsert\s*\(/);
    expect(audit).not.toMatch(/\.delete\s*\(/);
    expect(audit).not.toMatch(/\.rpc\s*\(/);
  });

  it('checks the entire current tree for whitespace errors', () => {
    const workflow = read('.github/workflows/production-candidate-gate.yml');

    expect(workflow).toContain("git hash-object -t tree /dev/null");
    expect(workflow).toContain('git diff --check "$EMPTY_TREE" HEAD');
    expect(workflow).toContain('fetch-depth: 0');
  });
});
