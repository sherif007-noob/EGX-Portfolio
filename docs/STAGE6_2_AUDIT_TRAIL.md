# Stage 6.2 — Lightweight Financial Audit Trail

## Status

**ACTIVE — 6.2.1 through 6.2.4 implemented on `main`.**

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

Transaction edit and transaction deletion support an optional correction reason.

The reason is audit-only. It does not overwrite the transaction's own Notes field.

Remaining Stage 6.2 work is to expose the same optional reason contract on:

- cash corrections;
- manual reconciliation;
- backup/restore or ledger import corrections where a reason is useful.

## Database

Migration:

`supabase/migrations/20261007214652_stage62_portfolio_audit_trail.sql`

The audit table is append-only for authenticated users:

- SELECT allowed for the owning portfolio;
- INSERT only through the owning portfolio boundary;
- UPDATE/DELETE are not granted.

The canonical mutation executor uses the atomic wrapper RPC only when there is a material audit diff. Background quote/price persistence continues through the non-audited snapshot/price paths.
