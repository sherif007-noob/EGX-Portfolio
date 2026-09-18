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

Cash events also live in the ledger by using ticker `CASH` and a `cash_flow_type` such as:

- `DEPOSIT`
- `WITHDRAWAL`
- `DIVIDEND`
- `CASH_ADJUSTMENT`

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
