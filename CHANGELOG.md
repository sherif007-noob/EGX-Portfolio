# Changelog

All notable project changes should be documented here going forward.

This file follows the spirit of [Keep a Changelog](https://keepachangelog.com/) while Git history remains the authoritative detailed record.

## Unreleased

### Analytics

- Added shared Today/1W/1M/90D/YTD/All portfolio analytics.
- Added Portfolio vs Return, Portfolio vs Net Deposits, TWR, and MWR chart modes.
- Added 15-minute transaction-aware Today reconstruction.
- Added performance drawdown, cumulative-fee, and realized-vs-unrealized P&L charts.
- Standardized dark chart tooltips, crosshairs, axes, empty states, and mobile resize behavior.

### Documentation

- Added full project documentation covering architecture, development, data model, API routes, authentication/security, analytics, testing, operations, troubleshooting, contribution workflow, and security policy.

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
