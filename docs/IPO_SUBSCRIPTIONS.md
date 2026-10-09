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

- available cash decreases by **the broker cash hold only**; for example, a 100,000 EGP order at a 25% hold reserves 25,000 EGP;
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

The subscription form asks the user for **number of shares** and **offer price per share**. The full EGP order commitment is automatically calculated (shares × price) and is never a required money input. The form then accepts a configurable broker-held percentage (100% by default for backward compatibility). The hold percentage must match the broker's actual order conditions. The amount displayed as `Estimated total` is the full order, not the cash debit. Allocation and cancellation use the original hold amount, not the full commitment.

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

The lifecycle model supports partial broker holds, regardless of IPO ticker. For example, a **synthetic** 100,000 EGP order with 25,000 EGP (25%) held records 25,000 EGP reserved cash as a pending asset; it does not create owned shares. Any real pending IPO in a user's portfolio must be saved through the dedicated audited form after confirmation. No production financial records were mutated by this branch implementation.

Source-level tests cover the 25%-hold submitted record, NAV neutrality, unallocated refunds, additional-cash debits, insufficient liquidity, and cancellation. TypeScript, Vitest and device-level acceptance are pending.

### Share-first input invariant

New IPO form submissions include `requestedShares` as the explicit whole-number quantity, alongside the calculated `requestedAmount` and `reservedAmount`. The canonical ledger mutation verifies that the rounded commitment agrees with shares × price; it preserves the precise quantity instead of dividing a rounded monetary amount back by the price. Legacy callers that supply only `requestedAmount` and `offerPrice` are still accepted. No portfolio ledger entries are created or changed by the UI migration alone.

## Correct a saved pending subscription date (medium-ui)

In the current UI, expand the original IPO entry under **Activity** and tap **Edit**. (The earlier IPO → Pending allocations path is retired.) The inline editor offers the actual subscription date, optional Cairo placement time, an audit reason, and **Save changes** or **Discard**.

- The correction updates the existing transaction **in place**, preserving its original ID, ticker, commitment, requested shares, cash hold, pending status and metadata. No duplicate order or second cash reservation is created.
- A date correction updates both the parent ledger row's `date` and the IPO metadata's `subscriptionDate`. An explicitly entered broker time is converted using `Africa/Cairo`, including DST, and saved as `executedAt`.
- If the corrected day also contains cash deposits, the actual placement time is **required**. Otherwise the ledger could process the backdated hold before its funding. For a broker order placed at 10:51 AM Cairo on October 7, enter that exact time from the order record. Do not infer execution times from submission-date defaults.
- Only orders in `SUBMITTED` status may be corrected here. Allocated or cancelled orders must retain their historical lifecycle and use a separate reviewed correction path.
- Financial persistence uses the canonical persist-before-apply executor with a mandatory audit reason, full reconciliation and all-or-nothing commit. The production ledger has not been modified by adding this feature.

The new editor and ledger correction have targeted regression source tests for Cairo DST, October-date changes, preserving a single hold, NAV neutrality and same-day funding order. Automated tests and phone acceptance remain pending.

## Modal flow and date-entry correction — 2026-10-09

An earlier IPO modal rendered three mutually unrelated financial workflows on one long surface and rejected a valid edited date because the correction form's JavaScript regex accidentally matched a literal escaped backslash rather than date digits.

That intermediate modal navigation has now been retired. The **Add → IPO subscription** option opens a single new-order form. An existing order is edited, allocated, or deleted directly from its record in **Activity**. The retired design had listed these screens:
- **New subscription:** ticker, requested shares, offer price per share, held percentage, summary, then create.
- **Edit order details:** existing pending order, real order date/time in Cairo, audit reason, then Save changes or Discard; no new reservation.
- **Record allocation:** actual allocated shares, date, actual fees, settlement/hold comparison, then confirm.
- **Cancel subscription:** separate broker-cancellation confirmation, explicitly describing funds released.

The parent modal remains one accessible dialog/sheet container but never shows those forms simultaneously. Pending-list selection and in-progress edits are no longer reset by ordinary background portfolio refreshes.

`DateInput` uses opt-in `strictInput` mode on IPO form dates. The shared `parseUserCalendarDate` accepts **Egyptian DD/MM/YYYY** or **ISO YYYY-MM-DD**, rejects impossible/incomplete dates, and returns `null` rather than silently falling back to today's date. An incomplete edited date invalidates the form state; the ledger correction independently normalizes/validates the date before auditing and persistence. The date save regex and Cairo-time regex were corrected.

Tests cover the 07/10/2026 round-trip, invalid 31/02/2026, isolated workflows, preventing reset during live-refresh, and the existing immutable-cash-hold correction path. Source-level changes only: no live IPO date was altered, and TypeScript/Vitest/browser acceptance has not been executed.

## Current IPO entry/action policy (2026-10-09)

**Add → IPO subscription** opens `SimpleIpoCreateModal` and does only one thing: submit a new IPO order. The form asks for ticker, company, whole requested shares, offer price, broker hold percentage, subscription date, and optional notes/reference. The commitment and reserved cash are calculated; no editing/allocation/cancellation subnavigation is available there.

**Activity → select pending IPO** offers **Allocation · Edit · Delete** on that specific record.
- **Edit** changes the same submitted ledger row in one audited dialog. Requested shares, price, hold percentage, date, Cairo time, reference and notes are editable. Recalculate requested amount and held EGP; the original transaction ID persists. On the actual cash funding date, Cairo order time is required for correct ledger ordering. Editing is not a new order or a second hold.
- **Allocation** uses the validated settlement mutation and records only actual awarded shares, with unused hold refund or available-cash top-up.
- **Delete** removes a mistaken **app ledger entry** with an audit reason and canonical recomputation. It does **not** cancel the broker's actual IPO order. Allocated and cancelled lifecycle records cannot be deleted from Activity or the canonical deletion mutation.
- Completed IPO history remains visible in Activity and is not offered unsafe lifecycle rewrites.

This supersedes older directions to open a combined IPO manager. Source-only implementation on `medium-ui`; no deployment or live ledger modification.
