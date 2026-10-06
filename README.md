# EGX Portfolio

A private Egyptian Exchange (EGX) portfolio tracker focused on ledger-correct accounting, current/historical market data, transaction-aware analytics, cash tracking, closed trade cycles, corporate actions, and fast personal trade logging.

## Current architecture

- **Client:** React 19 + TypeScript + Vite PWA.
- **Production web/API runtime:** Cloudflare Worker (`worker.ts`) serving Vite assets and `/api/*` routes.
- **Local/development runtime:** Express/Vite (`server.ts`).
- **Database/auth:** Supabase Postgres + Supabase Auth + RLS.
- **Financial truth:** transaction ledger; positions, cash and closed cycles are reconciled projections.
- **Market data:** TradingView scanner/history through controlled HTTP proxy and trusted Node ingestion.
- **Automation:** GitHub Actions for daily history, raw 1m ingestion, derived 5m history, ticker-registry reconciliation, production data audit and regression gates.
- **Optional integration:** Google Sheets.
- **OCR:** Tesseract.js-assisted trade entry.

The default/production branch is **`main`**. The old premium branch is only a compatibility mirror and is not a second production authority.

## Current feature state

### Portfolio/accounting

Financial mutations are persist-confirmed: candidate ledger → reconciliation → authoritative Supabase snapshot → local apply.

Current accounting includes:

- BUY/SELL;
- deposits/withdrawals and explicit cash-flow semantics;
- transaction correction/deletion;
- OCR/import/restore/reconciliation workflows;
- weighted-average / proportional cost basis;
- derived open positions and closed cycles;
- `CORPORATE_ACTION / BONUS_SHARES` with zero cash impact and unchanged invested cost.

### Reports

Reports is a five-mode analytical workspace:

```text
Overview | Analytics | Trading | Allocation | Monthly
```

It remembers the last mode, supports diagnostic drill-in, responsive layouts and the accepted premium selector/glass/aura language.

### Market data

```text
TradingView raw 1m
        ↓
Supabase intraday_price_history
        ↓
deterministic persisted 1m → 5m derivation
        ↓
Today Auto selector: 1m → 5m → legacy 15m
```

The UI also supports manual `Auto | 1m | 5m | 15m | 1h`; 1h is client-derived from observed intraday data.

Daily historical prices remain in `price_history`.

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
npm run verify:live-session-soak
```

Legacy Firestore migration commands remain for one-time historical recovery/migration only.

## Documentation

Start here:

- [Current status](docs/STATUS.md)
- [Master stabilization & evolution roadmap](docs/MASTER_STABILIZATION_ROADMAP.md)
- [Documentation map](docs/README.md)

Canonical references include:

- [Architecture](docs/ARCHITECTURE.md)
- [Data model](docs/DATA_MODEL.md)
- [Authentication and security](docs/AUTH_AND_SECURITY.md)
- [API](docs/API.md)
- [Operations](docs/OPERATIONS.md)
- [Testing](docs/TESTING.md)
- [Performance analytics](docs/PERFORMANCE_ANALYTICS.md)
- [Intraday market data](docs/INTRADAY_MARKET_DATA.md)
- [Ticker registry](docs/TICKER_REGISTRY.md)
- [Financial mutation contract](docs/FINANCIAL_MUTATION_CONTRACT.md)
- [Corporate actions ledger](docs/CORPORATE_ACTIONS_LEDGER.md)
- [Premium visual language](docs/PREMIUM_VISUAL_LANGUAGE_CONTRACT.md)

## Accounting/data invariants

1. The transaction ledger is authoritative.
2. A financial mutation is successful only after authoritative persistence succeeds.
3. Cash is derived from contributed capital and ledger cash impacts.
4. Positions and closed cycles reconcile to the ledger.
5. Missing historical/intraday market values are not fabricated.
6. Startup hydration is read-only.
7. Financial rows are not silently deduplicated or rewritten.
8. Corporate actions are explicit ledger events, not fake trades or derived-state patches.

## Current roadmap

Stages 1, 2, 4 and 5 are closed. Stage 3.5 remains deferred technical debt.

The next planned implementation is **Stage 6.1 — Broker reconciliation workspace**.

See [Current status](docs/STATUS.md) for the exact accepted runtime and [Operations](docs/OPERATIONS.md) for deployment/automation details.

## Disclaimer

This software is a personal portfolio tracking and analytics tool. Market data and calculated analytics should be independently verified before being used for financial decisions.
