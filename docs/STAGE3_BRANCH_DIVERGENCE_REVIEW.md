# Stage 3.1 — Main/Premium Branch Divergence Review

**Date:** 2026-10-03  
**Premium branch before integration:** `1c212324`  
**Main head reviewed:** `3259bb67`  
**Merge base:** `ce142a02`  
**Observed divergence before integration:** premium **1,466 commits ahead**, **12 commits behind** `main`.

## Decision

Do **not** import the `main` tree wholesale.

The premium branch already contains the useful historical-repair work in a newer architecture and has moved production deployment from Render to Cloudflare Workers. The reviewed integration therefore:

1. restores the one useful test contract that was absent from premium;
2. preserves the current premium tree;
3. records `main` as the second parent of one reviewed merge commit;
4. removes the 12-commit graph divergence without reverting premium accounting, market-data, deployment, or visual work.

This is equivalent to a reviewed “ours” merge after commit-by-commit classification, not a blind merge.

## Main-only commit classification

| Commit | Main-only change | Classification | Reviewed integration decision |
| --- | --- | --- | --- |
| `ffd6648d` | Add `render.yaml` Render deployment blueprint | **Obsolete** | Do not import. Production is Cloudflare Worker + Vite assets; Render is no longer the deployment authority. |
| `ae352745` | Add authenticated historical backfill service | **Superseded by premium** | Current premium `ensurePortfolioHistoricalPrices()` already contains authenticated ledger-aware repair and has since expanded into the gap-aware historical/intraday architecture. |
| `9a71ecc4` | Expose authenticated `/api/supabase/price-history/ensure` route | **Superseded by premium** | The same authenticated route already exists in current `server.ts`, alongside the intraday ensure route. |
| `9866e5ed` | Add client `ensureHistoricalPriceCoverage()` helper | **Superseded by premium** | The helper exists on premium with current Supabase auth and repair contracts. |
| `b2b25280` | Auto-repair analytics history from App when coverage is missing | **Superseded by premium** | Current `App.tsx` already contains the missing-ticker repair flow and retry guard. No old App patch is imported. |
| `b2b1d9b0` | Test unified analytics missing-ticker repair signal | **Required** | Restored/adapted on premium in commit `1c212324`, verifying `dataQuality.missingTickers` before history exists and full range restoration after history appears. |
| `daca9ca0` | Document automatic missing-history repair in performance docs | **Superseded by premium** | Current canonical performance documentation describes the newer completeness/data-quality model; old prose is not copied verbatim. |
| `5215ab7d` | Add missing-history troubleshooting notes | **Superseded by premium** | Current troubleshooting already covers historical/intraday coverage and trustworthy analytics behavior. |
| `d1556d98` | Document on-demand historical repair route | **Superseded by premium** | Current `OPERATIONS.md` owns the gap-aware historical repair and production ingestion model. |
| `c61a74e5` | Keep persisted ledger date authoritative over client hint | **Superseded by premium** | Exact rule is present in current `supabasePortfolioServer.ts`: `const startDate = ledgerDate ?? hintedDate`. |
| `5f81b404` | Clarify persisted-date authority in docs | **Superseded by premium** | Current code and canonical operations/data documentation own this rule; no stale historical prose is imported. |
| `3259bb67` | Merge PR #29 containing the historical-repair chain | **Obsolete as independent content** | Parent commits were reviewed individually. The new Stage 3.1 merge absorbs the graph only after the content review above. |

## Required integration applied

The only missing behavioral contract was the `missingTickers` unified-analytics test. It was restored before the branch merge:

- premium commit: `1c2123245a5ec45add8704d68b6a3c3967cdaa8c`;
- file: `src/services/unifiedAnalyticsEngine.test.ts`;
- behavior: newly introduced ticker is marked missing until historical data exists, then the full valuation range becomes available.

## Preserved premium authorities

The reviewed merge intentionally preserves premium versions of:

- financial mutation/accounting architecture;
- Supabase persistence and migrations;
- 1m intraday ingestion and derived resolutions;
- ticker registry;
- historical repair planner;
- Cloudflare Worker deployment;
- npm/package-lock toolchain;
- Phase 10 visual contract and baselines;
- current canonical documentation.

## Stage 3.1 acceptance

After the reviewed merge:

- `main` must be an ancestor of `feature/premium-ui-redesign`;
- comparison must report **0 commits behind main**;
- exact-head TypeScript/tests/build/Worker/rendered regression must stay green;
- no `render.yaml` is introduced;
- no premium file is replaced by an older main version.

