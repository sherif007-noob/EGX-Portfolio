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


## 4.4.2 — Auth/error response contract parity — ACCEPTED / CI GREEN

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

### 4.4.2 acceptance record

Accepted through PR #56 at `main@41f37430`.

Quality Checks #37243628532 passed:

- TypeScript;
- **109 / 109 test files, 599 / 599 tests**;
- production build.

The pass closed two concrete parity defects:

- shared API errors now always expose a string `error`; Worker Google upstream payloads move raw provider data into `details` rather than placing an object in `error`;
- Supabase token verification errors are separated from authenticated handler failures, so ordinary data/business errors containing words such as “invalid” cannot be mislabeled as HTTP 401.

Google Sheets/Drive upstream HTTP 401/403 responses now share the same `isAuthError` semantics, and missing Google credentials are auth-classified consistently.

Next: **4.4.3 — runtime capability/deprecation contract validation**.


## 4.4.3 — Runtime capability/deprecation contract validation — VALIDATION IN PROGRESS

**Scope**

- runtime capability meaning and ownership;
- capability-to-route mapping;
- Cloudflare Worker unavailable-capability responses;
- Express implementation-support coverage;
- explicit preservation of the legacy intraday repair no-op;
- distinction between runtime support and current configuration/enabling.

**Explicitly out of scope**

- Google Sheets request payload schema consolidation;
- scanner success-response schema;
- route/request normalization already accepted in 4.4.1;
- auth/error semantics already accepted in 4.4.2;
- Stage 4.5 CSS ownership.

**Acceptance**

- `API_RUNTIME_CAPABILITIES` means implementation support, not current feature configuration;
- every capability maps to one canonical route key;
- every unsupported Worker capability has an explicit shared unavailable-response contract;
- Worker handlers consume those shared contracts instead of hard-coding deprecation/disabled behavior;
- Express declares support only for capabilities for which it owns real handlers;
- the existing intraday Worker `200 + deprecated no-op` remains explicit and regression-protected for old cached clients;
- TypeScript, full tests, and production build are green.

Next after acceptance: **4.4.4 — Google Sheets payload/response contract consolidation**.
