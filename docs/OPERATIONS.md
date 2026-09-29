# Operations and Deployment

## Status

Canonical operational reference for the Premium branch.

For rollout risks and the next step, see [STATUS.md](STATUS.md).

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
3. install;
4. TypeScript;
5. Vitest;
6. production build.

Important: ordinary feature-branch pushes do not receive this complete quality workflow unless another workflow happens to cover the modified runtime files.

Before promotion, run the exact-head full gate deliberately.

## Raw 1m / derived 5m workflow

Primary workflow:

```text
.github/workflows/intraday-1m-sync.yml
```

Current Premium cron:

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

is manual-only in the Premium design.

Do not reintroduce it as a competing scheduled 5m producer while 5m is derived from raw 1m.

Manual:

```bash
npm run sync:intraday
```

## Daily historical coverage

Workflow:

```text
.github/workflows/historical-prices.yml
```

Current Premium schedule:

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

Current Premium schedule:

```text
15 13 * * 0-4
```

Manual:

```bash
npm run sync:ticker-registry
```

The job typechecks and runs focused registry/resolver regressions before writing identity changes.

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

### Known toolchain inconsistency

The Premium branch uses npm and no longer carries the prior Bun lockfile, but this workflow currently still invokes Bun with `--frozen-lockfile`.

Treat normalization of this workflow as part of the production-convergence stage before declaring the branch CI-clean.

## Scheduled-workflow branch rule

GitHub scheduled workflows execute from the repository default branch.

Therefore:

> a schedule committed only to `feature/premium-ui-redesign` is staged code, not necessarily the active production scheduler.

This is critical for:

- raw 1m ingestion;
- ticker registry reconciliation;
- any retirement of the legacy 15m producer.

The September 28 market-data audit demonstrated why deploying the web application without promoting matching workflow logic is unsafe.

## Promotion checklist

Before making a Premium revision production-authoritative:

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
