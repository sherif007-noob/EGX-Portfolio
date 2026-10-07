# EGX Portfolio — Current Status

## Purpose

This file is the **short current-state authority**: what is true now, what remains open, and what comes next.

Detailed sequencing belongs in [MASTER_STABILIZATION_ROADMAP.md](MASTER_STABILIZATION_ROADMAP.md). Historical implementation evidence belongs in the relevant phase/audit documents listed by [README.md](README.md).

## Snapshot

**Date:** 2026-10-07  
**Authoritative production/default branch:** `main`  
**Legacy premium branch:** compatibility/history only; not production authority  
**Latest runtime feature head:** `9f6cdcea` — Stage 7.1 benchmark comparison + Today Cairo-session boundary fix  
**Exact validation head:** `ea1204bb` — same application runtime plus the scoped Reports browser-harness fix  
**Current documentation head:** may be newer than the validated runtime because docs-only commits do not redefine runtime acceptance

Current runtime evidence on `main@5b0dcba3`:

- Quality Checks **#37549352346** — passed;
- Intraday 1m Migration Smoke **#37549352301** — passed;
- Phase 10 Visual Closure **#37549352298** — passed;
- Rendered Visual Regression **#37549352320** — passed;
- **140 / 140** Vitest files;
- **742 / 742** tests;
- focused intraday smoke: **9 / 9 files, 50 / 50 tests**;
- production Vite/PWA build — passed;
- Cloudflare Worker dry-run — passed;
- live intraday session-universe sync resolved **14 / 14** tickers with **0 failures**;
- **12 / 12** responsive geometry checks remained at **0px overflow**;
- every tracked screenshot remained on its accepted visual profile, including `reports-desktop` at the existing accepted **23.556%** delta;
- no visual baseline or global threshold changed.

## Runtime and persistence

Production topology:

- React 19 + TypeScript + Vite PWA;
- Cloudflare Worker serves static assets and `/api/*`;
- Supabase Postgres + Supabase Auth + RLS;
- Express/Vite remains the local/development compatibility runtime;
- GitHub Actions owns trusted Node market-data/registry/audit jobs.

Financial truth:

```text
transaction ledger
  → canonical reconciliation
  → positions
  → closed cycles
  → cash
```

All financial mutations use the shared persist-before-apply executor. BUY/SELL, transaction edits/deletes, cash, OCR, restore/import, reconciliation, and BONUS_SHARES corporate actions must persist the canonical snapshot before local success is applied.

See:

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DATA_MODEL.md](DATA_MODEL.md)
- [FINANCIAL_MUTATION_CONTRACT.md](FINANCIAL_MUTATION_CONTRACT.md)

## Market data

Current production policy:

- raw TradingView **1m** observations;
- deterministic persisted-raw **1m → 5m** derivation;
- legacy **15m** fallback;
- raw retention: 30 calendar days;
- derived retention: 90 calendar days;
- Cairo-local session rules;
- the requested EGX session must remain missing rather than silently switching to another date;
- Cairo midnight does **not** start a new Today session: from 00:00 through 09:59 Cairo on an EGX weekday, Today still resolves to the previous trading weekday; at 10:00 Cairo it switches to the new session date;
- Cairo day query bounds are converted to UTC with `Intl` timezone/DST handling rather than using an arbitrary UTC calendar day;
- EGX30, EGX70 EWI and EGX100 EWI are included in daily and intraday market-data ingestion for benchmark comparison.

Today UI resolutions:

```text
Auto · 1m · 5m · 15m · 1h
```

`Auto` prefers the finest trustworthy current-session persisted candidate. `1h` is display aggregation from the selected trustworthy intraday source, not a separate persisted interval.

### Oct 7 Today rollover incident — CLOSED

The Oct 6 chart initially still showed all points as incomplete after the pre-10:00 session-date fix. Production inspection proved the market bars and prior closes were healthy.

Root cause:

- three 20,000 EGP CASH deposits were created at about 01:08 Cairo on Oct 7;
- the cash-entry UI/service used UTC `toISOString().slice(0, 10)`, so those rows were persisted as Oct 6;
- CASH rows are date-based and had no `executedAt`;
- the intraday engine treated any same-session row without `executedAt` like an untimed stock trade, so all 262 reconstructed points became incomplete.

Current contract:

- new cash entries default to the `Africa/Cairo` calendar date;
- date-only same-session CASH flows are session-boundary external flows and do not poison intraday completeness;
- ordinary same-session BUY/SELL rows still require `executedAt`;
- the three affected 20,000 EGP deposits were corrected from Oct 6 to Oct 7 with cash, contributed capital, positions, share counts, closed cycles and realized P&L unchanged.

**Stage 3.5 live-session soak remains FAILED / deferred technical debt.** The October 4 soak showed scheduled ingestion reliability was not yet trustworthy: the writer could execute outside the accepted ingestion window and skip the target session. Repeat Stage 3.5 only after scheduler reliability is repaired, then verify post-close coverage and real phone-vs-desktop displayed snapshot parity.

The read-only Data Health Center from Stage 3.6 is implemented.

See [INTRADAY_MARKET_DATA.md](INTRADAY_MARKET_DATA.md).

## Analytics

Current analytical foundation includes:

- portfolio NAV/equity;
- net deposits;
- TWR;
- selected-period MWR;
- annualized XIRR reference;
- drawdown;
- cumulative fees;
- realized/unrealized composition;
- transaction-aware Today reconstruction;
- daily 1W / 1M / 90D / YTD / All;
- synchronized primary/secondary chart timelines;
- realized trajectory modes/timeframes;
- monthly audit;
- trading-performance indicators;
- flow-neutral Portfolio vs Benchmarks mode against EGX30, EGX70 EWI and EGX100 EWI;
- selected-period normalized benchmark overlays with portfolio-minus-index relative return.

The accounting and analytics engines remain the calculation authorities. UI work must consume them rather than duplicate formulas.

See:

- [PERFORMANCE_ANALYTICS.md](PERFORMANCE_ANALYTICS.md)
- [ANALYTICS_VISUAL_SYSTEM.md](ANALYTICS_VISUAL_SYSTEM.md)

## Reports workspace

**Stage 5 / Reports R1–R8 is CLOSED.**

Accepted architecture:

- Overview;
- Analytics;
- Trading;
- Allocation;
- Monthly;
- remembered mode via `reports:lastMode`;
- diagnostic Overview with one expanded preview at a time;
- direct promotion into full workspaces;
- shared React-owned motion/disclosure;
- responsive one-row mode rail;
- premium cyan/violet selector shell + aura;
- deterministic source and Chromium interaction regression.

Detailed authority: [POST_OVERHAUL_REPORTS_WORKSPACE_REDESIGN_PLAN.md](POST_OVERHAUL_REPORTS_WORKSPACE_REDESIGN_PLAN.md).

## Portfolio intelligence

**Stage 7.1 — Benchmark comparison is IMPLEMENTED / CI + RENDERED GREEN on `main`.**

Current benchmark contract:

- Portfolio leg = selected-period TWR;
- index legs = EGX30 / EGX70 EWI / EGX100 EWI;
- all series normalized from the selected-period baseline;
- daily history comes from the scheduled TradingView history pipeline;
- Today uses the same selected trustworthy intraday resolution as portfolio analytics;
- relative result = portfolio TWR minus benchmark return;
- missing index observations remain missing rather than being fabricated.

This was intentionally implemented before Stage 6 was complete. It does **not** close or waive Stage 6.

## Corporate actions

Current implemented subset:

- `CORPORATE_ACTION / BONUS_SHARES`.

The action:

- changes shares;
- has zero cash impact;
- adds zero cost;
- preserves total cost basis;
- derives entitlement from holdings immediately before the effective date;
- stores ratio/source-share/reference metadata;
- uses the canonical ledger mutation/persistence path;
- is protected by accounting regressions.

**Stage 6.3 must audit and extend this implementation rather than create a parallel corporate-action system.**

See [CORPORATE_ACTIONS_LEDGER.md](CORPORATE_ACTIONS_LEDGER.md).

## Visual / architecture closure

**Phase 10 is CLOSED / CI CLEAN.** The premium visual system is frozen by default.

**Stage 2 is CLOSED / CI CLEAN.** Financial mutation and ledger integrity are accepted.

**Stage 4 is CLOSED.** App/state/request/CSS ownership consolidation is accepted.

**Stage 5 is CLOSED.** Reports workspace redesign is accepted.

Stage 4 CSS ownership now uses:

- tokens;
- materials;
- semantics;
- hierarchy;
- controls;
- overlays;
- motion;
- responsive;
- feature owners for app shell, charts, Reports and Header.

`src/index.css` is the stable import-only entry.

See:

- [PREMIUM_VISUAL_LANGUAGE_CONTRACT.md](PREMIUM_VISUAL_LANGUAGE_CONTRACT.md)
- [ARCHITECTURE_MODULE_OWNERSHIP.md](ARCHITECTURE_MODULE_OWNERSHIP.md)
- [STAGE4_5_CSS_OWNERSHIP.md](STAGE4_5_CSS_OWNERSHIP.md)

## Current execution point

**Active working track — Stage 7.2: Personal risk dashboard**, because Stage 7.1 was explicitly implemented out of the original sequence.

**Earliest unfinished master-sequence stage — Stage 6.1: Broker reconciliation workspace.**

Stage 7 work does not silently waive Stage 6. Stage 6.1 still needs to compare broker truth with canonical app truth, explain discrepancies through source ledger events, and route corrections through explicit persist-confirmed ledger edits.

If continuing the currently active Stage 7 track, the next pass is 7.2.

## Documentation authority

Start with:

1. [STATUS.md](STATUS.md) — current truth and next action;
2. [MASTER_STABILIZATION_ROADMAP.md](MASTER_STABILIZATION_ROADMAP.md) — sequencing and stage gates;
3. [README.md](README.md) — complete authority/coverage map.

Historical phase journals may contain contemporaneous words such as `ACTIVE`, `NEXT`, `deferred`, or old branch names. Those are historical evidence only unless the documentation map explicitly marks that file as a current authority.
