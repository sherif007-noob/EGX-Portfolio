# Stage 4.4 Granular Validation

The original Stage 4.4 implementation landed before the roadmap was re-sequenced into smaller acceptance gates. Stage 4.4 is therefore revalidated in focused sub-passes. Later implementation already present on `main` does not count as accepted merely because it exists.

## 4.4.1 — Shared route/request contract authority — ACCEPTED / CI GREEN

**Scope**

- canonical API path ownership;
- canonical HTTP method ownership;
- Express route registration parity;
- Worker route coverage;
- method rejection behavior for known API routes;
- shared portfolio-save normalization;
- shared historical-price query normalization;
- existing shared price-tick and symbol-search request normalization.

**Explicitly out of scope**

- auth/error response semantics beyond method rejection;
- runtime capability/no-op semantics;
- Google Sheets payload schemas;
- scanner response schemas;
- Stage 4.5 CSS ownership.

**Acceptance**

- `src/api/contracts.ts` is the single path/method authority;
- every Express API registration matches `API_ROUTE_METHODS`;
- Worker covers every declared API route;
- both runtimes reject unsupported methods from the shared method map with HTTP 405 and an `Allow` header;
- Worker and Express contain no hard-coded runtime API route literals;
- portfolio-save and historical-price query normalization are shared rather than duplicated;
- existing shared request parsers remain in use;
- TypeScript, full tests, and production build are green.

### 4.4.1 acceptance record

Accepted through PR #55 at `main@895dc351`.

Quality Checks #37242757469 passed:

- TypeScript;
- **108 / 108 test files, 593 / 593 tests**;
- production build.

The pass closed the main route-authority gap left by the broad Stage 4.4 implementation: `API_ROUTE_METHODS` is now executable in both runtimes rather than documentation-only. Known API paths reject unsupported methods with HTTP 405 plus an `Allow` header before Express implicit routing or Worker handlers can diverge.

Portfolio-save and historical-price query normalization are also shared through `src/api/contracts.ts`, and regression coverage verifies every Express registration against the canonical method matrix plus every Worker route against the canonical path map.

Next: **4.4.2 — auth/error response contract parity**.


## 4.4.2 — Auth/error response contract parity — VALIDATION IN PROGRESS

**Scope**

- canonical API error body construction;
- Supabase authentication error classification;
- separation of authentication failures from authenticated handler failures;
- Worker/Express proxy error shape parity;
- Google Sheets/Drive upstream auth flags and error metadata;
- missing Google credentials behavior.

**Explicitly out of scope**

- runtime capability/no-op semantics;
- Google Sheets request payload schema consolidation;
- scanner success-response schema;
- Stage 4.5 CSS ownership.

**Acceptance**

- every shared API error exposes a string `error` field;
- optional `retryable`, `isAuthError`, `details`, and `authSource` fields are built through the shared contract;
- arbitrary business/data errors containing words such as “invalid” cannot be misclassified as authentication failures;
- Supabase token verification failures are separated from authenticated handler failures in both runtimes;
- HTTP 401/403 upstream Google responses consistently set `isAuthError: true`;
- missing Google credentials are auth-classified instead of generic HTTP 500 failures;
- TypeScript, full tests, and production build are green.

Next after acceptance: **4.4.3 — runtime capability/deprecation contract validation**.
