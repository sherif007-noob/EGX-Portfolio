# Contributing

Thanks for improving EGX Portfolio.

Because this application tracks financial records, changes to accounting and persistence should be treated more conservatively than ordinary UI changes.

## Development setup

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

Minimum validation before a pull request:

```bash
npm run lint
npm test
npm run build
```

## Branches

Create a focused branch from current `main`:

```bash
git switch main
git pull --ff-only
git switch -c <type>/<short-description>
```

Examples:

```text
fix/transaction-delete-persistence
feat/performance-period-selector
docs/update-architecture
```

## Pull requests

Keep a pull request focused on one coherent change.

The PR description should explain:

- what changed;
- why it changed;
- which financial invariants are affected;
- tests added/updated;
- any database or environment changes;
- manual verification performed.

Do not mix broad visual redesigns with accounting or persistence changes.

## Financial-data rules

### Ledger is authoritative

Transactions are the primary accounting record.

Do not create a feature where positions, closed trades, or cash become an independent competing source of truth.

### No silent cleanup

Never silently remove transactions because they appear duplicated.

Duplicate investigation must use concrete evidence and preserve an audit trail/reviewable change.

### Persistence before success

Financial mutations must not display success until the authoritative Supabase save succeeds.

### Startup is read-only

Loading/signing into the app must not write a reconstructed financial snapshot.

### Missing analytics stay missing

Do not fabricate drawdown, returns, or historical valuations when source history is incomplete.

## Code style

- Use TypeScript.
- Prefer existing services/helpers instead of duplicating accounting formulas in components.
- Keep UI components focused on presentation and interaction.
- Put accounting logic in tested service modules.
- Preserve existing naming/behavior when a compatibility shim is intentional.
- Avoid introducing secrets into source code.

## Tests

A bug fix should add or strengthen a regression test when practical.

Accounting/persistence changes should test:

- fees;
- partial sells;
- cash impact;
- share reconciliation;
- persistence failure behavior;
- duplicate prevention;
- missing historical data where relevant.

See [docs/TESTING.md](docs/TESTING.md).

## Database changes

Before changing Supabase schema or RLS:

1. inspect the current schema/policies;
2. document the intended ownership model;
3. use least privilege;
4. test with an authenticated user;
5. run security advisors;
6. verify existing portfolio data still reconciles.

Never expose `SUPABASE_SECRET_KEY` to the browser.

## Documentation

Update documentation when a change modifies:

- environment variables;
- architecture;
- API routes;
- schema;
- authentication;
- deployment;
- analytics semantics;
- operational procedures.

## Commit messages

Use clear, scoped messages, for example:

```text
fix: await transaction delete persistence
feat: add historical MWRR chart
docs: document Supabase ownership model
```

## Review checklist

Before merge:

- [ ] Typecheck passes.
- [ ] Tests pass.
- [ ] Production build passes.
- [ ] No secret was committed.
- [ ] Financial invariants were considered.
- [ ] Persistence behavior was tested.
- [ ] Documentation was updated when necessary.
