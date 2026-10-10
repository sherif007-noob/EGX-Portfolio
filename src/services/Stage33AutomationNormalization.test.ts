import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

const workflowPaths = [
  '.github/workflows/production-data-audit.yml',
  '.github/workflows/intraday-1m-diagnostic.yml',
  '.github/workflows/intraday-1m-smoke.yml',
  '.github/workflows/intraday-1m-sync.yml',
  '.github/workflows/intraday-prices.yml',
  '.github/workflows/historical-prices.yml',
  '.github/workflows/ticker-registry.yml',
  '.github/workflows/quality.yml',
  '.github/workflows/phase10-closure.yml',
  '.github/workflows/rendered-regression.yml',
];

describe('Stage 3.3 automation normalization', () => {
  it('uses Node 22, npm 11.6, and the committed lockfile across production automation', () => {
    for (const path of workflowPaths) {
      const workflow = read(path);
      expect(workflow).toContain('node-version: 22');
      expect(workflow).toContain('npm install --global npm@11.6.0');
      expect(workflow).toContain('npm ci --no-audit --no-fund');
      expect(workflow).not.toContain('setup-bun');
      expect(workflow).not.toContain('bun install');
      expect(workflow).not.toContain('bun run');
    }
  });

  it('serializes every workflow that writes intraday bars through one group', () => {
    for (const path of [
      '.github/workflows/intraday-1m-sync.yml',
      '.github/workflows/intraday-1m-smoke.yml',
      '.github/workflows/intraday-prices.yml',
    ]) {
      const workflow = read(path);
      expect(workflow).toContain('group: egx-intraday-market-data');
      expect(workflow).toContain('cancel-in-progress: false');
    }
  });

  it('keeps the legacy direct 5m repair manual-only', () => {
    const legacy = read('.github/workflows/intraday-prices.yml');
    expect(legacy).toContain('workflow_dispatch:');
    expect(legacy).not.toContain('schedule:');
    expect(legacy).not.toContain('push:');
    expect(legacy).toContain('npm run sync:intraday');
  });

  it('keeps GitHub intraday writers manual-only after Stage 3.5 remediation', () => {
    const oneMinute = read('.github/workflows/intraday-1m-sync.yml');
    const legacy = read('.github/workflows/intraday-prices.yml');
    const smoke = read('.github/workflows/intraday-1m-smoke.yml');
    const schedulerMigration = read('supabase/migrations/20261004_intraday_edge_scheduler.sql');

    expect(oneMinute).toContain('workflow_dispatch:');
    expect(oneMinute).not.toContain('schedule:');
    expect(oneMinute).toContain('npm run sync:intraday:1m');
    expect(legacy).not.toContain('schedule:');
    expect(smoke).not.toContain('schedule:');

    expect(schedulerMigration).toContain("'egx-intraday-edge-sync'");
    expect(schedulerMigration).toContain("'*/5 7-13 * * 0-4'");
    expect(schedulerMigration).toContain("'/functions/v1/egx-intraday-scheduler'");
  });

  it('keeps the production audit read-only and on the canonical npm script', () => {
    const audit = read('.github/workflows/production-data-audit.yml');
    expect(audit).toContain('permissions:');
    expect(audit).toContain('contents: read');
    expect(audit).toContain('npm run verify:production-data');
    expect(audit).toContain('group: egx-production-data-audit');
  });
});
