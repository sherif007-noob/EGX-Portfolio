import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Stage 2.1 canonical mutation boundary contract', () => {
  it('keeps the executor ledger-first and persistence-before-apply', () => {
    const source = readRelative('./ledgerMutationService.ts');

    expect(source).toContain('reconcilePortfolioFromLedger(');
    expect(source).toContain('forceFullSyncToFirestore(snapshot)');
    expect(source.indexOf('persisted = await persist(candidate.snapshot)'))
      .toBeLessThan(source.indexOf('request.apply(candidate.snapshot, candidate.value)'));
    expect(source).toContain("stage: LedgerMutationFailureStage");
    expect(source).toContain("'BUSY'");
    expect(source).toContain("'PERSIST_FAILED'");
  });

  it('keeps the authoritative Supabase accounting snapshot atomic', () => {
    const persistence = readRelative('./supabasePersistence.ts');

    expect(persistence).toContain("supabase.rpc('replace_portfolio_accounting_snapshot'");
    expect(persistence).toContain('p_transactions: txs');
    expect(persistence).toContain('p_positions: positions');
    expect(persistence).toContain('p_closed_trades: closed');
    expect(persistence).toContain('p_cash_balance: data.cashBalance');
  });

});
