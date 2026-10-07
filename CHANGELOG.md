# Changelog

All notable project changes should be documented here going forward.

This file follows the spirit of [Keep a Changelog](https://keepachangelog.com/) while Git history remains the authoritative detailed record.

## Unreleased

### Analytics

- Added shared Today/1W/1M/90D/YTD/All portfolio analytics.
- Added Portfolio vs Return, Portfolio vs Net Deposits, TWR, MWR, and Portfolio vs Benchmarks chart modes.
- Added transaction-aware Today reconstruction with persisted 1m/5m/15m selection, Auto fallback, and client-derived 1h display aggregation.
- Changed Today session ownership so Cairo midnight does not create a new empty session: before 10:00 Cairo the chart keeps the previous EGX trading weekday, with DST-aware Cairo-day query bounds.
- Fixed a second Today rollover failure where date-only CASH rows could mark every intraday point incomplete; CASH boundary flows no longer require exchange execution timestamps, while BUY/SELL timing remains strict.
- Added performance drawdown, cumulative-fee, and realized-vs-unrealized P&L charts.
- Standardized dark chart tooltips, crosshairs, axes, empty states, and mobile resize behavior.
- Added Stage 7.1 flow-neutral benchmark overlays for EGX30, EGX70 EWI and EGX100 EWI, with selected-period normalization, relative portfolio-minus-index return, daily history ingestion, and intraday benchmark ingestion.

### Documentation

- Added full project documentation covering architecture, development, data model, API routes, authentication/security, analytics, testing, operations, troubleshooting, contribution workflow, and security policy.

### Reports workspace

- Replaced the long Reports page with dedicated Overview, Analytics, Trading, Allocation, and Monthly workspaces.
- Added remembered Reports mode, direct full-report promotion, diagnostic progressive disclosure, responsive mode navigation, and motion/reduced-motion contracts.
- Restored the premium cyan/violet selector aura for structural report navigation and froze the inspected rendered state through exact-hash acceptance.
- Added source and Chromium interaction closure covering Analytics resolutions/modes, Trading filters/exports, Allocation cash/holdings, Monthly filters/exports, direct opening, and restoration.

### Financial integrity and corporate actions

- Completed the persist-before-apply ledger mutation boundary across BUY/SELL, transaction edits/deletes, cash, OCR, restore/import, and reconciliation.
- Removed independent Position/Closed Cycle accounting deletion and hidden BUY/SELL cash modes.
- Added canonical `CORPORATE_ACTION / BONUS_SHARES` support with zero-cash/zero-added-cost accounting, effective-date entitlement, stale-ledger protection, persistence metadata, journal rendering, and regression coverage.
- Changed cash-entry default dates from UTC calendar slicing to `Africa/Cairo` calendar dates. Repaired three affected 20,000 EGP deposits from Oct 6 to Oct 7 without changing cash, contributed capital, holdings, closed cycles, or realized P&L.

### Architecture and styling

- Closed Stage 4 architecture consolidation, including App/state ownership, shared Worker/Express request contracts, feature facades, and CSS ownership.
- Reduced `src/index.css` to the stable import entry and split shared tokens/materials/semantics/hierarchy/controls/overlays/motion/responsive plus feature-specific owners.

### Current validation

- Stage 5 R8 validated on `main@5152ca2b`: 139/139 test files, 734/734 tests, production build, Worker dry-run, rendered browser regression, and 12/12 responsive geometries at 0px overflow.
- Stage 7.1 + Today-session feature head `main@9f6cdcea` is fully closure-green at exact validation head `main@ea1204bb`: Quality **#37547142039**, Rendered Visual Regression **#37547142047**, and Phase 10 Visual Closure **#37547142018** all passed with 140/140 test files, 739/739 tests, production build, Worker dry-run, 12/12 zero-overflow geometries, and unchanged accepted screenshot baselines.
- Today Cairo cash-rollover fix validated on `main@5b0dcba3`: Quality **#37549352346**, Intraday 1m Migration Smoke **#37549352301**, Rendered Visual Regression **#37549352320**, and Phase 10 Visual Closure **#37549352298** all passed with 140/140 test files, 742/742 tests, focused intraday 50/50 tests, Worker dry-run, 14/14 live session tickers resolved with 0 failures, and 12/12 zero-overflow geometries.
- Stage 3.5 live-session ingestion soak remains deferred technical debt pending scheduler reliability remediation.

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
