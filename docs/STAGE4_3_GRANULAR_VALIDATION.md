# Stage 4.3 Granular Validation

The original Stage 4.3 implementation landed as one broad refactor before the work was re-sequenced into smaller sub-passes. From this point forward, Stage 4.3 is validated and accepted in granular gates.

## 4.3.1 — Local state + compatibility cache — ACCEPTED / CI GREEN

**Scope**

- local React portfolio state;
- legacy/localStorage compatibility keys;
- startup fallback values;
- visual-regression fixture startup state;
- local ticker metadata rehydration;
- local compatibility cache persistence.

**Explicitly out of scope**

- remote Supabase hydration/subscription;
- canonical ledger mutation execution;
- repository persistence actions;
- public facade cleanup beyond confirming localStorage no longer leaks into it.

**Acceptance**

- only the compatibility module reads/writes the legacy localStorage keys;
- local state modules contain no remote persistence or financial mutation implementation;
- existing storage keys remain unchanged;
- visual-regression fixture behavior remains represented;
- ticker metadata rehydration remains owned locally;
- TypeScript, full tests, and production build are green.

### 4.3.1 acceptance record

Accepted through PR #50 at `main@b0ecb4b7`.

Quality Checks #37229492006 passed:

- TypeScript;
- **103 / 103 test files, 566 / 566 tests**;
- production build.

The acceptance guard confirms that legacy localStorage access is contained in `portfolioCompatibility.ts`, local presentation state is free of remote persistence and ledger-mutation concerns, existing storage keys remain unchanged, and visual/ticker rehydration behavior remains represented.

Next: **4.3.2 — remote hydration/subscription ownership**.


## 4.3.2 — Remote hydration/subscription ownership — ACCEPTED / CI GREEN

**Scope**

- initial authoritative portfolio load;
- retry when the authoritative portfolio is temporarily unavailable;
- pending-write flush before steady-state polling;
- remote portfolio subscription lifecycle;
- subscription cleanup on unmount;
- remote accounting-state application while preserving fresher local quote timestamps;
- asynchronous subscription error visibility.

**Explicitly out of scope**

- canonical BUY/SELL/cash/OCR mutation execution;
- direct repository write actions such as force-sync and position metadata persistence;
- public compatibility-facade cleanup;
- Stage 4.4/4.5 work.

**Acceptance**

- `usePortfolioHydration.ts` owns load/retry/subscribe/cleanup behavior;
- hydration talks to persistence through `portfolioRepository`, not raw Supabase/storage functions;
- the long-lived subscription uses current local fallback state without being recreated on every render;
- both subscription setup errors and later polling errors are surfaced;
- fresher local quote timestamps remain protected when remote accounting snapshots arrive;
- hydration contains no localStorage or canonical financial mutation implementation;
- TypeScript, full tests, and production build are green.

### 4.3.2 acceptance record

Accepted through PR #51 at `main@dce45fc6`.

Quality Checks #37230637442 passed:

- TypeScript;
- **104 / 104 test files, 571 / 571 tests**;
- production build.

The pass also corrected two ownership defects inside the hydration boundary:

- long-lived subscription fallbacks now read the latest local ticker/capital/cash state without recreating the mount-only subscription;
- asynchronous polling errors are surfaced through the repository subscription error callback, separately from synchronous subscription setup failures.

Next: **4.3.3 — canonical ledger mutation ownership**.


## 4.3.3 — Canonical ledger mutation ownership — ACCEPTED / CI GREEN

**Scope**

- BUY and SELL mutation orchestration;
- transaction edit/delete;
- cash add/edit/delete and reconciliation adjustment;
- ledger reconciliation;
- OCR batch import;
- backup/ledger restore;
- persisted-snapshot application into local portfolio state;
- freshness of the in-memory mutation source between consecutive persisted mutations.

**Explicitly out of scope**

- direct repository actions such as position metadata persistence and force-sync;
- remote hydration/subscription;
- compatibility-facade cleanup beyond delegation checks;
- Stage 4.4/4.5 work.

**Acceptance**

- every financial mutation family enters through `usePortfolioLedgerMutations.ts`;
- the canonical executor persists before applying local financial state;
- no raw storage, Supabase, Google Sheets or localStorage mechanics live in the ledger owner;
- successful mutation application advances the mutation source synchronously before React's batched setters, preventing an immediately-following mutation from using the previous render's stale ledger;
- newly authored BUY/SELL transaction IDs use collision-resistant UUIDs;
- the public compatibility facade delegates financial writes to the ledger owner;
- TypeScript, full tests, and production build are green.

### 4.3.3 acceptance record

Accepted through PR #52 at `main@87a10cd4`.

Quality Checks #37231285634 passed:

- TypeScript;
- **105 / 105 test files, 577 / 577 tests**;
- production build.

The pass also closed a mutation-freshness race at the ownership boundary: after a financial mutation persists, `usePortfolioLedgerMutations.ts` now advances its internal canonical snapshot before React's batched state setters. An immediately-following mutation therefore prepares from the just-persisted ledger rather than the previous render. Newly authored BUY/SELL IDs now use `crypto.randomUUID()`.

Next: **4.3.4 — repository/persistence action ownership**.


## 4.3.4 — Repository/persistence action ownership — ACCEPTED / CI GREEN

**Scope**

- Supabase-backed portfolio repository adapter;
- persisted position metadata updates;
- explicit force-sync orchestration;
- persistence success/failure propagation to the Edit Position workflow;
- remote ticker-directory precedence during force-sync.

**Explicitly out of scope**

- canonical financial ledger mutation execution;
- remote hydration/subscription lifecycle;
- public compatibility-facade cleanup;
- Stage 4.4/4.5 work.

**Acceptance**

- repository actions depend on `portfolioRepository`, not raw Supabase/storage functions;
- `portfolioRepository` binds directly to Supabase storage instead of the legacy Firestore-name compatibility shim;
- position target/stop/notes edits are persistence-confirmed before local success is applied;
- failed position metadata persistence leaves the modal open and does not show success;
- successful metadata application preserves any fresher local market/accounting fields that advanced while the save was in flight;
- explicit force-sync does not overwrite authoritative remote ticker metadata with stale local duplicates;
- TypeScript, full tests, and production build are green.

### 4.3.4 acceptance record

Accepted through PR #53 at `main@4653347c`.

Quality Checks #37240842829 passed:

- TypeScript;
- **106 / 106 test files, 583 / 583 tests**;
- production build.

The pass also corrected two persistence-boundary defects:

- Edit Position target/stop/notes updates are now persistence-confirmed; failed saves keep the modal open and no longer report false success;
- explicit force-sync no longer lets stale local ticker metadata overwrite authoritative remote duplicates.

The repository adapter now binds directly to Supabase storage rather than the legacy Firestore-name compatibility shim.

Next: **4.3.5 — compatibility facade cleanup + regression closure**.


## 4.3.5 — Compatibility facade cleanup + regression closure — ACCEPTED / CI GREEN

**Scope**

- move the application-facing `usePortfolioState()` implementation under `src/features/portfolio`;
- retain `src/hooks/usePortfolioState.ts` only as a legacy import shim;
- stop exposing raw React setters for financial/portfolio state;
- replace App's raw `setPositions` access with the explicit market-projection operation `updateMarketPositions`;
- migrate Stage 4.3 source contracts to the owned feature facade;
- add a final boundary scan preventing new application imports from the legacy hook path.

**Explicitly out of scope**

- new accounting behavior;
- remote hydration behavior changes;
- repository persistence behavior changes;
- Stage 4.4/4.5 work;
- Stage 5 Reports redesign.

**Acceptance**

- the owned feature facade is the only implementation of `usePortfolioState()`;
- the old hook path is a re-export shim only;
- App imports through `features/portfolio`;
- no raw setters for positions, transactions, cash, closed cycles, tickers or contributed capital are exposed through the application facade;
- live market projection updates use a named operation rather than a raw React setter;
- ledger and repository operations remain explicit;
- all 4.3.1–4.3.5 ownership guards pass together;
- TypeScript, full tests, and production build are green.

### 4.3.5 acceptance record

Accepted through PR #54 at `main@98ca8653`.

Quality Checks #37241869884 passed:

- TypeScript;
- **107 / 107 test files, 588 / 588 tests**;
- production build.

Closure results:

- the owned `usePortfolioState()` implementation now lives under `src/features/portfolio`;
- `src/hooks/usePortfolioState.ts` is a legacy re-export shim only;
- raw React setters for positions, closed cycles, transactions, cash, tickers and contributed capital are no longer exposed through the application facade;
- App uses explicit `updateMarketPositions` for market projection refreshes;
- earlier Stage 4.3 ownership guards now follow the feature-owned facade;
- a source-boundary scan prevents application code from regressing to the legacy hook import path.

**Stage 4.3 is CLOSED / CI GREEN.**
