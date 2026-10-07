# IPO Subscriptions

## Purpose

IPO subscriptions are modeled as a dedicated ledger lifecycle. They are not normal BUY executions because requested capital can be reserved before final allocation is known.

## Canonical transaction

Type:

`IPO_SUBSCRIPTION`

Structured metadata:

- status: `SUBMITTED | ALLOCATED | CANCELLED`;
- requested amount;
- requested shares;
- offer price;
- subscription date;
- optional broker/offer reference;
- optional expected listing date;
- optional allocation date;
- optional cancellation date;
- allocated shares;
- allocated amount;
- refund amount.

The metadata is persisted in `transactions.ipo_subscription` as JSONB.

## Accounting semantics

### SUBMITTED

- available cash decreases by the requested amount;
- no listed shares are created;
- an equal pending IPO asset is included in portfolio equity;
- NAV and return are therefore unchanged by the reservation itself.

### ALLOCATED

- the pending reservation ends on the allocation date;
- allocated shares enter open-position accounting at the offer price;
- allocation fees become buy fees;
- only the actual allocated cost remains consumed;
- the unallocated balance is released back to cash.

### CANCELLED

- the pending reservation ends on the cancellation date;
- the full requested amount is released back to cash;
- no shares or trading P&L are created.

## Mutation path

All lifecycle mutations use the canonical persist-before-apply ledger executor:

```text
IPO form
  -> prepare IPO mutation
  -> reconcile ledger
  -> validate candidate
  -> atomic Supabase snapshot
  -> apply local state
```

The generic BUY/SELL editor is not allowed to edit an IPO lifecycle row.

## Analytics

Pending IPO capital is part of equity but not listed-equity market value. Current portfolio metrics, Today analytics and historical performance treat the reservation as return-neutral.

Historical reconstruction uses the preserved subscription/allocation/cancellation dates rather than rewriting the reservation period when the lifecycle status changes.

## User interface

Header action:

`IPO`

The modal supports:

1. new subscription;
2. viewing pending subscriptions;
3. recording allocation;
4. cancelling and releasing cash.

The portfolio summary displays:

- available cash;
- IPO reserved capital;
- total portfolio value including the pending asset.

## Persistence

Migration:

`supabase/migrations/20261007033000_add_ipo_subscription_metadata.sql`

Production Supabase was migrated on 2026-10-07.

## Google Sheets boundary

The current Transaction Logger sheet does not have lossless columns for the structured IPO lifecycle. IPO records are therefore excluded from automatic Sheets append/full-ledger mirror.

Supabase remains authoritative. A future Sheets schema extension must preserve the complete lifecycle object before IPO rows are allowed to round-trip.
