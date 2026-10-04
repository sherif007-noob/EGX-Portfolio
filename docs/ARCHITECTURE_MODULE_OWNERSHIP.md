# Stage 4 Architecture Module Ownership

## Status

**Stage 4.1 — module ownership boundary.**

This document defines where behavior belongs before Stage 4.2 starts extracting orchestration from `App.tsx`.

Stage 4.1 is intentionally behavior-preserving. Existing implementation files remain in place while stable facade roots are introduced. Later Stage 4 passes migrate implementation behind these roots incrementally instead of performing a repository-wide move.

## Governing rule

A module owner is the public application boundary for its concern.

New cross-feature imports should prefer the owner facade. Existing direct imports are migration debt, not permission to add more coupling.

Ownership does **not** transfer accounting authority away from the canonical ledger/reconciliation services.

## Domain ownership

### `src/domain/accounting`

Owns:

- canonical ledger mutations;
- trade/cash mutation preparation;
- reconciliation;
- cost-basis semantics;
- source-ledger versus derived-projection ownership.

It does not own UI state, remote polling, or market quote transport.

### `src/domain/performance`

Owns:

- portfolio performance metrics;
- equity-bridge calculations;
- unified analytics calculations.

It consumes accounting truth but must not mutate the ledger.

### `src/domain/market`

Owns:

- ticker identity/resolution;
- historical market-price access;
- quote-selection rules.

It must not fabricate missing bars or mutate accounting.

## Data ownership

### `src/data/supabase`

Owns Supabase-specific client and persistence adapters.

Feature and UI code should not grow new direct database knowledge when a data boundary can own it.

## Integration ownership

### `src/integrations/google-sheets`

Owns Google Sheets synchronization and export-side effects.

### `src/integrations/ocr`

Owns the OCR ingestion boundary. Parsed trades still enter accounting through canonical ledger mutation semantics.

### `src/integrations/tradingview`

Owns TradingView transport/adapters. The concrete migration is deferred to later Stage 4 work; the ownership slot is reserved now.

## Feature ownership

Target feature roots:

- `src/features/portfolio`;
- `src/features/trades`;
- `src/features/cash`;
- `src/features/reports`;
- `src/features/journal`;
- `src/features/directory`;
- `src/features/alerts`;
- `src/features/scanner`.

Stage 4.1 seeds the Portfolio and Reports facades because those are immediate consumers in Stage 4.2 and Stage 5. Other feature roots are created when their implementation is extracted; empty directory churn is intentionally avoided.

## UI ownership

Target UI roots:

- `src/ui/primitives`;
- `src/ui/overlays`;
- `src/ui/charts`.

The Phase 10 visual contract remains frozen. Stage 4 module moves must preserve rendered output.

## Migration policy

1. Define the owner facade before moving an implementation.
2. Migrate consumers to the facade in focused passes.
3. Move implementation behind that facade only when regression coverage protects behavior.
4. Do not mix module moves with business-logic rewrites.
5. Keep `App.tsx` orchestration extraction in Stage 4.2.
6. Keep `usePortfolioState` decomposition in Stage 4.3.
7. Keep Worker/Express contract consolidation in Stage 4.4.
8. Keep CSS ownership consolidation in Stage 4.5.

## Stage 4.1 exit criteria

- ownership map exists in source and docs;
- accounting/performance/market public domain facades exist;
- Supabase, Google Sheets and OCR public boundaries exist;
- Portfolio and Reports feature facades exist;
- tests protect those roots and ensure the new boundary layer contains no duplicate business implementation;
- no accounting, market-data, UI or persistence behavior changes.
