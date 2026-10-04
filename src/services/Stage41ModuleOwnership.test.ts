import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MODULE_OWNERSHIP } from '../architecture/moduleOwnership';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.1 module ownership', () => {
  it('defines the canonical architecture roots', () => {
    expect(MODULE_OWNERSHIP.domain.accounting.root).toBe('src/domain/accounting');
    expect(MODULE_OWNERSHIP.domain.performance.root).toBe('src/domain/performance');
    expect(MODULE_OWNERSHIP.domain.market.root).toBe('src/domain/market');
    expect(MODULE_OWNERSHIP.data.supabase.root).toBe('src/data/supabase');
    expect(MODULE_OWNERSHIP.integrations.googleSheets.root).toBe('src/integrations/google-sheets');
    expect(MODULE_OWNERSHIP.integrations.ocr.root).toBe('src/integrations/ocr');
    expect(MODULE_OWNERSHIP.features.portfolio).toBe('src/features/portfolio');
    expect(MODULE_OWNERSHIP.features.reports).toBe('src/features/reports');
  });

  it('keeps domain facades as adapters over the existing trusted implementations', () => {
    const accounting = read('src/domain/accounting/index.ts');
    const performance = read('src/domain/performance/index.ts');
    const market = read('src/domain/market/index.ts');

    expect(accounting).toContain("../../services/portfolioReconciliation");
    expect(accounting).toContain("../../services/ledgerMutationService");
    expect(performance).toContain("../../services/unifiedAnalyticsEngine");
    expect(market).toContain("../../services/historicalPriceStore");

    for (const source of [accounting, performance, market]) {
      expect(source).not.toMatch(/function\s+[A-Za-z0-9_]+\s*\(/);
      expect(source).not.toContain('useState(');
    }
  });

  it('establishes data, integration and immediate feature facades without reimplementing behavior', () => {
    const supabase = read('src/data/supabase/index.ts');
    const sheets = read('src/integrations/google-sheets/index.ts');
    const ocr = read('src/integrations/ocr/index.ts');
    const portfolio = read('src/features/portfolio/index.ts');
    const reports = read('src/features/reports/index.ts');

    expect(supabase).toContain("../../services/supabaseBrowser");
    expect(sheets).toContain("../../services/googleSheets");
    expect(ocr).toContain("../../services/ocrLedgerMutations");
    expect(portfolio).toContain("./usePortfolioState");
    expect(reports).toContain("../../components/PerformanceReports");
  });
});
