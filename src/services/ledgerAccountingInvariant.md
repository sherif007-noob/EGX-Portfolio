# Ledger accounting invariant

The transaction ledger is the sole source of truth for portfolio accounting. Positions, closed cycles, and cash are projections reconstructed from the ledger. Persisted derived state must never override a newer ledger.
