import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

const productionWorkflows = [
  '.github/workflows/intraday-1m-diagnostic.yml',
  '.github/workflows/intraday-1m-smoke.yml',
  '.github/workflows/intraday-1m-sync.yml',
  '.github/workflows/historical-prices.yml',
  '.github/workflows/ticker-registry.yml',
  '.github/workflows/quality.yml',
  '.github/workflows/production-data-audit.yml',
  '.github/workflows/phase10-closure.yml',
  '.github/workflows/rendered-regression.yml',
];

describe('Stage 3.2 default production branch authority', () => {
  it('does not bind production workflows to the retired long-lived premium branch', () => {
    const combined = productionWorkflows
      .map((path) => read(path))
      .join('\n');

    expect(combined).not.toContain('feature/premium-ui-redesign');
  });

  it('routes branch-scoped production validation through main', () => {
    for (const path of [
      '.github/workflows/intraday-1m-diagnostic.yml',
      '.github/workflows/intraday-1m-smoke.yml',
      '.github/workflows/ticker-registry.yml',
      '.github/workflows/quality.yml',
      '.github/workflows/phase10-closure.yml',
      '.github/workflows/rendered-regression.yml',
    ]) {
      expect(read(path)).toContain('main');
    }
  });

  it('keeps scheduled ingestion branch-agnostic so GitHub executes it from the default branch', () => {
    const oneMinute = read('.github/workflows/intraday-1m-sync.yml');
    const historical = read('.github/workflows/historical-prices.yml');
    const audit = read('.github/workflows/production-data-audit.yml');

    expect(oneMinute).toContain('schedule:');
    expect(historical).toContain('schedule:');
    expect(audit).toContain('schedule:');
    expect(oneMinute).not.toContain('feature/premium-ui-redesign');
    expect(historical).not.toContain('feature/premium-ui-redesign');
    expect(audit).not.toContain('feature/premium-ui-redesign');
  });

  it('keeps contributor and security policy anchored on main', () => {
    expect(read('CONTRIBUTING.md')).toContain('branch from current `main`');
    expect(read('SECURITY.md')).toContain('current `main` branch');
  });

  it('keeps Cloudflare Worker and migrations in the same repository production tree', () => {
    expect(read('wrangler.jsonc')).toContain('"main": "worker.ts"');
    expect(read('worker.ts')).toContain('/api/');
    expect(read('supabase/migrations/20260919_accounting_snapshot_rpc.sql'))
      .toContain('replace_portfolio_accounting_snapshot');
    expect(read('supabase/migrations/20260924_intraday_multi_resolution.sql'))
      .toContain('intraday_price_history');
  });
});
