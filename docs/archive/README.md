# Documentation Archive Policy

The archive separates **current truth** from **implementation history** without deleting useful reasoning.

## Current rule

Phase 10, Stage 4 and Stage 5 are closed, but several historical visual/architecture tests still read plan files using exact repository paths.

Therefore:

> classification happens first; physical movement happens only when path ownership is safely removed or migrated.

A document may remain physically under `docs/` while being classified as historical in [../README.md](../README.md).

Do not infer current status from a historical file's old `ACTIVE`, `NEXT` or branch wording. Use:

1. [../STATUS.md](../STATUS.md);
2. [../MASTER_STABILIZATION_ROADMAP.md](../MASTER_STABILIZATION_ROADMAP.md);
3. the relevant canonical domain document.

## Intended archive groups

### `archive/visual/`

Completed visual implementation journals once exact-path test dependencies are removed.

### `archive/audits/`

Dated audits/incidents after their findings are incorporated into canonical domain docs.

### `archive/migrations/`

Completed migration/rollout plans once no remaining rollout/deprecation gate depends on them.

## Archive requirements

Before moving a document:

1. identify references from code, tests and docs;
2. update those references in the same reviewed change;
3. confirm no active plan still owns it;
4. keep a canonical replacement for every current behavioral rule;
5. run the relevant regression suite.

Historical reasoning about accounting, persistence, market-data integrity, visual regressions and failed migration attempts should be preserved rather than deleted.
