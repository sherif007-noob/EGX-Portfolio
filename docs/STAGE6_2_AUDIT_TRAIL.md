# Stage 6.2 — Lightweight Financial Audit Trail

## Status

**COMPLETE / CLOSED — 6.2.1 through 6.2.5 implemented on `main`.**

The audit trail exists for personal traceability. It is not an accounting source of truth and it is not an enterprise compliance subsystem.

## Authority

```text
transaction ledger = financial authority
audit trail        = immutable explanation/history of ledger mutations
```

The audit trail must never be used to reconstruct portfolio accounting when the canonical ledger is available.

## Atomicity

Canonical mutations generate the audit draft after candidate validation and before persistence.

Persistence path:

```text
prepare candidate
  -> validate candidate
  -> derive audit before/after diff
  -> replace_portfolio_accounting_snapshot_with_audit(...)
       -> replace canonical accounting snapshot
       -> insert immutable audit row
     [same PostgreSQL transaction]
  -> apply local React state
```

If the audit insert fails, the accounting snapshot rolls back too.

## Stored fields

Each record stores:

- mutation ID;
- mutation kind;
- entity type;
- entity ID when available;
- ticker when available;
- optional user reason;
- compact before state;
- compact after state;
- added/removed/changed transaction IDs;
- changed position tickers;
- server timestamp.

The before/after state intentionally stores compact financial context rather than a complete duplicate portfolio snapshot.

## Visibility

Data & Tools → Backup, Sync & Integrity contains **Financial Audit Trail**.

The viewer shows the latest 100 records and exposes:

- mutation kind;
- entity/ticker;
- timestamp;
- optional reason;
- cash before/after;
- transaction before/after when applicable;
- compact ledger/position-change metadata.

## Reason capture

Optional audit-only reason capture now exists for:

- transaction edit and deletion;
- cash-ledger edit and deletion;
- manual cash reconciliation adjustment;
- manual ledger reconciliation;
- JSON backup restore.

Google Sheets import records the sheet source automatically as audit provenance.

The reason does not overwrite transaction/cash Notes fields.

## Closure acceptance

Exact core validation head: `df956cb5`.

- TypeScript passed.
- 150 / 150 test files and 792 / 792 tests passed.
- Production Vite/PWA build passed.
- Cloudflare Worker dry-run passed.
- 12 / 12 responsive geometry widths remained at 0px overflow.
- The rendered screenshot job remains red because its golden images were already stale before Stage 6.2. The reported diff percentages on the pre-stage head `b81d7fe5` and the Stage 6.2 acceptance head are identical, so the stage introduced no additional tracked rendered delta. No baseline or threshold was silently changed.

## Database

Migration:

`supabase/migrations/20261007214652_stage62_portfolio_audit_trail.sql`

The audit table is append-only for authenticated users:

- SELECT allowed for the owning portfolio;
- INSERT only through the owning portfolio boundary;
- UPDATE/DELETE are not granted.

The canonical mutation executor uses the atomic wrapper RPC only when there is a material audit diff. Background quote/price persistence continues through the non-audited snapshot/price paths.
