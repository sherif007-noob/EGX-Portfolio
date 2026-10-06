# EGX Portfolio — Current Status

## Purpose

This is the short current-state authority for the application.

Use it to answer:

- what is true now;
- what is closed;
- what remains open;
- what work comes next.

Detailed stage history belongs in [MASTER_STABILIZATION_ROADMAP.md](MASTER_STABILIZATION_ROADMAP.md). Domain semantics belong in the canonical documents listed in [README.md](README.md).

## Snapshot

**Date:** 2026-10-06  
**Authoritative production/default branch:** `main`  
**Legacy premium branch:** compatibility mirror only; not production authority  
**Current validated runtime head:** `5152ca2b` — Stage 5 / Reports R8 closure  
**Application:** private/personal EGX portfolio tracker  
**Primary database/auth:** Supabase Postgres + Supabase Auth + RLS  
**Production web/API runtime:** Cloudflare Worker serving Vite assets and `/api/*`  
**Local runtime:** Express/Vite via `server.ts`

Latest full runtime verification on `main@5152ca2b`:

- Quality Checks **#37502935404** — passed;
- Phase 10 Visual Closure **#37502935456** — passed;
- Rendered Visual Regression **#37502935538** — passed;
- TypeScript — passed;
- **139 / 139** Vitest files, **734 / 734** tests — passed;
- production Vite/PWA build — passed;
- Cloudflare Worker dry-run — passed;
- **12 / 12** responsive geometries — **0px overflow**;
- inspected Reports selector-aura state — exact-hash accepted at **23.556%**;
- every other tracked rendered state remained below the frozen **1%** threshold.

Documentation-only commits may be newer than the validated runtime head.

## Closed foundations

### Visual system — CLOSED

Phase 10 is closed and protected.

Current visual ownership is split across explicit token, material, semantic, hierarchy, control, overlay, motion, responsive and feature CSS owners. `src/index.css` is the stable import entry.

The later Reports navigation selector-aura correction was explicitly accepted without weakening the global rendered threshold.

### Stage 2 — Financial mutation & ledger integrity — CLOSED

The transaction ledger is authoritative.

Financial mutations follow:

```text
prepare
→ validate
→ reconcile
→ persist authoritative Supabase snapshot
→ apply local state
→ report success
```

BUY, SELL, transaction correction/deletion, cash events, OCR import, reconciliation, backup/restore and Sheets import use the shared persist-confirmed mutation boundary.

Accounting uses weighted-average / proportional remaining cost. Position and Closed Cycle are projections, not independent accounting truth.

### Stage 3 — Production / CI / market-data convergence — PARTIALLY CLOSED

Closed:

- 3.1 branch-divergence review;
- 3.2 `main` production authority;
- 3.3 automation normalization;
- 3.4 exact-head production candidate gate;
- 3.6 Data Health Center.

Still open as deferred technical debt:

- **3.5 live-session soak** — the October 4 soak failed because target-session ingestion did not satisfy the strict acceptance contract. Repeat only after scheduled ingestion reliability is repaired.

### Stage 4 — Architecture consolidation — CLOSED

Accepted architecture now includes:

- app-shell orchestration hooks;
- split portfolio local-state / hydration / ledger-mutation / repository ownership;
- shared API route/response contracts across Worker and Express;
- feature facades;
- explicit CSS ownership layers.

### Stage 5 — Reports workspace redesign — CLOSED

Reports is now a focused analytical workspace with:

- Overview;
- Analytics;
- Trading;
- Allocation;
- Monthly.

Accepted behavior includes:

- remembered last mode via `reports:lastMode`;
- direct Overview promotion into full workspaces;
- one expanded diagnostic preview at a time;
- responsive phone / short-landscape / tablet / desktop / 2XL layouts;
- shared motion/reduced-motion ownership;
- Analytics mode/timeframe/Today-resolution controls;
- synchronized analytics timelines/tooltips;
- Trading and Monthly filters/exports;
- Allocation sector/holding/cash controls;
- restored premium cyan/violet selector aura.

## Current product capabilities

### Market data

- raw TradingView **1m** intraday observations;
- deterministic persisted **1m → 5m** derivation;
- legacy **15m** fallback retained while rollout debt remains open;
- Today selector: coverage-aware `1m → 5m → 15m`;
- manual Today resolution: `Auto | 1m | 5m | 15m | 1h`;
- 1h is client-derived from observed intraday data, not another persisted tier;
- permanent daily history in `price_history`;
- centralized ticker/alias/ISIN resolution;
- read-only Data Health Center.

### Analytics

- current NAV/equity;
- net deposits;
- TWR;
- selected-period MWR plus annualized XIRR reference;
- drawdown;
- realized/unrealized composition;
- cumulative fees;
- Today transaction-aware reconstruction;
- 1W / 1M / 90D / YTD / All daily analytics;
- realized trajectory;
- monthly audit;
- trading-performance indicators.

Missing market observations remain missing. Analytics must not fabricate prices/candles.

### Corporate actions

A canonical corporate-action ledger now exists.

Currently implemented end-to-end:

- `CORPORATE_ACTION / BONUS_SHARES`.

It preserves zero cash impact and unchanged invested cost while increasing shares and recalculating average cost. Other corporate-action types exist in the type vocabulary but are not yet accounting-supported.

See [CORPORATE_ACTIONS_LEDGER.md](CORPORATE_ACTIONS_LEDGER.md).

## Open roadmap work

**Next execution point: Stage 6.1 — Broker reconciliation workspace.**

Stage 6 sequence:

1. **6.1 Broker reconciliation workspace** — compare broker snapshot/import with app truth and explain differences through ledger events.
2. **6.2 Lightweight audit trail** — record material manual corrections.
3. **6.3 Corporate actions** — audit and extend the existing bonus-shares implementation; do not build a parallel system.
4. **6.4 Ticker-attributed dividends** — attach dividend income to source security and lifecycle dates.

After Stage 6, the roadmap continues with portfolio intelligence, execution analytics, scanner/background operationalization and long-term cleanup.

## Deferred technical debt

- Stage 3.5 live-session soak/remediation;
- retirement of legacy 15m dependency remains blocked on trustworthy multi-session/live-session evidence;
- sector-momentum detection still runs in the foreground React app rather than as a true background/server-side detector.

## Documentation authority

Start with:

1. [STATUS.md](STATUS.md) — current truth and next action;
2. [MASTER_STABILIZATION_ROADMAP.md](MASTER_STABILIZATION_ROADMAP.md) — sequencing and stage history;
3. [README.md](README.md) — complete documentation map.

Historical phase plans and dated audits are evidence, not current-state authorities.
