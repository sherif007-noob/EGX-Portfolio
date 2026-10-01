# EGX Portfolio — Current Status

## Purpose

This is the short current-state document.

Update it after every accepted implementation pass. Detailed historical reasoning belongs in the domain/phase documents; sequencing belongs in `MASTER_STABILIZATION_ROADMAP.md`.

## Snapshot

**Date:** 2026-10-01  
**Active development branch:** `feature/premium-ui-redesign`  
**Current validated runtime head:** `50db10b2` — Phase 10 CLOSED / CI CLEAN  
**Current rendered-baseline verification:** Phase 10 Visual Closure #36921005365 on `50db10b2`  
**Application type:** private/personal EGX portfolio tracker  
**Primary database/auth:** Supabase Postgres + Supabase Auth  
**Production web runtime:** Cloudflare Worker serving Vite assets and `/api/*` routes  
**Local/development compatibility runtime:** Express/Vite via `server.ts`

Documentation-only commits may be newer than the runtime baseline above.

---

## Current execution point

### Visual system

**Phase 10 is CLOSED / CI CLEAN.**

Completed:

- 10.7A Overview;
- 10.7B Open Positions;
- 10.7C Closed Cycles;
- 10.8 Modal & workflow consistency;
- 10.9 Responsive cross-app parity;
- rendered browser regression harness;
- **10.10 exact-head visual regression closure.**

Frozen visual contracts now remain protected while the roadmap moves into financial integrity work.

Next:

1. **Stage 2.1 — Canonical financial mutation executor**

---

### Phase 10.8 validation

Runtime head `d3395be5` passed **Intraday 1m Migration Smoke #36643635140** end-to-end:

- TypeScript passed;
- focused intraday regression suite passed;
- ACTF/NAPR/ORAS rebuild path passed;
- session-relevant portfolio-universe sync passed.

10.8 standardized all 13 inventoried modal/workflow owners on the shared body-level modal contract, including Visual Viewport keyboard safety and one-scroll-owner behavior.

Historical 10.8 note: full-suite/build/rendered closure was intentionally deferred at that pass and is now satisfied by Phase 10.10 run #36921005365.

---

### Phase 10.9 validation

Runtime head `74741fa9` passed **Intraday 1m Migration Smoke #36647092353** end-to-end:

- TypeScript passed;
- focused intraday regression suite passed;
- ACTF/NAPR/ORAS rebuild path passed;
- session-relevant portfolio-universe sync passed.

Source parity now explicitly covers the 320/359 narrow-phone tier, 390/430 phone layouts, short landscape, tablet, laptop, desktop and 2XL containment rules without reopening the frozen Header or chart behavior.

Historical 10.9 note: the rendered evidence gap was intentionally deferred and is now satisfied by the golden-baseline harness plus Phase 10.10 exact-head closure.

---

### Rendered regression validation

The Phase 10 rendered layer is now active and green.

Deterministic runtime head `ac7703b3` passed **Intraday 1m Migration Smoke #36917666997**.

Tracked golden baselines were established in `6b61b321` only after manual artifact inspection.

Required-baseline Chromium run **#36918687347** on verification head `38bc2b4f` reported:

- **12 / 12 responsive geometry checks at 0px page-level horizontal overflow**;
- **16 / 16 golden screenshots passed**;
- **0.000% pixel diff for every golden state**;
- no rendered-regression errors;
- baseline promotion correctly skipped because baselines already existed.

The bootstrap capture initially exposed a Supabase-configuration message inside the analytics surface. That image was rejected; deterministic local visual history/intraday isolation was added before the golden set was promoted.

---

### Phase 10.10 final closure

Runtime head `50db10b2` passed **Phase 10 Visual Closure #36921005365** on October 1, 2026.

Same-head results:

- TypeScript: passed;
- full Vitest: **77 / 77 files, 435 / 435 tests**;
- production Vite/PWA build: passed;
- Cloudflare Worker `wrangler deploy --dry-run`: passed;
- deterministic Chromium required-baseline comparison: passed;
- responsive geometry: **12 / 12 widths at 0px page overflow**;
- golden images: **16 / 16 at 0.000% diff**.

The closure gate initially exposed four obsolete source-string contracts. They were updated to assert the current accepted architecture; production visuals/business/data logic were not changed to satisfy stale tests.

**Visual system state: CLOSED / CI CLEAN.**

Next execution point: **Stage 2.1 — Canonical financial mutation executor.**

---

## Highest-priority post-visual work

### P0 — financial mutation integrity

Known inconsistency:

- cash deletion already follows a persist-first pattern;
- BUY, SELL, transaction edit, position edit and position deletion can update local financial state before the authoritative save is confirmed.

Target invariant:

> no financial success state before persistence succeeds.

### P0 — Position deletion semantics

Open positions are derived from the transaction ledger, but the UI still allows direct position deletion that removes inferred “open BUY” rows.

The helper used for that inference is FIFO-like while reconciliation uses proportional/weighted-average cost allocation after partial sells.

Target:

- remove direct accounting deletion from Position;
- correct the source ledger explicitly;
- freeze one cost-basis method.

### P0 — trade cash semantics

Normal BUY/SELL must not have optional hidden cash behavior.

Retire normal-accounting use of:

- `deductFromCash=false`;
- `addToCash=false`.

### P0 — branch/automation convergence

Audit baseline comparison:

- premium branch ahead of `main`: **1,388 commits**;
- premium branch behind `main`: **12 commits**.

GitHub scheduled workflows execute from the default branch, so the current branch split remains an operational risk until intentionally reconciled/promoted.

### P0 — CI/toolchain inconsistency

The premium branch declares npm and removed `bun.lock`, while `.github/workflows/production-data-audit.yml` still uses Bun with `--frozen-lockfile`.

Normalize this during production convergence.

---

## Market-data state

Current premium intraday policy:

- raw source: TradingView 1m;
- derived: deterministic 5m from persisted raw 1m;
- fallback: legacy 15m;
- display choices: Auto / 1m / 5m / 15m / client-derived 1h;
- raw retention: 30 days;
- derived retention: 90 days;
- timezone/session logic: `Africa/Cairo`;
- regular session: 10:00–14:30 Cairo;
- scheduled ingestion grace: through 15:15 Cairo.

Current premium workflow cron:

```text
*/5 7-13 * * 0-4
```

This is only the production scheduler once the reviewed workflow exists on the default branch.

The September 28 repair corrected major issues around wrong-session Today data, stale 15m fallback, startup hydration, quote freshness, pagination and primary/secondary analytics consistency.

Remaining rollout requirement: production/default-branch convergence and live-session verification.

---

## Ticker identity state

The service-managed ticker registry is the intended authority:

- `ticker_registry`;
- `ticker_aliases`;
- quote snapshot table remains separate.

Resolution supports canonical ticker and ISIN fallback.

The registry schedule is also subject to the default-branch promotion rule.

---

## Analytics state

Strong/current foundation:

- unified portfolio NAV/equity;
- net deposits;
- TWR;
- selected-period MWR;
- annualized XIRR reference;
- drawdown;
- cumulative fees;
- realized/unrealized composition;
- transaction-aware Today reconstruction;
- daily 1W / 1M / 90D / YTD / All;
- realized trajectory;
- monthly audit;
- trading-performance indicators.

Do not rewrite this engine during the Reports workspace redesign.

---

## Reports workspace

`POST_OVERHAUL_REPORTS_WORKSPACE_REDESIGN_PLAN.md` is now integrated into the master roadmap as **Stage 5 / R1–R8**.

Its visual entry gate is now satisfied because Phase 10 is closed.

It remains deferred until the remaining gates close:

1. financial mutation integrity;
2. production/automation convergence;
3. enough architecture ownership exists to move report components safely.

---

## Sector momentum scanner

Current implementation:

- foreground React hook;
- 60-second polling during an active session;
- 5–10 minute baseline window;
- momentum + liquidity + RVOL filters;
- multi-member sector/industry cluster detection;
- browser/service-worker notification display;
- localStorage snapshot/dedup state.

Important limitation:

> The detector itself is not background/server-side. If the app is suspended/closed, new clusters are not detected.

Server-side/background operationalization is deferred until the underlying data source has been validated.

---

## Architecture pressure points

Current large owners include:

- `App.tsx`;
- `usePortfolioState.ts`;
- `index.css`;
- Trading Journal;
- Cash Balance;
- Closed Cycles;
- Performance Reports;
- Header;
- several integration modals.

Plan: incremental extraction after financial/release stabilization. No rewrite.

---

## Documentation authority

Start with:

1. `docs/STATUS.md` — current state;
2. `docs/MASTER_STABILIZATION_ROADMAP.md` — sequencing;
3. `docs/README.md` — map of canonical/active/historical docs.

Current domain authorities:

- `ARCHITECTURE.md`
- `DATA_MODEL.md`
- `AUTH_AND_SECURITY.md`
- `OPERATIONS.md`
- `TESTING.md`
- `PERFORMANCE_ANALYTICS.md`
- `INTRADAY_MARKET_DATA.md`
- `TICKER_REGISTRY.md`
- `PREMIUM_VISUAL_LANGUAGE_CONTRACT.md`

---

## Next pass

**Stage 2.1 — Canonical financial mutation executor.**

The first post-visual objective is to make every financial mutation persist-confirmed and atomic before the UI applies success state.
