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

## Current validated runtime evidence

The latest application feature head is `main@9f6cdcea` (Stage 7.1 benchmark comparison + Today Cairo-session boundary fix). The exact closure-validation head is `main@ea1204bb`, which adds only the scoped Reports browser-harness correction on top of that runtime.

Current evidence:

- Quality Checks **#37547142039** — passed;
- Rendered Visual Regression **#37547142047** — passed;
- Phase 10 Visual Closure **#37547142018** — passed;
- full Vitest: **140 / 140 files, 739 / 739 tests**;
- production build: passed;
- Cloudflare Worker dry-run: passed;
- **12 / 12** geometries at **0px overflow**;
- every tracked screenshot remained on the accepted profile, including Reports at the existing exact-hash accepted **23.556%** delta;
- the R8 browser interaction closure passed after Analytics timeframe / Today resolution / trajectory selectors were scoped to the active Reports Analytics workspace.

No visual baseline or global 1% threshold was changed. Documentation-only commits may be newer than the validation head.

## Test areas

### Portfolio accounting

`src/services/portfolioAccounting.test.ts`

Covers fee-aware trade accounting, including partial sells and realized P&L behavior.

### Reconciliation

`src/services/portfolioReconciliation.test.ts`

Covers rebuilding positions, cash, and closed cycles from transactions.

### Cash ledger

`src/services/cashLedger.test.ts`

Covers capital cash events, performance cash events, reconciliation adjustments, and editing/deletion of cash history.

### Corporate actions

`src/services/corporateActionAccounting.test.ts`

Covers the implemented BONUS_SHARES lifecycle, including:

- zero-cash / zero-added-cost issuance;
- weighted-average cost after a later partial sale;
- effective-date entitlement based on pre-action holdings;
- stale source-share rejection;
- historical-equity neutrality across mechanical price adjustment.

Corporate-action creation is also protected by the shared persist-before-apply ledger mutation tests.

### Persistence/storage

`src/services/supabaseStorage.test.ts`

Covers ledger storage mutation semantics and protection against data-loss/duplication behavior.

### Performance engine

`src/services/performanceEngine.test.ts`

Covers historical valuations, external cash flows, MWRR, and drawdown.

### Portfolio performance

`src/services/portfolioPerformance.test.ts`

Covers equity bridges and fee-aware portfolio performance math.

### Portfolio benchmarks

`src/services/portfolioBenchmarks.test.ts`

Covers:

- EGX30 / EGX70 EWI / EGX100 EWI normalized-return construction;
- selected-period beginning-of-period baseline alignment;
- latest-at-or-before observation alignment without future look-ahead;
- intraday benchmark normalization;
- portfolio-minus-index relative return.

### Portfolio metrics

`src/utils/portfolioMetrics.test.ts`

Covers summary metrics such as denominators used for day-change calculations.

## Stage 2 financial acceptance suite

Stage 2's exit suite is:

- `src/services/Stage28FinancialAcceptance.test.ts`.

It chains the financial subsystems together and covers:

- DCA + repeated proportional partial sells;
- full close/reopen cycle boundaries;
- correction after partial realization;
- duplicate OCR execution suppression;
- dated deposit/withdrawal performance behavior;
- dividend/fee/reconciliation semantics;
- same-day round trips;
- persistence failure across all Stage 2 mutation families;
- stale quote precedence during accounting reconstruction;
- source guards for persist-before-apply, projection ownership, canonical cost basis and hidden cash-mode removal.

`src/services/supabaseStorage.test.ts` adds the cross-device case where a stale local view performs an accounting edit after a newer remote quote arrives; the persisted canonical state must retain the newer quote.

Stage 2 final exact-head validation on `70ad1148`:

- Phase 10 Visual Closure **#37121788769**;
- **90 / 90 Vitest files, 513 / 513 tests**;
- production build passed;
- Worker dry-run passed;
- 12 / 12 responsive geometries had 0px overflow;
- 16 / 16 rendered states passed;
- Rendered Visual Regression **#37121788757** passed.

---

## Intraday migration regression suite

The 1-minute migration is validated by the focused smoke workflow and the following service tests:

- `intradayPolicy.test.ts` — canonical 1m/5m/15m intervals, retention and bounded backfill limits;
- `egxTradingSession.test.ts` — Cairo summer/winter offsets, trading weekdays, regular session and post-close grace window;
- `intradayBackfillPlan.test.ts` — full-derived bootstrap, raw-tier backfill and incremental overlap planning;
- `intradayAggregation.test.ts` — deterministic 1m -> 5m OHLCV, sparse-minute behavior and persisted-raw precedence;
- `intradayTickerUniverse.test.ts` — held/session-traded tickers, same-day round trips, normalization and CASH exclusion;
- `intradayResolution.test.ts` — 1m/5m/15m fallback, incomplete 1m rejection, sparse illiquid acceptance, Cairo date handling and same-session selection;
- `todayIntraday.test.ts` — Cairo calendar-day UTC bounds, midnight behavior, summer/winter DST offsets, same-session loading and resolution fallback;
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

The Intraday 1m Migration Smoke workflow typechecks and runs this regression set before executing its targeted TradingView/Supabase migration test.

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
9. Cairo midnight does not create a new Today session: before 10:00 Cairo on an EGX weekday the reader uses the previous trading weekday, while weekends resolve to the previous trading weekday; once a requested session date is chosen, missing candles do not authorize switching to a different date;
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

## Financial mutation boundary regressions

Stage 2.1 adds:

- `src/services/ledgerMutationService.test.ts`;
- `src/services/Stage21MutationBoundary.test.ts`.

Stage 2.2 adds:

- `src/services/tradeLedgerMutations.test.ts`;
- `src/services/Stage22PersistedTradeMutations.test.ts`.

Stage 2.3 adds:

- `src/services/ledgerWorkflowMutations.test.ts`;
- `src/services/ocrLedgerMutations.test.ts`;
- `src/services/Stage23WorkflowMigration.test.ts`.

It also relies on the existing `cashLedger.test.ts` suite as a compatibility/invariant gate.

Stage 2.4 adds:

- `src/services/ledgerProjectionOwnership.test.ts`;
- `src/services/Stage24ProjectionOwnership.test.ts`.

Stage 2.5 adds:

- `src/services/Stage25CanonicalTradeCashEffect.test.ts`.

The suite protects the canonical:

```text
prepare → validate → persist → apply
```

ordering.

Current coverage includes:

- accounting projections derived from the candidate ledger rather than caller-provided cash/positions;
- persistence must complete before local apply;
- persistence failure leaves local apply untouched;
- preparation failure;
- duplicate transaction ID rejection;
- malformed financial-value rejection;
- new oversell/reconciliation discrepancy rejection;
- baseline legacy discrepancy tolerance;
- global one-mutation-in-flight serialization;
- persisted-but-local-apply-failed distinction;
- reconciliation seed behavior;
- continued use of the atomic `replace_portfolio_accounting_snapshot` Supabase RPC;
- Stage 2.1 boundary isolation;
- persisted BUY/SELL preparation and sequencing;
- insufficient-cash and stale-position trade rejection;
- partial/full/same-day SELL scenarios;
- in-flight modal submission locking;
- Sheets-after-persistence source contract;
- target/stop/notes metadata ownership through canonical reconciliation;
- explicit rejection of legacy hidden trade cash bypasses;
- transaction-edit cash-field canonicalization;
- cash-flow capital recalculation on general transaction deletion;
- cash add/edit/delete candidate preparation;
- restore/import ledger-authority rejection rules;
- dependency-aware OCR batch construction;
- broker trade-row time extraction when a screenshot also contains a device/status-bar clock;
- repeated same-ticker OCR round trips;
- same-time close → reopen ordering;
- legitimate same-minute split fills inside one batch;
- exact duplicate screenshot filtering in the review UI;
- duplicate OCR execution blocking against the pre-existing ledger;
- unreconcilable OCR SELL rejection;
- persistence-aware Journal/OCR/Cash/Backup/Sheets UI contracts;
- persisted Undo source contract;
- aggregate-share active-cycle source ownership instead of FIFO deletion ownership;
- DCA + partial-sell correction scope;
- full-close/reopen correction-scope reset;
- Closed Cycle source ID ownership;
- absence of Position/Closed Cycle direct accounting delete actions;
- Journal correction scoping to source transaction IDs;
- removal of BUY/SELL hidden cash-mode flags;
- required BUY broker-cash effect display;
- insufficient BUY cash rejected during pre-validation;
- canonical BUY debit / SELL credit transaction fields.

Exact-head Stage 2.1 validation:

- runtime: `eb3f776e`;
- run: **#36924616787**;
- TypeScript: passed;
- Vitest: **79 / 79 files, 447 / 447 tests**;
- production Vite/PWA build: passed;
- Worker dry-run: passed;
- frozen visual regression: 12/12 geometry widths and 16/16 screenshots green.

### Exact-head Stage 2.2 validation

- runtime: `d012aeff`;
- Phase 10 Visual Closure: **#36941746467**;
- TypeScript: passed;
- Vitest: **81 / 81 files, 462 / 462 tests**;
- production Vite/PWA build: passed;
- Worker dry-run: passed;
- frozen visual regression: **12 / 12 geometries at 0px overflow** and **16 / 16 screenshots at 0.000% diff**;
- Intraday 1m Migration Smoke **#36941746472**: passed, including live ACTF/NAPR 1m rebuild and session-relevant universe sync.

### Exact-head Stage 2.3 validation

- runtime: `d069f62d`;
- Phase 10 Visual Closure: **#36944695939**;
- TypeScript: passed;
- Vitest: **84 / 84 files, 475 / 475 tests**;
- production Vite/PWA build: passed;
- Worker dry-run: passed;
- frozen visual regression: **12 / 12 geometries at 0px overflow** and **16 / 16 screenshots at 0.000% diff**;
- Rendered Visual Regression **#36944695986**: passed.

The first Stage 2.3 CI run exposed a real legacy-opening-capital regression in the cash compatibility wrapper. The failure was fixed; the exact-head run above includes the repaired behavior.

### Exact-head Stage 2.4 validation

- runtime/test head: `7a5d8bde`;
- Phase 10 Visual Closure: **#36957879472**;
- TypeScript: passed;
- Vitest: **86 / 86 files, 484 / 484 tests**;
- production Vite/PWA build: passed;
- Worker dry-run: passed;
- responsive geometry: **12 / 12 widths at 0px page overflow**;
- rendered matrix: **16 / 16 states passed**;
- intended visual delta: Positions desktop **0.021%**, Closed Cycles desktop **0.012%**, all others **0.000%**;
- Rendered Visual Regression **#36957879457**: passed;
- Intraday 1m Migration Smoke **#36957765990**: passed on runtime commit `95c6b13a`.

The first full-suite run failed three historical Phase 10 source-string expectations that required destructive Position/Closed Cycle controls. Those contracts were updated to preserve the visual/action geometry while requiring the new ledger-correction semantics.

### Exact-head Stage 2.5 validation

- runtime: `208aa5e9`;
- Phase 10 Visual Closure: **#37048999587**;
- TypeScript: passed;
- Vitest: **87 / 87 files, 487 / 487 tests**;
- production Vite/PWA build: passed;
- Worker dry-run: passed;
- responsive geometry: **12 / 12 widths at 0px page overflow**;
- rendered matrix: **16 / 16 states passed**;
- Rendered Visual Regression **#37048999583**: passed;
- no new Stage 2.5 screenshot regression.

The predecessor Stage 2.5 runtime `33fb9871` passed Intraday 1m Migration Smoke **#37048671583** before the validation-only tightening.

When migrating an individual workflow, add tests for both:

1. successful persisted state;
2. failed persistence with unchanged local financial state.

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

## Stage 3.4 production candidate gate

Canonical workflow:

```text
.github/workflows/production-candidate-gate.yml
```

This is the release-quality gate for one exact production candidate. It is deliberately non-writing.

It runs:

1. Node 22 / npm 11.6;
2. clean locked `npm ci`;
3. candidate-delta `git diff --check`;
4. TypeScript;
5. full Vitest;
6. focused intraday regressions;
7. focused ticker-registry regressions;
8. production Vite/PWA build;
9. Cloudflare Worker dry-run;
10. live read-only production-data audit.

For push runs, diff hygiene compares `github.event.before..HEAD`. For manual runs, an optional `base_sha` may define the lower bound; otherwise the workflow falls back to `HEAD^`.

Do not redefine this as a whole-repository whitespace rewrite. Historical whitespace debt is separate from release-candidate diff hygiene.

Stage 3.4 closure evidence:

- candidate: `ce60f932`;
- Production Candidate Gate **#37180662256**;
- full Vitest: **94 / 94 files, 531 / 531 tests**;
- focused intraday: **49 / 49 tests**;
- focused ticker registry: **22 / 22 tests**;
- production build: passed;
- Worker dry-run: passed;
- production data audit: **passed, zero issues**.

Supporting same-head visual closure:

- Phase 10 Visual Closure **#37180662178**;
- Rendered Visual Regression **#37180662271**;
- **12 / 12** geometry checks at 0px overflow;
- **16 / 16** rendered states passed.

## Historical-price sync verification

After changing historical-price ingestion:

```bash
npm run sync:historical
```

Use a test/staging project when possible. Never expose the server secret in command output, screenshots, or committed files.

## Rendered visual regression

The application uses a real Chromium rendered-regression layer in addition to Vitest source contracts.

Canonical workflow:

`.github/workflows/rendered-regression.yml`

Canonical harness:

`scripts/renderedRegression.mjs`

Golden images:

`visual-regression/baseline/`

### Deterministic build contract

The workflow builds with:

```env
VITE_VISUAL_REGRESSION=true
```

That mode is test-only. It bypasses live Supabase authentication and portfolio hydration, disables live market-data/Google-Sheets/Supabase-history side effects, freezes the browser clock, and uses a representative ledger fixture derived through the real reconciliation/analytics engines.

Do not use real production portfolio rows as screenshot fixtures.

### Geometry matrix

Every rendered run checks page-level horizontal overflow at:

- 320;
- 359;
- 390;
- 430;
- short landscape 844 × 390;
- 768;
- 1024;
- 1280;
- 1440;
- 1600;
- 1920;
- 2560.

The document/body overflow tolerance is 1px.

### Golden screenshot matrix

The tracked set covers:

- Overview at 320, 390, short landscape, 1024, 1440 and 2560;
- Open Positions desktop/mobile;
- Closed Cycles;
- Reports;
- Journal;
- Cash Ledger;
- Add Trade modal on phone;
- Transaction Edit modal;
- Data & Tools dropdown;
- semantic Overview summary cards.

### Pixel gate

The harness uses Sharp for deterministic PNG comparison.

Defaults:

- channel tolerance: 16;
- maximum changed-pixel ratio: 1%;
- dimensions must match exactly;
- missing baseline = failure after bootstrap;
- failing states emit a red diff image.

A successful run uploads current screenshots, diffs and `visual-regression/report.json` for 14 days.

The first bootstrap is deliberately special: if no baseline PNGs exist, an inspected successful capture may be promoted. Once baselines exist, `VISUAL_REQUIRE_BASELINE` is true and promotion is skipped.

Current establishment evidence:

- runtime smoke #36917666997 passed on `ac7703b3`;
- golden PNG commit `6b61b321`;
- required-baseline comparison #36918687347 passed **16/16 at 0.000% diff** and **12/12 geometry checks at 0px page overflow**.

The bootstrap inspection also caught a Supabase configuration message in the analytics screenshot. That image was rejected and the visual fixture was corrected before baseline promotion. Never refresh baselines merely to make a regression pass; first decide whether the visual change is intentional.

### Stage 7.1 interaction-harness compatibility

Adding the benchmark analytics mode exposed that the R8 browser closure's global accessible-role lookup could match more than one Analytics timeframe group. The closure harness now scopes Analytics timeframe, Today resolution and realized-trajectory controls to `[data-reports-workspace="analytics"]`.

This is a test-harness ownership fix, not a visual-baseline change. Exact-head closure on `main@ea1204bb` passed through Rendered Visual Regression **#37547142047** and Phase 10 Visual Closure **#37547142018**.

### Stage 5 Reports interaction closure

The rendered harness also contains a non-golden Reports interaction matrix (`report.reportsClosure`) that exercises behavior rather than only pixel output:

- Overview diagnostic surfaces;
- direct full-report opening;
- remembered mode restoration;
- Analytics 1W/Today/5m/mode/realized-trajectory controls;
- Trading timeframe/trade-type filters and export actions;
- Allocation Holdings + Include Cash;
- Monthly record filters and export actions.

R8 accepted this matrix on `main@5152ca2b` through Rendered Visual Regression **#37502935538**. This interaction closure complements the five Reports responsive geometry tiers and the exact-hash Reports screenshot acceptance.

## Phase 10 exact-head visual closure gate

The final Phase 10 gate is:

`.github/workflows/phase10-closure.yml`

It runs on `main` for runtime/visual-contract changes and intentionally combines the previously separate evidence into one exact-head job:

1. npm dependency installation;
2. TypeScript typecheck;
3. the complete Vitest suite;
4. production Vite/PWA build;
5. Cloudflare Worker `wrangler deploy --dry-run`;
6. pinned Playwright Chromium installation;
7. deterministic visual build;
8. local Vite preview;
9. required golden screenshot + responsive geometry comparison.

Do not mark a visual-system closure from independent green runs on different commits when an exact-head closure run is available.

Phase 10 closure evidence:

- runtime head: `50db10b2`;
- workflow run: **#36921005365**;
- Vitest: **77 / 77 files, 435 / 435 tests**;
- production build: passed;
- Worker dry-run: passed;
- Wrangler dry-run bundle: **800.60 KiB / 158.95 KiB gzip**;
- geometry: **12 / 12 at 0px page overflow**;
- screenshot baselines: **16 / 16 at 0.000% diff**.

The full-suite gate is intentionally authoritative over focused phase smoke tests. During closure it exposed four obsolete source-string assertions even though focused smoke and rendered checks were green; those contracts were repaired before Phase 10 was closed.

## CI

GitHub Actions runs Quality Checks on:

- pushes to `main`;
- pull requests targeting `main`.

The Quality job uses Node 22 and currently installs dependencies with npm.

`main` also has dedicated migration, rendered-regression, Phase 10 closure, and Production Candidate Gate workflows. Playwright/Chromium is installed only inside visual CI jobs so normal application dependencies remain unchanged.

## Testing principles

- Financial edge cases should get regression tests.
- A bug that caused duplicate or disappearing transactions should receive a persistence regression test.
- Tests should assert accounting invariants, not only component rendering.
- Missing data should be tested explicitly.
- Do not rewrite expected values merely to make a changed formula pass; validate the intended accounting semantics first.


## Monthly Audit summary regression coverage

`src/services/monthlyAuditSummary.test.ts` verifies the report-summary contract independently from rendering:

- All Records combines visible liquidated-trade P&L and holding P&L instead of reusing the legacy closed-only monthly aggregate.
- The same helper naturally follows Liquidated-only, Holdings-only, and search-filtered record sets because it summarizes the visible `auditRecords` input.
- Closed-trade win rate excludes breakeven trades from the denominator, matching canonical portfolio accounting.
- Visible commissions are summed from the same records being summarized.

The Monthly Audit component also uses `calculatePositionUnrealizedPnl` for current open holdings so entry fees are included consistently with the rest of the portfolio.
