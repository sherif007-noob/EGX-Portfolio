import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 3.5 live-session soak contract', () => {
  it('runs five read-only checkpoints across the target EGX session', () => {
    const workflow = read('.github/workflows/live-session-soak.yml');

    expect(workflow).toContain("cron: '45 6 5 10 *'");
    expect(workflow).toContain("cron: '20 7 5 10 *'");
    expect(workflow).toContain("cron: '0 9 5 10 *'");
    expect(workflow).toContain("cron: '20 11 5 10 *'");
    expect(workflow).toContain("cron: '20 12 5 10 *'");
    expect(workflow).toContain("EGX_LIVE_SOAK_DATE: ${{ inputs.session_date || '2026-10-05' }}");
    expect(workflow).toContain('npm run verify:live-session-soak');
    expect(workflow).toContain('actions/upload-artifact@v4');
  });

  it('never invokes a production writer from the soak workflow', () => {
    const workflow = read('.github/workflows/live-session-soak.yml');

    expect(workflow).toContain('permissions:');
    expect(workflow).toContain('contents: read');
    expect(workflow).not.toContain('npm run sync:intraday');
    expect(workflow).not.toContain('npm run sync:ticker-registry');
    expect(workflow).not.toContain('wrangler deploy');
  });

  it('reuses canonical market-data and accounting semantics', () => {
    const script = read('scripts/verifyLiveSessionSoak.ts');

    expect(script).toContain('resolveIntradaySessionTickers');
    expect(script).toContain('aggregateIntradayBars');
    expect(script).toContain('selectBestIntradayResolution');
    expect(script).toContain('reconcilePortfolioFromLedger');
    expect(script).toContain('buildIntradayAnalyticsResult');
    expect(script).toContain('applyLivePricesToPortfolio');
    expect(script).toContain('fetchTradingViewEGXPrices');
  });

  it('keeps the verifier read-only against Supabase and production APIs', () => {
    const script = read('scripts/verifyLiveSessionSoak.ts');

    expect(script).not.toMatch(/\.insert\s*\(/);
    expect(script).not.toMatch(/\.update\s*\(/);
    expect(script).not.toMatch(/\.upsert\s*\(/);
    expect(script).not.toMatch(/\.delete\s*\(/);
    expect(script).not.toMatch(/\.rpc\s*\(/);
    expect(script).not.toContain('saveSupabase');
    expect(script).not.toContain('syncIntraday');
  });

  it('makes the post-close checkpoint the strict final verdict', () => {
    const script = read('scripts/verifyLiveSessionSoak.ts');

    expect(script).toContain("const strictFinal = phase === 'POSTCLOSE'");
    expect(script).toContain('Opening holding');
    expect(script).toContain('Closing holding');
    expect(script).toContain('Daily history has not advanced');
    expect(script).toContain('Competing direct 5m rows found');
    expect(script).toContain('Today endpoint does not converge on scanner NAV');
    expect(script).toContain('Auto resolution substituted session');
    expect(script).toContain('Manual 1m selection substituted session');
  });

  it('registers the soak as an npm command', () => {
    const packageJson = JSON.parse(read('package.json'));
    expect(packageJson.scripts['verify:live-session-soak'])
      .toBe('tsx scripts/verifyLiveSessionSoak.ts');
  });
});
