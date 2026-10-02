import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Stage 2.3 canonical workflow migration contract', () => {
  it('routes transaction edit/delete, cash, reconciliation, restore and OCR batch through one executor helper', () => {
    const hook = readRelative('../hooks/usePortfolioState.ts');

    expect(hook).toContain("executePreparedMutation(");
    expect(hook).toContain("'EDIT_TRANSACTION'");
    expect(hook).toContain("'DELETE_TRANSACTION'");
    expect(hook).toContain("'EDIT_CASH_TRANSACTION'");
    expect(hook).toContain("'DELETE_CASH_TRANSACTION'");
    expect(hook).toContain("'RECONCILE_LEDGER'");
    expect(hook).toContain("'RESTORE_PORTFOLIO'");
    expect(hook).toContain("'OCR_BATCH_IMPORT'");
    expect(hook).not.toContain('cashSaveInFlight');
    expect(hook).not.toContain('persistCashSnapshot');
  });

  it('removes App-level OCR local financial apply and direct full persistence', () => {
    const app = readRelative('../App.tsx');

    expect(app).toContain('const result = await importOcrBatch(parsedTxs)');
    expect(app).not.toContain('setTransactions(workingTransactions)');
    expect(app).not.toContain('void forceFullSyncToFirestore({');
  });

  it('keeps transaction edit/delete UI open until persistence resolves', () => {
    const journal = readRelative('../components/TradingJournal.tsx');
    const confirmDelete = readRelative('../components/ConfirmDeleteModal.tsx');

    expect(journal).toContain('const saved = await onEditTransaction(updatedTx)');
    expect(journal).toContain('disabled={isSavingEdit}');
    expect(confirmDelete).toContain('const result = await onConfirm()');
    expect(confirmDelete).toContain("result !== false");
    expect(confirmDelete).toContain("isSubmitting ? 'Deleting…'");
  });

  it('makes OCR, quick cash, backup and Sheets imports persistence-aware', () => {
    const ocr = readRelative('../components/TradeScreenshotModal.tsx');
    const quick = readRelative('../components/QuickCashModal.tsx');
    const backup = readRelative('../components/PortfolioBackupModal.tsx');
    const sheets = readRelative('../components/GoogleSheetsModal.tsx');

    expect(ocr).toContain('const saved = onAddBatchTransactions');
    expect(ocr).toContain('Saving Ledger…');
    expect(quick).toContain('const saved = await onUpdateCash(amount)');
    expect(backup).toContain('const restored = await onRestoreBackup');
    expect(sheets).toContain('const imported = await onImportData(');
  });

  it('keeps restore ledger-authoritative rather than trusting imported projections', () => {
    const workflow = readRelative('./ledgerWorkflowMutations.ts');

    expect(workflow).toContain('Restore requires an authoritative transaction ledger');
    expect(workflow).toContain('positionSeed: Array.isArray(restore.positions)');
    expect(workflow).toContain('transactions = restore.transactions.map(normalizeTransaction)');
  });
});
