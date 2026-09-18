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

### Intraday Prices

File:

```text
.github/workflows/intraday-prices.yml
```

Schedule:

```text
*/15 6-13 * * 0-4
```

The broad UTC window covers the EGX session across Cairo daylight-saving changes. TradingView supplies the actual 15-minute bar timestamps.

The job:

- runs with Node 22 and npm;
- discovers current/recent portfolio tickers;
- performs an initial retention-window backfill when needed;
- incrementally upserts recent 15-minute bars afterward;
- prunes bars older than the configured retention window;
- uses workflow concurrency to prevent overlapping ingestion runs.

Manual run:

```bash
npm run sync:intraday
```

Default retention:

```env
EGX_INTRADAY_RETENTION_DAYS=90
```

See [INTRADAY_MARKET_DATA.md](INTRADAY_MARKET_DATA.md) for the full design.

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
