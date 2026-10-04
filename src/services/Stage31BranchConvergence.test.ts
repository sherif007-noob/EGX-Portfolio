import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (relative: string) => readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');

describe('Stage 3.1 reviewed branch convergence contract', () => {
  it('keeps the historical repair functionality reviewed from main', () => {
    const server = read('server.ts');
    const contracts = read('src/api/contracts.ts');
    const historicalStore = read('src/services/historicalPriceStore.ts');
    const portfolioServer = read('src/services/supabasePortfolioServer.ts');
    const historicalAnalytics = read('src/features/app-shell/useHistoricalPortfolioAnalytics.ts');

    expect(contracts).toContain("supabasePriceHistoryEnsure: '/api/supabase/price-history/ensure'");
    expect(server).toContain('API_ROUTES.supabasePriceHistoryEnsure');
    expect(historicalStore).toContain('ensureHistoricalPriceCoverage');
    expect(historicalAnalytics).toContain('ensureHistoricalPriceCoverage');
    expect(portfolioServer).toContain('const startDate = ledgerDate ?? hintedDate;');
  });

  it('keeps Cloudflare as deployment authority instead of reviving the obsolete Render blueprint', () => {
    expect(existsSync(`${root}render.yaml`)).toBe(false);
    expect(existsSync(`${root}worker.ts`)).toBe(true);
    expect(existsSync(`${root}wrangler.jsonc`)).toBe(true);
  });

  it('records the commit-by-commit divergence review', () => {
    const review = read('docs/STAGE3_BRANCH_DIVERGENCE_REVIEW.md');
    expect(review).toContain('12 commits behind');
    expect(review).toContain('b2b1d9b0');
    expect(review).toContain('Required');
    expect(review).toContain('Superseded by premium');
    expect(review).toContain('Obsolete');
  });
});
