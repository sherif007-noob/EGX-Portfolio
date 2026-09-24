# Operations and Deployment

## Runtime model

Production runs the built React application and Express server from one Node process.

Build:

```bash
npm run build
```

This produces:

- Vite client assets in `dist/`;
- bundled Express server at `dist/server.cjs`.

Start:

```bash
npm start
```

The server listens on `PORT` or defaults to `3000`.

## Production environment

Minimum application variables:

```env
NODE_ENV=production
PORT=3000

VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY

SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

The `VITE_*` values are compiled into the browser bundle. The secret key must never use the `VITE_` prefix.

## Google Sheets service account

For unattended spreadsheet sync, configure a Google service account.

Either:

```env
GOOGLE_SERVICE_ACCOUNT_KEY={...json...}
```

or:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=...
GOOGLE_PROJECT_ID=...
```

Share the target spreadsheet with the service-account email and grant Editor access.

## Health checks

Use:

```text
GET /api/health
```

Expected response:

```json
{ "status": "ok" }
```

## GitHub Actions

### Quality Checks

File:

```text
.github/workflows/quality.yml
```

Triggers:

- push to `main`;
- pull request into `main`.

Runs:

1. dependency installation;
2. TypeScript typecheck;
3. Vitest;
4. production build.

### Historical Prices

File:

```text
.github/workflows/historical-prices.yml
```

Schedule:

```text
30 12 * * 0-4
```

This is Sunday through Thursday, matching normal EGX trading days.

Required repository secret:

```text
SUPABASE_SECRET_KEY
```

Optional repository variable:

```text
EGX_PORTFOLIO_ID
```

The workflow uses the server secret only inside GitHub Actions.

### Intraday 1-minute market data

Primary workflow:

```text
.github/workflows/intraday-1m-sync.yml
```

The Premium implementation stages a five-minute ingestion cadence:

```text
*/5 7-12 * * 0-4
```

The cron is deliberately a broad UTC envelope. `scripts/syncIntradayOneMinute.ts` converts the run time through `Africa/Cairo` and only executes scheduled ingestion on Sunday-Thursday from 10:00 through the configured 14:40 Cairo post-close grace window. This avoids hardcoding a UTC+2 or UTC+3 assumption.

GitHub scheduled workflows execute from the repository default branch. Therefore the schedule in `feature/premium-ui-redesign` is staged until that work is intentionally promoted; do not treat a Premium-only cron edit as already active production scheduling.

The job:

1. discovers session-relevant portfolio tickers;
2. resolves ticker/canonical/ISIN identity;
3. retrieves missing/recent TradingView 1m observations in bounded batches;
4. inserts only missing raw 1m timestamps;
5. reloads persisted raw rows as the source of truth;
6. derives deterministic 5m buckets;
7. keeps only unreconstructible older legacy 5m bootstrap data;
8. prunes raw 1m >30d and derived 5m >90d;
9. emits per-ticker and final coverage diagnostics.

Manual run:

```bash
npm run sync:intraday:1m
```

Optional targeted/full-repair variables:

```env
EGX_INTRADAY_TICKERS=ACTF,NAPR
EGX_INTRADAY_FULL_REPAIR=true
```

Read-only diagnostic:

```bash
npm run diagnose:intraday:1m
```

### Legacy 5-minute repair

File:

```text
.github/workflows/intraday-prices.yml
```

This workflow is manual-only. It must not be reintroduced as a competing scheduled 5m producer while derived 5m is being generated from raw 1m.

Manual command:

```bash
npm run sync:intraday
```

Both intraday workflows use the same concurrency group so raw/derived migration and legacy repair cannot write concurrently.

See [INTRADAY_MARKET_DATA.md](INTRADAY_MARKET_DATA.md) and [INTRADAY_1M_MIGRATION_PLAN.md](INTRADAY_1M_MIGRATION_PLAN.md).

### EGX ticker registry

Authoritative security identity is maintained separately from quote snapshots:

```text
public.ticker_registry
public.ticker_aliases
```

The existing `public.tickers` table remains the price/technical snapshot table.

Workflow:

```text
.github/workflows/ticker-registry.yml
```

Manual command:

```bash
npm run sync:ticker-registry
```

The reconciliation job:

1. reads the TradingView Egypt Scanner universe;
2. keeps current live scanner symbols canonical;
3. normalizes ISIN-shaped scanner aliases back to a known ticker when evidence is unique;
4. refreshes identity/classification metadata;
5. detects renames only from previously scanner-verified identities sharing a unique ISIN;
6. verifies historical TradingView resolution and persists the successful symbol/method;
7. keeps inactive/retired identities for historical lookup;
8. emits active, alias, verification and unresolved counts.

Static aliases and the bundled dictionary are fallback/bootstrapping data only. They must not override a current registry identity.

Default policy:

```env
EGX_TICKER_VERIFY_LIMIT=100
EGX_TICKER_VERIFY_AFTER_DAYS=30
EGX_TICKER_INACTIVE_AFTER_DAYS=14
```

The Premium branch stages a post-session Sunday-Thursday registry schedule. As with the 1m workflow, GitHub scheduled workflows execute from the default branch, so this schedule is not production-active until Premium is intentionally promoted.

See [TICKER_REGISTRY.md](TICKER_REGISTRY.md).

### Production Data Audit

File:

```text
.github/workflows/production-data-audit.yml
```

Schedule:

```text
0 14 * * 0-4
```

Runs a read-only reconciliation/data-integrity audit.

## Historical-price operations

Manual run:

```bash
npm run sync:historical
```

Required:

```env
SUPABASE_URL=...
SUPABASE_SECRET_KEY=sb_secret_...
```

The historical sync:

- determines the portfolio/ticker universe;
- requests enough TradingView bars to cover the target calendar interval;
- filters results to exact requested dates;
- upserts historical rows without modifying accounting transactions.

## Production audit

Manual run:

```bash
npm run verify:production-data
```

Use it after:

- a migration;
- duplicate cleanup;
- accounting code changes;
- unusual position/cash behavior;
- historical-price backfills.

The audit should not mutate portfolio accounting data.

## Data-change safety

Before any manual production correction:

1. identify the exact rows to change;
2. take a read-only before snapshot;
3. verify references from closed trades/positions;
4. perform the smallest possible mutation;
5. recompute/reconcile derived state if needed;
6. take an after snapshot;
7. run the production audit;
8. refresh/reopen the application to confirm persistence.

Never perform broad financial cleanup using an unreviewed similarity rule.

## Backups

The application contains JSON backup/reconcile functionality in the UI. A backup should be treated as a portable snapshot of financial state.

For important corrections, also capture database-side counts before and after:

- transactions;
- positions;
- closed trades;
- cash;
- capital deposits.

## PWA/service-worker deployments

Because the project is a PWA, clients can retain a previous application bundle.

After a deployment that changes authentication or persistence:

- hard refresh the page;
- verify the expected commit is deployed;
- if behavior remains stale, unregister the service worker and clear site data;
- reopen the app and authenticate again.

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Mobile access during development

The dev server binds to `0.0.0.0`, allowing LAN testing when firewall/network rules permit it.

For HTTPS testing on iOS, a temporary HTTPS tunnel may be used to forward to:

```text
http://localhost:3000
```

Supabase Auth does not require Firebase authorized-domain configuration.

## Legacy migration operations

The Firestore migration endpoint and scripts remain in the repository for historical/one-time use.

Keep:

```env
ENABLE_SUPABASE_MIGRATION_UI
```

unset or false in normal operation.

Do not rerun a migration against an already-live portfolio unless there is a documented recovery plan and a verified reconciliation target.


## Final analytics audit checks

Before promoting analytics changes, verify:

- transaction-ledger cash equals stored portfolio cash;
- transaction-derived shares equal stored positions;
- no exact duplicate non-cash transaction groups exist;
- all portfolio trades have execution timestamps when intraday analytics depend on them;
- every open holding has the latest daily market close;
- every open holding has intraday coverage for the latest completed session;
- final-session NAV from 15-minute closes agrees with stored portfolio market value.

The production RLS event-trigger function is intentionally not executable by browser API roles. The remaining Supabase security-advisor item at the time of the analytics audit is leaked-password protection, which should be enabled in Supabase Auth settings when available for the project.
