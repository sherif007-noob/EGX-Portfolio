# Stage 4.4 Granular Validation

The original Stage 4.4 implementation landed before the roadmap was re-sequenced into smaller acceptance gates. Stage 4.4 is therefore revalidated in focused sub-passes. Later implementation already present on `main` does not count as accepted merely because it exists.

## 4.4.1 — Shared route/request contract authority — VALIDATION IN PROGRESS

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

Next after acceptance: **4.4.2 — auth/error response contract parity**.
