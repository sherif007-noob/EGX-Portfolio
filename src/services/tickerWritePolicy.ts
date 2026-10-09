/**
 * Portfolio-accounting mutations are independent of market-quote refresh.
 * A manual restore can import the ticker directory, but an edit to ACTF fees
 * must never submit ~314 quote updates as a side effect of the audited save.
 */
export function shouldSyncTickerQuotesForPortfolioSave(mutationKind?: string): boolean {
  return !mutationKind ||
    mutationKind === 'RESTORE_PORTFOLIO' ||
    mutationKind === 'RESTORE_LEDGER_SNAPSHOT';
}
