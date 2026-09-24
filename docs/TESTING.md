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

## Intraday migration regression suite

The 1-minute migration is validated by the focused smoke workflow and the following service tests:

- `intradayPolicy.test.ts` — canonical 1m/5m/15m intervals, retention and bounded backfill limits;
- `egxTradingSession.test.ts` — Cairo summer/winter offsets, trading weekdays, regular session and post-close grace window;
- `intradayBackfillPlan.test.ts` — full-derived bootstrap, raw-tier backfill and incremental overlap planning;
- `intradayAggregation.test.ts` — deterministic 1m -> 5m OHLCV, sparse-minute behavior and persisted-raw precedence;
- `intradayTickerUniverse.test.ts` — held/session-traded tickers, same-day round trips, normalization and CASH exclusion;
- `intradayResolution.test.ts` — 1m/5m/15m fallback, incomplete 1m rejection, sparse illiquid acceptance, Cairo date handling, post-midnight and closed-session fallback;
- `tradingViewSymbolResolver.test.ts` — ticker/canonical/ISIN resolution behavior;
- `intradayAnalyticsEngine.test.ts` — transaction timing, post-close endpoint pinning, authoritative session-cash reconstruction, stale-opening-capital regression, and 1m/5m/15m accounting invariants.

Focused local run:

```bash
npx vitest run \
  src/services/intradayPolicy.test.ts \
  src/services/egxTradingSession.test.ts \
  src/services/intradayBackfillPlan.test.ts \
  src/services/intradayAggregation.test.ts \
  src/services/intradayTickerUniverse.test.ts \
  src/services/intradayResolution.test.ts \
  src/services/tradingViewSymbolResolver.test.ts \
  src/services/intradayAnalyticsEngine.test.ts
```

The Premium smoke workflow typechecks and runs this regression set before executing its targeted TradingView/Supabase migration test.

### Intraday acceptance checks

Before calling the migration stable, verify directly against persisted data:

1. no duplicate `(ticker, interval_minutes, bar_timestamp)` rows;
2. raw 1m rows use `source=tradingview`;
3. reconstructible 5m rows use `source=derived-1m`;
4. every overlapping derived 5m bucket exactly matches aggregation of persisted raw 1m OHLCV;
5. a ticker with incomplete 1m session coverage falls back to a healthier coarser resolution;
6. a legitimately sparse/illiquid ticker is not rejected merely for missing minutes;
7. same-session executions between old 15m boundaries enter the finer path at the correct time;
8. opening equity, cash accounting, external flows, final authoritative NAV/P&L and TWR/MWR semantics remain stable across interval changes;
9. after midnight/weekends/closed dates, the reader uses the latest real session and does not synthesize a new one;
10. resolver logs preserve failed attempts, such as NAPR ticker failure followed by ISIN success.

A reported `repaired1mGaps` sync metric is source-backed: it counts TradingView observations that were absent at or before the previously persisted latest raw timestamp. It must not interpret a no-trade minute as a gap.

## Ticker registry regressions

The self-healing ticker directory has focused regression coverage in:

- `src/services/tickerRegistry.test.ts` — registry-over-quote identity precedence, alias/ISIN lookup, retired-symbol rename precedence, active exact-symbol precedence;
- `src/services/tradingViewSymbolResolver.test.ts` — persisted/current/legacy/ISIN history resolution;
- `src/services/marketPriceSync.test.ts` — current scanner identity, stale static alias resistance, quote updates without identity corruption.

The registry workflow runs these tests after TypeScript typecheck and before any registry write.

Manual focused run:

```bash
npx vitest run \
  src/services/tickerRegistry.test.ts \
  src/services/tradingViewSymbolResolver.test.ts \
  src/services/marketPriceSync.test.ts
```

After a live reconciliation, database acceptance checks should include:

1. every active security has an ISIN when the scanner provides one;
2. every active security has a verified history symbol or an explicit verification error;
3. no active ticker is simultaneously stored as an alias to another ticker;
4. ISIN-shaped scanner symbols resolve to a normal ticker when a unique trusted identity exists;
5. automatic rename aliases are created only from previously scanner-verified identities;
6. stale baseline ISINs do not create rename aliases;
7. inactive/retired rows remain available for history but do not appear in the active directory;
8. browser quote sync does not overwrite registry name/ISIN/sector/canonical identity.

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
