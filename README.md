# EGX Portfolio

A private Egyptian Exchange (EGX) portfolio tracker focused on ledger-correct accounting, current and historical market data, transaction-aware analytics, cash tracking, closed trade cycles, and fast personal trade logging.

## Current architecture

- **Client:** React 19 + TypeScript + Vite PWA.
- **Production web/API runtime:** Cloudflare Worker (`worker.ts`) serving Vite assets and `/api/*` routes.
- **Local/development runtime:** Express/Vite (`server.ts`).
- **Database/auth:** Supabase Postgres + Supabase Auth + RLS.
- **Market data:** TradingView scanner/history through controlled proxy/Node ingestion paths.
- **Automation:** GitHub Actions for daily history, raw 1m intraday ingestion, derived 5m history, ticker registry reconciliation, and production data audits.
- **Optional integration:** Google Sheets.
- **OCR:** Tesseract.js-assisted trade entry.
- **Reports workspace:** Overview / Analytics / Trading / Allocation / Monthly with remembered mode and progressive disclosure.
- **Corporate actions:** canonical ledger-backed BONUS_SHARES flow; broader lifecycle expansion is planned in Stage 6.3.
- **Portfolio intelligence:** Stage 7.1 benchmark comparison overlays flow-neutral portfolio TWR against EGX30, EGX70 EWI, and EGX100 EWI.

The transaction ledger is the financial source of truth. Positions, cash and closed cycles are projections of ledger activity.

## Market-data model

Current production/default-`main` policy:

```text
TradingView raw 1m
        ↓
Supabase intraday_price_history
        ↓
deterministic 5m derivation
        ↓
Today reader: trustworthy 1m → 5m → legacy 15m
UI resolution: Auto / 1m / 5m / 15m / 1h
```

Daily historical closes remain in `price_history`.

The UI also supports a client-derived 1h Today display from observed intraday data.

Today follows the EGX session boundary rather than Cairo midnight: before 10:00 Cairo on an EGX weekday it continues to use the previous trading weekday; at 10:00 it switches to the new session date. Cairo-day database bounds are timezone/DST-aware.

Daily and intraday market-data ingestion also includes EGX30, EGX70 EWI and EGX100 EWI for the Stage 7.1 benchmark comparison mode.

## Quick start

Requirements:

- Node.js 22+
- npm 11+
- configured Supabase project

Install and run:

```bash
npm install
npm run dev
```

The local Express/Vite server uses port 3000 by default.

Minimum local environment:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY

SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

Never expose `SUPABASE_SECRET_KEY` through a `VITE_*` variable.

## Core commands

```bash
npm run dev
npm run lint
npm test
npm run build
npm start

npm run build:cloudflare
npm run deploy:cloudflare

npm run sync:historical
npm run sync:intraday:1m
npm run diagnose:intraday:1m
npm run sync:intraday
npm run sync:ticker-registry
npm run verify:production-data
```

Legacy Firestore migration commands remain for one-time historical recovery/migration work only.

## Documentation

Start here:

- [Current status](docs/STATUS.md)
- [Master stabilization & evolution roadmap](docs/MASTER_STABILIZATION_ROADMAP.md)
- [Documentation map](docs/README.md)

Canonical domain references include:

- [Architecture](docs/ARCHITECTURE.md)
- [Data model](docs/DATA_MODEL.md)
- [Authentication and security](docs/AUTH_AND_SECURITY.md)
- [Operations](docs/OPERATIONS.md)
- [Testing](docs/TESTING.md)
- [Performance analytics](docs/PERFORMANCE_ANALYTICS.md)
- [Intraday market data](docs/INTRADAY_MARKET_DATA.md)
- [Ticker registry](docs/TICKER_REGISTRY.md)
- [Premium visual language](docs/PREMIUM_VISUAL_LANGUAGE_CONTRACT.md)
- [Financial mutation contract](docs/FINANCIAL_MUTATION_CONTRACT.md)
- [Corporate actions ledger](docs/CORPORATE_ACTIONS_LEDGER.md)
- [Closed Reports workspace authority](docs/POST_OVERHAUL_REPORTS_WORKSPACE_REDESIGN_PLAN.md)

## Accounting invariants

1. The transaction ledger is authoritative.
2. A financial mutation is successful only after authoritative persistence succeeds.
3. Cash is derived from contributed capital and ledger cash impacts.
4. Positions reconcile to the ledger.
5. Closed cycles reconcile to the same ledger.
6. Historical analytics do not fabricate missing market values.
7. Startup hydration is read-only.
8. Financial rows are not silently deduplicated or rewritten.

The master roadmap records remaining operational debt and future feature work. Stage 2 financial-integrity adoption is closed; later stages must preserve these invariants.

## Production note

GitHub scheduled workflows execute from the repository default branch, and `main` is the production authority for application code, Cloudflare runtime, market-data automation, ticker registry reconciliation, and regression workflows.

The raw-1m/derived-5m pipeline is already promoted to `main`. Stage 3.5 remains deferred because scheduled-ingestion reliability still requires remediation and a fresh live-session soak.

See [Operations](docs/OPERATIONS.md) and [Current status](docs/STATUS.md).

## Disclaimer

This software is a personal portfolio tracking and analytics tool. Market data and calculated analytics should be independently verified before being used for financial decisions.
