# Documentation Archive Policy

The archive exists to separate **current truth** from **implementation history** without deleting useful reasoning.

## Why historical files have not all been moved yet

Several Phase 8–10 regression tests read plan/contract files using exact repository paths.

Moving those documents merely for tidiness would break regression coverage or require unrelated code changes while Phase 10 is still active.

Therefore:

> classification happens first; physical movement happens only when path ownership is safely removed or migrated.

Use `../README.md` to see whether a root-level document is canonical, active, audit evidence, or historical.

## Future archive groups

### `archive/visual/`

Completed visual implementation journals, once no active tests depend on their current paths.

### `archive/audits/`

Dated audits/incidents after their findings have been incorporated into canonical domain docs.

### `archive/migrations/`

Completed migration/rollout plans after the deployed architecture no longer depends on their checklist.

## Archive requirements

Before moving a document:

1. identify references from code/tests/docs;
2. update those references in the same reviewed change;
3. confirm no active plan still owns it;
4. keep a canonical replacement for any current behavioral rule;
5. run the relevant regression suite.

Historical reasoning about accounting, persistence or market-data integrity should be preserved rather than deleted.
