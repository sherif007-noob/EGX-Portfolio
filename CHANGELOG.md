# Changelog

All notable project changes should be documented here going forward.

This file follows the spirit of [Keep a Changelog](https://keepachangelog.com/) while Git history remains the authoritative detailed record.

## Unreleased

### Documentation

- Reconciled the current documentation authorities after Stage 5 closure and advanced the documented execution point to Stage 6.1 Broker Reconciliation.

## 2026-10

### Financial integrity

- Closed Stage 2 around one persist-confirmed ledger mutation boundary for BUY/SELL, transaction correction/deletion, cash events, OCR/import, reconciliation and restore/import.
- Froze weighted-average / proportional cost-basis semantics and separated contributed-capital, performance-cash and bookkeeping-reconciliation cash flows.
- Removed independent Position/Closed Cycle accounting deletion and hidden trade cash modes.

### Production and architecture

- Made `main` the sole production/default branch authority and normalized GitHub Actions/Node/npm production workflows.
- Added the exact-head production candidate gate and read-only Data Health Center.
- Closed Stage 4 architecture consolidation: app-shell orchestration, portfolio state/hydration/ledger/repository ownership, shared Worker/Express API contracts, and explicit CSS ownership layers.
- Kept Stage 3.5 live-session ingestion soak open as deferred technical debt after the October 4 failure and the unsuccessful October 5 retry (four failed observation jobs and one cancelled final trigger).

### Market data and analytics

- Promoted raw TradingView 1m observations as recent intraday truth with deterministic persisted 1m → 5m derivation and legacy 15m fallback.
- Added coverage-aware Today resolution plus manual `Auto | 1m | 5m | 15m | 1h`; 1h is derived client-side from observed data.
- Preserved strict same-session behavior and no-fabrication rules for missing market observations.
- Kept synchronized primary/secondary analytics, 1W transition behavior, realized trajectory, monthly audit and trading statistics under regression coverage.

### Reports workspace

- Closed Stage 5 Reports redesign with internal Overview / Analytics / Trading / Allocation / Monthly modes.
- Added remembered last mode, diagnostic Overview with one-at-a-time progressive disclosure, direct full-report promotion, responsive workspace validation and shared reduced-motion behavior.
- Restored the Reports structural selector to the accepted glass/refraction/aura visual language and froze the inspected rendered result by exact hash without relaxing the global 1% visual threshold.

### Corporate actions

- Added explicit `CORPORATE_ACTION` ledger support and the first end-to-end action: `BONUS_SHARES`.
- Bonus shares increase broker-credited quantity with zero cash impact and unchanged invested cost, preserve effective-date entitlement/source-share guards, and remain neutral to historical/Today analytics across mechanical price adjustment.
- Reserved broader corporate-action types for Stage 6.3 rather than partially implementing them.

### Validation

- Stage 5 R8 validated runtime `main@5152ca2b` passed Quality Checks, Phase 10 Visual Closure and Rendered Visual Regression.
- Full suite: **139 / 139 test files, 734 / 734 tests**.
- Production build and Cloudflare Worker dry-run passed.
- **12 / 12** responsive geometries remained at **0px overflow**.

## 2026-09

### Authentication and persistence

- Migrated primary portfolio authentication from Firebase Auth to Supabase Auth.
- Mapped the existing portfolio owner to the Supabase Auth user UUID.
- Switched normal browser portfolio persistence to the authenticated Supabase client with RLS.
- Added required authenticated table privileges alongside RLS.
- Kept Firebase only for legacy migration utilities and optional Google OAuth used by Google Sheets.

### Data integrity

- Made transaction deletion wait for successful Supabase persistence before reporting success.
- Made startup hydration read-only to prevent stale snapshots from rewriting accounting data.
- Cleaned confirmed duplicate Sept 13 AFMC/BONY transaction cycles and reconciled derived state.
- Preserved the rule that duplicate-equivalent transactions must be investigated rather than silently deleted.

### Historical analytics

- Added historical EGX price synchronization.
- Added historical portfolio reconstruction.
- Added money-weighted-return reporting.
- Added historical drawdown with strict availability requirements.
- Added production data auditing for reconciliation, duplicate detection, and history coverage.

### CI and automation

- Added quality checks for typecheck, tests, and production build.
- Added scheduled historical-price synchronization.
- Added scheduled production-data auditing.
