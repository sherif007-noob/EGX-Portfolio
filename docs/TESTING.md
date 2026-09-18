# Testing

## Test stack

The project uses Vitest for automated tests and TypeScript's compiler for type checking.

## Required pre-merge checks

Run:

```bash
npm run lint
npm test
npm run build
```

These are the same core checks run by `.github/workflows/quality.yml`.

## Test areas

### Portfolio accounting

`src/services/portfolioAccounting.test.ts`

Covers fee-aware trade accounting, including partial sells and realized P&L behavior.

### Reconciliation

`src/services/portfolioReconciliation.test.ts`

Covers rebuilding positions, cash, and closed cycles from transactions.

### Cash ledger

`src/services/cashLedger.test.ts`

Covers deposit/withdrawal/dividend/cash-adjustment events plus editing/deletion of cash history.

### Persistence/storage

`src/services/supabaseStorage.test.ts`

Covers ledger storage mutation semantics and protection against data-loss/duplication behavior.

### Performance engine

`src/services/performanceEngine.test.ts`

Covers historical valuations, external cash flows, MWRR, and drawdown.

### Portfolio performance

`src/services/portfolioPerformance.test.ts`

Covers equity bridges and fee-aware portfolio performance math.

### Portfolio metrics

`src/utils/portfolioMetrics.test.ts`

Covers summary metrics such as denominators used for day-change calculations.

## Manual financial regression checklist

Automated tests are necessary but not sufficient for a portfolio application.

When changing transaction persistence or accounting:

1. record current transaction count, open positions, cash, and capital;
2. add one harmless test trade only in a non-production environment;
3. verify exactly one transaction appears;
4. refresh and verify it remains exactly once;
5. edit it and refresh;
6. delete it and confirm persistence succeeds before the UI reports success;
7. refresh again and confirm it stays deleted;
8. verify unrelated positions did not change.

When testing production data, do not create artificial financial rows unless they will be explicitly removed and reconciled.

## Production data audit

Run:

```bash
npm run verify:production-data
```

This requires:

```env
SUPABASE_URL=...
SUPABASE_SECRET_KEY=sb_secret_...
```

Optionally:

```env
EGX_PORTFOLIO_ID=...
```

The audit is designed to detect issues such as:

- share reconciliation drift;
- cash reconciliation drift;
- duplicate-equivalent transactions;
- historical price coverage gaps.

The audit should be treated as read-only verification.

## Historical-price sync verification

After changing historical-price ingestion:

```bash
npm run sync:historical
```

Use a test/staging project when possible. Never expose the server secret in command output, screenshots, or committed files.

## CI

GitHub Actions runs Quality Checks on:

- pushes to `main`;
- pull requests targeting `main`.

The job uses Node 22 and currently installs dependencies with npm.

## Testing principles

- Financial edge cases should get regression tests.
- A bug that caused duplicate or disappearing transactions should receive a persistence regression test.
- Tests should assert accounting invariants, not only component rendering.
- Missing data should be tested explicitly.
- Do not rewrite expected values merely to make a changed formula pass; validate the intended accounting semantics first.
