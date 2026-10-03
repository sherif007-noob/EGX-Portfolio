# Data Model

## Accounting model

The transaction ledger is authoritative.

```text
transactions
    ↓ reconcile
positions
closed_trades
cash_balance
```

The application should be able to rebuild the financial state from the ledger plus capital/cash-flow information.

## Ownership model

A row in `portfolios` represents a portfolio.

`portfolios.owner_key` stores the Supabase Auth user UUID as text.

Portfolio-owned tables reference `portfolios.id` through `portfolio_id`.

RLS restricts portfolio-owned rows to portfolios where:

```sql
portfolios.owner_key = auth.uid()::text
```

## Tables

### portfolios

Portfolio-level state.

Important fields:

| Column | Purpose |
| --- | --- |
| `id` | Portfolio UUID |
| `owner_key` | Supabase Auth user UUID |
| `name` | Portfolio name |
| `cash_balance` | Current reconciled cash |
| `capital_deposits` | Contributed/opening capital |
| `schema_version` | Application data schema version |
| `last_price_write_at` | Throttle marker for price writes |
| `created_at`, `updated_at` | Audit timestamps |

### transactions

The authoritative accounting ledger.

Important fields include:

- BUY/SELL type;
- ticker;
- shares;
- execution price;
- date/time;
- fees;
- total amount;
- cash-flow type and amount;
- trade ID/cycle metadata;
- running shares;
- gross value;
- net cash impact;
- realized P&L;
- holding period;
- position reference.

Cash events also live in the ledger by using ticker `CASH`.

Canonical `cash_flow_type` values are:

- `DEPOSIT` — external capital in;
- `WITHDRAWAL` — external capital out;
- `DIVIDEND` — portfolio income;
- `FEE` — portfolio expense;
- `OTHER_INCOME` — non-trade portfolio income;
- `OTHER_EXPENSE` — non-trade portfolio expense;
- `RECONCILIATION_ADJUSTMENT` — signed bookkeeping correction that is return-neutral and does not alter contributed capital.

Legacy `CASH_ADJUSTMENT` rows remain readable, but normalization converts them to `RECONCILIATION_ADJUSTMENT`. New runtime writes must not create the legacy type.

Economic classes are intentionally separate:

```text
contributed capital = DEPOSIT / WITHDRAWAL only
cash performance    = DIVIDEND / FEE / OTHER_INCOME / OTHER_EXPENSE
book repair         = RECONCILIATION_ADJUSTMENT
```

For Google Sheets ledger round-trip, `Cash Flow Type` and `Cash Flow Amount` are persisted as explicit Transaction Logger columns.

### positions

Materialized open-position state derived from the transaction ledger.

Important fields:

- ticker;
- shares;
- average buy price;
- current price;
- total fees;
- buy date;
- target price;
- stop loss;
- notes.

Position shares must reconcile to cumulative BUY shares minus SELL shares for the same ticker.

Portfolio-authored position metadata is not an accounting source. For target price, stop loss and notes, canonical reconciliation preserves portfolio/BUY-authored values before using ticker-directory defaults. Shares, average cost, fees and cash remain ledger-derived.

### closed_trades

Materialized closed-cycle records derived from the ledger.

Contains:

- buy/sell prices;
- realized P&L;
- fee allocation;
- holding period;
- outcome;
- cycle metadata;
- arrays of source BUY and SELL transaction IDs.

The transaction ID arrays allow a closed cycle to be traced back to its ledger entries.

### tickers

EGX security master and latest market snapshot.

Contains company identity, sector, live-price fields, volume, range data, RSI, support/resistance, target/stop fields, timestamps, and optional logo metadata.

### price_history

Daily historical OHLCV data.

Primary analytical fields:

- `ticker`
- `trading_date`
- `open`
- `high`
- `low`
- `close`
- `volume`
- `source`
- `retrieved_at`

Historical portfolio valuations are reconstructed from transactions plus this table.

### intraday_price_history

15-minute EGX OHLCV bars used for current/latest-session analytics.

Primary fields:

- `ticker`
- `interval_minutes` (currently 15)
- `bar_timestamp` (`timestamptz`, stored in UTC)
- `open`
- `high`
- `low`
- `close`
- `volume`
- `source`
- `retrieved_at`

Primary key:

```text
(ticker, interval_minutes, bar_timestamp)
```

Intraday rows use a rolling 90-day retention policy by default. They are kept separate from permanent daily history so different resolutions cannot be confused.

Authenticated application sessions have SELECT-only access. Trusted automation owns writes and retention cleanup.

### daily_valuations

Optional persisted daily valuation structure containing:

- equity;
- market value;
- cash balance;
- invested capital;
- external cash flow;
- dividends;
- fees;
- source.

The application does not require this table to be populated in order to reconstruct historical valuations.

### cash_transactions

Legacy/separate cash-history table retained in the schema.

Current accounting logic treats cash changes as ledger events in `transactions`. New financial logic should not introduce a second authoritative cash source.

## Snapshot writes

The application uses:

```text
replace_portfolio_accounting_snapshot
```

to atomically replace the canonical accounting snapshot for one owned portfolio.

The function verifies the portfolio ID/owner key and then writes:

- portfolio cash/capital;
- transactions;
- positions;
- closed trades.

Because the accounting tables are replaced as a coherent snapshot, callers must send a complete canonical ledger state.

## Mutation ordering

Stage 2.1 introduces a canonical mutation boundary above snapshot persistence.

The intended ordering is:

```text
candidate transaction ledger
    ↓ normalize
reconcile canonical projections
    ↓ validate
atomic accounting snapshot RPC
    ↓ success only
apply local application state
```

Callers must not treat `positions`, `closed_trades` or `cash_balance` as independent accounting sources.

The mutation service derives them from the candidate ledger before persistence.

A failed authoritative write must leave the previous local financial state intact.

As of Stage 2.4, BUY/SELL, transaction correction/deletion, cash events, OCR import, reconciliation and portfolio restore/import follow this ordering, and derived Position / Closed Cycle records no longer expose independent accounting deletion.

### Derived Position / Closed Cycle ownership

`positions` and `closed_trades` are persisted projections for fast read/display and metadata continuity.

They are not independent source records that may be deleted to change accounting history.

Stage 2.4 enforces:

```text
financial correction
  = edit/delete the source transaction ledger row
  ≠ delete a Position or Closed Cycle projection
```

For open positions, correction scope is defined by the current active aggregate-share cycle.

This intentionally avoids FIFO ownership inference.

For closed cycles, persisted `buyTransactionIds` and `sellTransactionIds` are the canonical source links.

Legacy cycle/date matching may be used to navigate old data that lacks source IDs, but it must never become automatic accounting deletion logic.

### Canonical cost-basis method

Stage 2.6 freezes the portfolio accounting method as:

```text
WEIGHTED_AVERAGE_PROPORTIONAL
```

For a partial SELL, realized gross cost and remaining buy fees are allocated by the sold-share ratio across the full open exposure:

```text
ratio                  = sold shares / open shares
allocated gross cost   = open gross cost × ratio
allocated buy fees     = open buy fees × ratio
remaining gross cost   = open gross cost × (1 - ratio)
remaining buy fees     = open buy fees × (1 - ratio)
```

Consequences:

- FIFO/LIFO lot consumption is not accounting ownership;
- a partial SELL leaves the remaining blended average cost unchanged until another BUY changes it;
- all source BUY executions may still be linked to an active/closed cycle for audit traceability;
- linked source phases must not be summed to re-price realized cost;
- Google Sheets reconstruction delegates to the canonical ledger reconciler;
- secondary analytics reuses the canonical sell-allocation helper.

A future FIFO view is allowed only as an explicitly separate analytical view. It must not write or redefine portfolio accounting state.

### Transaction edit source fields

When a BUY/SELL transaction is corrected, cached financial fields are not trusted.

The corrected row recomputes gross/total/net cash fields from shares, price and fees.

SELL realized P&L, realized percent, outcome and holding days are treated as projections of the surrounding ledger and are rebuilt by reconciliation.

### Restore/import authority

Backup and Google Sheets restore paths require the transaction ledger as the financial source of truth.

Imported:

- `positions`;
- `closedTrades`;
- `cashBalance`

cannot independently replace accounting state.

Position rows may be used as reconciliation metadata/identity seeds, but canonical shares/cost/cash/P&L are rebuilt from transactions.

A projection-only backup with meaningful financial values but no transaction ledger is rejected.

### Contributed-capital edits

Deleting or changing a deposit/withdrawal can change contributed capital.

Stage 2.3 derives candidate contributed capital from the candidate cash-flow ledger before reconciliation.

In particular, deleting the final legacy opening-capital materialization must not cause the fallback opening capital to be silently re-seeded.

### Trade cash effect

Canonical BUY and SELL ledger rows always carry their real broker cash effect.

Stage 2.5 removed the legacy `deductFromCash` / `addToCash` controls and parameters entirely.

The legal transaction model is:

```text
BUY  net_cash_impact < 0  (gross purchase + fees)
SELL net_cash_impact > 0  (gross proceeds - sell fees)
```

Insufficient BUY cash is rejected both in App pre-validation and canonical mutation preparation.

A cash discrepancy is represented by a separate explicit cash-ledger event; it is never encoded by suppressing a trade's cash effect.

See [FINANCIAL_MUTATION_CONTRACT.md](FINANCIAL_MUTATION_CONTRACT.md).

## Reconciliation invariants

A production data audit should maintain:

1. `position shares = BUY shares - SELL shares`
2. portfolio cash equals capital plus ledger cash impacts;
3. derived closed cycles reference valid transaction IDs;
4. duplicate-equivalent transactions are investigated rather than automatically removed;
5. historical coverage exists for tickers required by performance calculations.

## RLS summary

Portfolio-owned tables use ownership-aware policies.

Market-reference tables are readable by authenticated users. Legacy `tickers` and `price_history` currently allow authenticated writes; the newer `intraday_price_history` table is intentionally SELECT-only for authenticated browser sessions, with writes restricted to trusted automation.

See [AUTH_AND_SECURITY.md](AUTH_AND_SECURITY.md) for the security model.
