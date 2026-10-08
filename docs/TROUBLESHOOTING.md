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

## MWR or annualized XIRR looks unusual

The main analytics chart uses a **non-annualized money-weighted return for the selected period**.

Only the All-time MWR view exposes annualized XIRR as a secondary reference. For a young portfolio, that annualized reference can be very large even when the underlying period gain/loss is modest.

If the selected-period MWR looks wrong, verify:

- the timeframe baseline valuation;
- deposits and withdrawals inside the selected period;
- transaction timestamps for Today;
- complete daily/intraday market-price coverage.

Do not replace the selected-period MWR with annualized XIRR.

## Today shows no intraday curve

Today resolves its requested date from the **EGX session boundary**, not from Cairo midnight:

- Friday/Saturday → previous EGX trading weekday;
- Sunday–Thursday before 10:00 Cairo → previous EGX trading weekday;
- Sunday–Thursday from 10:00 Cairo → current Cairo date.

The selected Cairo date is converted to a full UTC query window with timezone/DST-aware bounds. Once that date is selected, missing 1m/5m/15m data does not authorize silently switching to a different session date.

If Today is unavailable, check:

- `intraday_price_history` has rows for the requested session and selected/fallback resolution;
- all same-session trades have `executedAt`;
- required holdings have a prior trusted close;
- the intraday workflow completed successfully;
- benchmark mode additionally has EGX30 / EGX70EWI / EGX100EWI data for the requested comparison.

If the UI says many **incomplete points were excluded** even though intraday bars exist, inspect the session ledger:

- an ordinary BUY/SELL dated to that session but missing `executedAt` correctly invalidates the reconstructed path;
- date-only CASH rows must **not** be treated as missing-time trades;
- confirm newly-created cash rows use the Cairo calendar date, especially between Cairo midnight and UTC midnight.

The Oct 7 incident was caused by three 20,000 EGP deposits entered after Cairo midnight but stamped with the prior UTC date. That UTC cash-date default has been removed.

The app does not fabricate a Today curve from daily prices. The pre-10:00 rule handles ordinary overnight continuity; it is not a full exchange-holiday calendar.

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

## Broker NAV mismatch and misleading deposits in Transactions (medium-ui)
1. Break down portfolio NAV as **sum(open position shares × actual last marked prices) + available cash + pending IPO subscription assets**. Do not add realized P&L again or treat contributed capital as another asset.
2. Use Home → **Reconcile NAV with Telda** to enter the broker NAV from the same timestamp. If available, enter broker cash as well: the remaining difference identifies shares/prices/IPO treatment instead of an unexplained cash mismatch.
3. Check instrument quantities, official corporate actions, broker mark convention, per-position last quote timestamps and possible delayed settlement. Refresh timestamps on a holiday do **not** mean a new trading session occurred.
4. For every trade, compare execution quantity, unit price and **actual broker invoice fees**, especially same-day/grouped invoices. If the invoice is grouped, its overall fee total can be audited, but do not invent exact per-ticket allocations. Use audit-reasoned ledger edits only after validation.
5. Legacy CASH pseudo BUY/SELL rows represent EGP deposits, withdrawals, dividends and adjustments, **not shares**. The investment journal excludes these; Cash Ledger retains them. An external deposit changes equity and contributed capital equally, and must not be counted as profit on the return chart.
6. Missing price-history observations must remain visible as a data-quality warning; don't shift curves vertically or insert compensating cash to force NAV parity.
