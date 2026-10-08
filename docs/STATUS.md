# EGX Portfolio — Current Status

## Purpose

This file is the **short current-state authority**: what is true now, what remains open, and what comes next.

Detailed sequencing belongs in [MASTER_STABILIZATION_ROADMAP.md](MASTER_STABILIZATION_ROADMAP.md). Historical implementation evidence belongs in the relevant phase/audit documents listed by [README.md](README.md).

## Snapshot

**Date:** 2026-10-08  
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

All financial mutations use the shared persist-before-apply executor. BUY/SELL, transaction edits/deletes, cash, OCR, restore/import, reconciliation, BONUS_SHARES corporate actions, and IPO subscription lifecycle changes must persist the canonical snapshot before local success is applied.

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

`Auto` prefers the finest trustworthy current-session persisted candidate. Manual `1m` and `5m` remain strict persisted reads; manual `15m` and `1h` are display aggregations from the finest healthy same-session `1m -> 5m -> legacy 15m` source and do not require dedicated persisted coarse bars.

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

## Ticker directory and logos

The production ticker registry is scanner-managed on `main`. New active EGX securities are discovered from the TradingView Egypt scanner and persisted to `ticker_registry`; HALN is already present as an active registry security with ISIN `EGS59231C018` and verified history symbol `HALN`.

TradingView scanner `logoid` slugs are converted to company-logo URLs before persistence. This replaces the prior failure mode where most active securities fell back to the generic Egypt-market badge.

See [TICKER_REGISTRY.md](TICKER_REGISTRY.md).

## IPO subscriptions

A first-class IPO lifecycle is implemented on `main`.

Current workflow:

- `SUBMITTED` — requested capital leaves available cash and is carried as an equal pending IPO asset, so NAV is unchanged;
- `ALLOCATED` — actual allocated shares enter weighted-average position accounting at the offer price, allocation fees are included, and the unused amount is released back to cash;
- `CANCELLED` — the reservation is fully released and no shares are created.

The header exposes an **IPO** creation action. The same modal can record a new request, settle a pending allocation, or cancel a pending request. The portfolio summary shows reserved IPO capital separately from available cash.

Supabase persistence stores the lifecycle object in `transactions.ipo_subscription` and the production migration is applied. IPO records are currently excluded from Google Sheets mirroring because the existing sheet schema cannot preserve the structured lifecycle metadata without loss.

See [IPO_SUBSCRIPTIONS.md](IPO_SUBSCRIPTIONS.md).

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

## Stage 6.1 — Broker reconciliation

**ACTIVE on main.**

Implemented:

- broker snapshot contract with broker/date/cash/holdings;
- pasted or CSV/TXT holdings parser with ticker alias/ISIN resolution;
- deterministic App − Broker share and cash differences;
- statuses for exact match, share mismatch, broker-only holding and app-only holding;
- active/source ledger evidence attached to share mismatches;
- recent cash-affecting ledger evidence attached to cash mismatches;
- direct navigation from a share mismatch to the scoped Transactions ledger;
- direct navigation from a cash mismatch to Cash Ledger;
- read-only reconciliation semantics: no derived position/cash overwrite is allowed.

Stage 6.1.4 now also supports local OCR scanning of Telda-style/current-holdings screenshots, auto-filling recognized ticker quantities, optional average price, broker identity and available cash when present.

Next slice: **6.1.5 — production acceptance + closure** using real broker snapshots and the mismatch matrix.

Stage 7.1 remains implemented. Stage 7.2 is paused while the master sequence proceeds through Stage 6.

## Stage 6.2 — Lightweight audit trail

**COMPLETE / CLOSED on main.**

Implemented:

- canonical before/after audit diff generation inside the financial mutation boundary;
- append-only `portfolio_audit_log` table with portfolio-scoped RLS;
- audit persistence in the **same PostgreSQL transaction** as the accounting snapshot;
- database timestamp, mutation kind, entity type/id, ticker, before/after state and compact change metadata;
- Data & Tools → Financial Audit Trail viewer;
- optional audit-only reasons on transaction edit/delete;
- optional audit-only reasons on cash edit/delete and manual cash adjustment;
- optional reason on manual ledger reconciliation and JSON backup restore;
- Google Sheets restore/import records its source as audit provenance;
- no-op reconciliation creates no audit noise;
- background quote/market-data writes remain outside the financial audit trail;
- Cash Ledger's “Apply Audited Balance” now awaits persistence before showing success.

Production migration:

`20261007214652_stage62_portfolio_audit_trail.sql`

Closure evidence on exact core head `df956cb5`:

- TypeScript — passed;
- **150 / 150 Vitest files, 792 / 792 tests — passed**;
- production Vite/PWA build — passed;
- Cloudflare Worker dry-run — passed;
- **12 / 12 responsive geometry widths remain at 0px overflow**.

Rendered-regression truth: the global golden-image job is still red, but the complete reported diff profile is identical to pre-6.2 head `b81d7fe5`. That is pre-existing stale-baseline debt, not a Stage 6.2 visual regression. No baseline or threshold was changed to hide it.

**Next execution point: Stage 6.3 — Corporate Actions lifecycle audit and expansion.**

## Documentation authority

Start with:

1. [STATUS.md](STATUS.md) — current truth and next action;
2. [MASTER_STABILIZATION_ROADMAP.md](MASTER_STABILIZATION_ROADMAP.md) — sequencing and stage gates;
3. [README.md](README.md) — complete authority/coverage map.

Historical phase journals may contain contemporaneous words such as `ACTIVE`, `NEXT`, `deferred`, or old branch names. Those are historical evidence only unless the documentation map explicitly marks that file as a current authority.

## Experimental branch notice — medium-ui Personal Risk (2026-10-08)
The `medium-ui` branch contains a source-level **Stage 7.2 My Risk** view integrated with its simplified Reports UI. It reads canonical positions/closed trades and does not modify financial data. This is **not** a production `main` acceptance or a revision of the Stage 6 working sequence. GitHub-based compilation, Vitest, rendered phone checks and broker parity have not been validated for this branch. Detailed calculation definitions and uncovered-stop limitations are recorded in `docs/SIMPLE_UI.md`.

## Experimental medium-ui holiday correction — 2026-10-08

The `medium-ui` branch implements an exchange-calendar correction for the **Thursday 2026-10-08 EGX closure** (observed Armed Forces Day). The confirmed previous trading session is Wednesday **2026-10-07**; trading resumes Sunday **2026-10-11**. The fix is scoped to the experimental branch and does not declare `main` production acceptance. Session resolver, market scheduler, scheduled ingestion and native Home/Reports labels now share explicit exchange-date logic. See `INTRADAY_MARKET_DATA.md` and `SIMPLE_UI.md`.

The observed +0.24% can come from the prior trading session's stored per-symbol quote-change data, even without any holiday trading. UI now distinguishes market closure from the daily quote-return metric. Exact financial reconciliation and TypeScript/Vitest/browser tests remain unverified on this branch; do not claim the number was verified against Telda.

## Experimental medium-ui cash-flow and broker NAV audit — 2026-10-08
The medium-ui branch adds a read-only Telda NAV breakdown in Home, separates cash ledger rows from the equity trade UI, and changes the simple Return chart to neutralize investor transfers and return-neutral audited corrections. It also blocks quote timestamp re-stamping on EGX-closed dates. Real broker receipts exposed fee-estimate differences on some same-day/grouped buys; production financial rows were **not** edited or automatically balanced. No production parity, mobile acceptance, or CI pass is implied. See SIMPLE_UI.md for the data model boundary and pending verification requirements.

## Experimental medium-ui unified Activity and IPO 25%-hold correction (2026-10-09)

The new default Activity timeline retains every persisted ledger event and renders cash movements, dividends, free shares, corporate actions, IPO orders and security executions with different information; no cash pseudo-share details. Advanced `TradingJournal` remains an equity-execution editor only.

The IPO mutation model now separates the **full request** from the **broker-held cash**. The held amount is a pending NAV asset until allocation/cancellation; the full requested shares are *not* holdings. Allocation may refund unused reserved cash or request additional available funds, and the new cash/IPO cases are covered by source-level tests. No production financial mutations occurred, and deployment, automated tests and rendered-device acceptance are still pending. See IPO_SUBSCRIPTIONS.md, SIMPLE_UI.md, and FINANCIAL_MUTATION_CONTRACT.md.

### Last-session return fallback guard (medium-ui)
In the medium-ui branch, daily P&L preserves transaction-aware opening holdings even when tickers are not in the directory, by using stored valid holding deltas as previous-close fallback. Where opening values cannot be reconstructed, the UI marks the daily return unavailable instead of presenting a false percent. Source-only changes pending actual tests and broker validation.
