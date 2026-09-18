# Final Readiness Audit

This document records the cross-app readiness review performed after the analytics expansion and before live testing.

## Scope

The audit covered:

- Supabase authentication and portfolio ownership;
- canonical accounting persistence;
- transaction timestamp preservation;
- duplicate-trade risk;
- cash and share reconciliation;
- daily and 15-minute market-data coverage;
- Today / 1W / 1M / 90D / YTD / All analytics;
- MWR, TWR, drawdown, net-deposit, fee, and realized/unrealized P&L semantics;
- PWA update behavior;
- error handling and legacy Firebase-era wording;
- Supabase RLS/security-advisor findings;
- deployment reproducibility.

## Verified production invariants

At the time of the audit:

- portfolio cash reconciled exactly to the authoritative ledger;
- stored positions reconciled exactly to ledger-derived shares;
- all 67 market trades had execution timestamps;
- there were no exact duplicate-equivalent transaction groups;
- all open positions had current daily and 15-minute market-data coverage;
- the Sep 17 session reconstructed to +372.55 EGP, matching the broker reference;
- final 15-minute closes for all open positions matched the stored portfolio prices;
- the intraday price table was populated and readable by authenticated users only;
- the internal RLS event-trigger helper was no longer executable by API roles.

## Persistence architecture

Portfolio accounting snapshots are replaced atomically through:

```text
public.replace_portfolio_accounting_snapshot(...)
```

The RPC:

- runs as security invoker;
- verifies portfolio ownership;
- serializes concurrent full-snapshot writes through the portfolio row lock;
- replaces transactions, positions, and closed trades inside one database transaction;
- preserves `executed_at`.

Its definition is committed under `supabase/migrations/` so a fresh environment can reproduce production behavior.

## Duplicate execution protection

Transaction IDs are globally unique, but different IDs can still describe the same broker execution.

The screenshot/OCR import paths therefore use strong execution-level duplicate detection for timestamped entries. A trade is automatically blocked only when all of the following agree:

- BUY/SELL side;
- normalized ticker;
- execution minute;
- transaction date;
- shares;
- price;
- fees.

Date-only OCR entries are not automatically deduplicated because two legitimate fills can otherwise appear identical. Manual entry is also not auto-blocked by this heuristic, preserving a path for legitimate same-minute split fills.

The OCR batch importer also deduplicates against:

- the existing ledger; and
- transactions already accepted earlier in the same batch.

## OCR SELL safety

A single scanned SELL without a matching open position is rejected.

The app no longer creates an orphan local-only SELL row or changes cash when the ledger cannot reconcile the sale.

Batch imports remain dependency-aware: valid BUYs can be applied before dependent SELLs when needed.

## Analytics consistency

The primary and secondary analytics all derive from the same unified valuation engines.

### Today

- regular cash-equity session boundary: 10:00 Cairo;
- latest actual intraday market session is selected from stored bars, including holiday fallback;
- exact transaction timestamps change holdings/cash through the session;
- 15-minute observations are linear, not smoothed;
- no future-bar look-ahead.

### Longer ranges

- 1W: rolling 7 calendar days;
- 1M: rolling calendar month;
- 90D: rolling 90 calendar days;
- YTD: January 1 through latest session;
- All: portfolio inception through latest session.

Only complete valuation points are used.

### Returns

- selected-period MWR is non-annualized;
- annualized XIRR is secondary reference data;
- TWR neutralizes external deposits and withdrawals;
- report drawdown uses the same external-flow-neutral TWR drawdown definition as the main analytics engine.

## PWA/update behavior

The Vite PWA configuration uses:

```text
registerType: autoUpdate
```

This is intended to replace stale service-worker bundles automatically after a deployment.

If the browser still appears to run old code, the recovery path is:

1. hard refresh;
2. close/reopen the installed PWA or browser tab;
3. unregister the site service worker and clear site data only if the stale bundle persists.

## Security status

The internal `public.rls_auto_enable()` SECURITY DEFINER event-trigger function remains active for DDL safety, but direct EXECUTE access has been revoked from API roles.

The remaining Supabase security-advisor warning is:

```text
Leaked Password Protection Disabled
```

This is an Auth project setting and should be enabled from Supabase Auth security settings when desired. It is not an accounting or analytics blocker.

## Known non-blocking technical debt

- Some internal compatibility function/file names still contain `Firestore`; they route to Supabase and are retained to avoid unnecessary churn before live testing.
- Optional Google Sheets integration still uses Firebase/Google OAuth intentionally.
- The repository currently carries a Bun lockfile while operational workflows use Node/npm. This does not block the current build, but adding an npm lockfile would improve npm dependency reproducibility in a later maintenance pass.

## Live-test checklist

Before entering new trades:

1. pull current `main`;
2. restart the dev server with npm;
3. sign in through Supabase;
4. confirm cash and total portfolio value still match the broker;
5. confirm Today resolves to the latest real EGX session;
6. switch through all analytics modes/timeframes;
7. verify dark chart tooltips are readable on desktop and mobile;
8. test one harmless edit/save path before adding new broker executions;
9. verify duplicate screenshot import is blocked;
10. verify an unreconcilable standalone SELL is rejected without changing cash.

No production accounting mutation should be required for this live test.
