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


## 4.3.3 — Canonical ledger mutation ownership — VALIDATION IN PROGRESS

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

Next after acceptance: **4.3.4 — repository/persistence action ownership**.
