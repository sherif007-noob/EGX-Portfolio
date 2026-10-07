# Stage 6.1 — Broker Reconciliation Workspace

## Status

**ACTIVE — 6.1.1 through 6.1.3 implemented on `main`.**

Stage 6.1 exists to compare an external broker snapshot against the canonical app ledger projection without creating a second accounting authority.

## Invariant

```text
broker snapshot = external observation
app ledger      = internal financial authority
comparison      = read-only diagnosis
correction      = explicit source-ledger edit/event
```

The reconciliation workspace must never repair a difference by mutating derived Position or cash state directly.

## Snapshot contract

A snapshot currently contains:

- broker name;
- as-of date;
- broker available cash;
- holdings:
  - ticker;
  - share quantity;
  - optional broker average price.

Ticker identity is resolved through the canonical ticker directory so aliases and ISIN inputs converge onto the active app ticker.

## Comparison semantics

For each ticker:

```text
differenceShares = appShares - brokerShares
```

Statuses:

- `MATCH`;
- `SHARE_MISMATCH`;
- `MISSING_IN_APP`;
- `MISSING_AT_BROKER`.

Cash uses the same sign convention:

```text
differenceCash = appCash - brokerCash
```

No balancing event is fabricated.

## Ledger attribution

Share mismatches expose source ledger evidence from the currently active share cycle where possible. Evidence understands:

- BUY;
- SELL;
- BONUS_SHARES;
- allocated IPO shares.

If no active cycle exists, bounded recent ticker ledger evidence is shown instead.

Cash mismatches expose recent cash-affecting canonical ledger events. This is diagnostic evidence, not a claim that the latest event is necessarily the missing broker event.

## Correction navigation

A share mismatch can open the Transactions workspace scoped to the relevant ledger IDs.

A cash mismatch can open Cash Ledger.

The user corrects the real source transaction/event through the existing persist-before-apply mutation boundary. Stage 6.1 does not write a derived-state patch.

## Current ingestion

Implemented:

- paste holdings text;
- CSV/TXT upload;
- header row support;
- comma, tab, semicolon, or whitespace separation;
- `TICKER,SHARES`;
- optional third column for broker average price.

Duplicate ticker rows are rejected rather than silently aggregated.

## Remaining work

### 6.1.4 — broker-specific ingestion adapters

Add richer personal-workflow ingestion without weakening the snapshot contract. Candidate inputs:

- Telda portfolio screenshot / current-holdings capture;
- broker CSV/export when available;
- optional receipt/email-assisted evidence for explaining discrepancies.

Receipt history is not a substitute for a current broker snapshot.

### 6.1.5 — acceptance and closure

Required:

- real broker snapshot smoke;
- exact-match case;
- missing BUY;
- missing SELL;
- corporate-action share difference;
- cash-only mismatch;
- alias/renamed ticker;
- IPO pending/allocation interaction;
- phone workspace containment;
- no automatic accounting mutation;
- docs/STATUS closure update.
