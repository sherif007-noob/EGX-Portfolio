import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function readRelative(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
}

describe('Stage 6.2 audit trail ownership', () => {
  it('keeps audit generation inside the canonical mutation boundary', () => {
    const executor = readRelative('./ledgerMutationService.ts');
    expect(executor).toContain('buildAuditTrailDraft(');
    expect(executor).toContain('persist(candidate.snapshot, auditEvent ?? undefined)');
    expect(executor.indexOf('buildAuditTrailDraft('))
      .toBeLessThan(executor.indexOf('persist(candidate.snapshot, auditEvent ?? undefined)'));
    expect(executor.indexOf('persist(candidate.snapshot, auditEvent ?? undefined)'))
      .toBeLessThan(executor.indexOf('request.apply(candidate.snapshot, candidate.value)'));
  });

  it('uses the atomic audit snapshot RPC and exposes an immutable viewer', () => {
    const persistence = readRelative('./supabasePersistence.ts');
    const modal = readRelative('../components/PortfolioBackupModal.tsx');
    const viewer = readRelative('../components/AuditTrailWorkspace.tsx');

    expect(persistence).toContain('replace_portfolio_accounting_snapshot_with_audit');
    expect(persistence).toContain('loadAuditTrailFromSupabase');
    expect(modal).toContain('<AuditTrailWorkspace active={isOpen} />');
    expect(viewer).toContain('Financial Audit Trail');
  });


  it('threads audit reasons through cash correction, reconcile and restore surfaces', () => {
    const ledger = readRelative('../features/portfolio/ledger/usePortfolioLedgerMutations.ts');
    const cash = readRelative('../components/CashBalanceView.tsx');
    const quickCash = readRelative('../components/QuickCashModal.tsx');
    const backup = readRelative('../components/PortfolioBackupModal.tsx');
    const app = readRelative('../App.tsx');

    expect(ledger).toContain("executePreparedMutation(\n      'EDIT_CASH_TRANSACTION'");
    expect(ledger).toContain("executePreparedMutation(\n      'DELETE_CASH_TRANSACTION'");
    expect(ledger).toContain("'RECONCILIATION_ADJUSTMENT'");
    expect(ledger).toContain("'RESTORE_PORTFOLIO'");
    expect(cash).toContain('Correction Reason (Optional)');
    expect(cash).toContain('Deletion Reason (Optional)');
    expect(cash).toContain('Reconciliation reason (optional)');
    expect(quickCash).toContain('Adjustment Reason (Optional)');
    expect(backup).toContain('Restore Reason (Optional)');
    expect(backup).toContain('Ledger reconciliation reason');
    expect(app).toContain('Imported from Google Sheets:');
  });

  it('does not claim audited cash success before persistence resolves', () => {
    const cash = readRelative('../components/CashBalanceView.tsx');
    const awaitIndex = cash.indexOf('const saved = await saveCashChange(() =>');
    const successIndex = cash.indexOf('Cash balance reconciled to ledger-derived amount');
    expect(awaitIndex).toBeGreaterThan(-1);
    expect(successIndex).toBeGreaterThan(awaitIndex);
    expect(cash).toContain('if (!saved) return;');
  });

  it('captures optional reasons without conflating them with trade notes', () => {
    const journal = readRelative('../components/TradingJournal.tsx');
    expect(journal).toContain('Correction Reason (Optional)');
    expect(journal).toContain('editAuditReason.trim() || undefined');
    expect(journal).toContain('Stored in the immutable audit trail; it does not alter the trade note.');
  });
});
