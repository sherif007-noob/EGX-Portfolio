# Analytics integrity repair — price adjustments, investor flows, and save latency

**Status:** Audited and prepared, NOT implemented/validated as a chart repair. Scope: experimental `medium-ui`. Production financial rows and historical-price records MUST NOT be rewritten merely to make a return chart look better.

## Evidence and root causes (2026-10-09)
- Live chart history uses `buildHistoricalEquityCurve` in `src/services/portfolioPerformance.ts`, `buildUnifiedAnalyticsResult`, then `HomeChart` or `PerformanceTimeframeChart` and `SecondaryAnalyticsCharts`.
- **Price basis corruption, ORHD:** The historical source stores an unadjusted close of 38.80 on Sep 29, then a mechanically adjusted close of 11.641924 on Sep 30, while the bonus-share ledger event becomes effective October 7. The daily open on Sep 30, 12.016671, multiplied by (1 + public ORHD bonus ratio 2.2288508184) is approximately the preceding unadjusted 38.80 close. The mixed *adjusted/unadjusted* feed makes an unchanged share quantity appear to lose ~70% across Sep 29–30, and applying additional bonus shares on Oct 7 makes it appear to gain roughly the same value back. Another external history source displays Sep 29 around 12.02 on an adjusted basis; do not assume all price providers use the same basis.
- Official public corporate action reference: https://www.arabfinance.com/ar/news/newdetails/أوراسكوم-للتنمية-تعلن-موعد-أخر-حق-لمشتري-السهم-في-التوزيعات-المجانية (last entitlement Oct 6, bonus distribution Oct 7). **Do not change the audited free-share transaction date to Sep 30 to mask this price-history defect.**
- Scanning available stored daily closes for adjacent >45% jumps identified only this ORHD discontinuity in the audited history window; repeat the scan after any future price backfill.
- **Cash flows:** investor deposits are explicit CASH/DEPOSIT ledger records. The canonical `buildExternalCashFlows` already returns them as external capital flows with the correct opposing sign. A deposit legitimately raises NAV (the `Value` line) but must not raise `Return` EGP or TWR. On Oct 7, 60,000 EGP of deposits were present. The naïve reconstructed NAV movement minus 60,000 EGP remains materially positive because of the ORHD price-basis inconsistency. Do not 'correct' deposits by reversing them again.
- **Presentation inconsistencies:** `HomeChart` Ret displays `cashFlowNeutralReturn(points)` EGP, Value/Deposits display actual NAV, while the legacy `PORTFOLIO_RETURN` mode plots NAV and labels selected-period P&L separately. `PerformanceTimeframeChart` tooltip computes `periodPnl` from only `netDeposits`, omitting reconciliation adjustments that `result.summary.pnlEgp` includes; this can make two views disagree. `equityDrawdownEgp` in `unifiedAnalyticsEngine` measures peak-to-trough **raw NAV**, so deposits/withdrawals distort EGP drawdown even when the percent metric uses TWR. `secondaryAnalytics` uses the same invalid valuation timeline for unrealized P&L.
- **Missing/old prices:** `closeAtOrBefore` accepts a stale last known close without reporting the quote age; an asset can count as 'complete' while using an untrusted stale quote, and transitions from missing to populated history can create performance discontinuities. Resolve valuation completeness and price provenance before allowing return calculations.
- **Save delay:** Editing one financial row calls the canonical mutation executor, normalizes/reconciles every transaction, waits for authentication/portfolio lookup, sends all transactions/positions/closed trades through `replace_portfolio_accounting_snapshot_with_audit`, then (when ticker list exists) awaits `persistTickerQuotes`. The database's audited RPC was observed at ~47ms average and ~102ms maximum in available aggregated `pg_stat_statements` data, **not five seconds**. Client/network/auth/quote persistence and local computation need per-stage instrumentation before assigning the five-second wait. A second click while an edit is in-flight returns BUSY and can produce misleading 'Nothing was changed' toast before the first save eventually succeeds.

## Non-negotiable financial contracts
1. NAV = holdings marked on a consistent price/share basis + available cash + pending actual IPO-held assets. Investor flows change NAV but cannot be counted as investment gain.
2. No-investment-move synthetic deposit: NAV rises exactly by deposit; EGP P&L = 0; TWR = 0; no positive realized/unrealized P&L.
3. A 25%-held IPO reservation: available cash falls by hold; pending IPO asset rises by equal hold; NAV and return unchanged. Full order commitment is NOT cash paid or owned stock.
4. Bonus shares: **no cash inflow and no automatic P&L** from entitlement/crediting alone. Adjusted historical prices and share units must use a consistent economic basis; fractional entitlement rounding must be tracked separately from real returns.
5. EGP drawdown and contribution-based P&L normalize external cash flows (including audited return-neutral corrections). `Value` should retain the cash-flow jump but be unambiguously labelled **Portfolio value (NAV)**.
6. Never infer missing capital/deposit events from NAV differences. Never alter production cash transactions or manufacture accounting adjustments to force charts to agree.
7. For incomplete or mixed-basis valuation windows, flag **Unverified return** and exclude invalid observations from P&L, benchmark overlays, TWR/MWR and drawdown; do not connect disjoint trustworthy periods with a fake gain.

## Proposed implementation passes (in order)

### Pass A — Price-adjustment provenance and corporate-action alignment
- Introduce a versioned, auditable corporate-action *market price basis* descriptor distinct from the financial ledger (ticker, adjustment factor, source, basis, effective ex/entitlement date, feed adjustment range, audit reference). Historical price rows stay raw/immutable; the chart derives normalized comparison prices.
- Normalize all closes to one economic share basis before valuation (either original shares with original-equivalent closes until effective distribution or economically equivalent share units with consistently adjusted prices), with explicit rules for the broker's record date, credit date, entitlement rounding, and stock splits. Never infer event dates solely from an observed large move.
- Detect mixed-basis transitions (`ratio of pre/post prices` near published split factor; severe unaccounted price discontinuity; matching corporate event) and **fail closed** until the descriptor is verified. First validation target is ORHD's mixed price series, across Sept 29–Oct 7.
- Do not backdate the user's real bonus-share ledger entry; maintain a separate historical adjustment/basis view. Compare reconstructed NAV against actual broker/cash valuation at boundary sessions.

### Pass B — Unified cash-flow-neutral performance model
- Compute canonical `point.externalFlow` and a cumulative `externalFlowSincePeriodStart`/cash-adjusted P&L in one engine. Distinguish capital flows (deposits/withdrawals) from return-neutral reconciliation, dividends, execution fees and dividends-in-kind.
- Return EGP = interval NAV delta **minus** signed investor capital and return-neutral corrections; all durations (Today/1W/1M/90D/YTD/ALL) must use the same model. Reconcile `cashFlowNeutralReturn`, `summary.pnlEgp`, tooltip `periodPnl`, and the `vs Deposits` chart; remove duplicate arithmetic.
- `Value` remains NAV (moves with deposits). `Return` means cash-flow-neutral P&L, not an NAV line under a misleading name. `vs Deposits` plots NAV and cumulative contributed capital with clear distinct labels.
- Replace raw-NAV EGP drawdown with a cash-flow-adjusted performance-capital index translated to EGP (and label its metric explicitly), or omit EGP drawdown until methodology validated. Drawdown percentages and EGX benchmark overlays must never incorporate unverified points.
- Secondary realized/unrealized model must use the same normalized market-price basis, the same free-share basis, and verified data-completeness markers.

### Pass C — Save UX and real latency diagnosis
- Add client timing checkpoints (prepare, reconcile/validate, auth+portfolio lookup, RPC, ticker persistence, apply/UI), showing durations only in diagnostics (no sensitive ledger payloads). Check p50/p95 across mobile and desktop after deployment.
- Eliminate redundant ticker-directory quote persistence from unrelated ledger edits when quote data is unchanged, maintaining explicit price-sync and directory updates as distinct operations.
- Keep the audited atomic ledger RPC, persistence-before-apply guarantee, input locking, and busy rejection. Don't try optimistic P&L writes or parallel overlapping snapshots just to make Save appear fast.
- Use an in-flight ref to deduplicate rapid taps; show disabled **Saving…**, then one unambiguous **Saved** or specific failure. Ignore a second click instead of showing a contradictory BUSY/'Nothing was changed' toast.
- Avoid re-reading the entire portfolio for a mutation if the current authenticated/authoritative snapshot and version checks can safely support one transaction-scoped RPC; only change transaction-scoped persistence after a dedicated concurrency/RLS/audit migration and regression suite.

## Acceptance tests — required before deployment
- A synthetic deposit-only account with 20,000 EGP added mid-series: NAV +20,000; return 0 and TWR 0 across every chart and tooltip.
- Multiple same-day deposits, purchases, sales and a cash withdrawal: return equals actual fee-adjusted market profit independent of investor flows; cash allocated vs held tracked separately.
- A synthetic bonus distribution where prior closes switch from unadjusted to adjusted midway through history: no artificial loss on price-basis migration day and no phantom gain on credit day; matched to verified corporate-action provenance.
- ORHD recorded price-basis window replay vs official ratio and trading dates; do not assert a specific expected NAV without checking source basis and broker date marks.
- Missing/stale price or unknown adjustment: chart says **Unverified**, no fabricated return/drawdown/benchmark.
- Same source input produces identical return across Home, advanced Reports, secondary chart tooltip, and every date range. Exact account NAV agreement does not alone prove historical returns.
- One ACTF fee edit: one audited mutation ID, one backend commit, no full quote-directory rewrite, correct NAV and cash, responsive UI while pending. Double-click cannot show a false failure while first save succeeds; deliberate error must retain the edit dialog.
- Verify on phone and desktop, rerun TypeScript, Vitest, production Vite/PWA build, Cloudflare deploy dry run, then manual 1M/ALL replay on production-like data.

## Operational gates
- No direct SQL rewriting of `transactions`, `positions`, or cash to alter performance. This plan is a read-only findings document and fix design.
- Chart corrections should be on `medium-ui` until tested, then promoted deliberately after acceptance. Running `main` and `medium-ui` simultaneously against one portfolio requires schema backward compatibility, otherwise old clients may strip new metadata.
- Keep sensitive user financial amounts and portfolio holdings out of public source fixtures. Synthetic datasets should reproduce the failure.
