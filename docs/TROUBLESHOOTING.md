# Troubleshooting

## Login succeeds but portfolio is all zeros

### Symptoms

- Supabase email/password login works;
- application opens;
- positions, cash, and transactions appear empty or zero.

### Checks

1. Confirm the authenticated user owns a `portfolios` row.
2. Confirm `portfolios.owner_key` equals the Supabase Auth user UUID.
3. Confirm RLS policies are enabled.
4. Confirm the `authenticated` Postgres role has table privileges in addition to RLS policies.
5. Inspect browser console for direct Supabase errors.

RLS does not replace SQL privileges. A correct policy with missing `GRANT SELECT` still prevents reads.

## Login screen does not appear after an auth change

A PWA service worker may be serving an older bundle.

Try:

1. private/incognito window;
2. hard refresh;
3. browser DevTools → Application → Service Workers → Unregister;
4. clear site data;
5. restart the dev server.

Then verify the local commit:

```bash
git rev-parse --short HEAD
```

## Deleted transaction comes back after refresh

A financial delete must not be treated as successful until Supabase persistence succeeds.

The current delete flow waits for the authoritative save before updating local state.

If a deleted row returns:

1. stop entering new trades;
2. inspect the database row directly;
3. confirm the browser is running current `main`;
4. inspect console errors from the snapshot RPC;
5. verify RLS and RPC permissions;
6. run the production data audit.

Do not repeatedly delete the same row before understanding why persistence failed.

## Duplicate transactions

Run:

```bash
npm run verify:production-data
```

Investigate duplicate-equivalent transactions using:

- ticker;
- BUY/SELL type;
- shares;
- price;
- fees;
- total amount;
- original transaction date;
- notes;
- linked closed-trade transaction IDs.

Do not auto-delete based only on a shared date.

If a duplicate cycle is confirmed, remove the duplicate ledger rows and reconcile closed trades, positions, and cash from the clean ledger.

## Cash does not match expected value

Cash is ledger-derived.

Check:

```text
capital deposits
+ deposits
- withdrawals
+ dividends
+ cash adjustments
- BUY cash outflows
+ SELL cash proceeds
= cash balance
```

Then verify:

- fees are included exactly once;
- BUY `total_amount` is fee-inclusive;
- SELL `total_amount` represents net proceeds;
- no duplicate transaction cycles remain.

## Position shares are wrong

For each ticker:

```text
open shares = sum(BUY shares) - sum(SELL shares)
```

If the database `positions` table differs from the ledger, treat the ledger as authoritative and run reconciliation.

## MWRR looks extremely large

The performance chart uses an annualized money-weighted-return calculation.

For a very young portfolio, annualization can produce very large values even when the underlying absolute gain/loss is modest.

Verify the dated cash flows before changing the formula.

## Drawdown shows N/A

This can be correct.

Drawdown intentionally remains unavailable when historical valuation coverage is insufficient.

Check:

- at least two valid valuation dates;
- historical prices exist for required holdings;
- no coverage gaps invalidate the requested period.

Do not replace missing historical prices with current prices.

## Historical-price workflow finds no new rows

Possible reasons:

- market was closed;
- rows already exist;
- requested period contains no additional EGX sessions;
- ticker symbol is invalid/unavailable at the data source.

Check the workflow log and existing `price_history` date range before treating `0 new` as an error.

## Google sign-in button still appears

This is expected when Google Sheets support is enabled.

The Google/Firebase sign-in path is for the optional Google Sheets integration and is separate from Supabase portfolio authentication.

## Google Sheets sync returns 401/403

Check:

- service account configured correctly;
- sheet shared with service-account email;
- OAuth token not expired when using user auth;
- spreadsheet ID is correct;
- API scopes/permissions allow the requested operation.

## Supabase secret key rejected

Server automation expects a current secret key that begins with:

```text
sb_secret_
```

Do not use the browser publishable key for server administration scripts.

## App works on PC but not iPhone

Check:

- iPhone can reach the host/tunnel;
- HTTPS is used when browser features require a secure context;
- the PWA is not serving an old cached bundle;
- the Supabase session exists in that browser;
- temporary tunnel hostname has not changed since opening the page.

## Build failure

Run locally:

```bash
npm install
npm run lint
npm test
npm run build
```

Fix typecheck failures before investigating later build steps because CI stops at the first failed stage.
