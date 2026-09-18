# Development

## Prerequisites

- Node.js 22 or newer
- npm 11 or newer
- Git
- Supabase project access

The normal local workflow uses npm.

## Clone and install

```bash
git clone https://github.com/sherif007-noob/EGX-Portfolio.git
cd EGX-Portfolio
npm install
```

## Environment variables

Create a local `.env` file. Do not commit it.

### Required for browser authentication and direct portfolio persistence

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

### Required for server-side Supabase utilities and scripts

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

`SUPABASE_SECRET_KEY` must remain server-side.

### Optional server variables

```env
PORT=3000
DISABLE_HMR=false
```

### Optional Google Sheets service account

Use either a JSON credential variable:

```env
GOOGLE_SERVICE_ACCOUNT_KEY={"client_email":"...","private_key":"..."}
```

or separate values:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_PROJECT_ID=...
```

The server also accepts `GOOGLE_SERVICE_ACCOUNT_JSON` as an alternative to `GOOGLE_SERVICE_ACCOUNT_KEY`.

### Legacy migration variables

Only required when running the old Firestore migration tools:

```env
ENABLE_SUPABASE_MIGRATION_UI=true
FIREBASE_ADMIN_PROJECT_ID=...
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY=...
FIREBASE_ADMIN_OWNER_UID=...
```

Do not configure migration credentials in normal deployments unless migration is actively required.

## Run locally

```bash
npm run dev
```

The app is served through Express with Vite middleware at:

```text
http://localhost:3000
```

The development server listens on `0.0.0.0`, so another device on the same network can reach it using the computer's LAN IP when network/firewall rules permit it.

For an HTTPS mobile test, a temporary tunnel can be used outside the application.

## Quality commands

Run these before opening or merging a pull request:

```bash
npm run lint
npm test
npm run build
```

## Project structure

```text
.
├── .github/workflows/       GitHub Actions
├── docs/                    Project documentation
├── public/                  Static assets and migration page
├── scripts/                 Historical sync and verification scripts
├── src/
│   ├── components/          React UI
│   ├── data/                Seed/static data
│   ├── hooks/               Application state hooks
│   ├── services/            Accounting, persistence, market, integrations
│   └── utils/               Shared calculations/helpers
├── server.ts                Express + Vite application server
├── vite.config.ts
└── package.json
```

## Development principles

### Preserve ledger authority

Do not directly modify positions or cash in a way that bypasses the ledger. Accounting changes should originate from transactions or explicit cash-ledger events and then reconcile derived state.

### Await financial persistence

A mutation that changes financial records must not report success until persistence succeeds.

### Do not write on startup

Loading or signing into the application should hydrate state, not persist a reconstructed copy automatically.

### Never fabricate analytics

If historical coverage is insufficient for a performance metric, return `N/A` or an equivalent unavailable state.

### Keep secrets separated

Browser code may use a Supabase publishable key. It must never contain the server secret key, Firebase Admin private keys, or Google service-account private keys.

## Branch workflow

Recommended flow:

```bash
git switch main
git pull --ff-only
git switch -c feature/my-change
```

After the change:

```bash
npm run lint
npm test
npm run build
git add .
git commit -m "..."
git push -u origin feature/my-change
```

Open a pull request into `main` and wait for Quality Checks to pass.
