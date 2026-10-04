import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.2 App orchestration extraction', () => {
  it('keeps App focused on composition instead of owning workflow state machines', () => {
    const app = read('src/App.tsx');

    expect(app).toContain('useAppOverlayState');
    expect(app).toContain('useAppNotifications');
    expect(app).toContain('usePortfolioNavigation');
    expect(app).toContain('useHistoricalPortfolioAnalytics');
    expect(app).toContain('useLivePriceSheetMirror');
    expect(app).toContain('usePortfolioWorkflows');

    expect(app).not.toContain('useState(');
    expect(app).not.toContain('useEffect(');
    expect(app).not.toContain('useRef(');
    expect(app).not.toContain('validateTradeInput');
    expect(app).not.toContain('findStrongDuplicateExecution');
    expect(app).not.toContain('getHistoricalPricesForTransactions');
    expect(app).not.toContain('ensureHistoricalPriceCoverage');
    expect(app).not.toContain('appendTransactionToSheet');
    expect(app).not.toContain('syncTransactionsLedgerToSheet');
  });

  it('moves each orchestration concern behind an owned feature hook', () => {
    const workflows = read('src/features/app-shell/usePortfolioWorkflows.ts');
    const history = read('src/features/app-shell/useHistoricalPortfolioAnalytics.ts');
    const navigation = read('src/features/app-shell/usePortfolioNavigation.ts');
    const overlays = read('src/features/app-shell/useAppOverlayState.ts');
    const notifications = read('src/features/app-shell/useAppNotifications.ts');
    const sheetMirror = read('src/features/app-shell/useLivePriceSheetMirror.ts');

    expect(workflows).toContain('validateTradeInput');
    expect(workflows).toContain('findStrongDuplicateExecution');
    expect(workflows).toContain('appendTransactionToSheet');
    expect(workflows).toContain('syncTransactionsLedgerToSheet');
    expect(history).toContain('ensureHistoricalPriceCoverage');
    expect(history).toContain('getHistoricalPricesForTransactions');
    expect(navigation).toContain('getActivePositionLedgerTransactionIds');
    expect(navigation).toContain('getClosedCycleLedgerTransactionIds');
    expect(overlays).toContain('isAddTradeModalOpen');
    expect(notifications).toContain('executeUndo');
    expect(sheetMirror).toContain('lastSheetAutoPushRef');
  });

  it('does not start Stage 5 while Stage 4.2 is under test', () => {
    const app = read('src/App.tsx');
    expect(app).not.toContain('reports:lastMode');
    expect(app).not.toContain('ReportsNavigation');
    expect(app).not.toContain('ReportsOverview');
  });
});
