# IPO Subscriptions

## Purpose

IPO subscriptions are modeled as a dedicated ledger lifecycle. They are not normal BUY executions because requested capital can be reserved before final allocation is known.

## Canonical transaction

Type:

`IPO_SUBSCRIPTION`

Structured metadata:

- status: `SUBMITTED | ALLOCATED | CANCELLED`;
- requested full order commitment (`requestedAmount`); 
- broker cash hold (`reservedAmount`, optional; defaults to full commitment for legacy records);
- requested shares;
- offer price;
- subscription date;
- optional broker/offer reference;
- optional expected listing date;
- optional allocation date;
- optional cancellation date;
- allocated shares;
- allocated amount;
- refund of unused broker-held cash;
- additional cash required if the allocation exceeds the original hold (`additionalPaymentAmount`).

The metadata is persisted in `transactions.ipo_subscription` as JSONB.

## Accounting semantics

### SUBMITTED

- available cash decreases by **the broker cash hold only**; an order for 161,700 EGP with a 25% hold reserves 40,425 EGP;
- no listed shares are created;
- an equal pending IPO asset is included in portfolio equity (NOT the full order commitment);
- NAV and return are therefore unchanged by the reservation itself.

### ALLOCATED

- the pending reservation ends on the allocation date;
- allocated shares enter open-position accounting at the offer price;
- allocation fees become buy fees;
- when settlement costs less than the hold, the unused held cash is refunded;
- when settlement costs **more** than the hold, the difference must be covered by available cash; otherwise allocation is rejected without a ledger mutation;
- the cash-on-hand result is original available cash less actual allocation cost; no negative refund is invented.

### CANCELLED

- the pending reservation ends on the cancellation date;
- only the **held amount** is released back to available cash;
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

The subscription entry form accepts a configurable broker-held percentage (the default is 100% for backward compatibility). For the user's observed HALN subscription, the correct percentage is 25%. The amount displayed as `Estimated total` is the full order, not the cash debit. Allocation and cancellation use the original hold amount, not the full commitment.

The portfolio summary displays:

- available cash;
- IPO reserved capital;
- total portfolio value including the pending asset.

## Persistence

Migration:

`supabase/migrations/20261007002758_add_ipo_subscription_metadata.sql`

Production Supabase was migrated on 2026-10-07.

## Google Sheets boundary

The current Transaction Logger sheet does not have lossless columns for the structured IPO lifecycle. IPO records are therefore excluded from automatic Sheets append/full-ledger mirror.

Supabase remains authoritative. A future Sheets schema extension must preserve the complete lifecycle object before IPO rows are allowed to round-trip.

## Read-only observed reconciliation / operational boundary

The 2026-10-07 HALN placed order described by the user has 6,600 requested shares at 24.50 EGP, a full 161,700 EGP commitment, and a broker hold of 40,425 EGP. This **does not mean shares were allocated**. The current production database had no IPO_SUBSCRIPTION record during the read-only investigation. Applying the order to the user's actual portfolio must go through the dedicated audited form after confirmation; **no database mutation was made by this branch implementation**. Historical/backtest prices must never treat this as an owned security position.

Source-level tests cover the 25%-hold submitted record, NAV neutrality, unallocated refunds, additional-cash debits, insufficient liquidity, and cancellation. TypeScript, Vitest and device-level acceptance are pending.
