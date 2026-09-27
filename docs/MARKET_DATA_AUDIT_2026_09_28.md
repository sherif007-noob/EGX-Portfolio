# Intraday, syncing, valuation, and analytics audit — 2026-09-28

## Scope and baseline

Reviewed `feature/premium-ui-redesign` at `72c0781ccbe91ee280ed5cafe50095fe150dfc0e`, including the browser, Express/Cloudflare proxies, Supabase persistence, raw/derived ingestion, Actions, accounting quote selection, primary/secondary charts, and realized trajectory. Work is isolated on `fix/intraday-market-data-audit` because the user's older local feature checkout has an independent deployment-trigger commit and generated files. Phase 8/9 visuals are preserved.

## Confirmed causes

| Symptom | Evidence and cause | Correction |
| --- | --- | --- |
| Today shows an earlier session | Browser expanded to a 14-day lookback when current data was absent; live endpoint accepted `sessionDate <= today` | Exact requested Cairo session for all resolutions; no implicit holiday inference; no newer-day quote on an old chart |
| 1m becomes 15m after close | Before repair, production had September 27 15m rows only; latest 1m was September 24. Default branch `main` still runs legacy 15m, while 1m cron is staged only on the feature branch | Repaired production coverage; documented required default-branch promotion; extended delayed close ingestion through 15:15 Cairo and stopped overlapping jobs from cancelling active ingestion |
| Startup wrong until manual refresh | Price hook fetched before authoritative remote hydration; subsequent load overwrote prices; one-shot startup never retried failure | Gate on successful remote load; retry remote load and quote failures; refresh on online/focus/resume |
| Devices disagree | Polling compared a ledger-only fingerprint, suppressing price-only changes; reconciliation/directory hydration preferred ticker price without checking freshness; reconciliation dropped quote timestamps | Separate market fingerprint; preserve timestamps and use newest quote; preserve newer local quotes when an older remote read finishes |
| Slow device can corrupt shared state | Price writes upserted full position records, including shares and cost basis; ticker writes could overwrite newer prices | Update only valuation fields on existing owned positions, with timestamp predicates; conditional ticker updates for both price and accounting saves |
| Fetch failures / inconsistent identity | Browser requested 16 scanner columns; both proxies requested only 13, omitting industry, ISIN, currency. Requests had no timeout and immediately attempted direct CORS fallback | One shared payload; finite-price validation; bounded proxy retry, then direct fallback; no-store responses/requests; persistence errors propagate |
| Intraday missing candles at page boundaries | Ordering used timestamp alone across multiple tickers | Unique `(bar_timestamp, ticker)` ordering on each page |
| Daily charts eventually truncate | Daily reads had no pagination and would hit the default 1,000-row limit | Paginated `(trading_date, ticker)` reads. Production currently has 510 daily rows, so this was a latent defect, not the September 27 cause |
| Charts stop advancing despite ingestion | History loading depended on portfolio/price changes rather than elapsed time or resume | Visible five-minute history refresh and reconnect/resume refresh; realized windows re-evaluate too |
| Secondary P&L disagrees with main chart | Secondary engine valued closes at bar start and repriced the live endpoint with stale history | Use primary point market value minus ledger cost basis; keep shared drawdown and transaction timing |

Actual PC and phone browser caches were not captured, so the device mismatch is supported by reproducible code paths rather than a forensic comparison of both devices. The intermittent upstream HTTP failure status was not captured; bounded recovery fixes known failure-handling defects without claiming a specific provider outage.

## Database and production verification

Production project: `jhubsrbfiqjxdgngnwaq`. Before repair, September 27 contained 480 legacy 15m rows for 27 symbols, no 1m/5m. September 24 contained 2,047 raw 1m rows for eight symbols. A read-only TradingView diagnostic returned September 27 1m observations through 11:29 UTC for ACTF and ORAS.

Ran the existing Node ingestion with retention disabled and session discovery corrected for after-midnight execution:

- Seven relevant tickers resolved; zero failures.
- 6,776 raw rows inserted across missing coverage; 2,050 derived 5m buckets upserted.
- MPCO required an initial raw bootstrap; source exhaustion limits older reconstructible history. Older direct 5m bootstrap outside raw coverage remains intact.
- Zero raw/derived retention deletions; no accounting, cash, holdings, or transaction mutation.
- September 27 now has 1,770 raw bars and 367 derived 5m bars for all seven relevant symbols.
- SQL OHLCV comparison against raw aggregation: zero mismatches.
- Actual persisted rows passed through the application selector: September 27, interval 1m, seven of seven expected tickers covered.

RLS was inspected on market/position tables. No schema or RLS change was needed. The security advisor reported only the existing [leaked-password-protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), unrelated to the market-data defects.

## Analytics timeframe review

| View | Source and semantics checked |
| --- | --- |
| Today Auto/1m/5m/15m | Exact Cairo session; strict manual resolution; Auto coverage/envelope comparison; failed-resolution isolation; real bars only |
| Today 1h | Client aggregation of observed selected-source bars; no new storage tier or fabricated minute observations |
| 1W | Seven calendar-day window; daily observed valuations, proportional date axis; same unified return/deposit/portfolio engine |
| 1M | Calendar-month subtraction with month-end clamp; daily observed valuations |
| 90D | Ninety calendar-day window; daily observed valuations |
| YTD | January 1 through latest Cairo session; daily observed valuations |
| ALL | Inception boundary and canonical capital; full paginated daily history |
| Secondary drawdown/P&L/fees | Unified timeline and valuation, ledger cost/realization/fee replay; complete points only |
| Realized trajectory 1D/1W/1M/90D/YTD/ALL | Shared Cairo window selection and closed-trade filtering; refreshes across session boundaries |

No exchange-holiday calendar was introduced. A missing weekday session is shown as unavailable instead of guessing that the exchange was closed. Missing historical observations remain missing. Source receipt timestamps do not turn delayed TradingView prices into exchange real-time prices.

## Validation and release

Regression coverage includes startup hydration sequencing, retry/resume, quote freshness, scanner payload/recovery/currency, price-only polling, position update isolation, conditional quote persistence, multi-page history, strict session selection, after-close 1m, cross-day live endpoint rejection, and primary/secondary P&L consistency. Existing accounting, timeframe, aggregation, and Phase 8/9 visual tests remain part of the full gate.

Code is not deployed and the default-branch scheduler is not yet promoted. The data repair is live; the durable ingestion fix requires that promotion. Merely deploying the web app leaves the old 15m scheduler running. After release, verify a real scheduled 1m run and both devices against the same portfolio and quote snapshot.


Final local quality gate (Node 24.19.0): clean `npm ci` passed; TypeScript passed; 59 test files / 307 tests passed; production Vite/PWA/Express build passed; Cloudflare Worker dry-run compilation passed; `git diff --check` passed. The lockfile records the dependency set used for this validation. Remote CI has not run because this isolated branch has not been pushed.
