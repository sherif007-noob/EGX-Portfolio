# Operations and Deployment

## Status

Canonical operational reference for the production/default `main` branch.

For rollout risks and the next step, see [STATUS.md](STATUS.md).

## Production branch authority

The repository default branch **`main`** is the only production source of truth.

Production-owned artifacts on `main` include:

- application/runtime code;
- `worker.ts` and `wrangler.jsonc`;
- Supabase migrations;
- raw 1m and derived 5m ingestion;
- historical price repair;
- ticker registry reconciliation;
- quality and rendered-regression workflows;
- production data audit.

GitHub scheduled workflows execute from the default branch, so production schedules inherit `main` automatically.

Branch-scoped workflow validation targets `main`, not a long-lived feature branch.

The former `feature/premium-ui-redesign` branch is retained only as a compatibility mirror at Stage 3.2 closure. New work branches from current `main` and returns through the normal review/validation path.

Stage 3.2 production verification confirmed the live Supabase project's accounting RPC plus `price_history`, `intraday_price_history`, and `ticker_registry` production objects.

Stage 3.3 automation/toolchain normalization is closed. The remaining Stage 3 operational debt is the failed/deferred Stage 3.5 live-session soak; Stage 3.6 Data Health Center is implemented.

---

## Production runtime

Production uses Cloudflare Workers.

`wrangler.jsonc` configures:

- Worker entry: `worker.ts`;
- Vite output: `./dist`;
- assets binding: `ASSETS`;
- SPA fallback;
- Worker-first execution for `/api/*`;
- invocation/persisted logs.

Build and deploy:

```bash
npm run build:cloudflare
npm run deploy:cloudflare
```

## Local runtime

Development:

```bash
npm run dev
```

This starts the Express/Vite development runtime from `server.ts`.

A production-style local Node build remains available:

```bash
npm run build
npm start
```

This bundles `server.ts` to `dist/server.cjs`.

Cloudflare is nevertheless the current deployed web runtime; Express is not the production-topology authority.

## Environment separation

### Browser build

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

These values are browser-visible by design.

### Server/Worker/automation secrets

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

Never place the server secret in a `VITE_*` variable.

Cloudflare bindings/secrets and GitHub Actions secrets must be configured independently.

## Health check

```text
GET /api/health
```

Cloudflare response includes the runtime identifier.

## Quality workflow

File:

```text
.github/workflows/quality.yml
```

Triggers:

- push to `main`;
- pull request targeting `main`.

Current gate:

1. Node 22;
2. npm 11.6;
3. locked install with `npm ci`;
4. TypeScript;
5. Vitest;
6. production build.

Important: ordinary feature-branch pushes do not receive this complete quality workflow unless another workflow happens to cover the modified runtime files.

Before promotion, run the exact-head full gate deliberately.

## Production candidate gate

Canonical workflow:

```text
.github/workflows/production-candidate-gate.yml
```

This is the non-writing exact-head release gate.

It combines on one commit:

1. Node 22 + npm 11.6;
2. clean locked `npm ci`;
3. candidate-delta `git diff --check`;
4. TypeScript;
5. full Vitest;
6. focused intraday regressions;
7. focused ticker-registry regressions;
8. Vite/PWA production build;
9. Cloudflare Worker dry-run;
10. live read-only production-data audit.

The workflow never runs market-data synchronization, ticker-registry mutation, or a real Cloudflare deployment.

On push, diff hygiene covers the promoted candidate delta. On a manual run, supply `base_sha` when a wider candidate range should be checked.

Stage 3.4 validated this contract on `main@ce60f932` with Production Candidate Gate **#37180662256**. The production audit returned zero issues.

## Raw 1m / derived 5m workflow

Primary workflow:

```text
.github/workflows/intraday-1m-sync.yml
```

Current production cron:

```text
*/5 7-13 * * 0-4
```

GitHub cron is UTC.

The Node script applies the authoritative `Africa/Cairo` gate and accepts scheduled ingestion through **15:15 Cairo** so delayed final observations and runner delays can be captured.

Workflow behavior:

1. discover the session-relevant portfolio universe;
2. resolve current ticker/history identity including ISIN fallback;
3. retrieve raw TradingView 1m observations;
4. insert missing raw timestamps;
5. reload persisted raw truth;
6. derive deterministic 5m buckets;
7. retain only unreconstructible older legacy bootstrap rows where needed;
8. apply retention;
9. emit coverage diagnostics.

Manual:

```bash
npm run sync:intraday:1m
```

Diagnostic:

```bash
npm run diagnose:intraday:1m
```

Targeted repair examples use:

```env
EGX_INTRADAY_TICKERS=ACTF,NAPR
EGX_INTRADAY_FULL_REPAIR=true
EGX_INTRADAY_SKIP_RETENTION=true
```

Only use non-pruning/full-repair options deliberately.

## Legacy intraday repair

```text
.github/workflows/intraday-prices.yml
```

is manual-only in the production design.

Do not reintroduce it as a competing scheduled 5m producer while 5m is derived from raw 1m.

All workflows that actually persist intraday bars serialize through:

```text
group: egx-intraday-market-data
cancel-in-progress: false
```

This includes the scheduled 1m writer, the production-writing 1m migration smoke, and this manual legacy 5m repair. Diagnostics do not use the writer lock because they do not persist bars.

Manual:

```bash
npm run sync:intraday
```

## Daily historical coverage

Workflow:

```text
.github/workflows/historical-prices.yml
```

Current production schedule:

```text
17 12-22 * * *
```

This is a gap-aware repair loop. Healthy coverage can exit before opening a TradingView session.

Manual:

```bash
npm run sync:historical
```

Optional targeted controls:

```env
EGX_HISTORY_TICKERS=...
EGX_HISTORY_START=YYYY-MM-DD
EGX_HISTORY_END=YYYY-MM-DD
```

## Ticker registry

Workflow:

```text
.github/workflows/ticker-registry.yml
```

Current production schedule:

```text
15 13 * * 0-4
```

Manual:

```bash
npm run sync:ticker-registry
```

The job typechecks and runs focused registry/resolver regressions before writing identity changes.

## Live-session soak

Stage 3.5 uses:

```text
.github/workflows/live-session-soak.yml
scripts/verifyLiveSessionSoak.ts
npm run verify:live-session-soak
```

The soak is read-only and is separate from the intraday writer concurrency group because it never persists bars.

For the 2026-10-04 acceptance session it records five checkpoints:

```text
09:45 Cairo  pre-open
10:20 Cairo  early session
12:00 Cairo  mid-session
14:20 Cairo  near close
15:20 Cairo  strict post-grace verdict
```

Each run uploads `live-session-soak.json`.

The strict final verdict requires:

- source-ledger cash/position reconciliation;
- current-session raw 1m coverage near the open and close;
- exact overlap between persisted derived 5m and fresh aggregation of persisted 1m;
- no direct 5m competitor in the target session;
- Auto bound to the requested session;
- manual 1m not silently replaced;
- target-session daily history for held tickers;
- healthy production scanner proxy;
- complete held-ticker live reference;
- Today end equity matching scanner-derived reference NAV.

The verifier must remain read-only. Do not add inserts, upserts, updates, deletes, RPC writes, sync commands or real deploys to this workflow.

Physical phone/desktop display parity remains a manual observation because authenticated device rendering cannot be truthfully inferred from a server-side soak.

### Current Stage 3.5 status

The 2026-10-04 acceptance soak **failed** because the target session did not receive the required persisted 1m/derived-5m coverage and daily history had not advanced sufficiently. The read-only scanner path remained healthy, but that does not satisfy the ingestion contract.

Stage 3.5 is therefore deferred technical debt, not accepted production evidence.

Repeat the soak only after scheduled raw-1m ingestion reliability is repaired. Do not retire legacy 15m fallback solely because source-level migration tests are green.

## Data Health Center

The application exposes a read-only production trust surface from Settings.

It summarizes:

- held-universe quote health;
- expected versus selected EGX session;
- latest raw 1m coverage;
- derived 5m tail alignment;
- daily-history coverage;
- ticker resolution;
- Supabase portfolio sync age;
- last raw-ingestion age;
- application build commit.

The Data Health Center is diagnostic only. It must not write market data, repair accounting, or fabricate missing coverage.

## Production data audit

Workflow:

```text
.github/workflows/production-data-audit.yml
```

Current schedule:

```text
0 14 * * 0-4
```

Manual equivalent:

```bash
npm run verify:production-data
```

The audit is intended to be read-only.

### Canonical audit toolchain

The production audit uses the same repository toolchain as the rest of automation:

```text
Node 22
npm 11.6.0
npm ci --no-audit --no-fund
npm run verify:production-data
```

The workflow is read-only, has `contents: read`, and uses its own non-overlapping audit concurrency group. The former Bun path has been removed.

## Scheduled-workflow branch rule

GitHub scheduled workflows execute from the repository default branch.

Therefore:

> a schedule committed only to a non-default feature branch is staged code, not the active production scheduler.

This is critical for:

- raw 1m ingestion;
- ticker registry reconciliation;
- any retirement of the legacy 15m producer.

The September 28 market-data audit demonstrated why deploying the web application without promoting matching workflow logic is unsafe.

## Promotion checklist

Before promoting a production candidate:

1. review `main`-only commits;
2. reconcile branch divergence intentionally;
3. confirm required migrations exist;
4. confirm Worker configuration;
5. confirm Actions secrets/variables;
6. run exact-head TypeScript + full Vitest + build;
7. compile/dry-run Worker;
8. run focused intraday and ticker-registry regressions;
9. run read-only production data audit;
10. promote the matching scheduled workflows;
11. confirm the old scheduled intraday writer is retired;
12. observe an actual scheduled run;
13. verify a live EGX session on phone and desktop.

## Data-change safety

Before manual production accounting correction:

1. identify exact rows/events;
2. capture a read-only before snapshot;
3. verify related transactions/positions/closed cycles;
4. change the smallest possible source ledger data;
5. reconcile;
6. capture after state;
7. run production audit;
8. reopen the app and verify persistence.

Do not repair accounting by broad similarity rules or by directly patching a derived Position when the ledger is the source of truth.

## Backups

The UI backup is a portable portfolio snapshot.

For important corrective work also record database-side counts/state for:

- transactions;
- positions;
- closed trades;
- cash;
- capital deposits.

## PWA deployment recovery

If a device appears to run stale code after deployment:

1. hard refresh;
2. close/reopen installed PWA/browser;
3. confirm expected build/behavior;
4. only if necessary, unregister the service worker and clear site data;
5. sign in again and verify remote state.

Never “fix” a stale client by changing production accounting rows.

## Cloudflare / market-data boundary

Do not move TradingView WebSocket history ingestion into Cloudflare Worker.

Worker responsibilities are request/asset serving and lightweight proxy/API behavior.

Trusted Node automation owns historical ingestion/backfill.

Browser startup must not initiate history repair.

See:

- [INTRADAY_MARKET_DATA.md](INTRADAY_MARKET_DATA.md)
- [MARKET_DATA_AUDIT_2026_09_28.md](MARKET_DATA_AUDIT_2026_09_28.md)
- [MASTER_STABILIZATION_ROADMAP.md](MASTER_STABILIZATION_ROADMAP.md)
