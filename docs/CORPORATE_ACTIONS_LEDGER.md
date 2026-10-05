# Corporate Actions Ledger

## Purpose

Corporate actions must be represented as canonical ledger events. They must never be simulated as a BUY/SELL execution or by manually changing a derived position.

The transaction ledger remains authoritative. Positions, cost basis, closed cycles, cash, historical equity and intraday analytics are rebuilt from it.

## Supported action

The first supported action is:

- `CORPORATE_ACTION / BONUS_SHARES`

Other corporate-action types remain reserved in the type system but are intentionally rejected until their accounting rules are implemented and tested.

## Bonus-share accounting contract

A bonus/free-share event stores:

- ticker
- effective / credit date
- actual shares credited
- official ratio, expressed as **additional shares per one pre-action share**
- source shares immediately before the effective date
- optional disclosure / broker reference
- optional notes

Its accounting effect is:

- shares: increase by the actual credited quantity
- cash: no change
- gross invested cost: no change
- brokerage fees: no change
- weighted average price: recalculated from the unchanged cost over the larger share count
- future sales: existing weighted-average cost allocation continues over the adjusted quantity

The actual broker-credited share quantity is authoritative. The ratio is retained for auditability and theoretical-entitlement checks.

## Effective-date entitlement

Source shares are derived by replaying the ledger strictly before the corporate action's effective date.

Corporate actions are session-start events. When an action and exchange trades share the same calendar date, reconciliation applies the corporate action before same-day BUY/SELL executions.

The saved source-share count is a stale-ledger guard. Reconciliation rejects an event if the recorded entitlement base does not match the replayed pre-action holdings.

Future-dated corporate actions are rejected using the Cairo calendar date.

## Persistence

`public.transactions` contains:

- `corporate_action_type`
- `corporate_action_ratio`
- `corporate_action_source_shares`
- `corporate_action_reference`

The authoritative snapshot RPC preserves these fields during full ledger replacement.

Versioned migrations:

- `20261005171938_add_transaction_corporate_action_metadata.sql`
- `20261005172415_preserve_corporate_action_metadata_in_snapshot_rpc.sql`

## User workflow

Use **Bonus Shares** in the header creation cluster.

1. Select the open position.
2. Enter the effective / credit date.
3. Enter the official additional-shares ratio.
4. Verify or replace the theoretical quantity with the actual broker-credited quantity.
5. Add the EGX/company/broker reference when available.
6. Save.

The journal renders the result as a corporate action with zero cash impact. Corporate-action rows cannot be edited through the BUY/SELL editor; delete and re-enter them until a dedicated corporate-action editor exists.

## Analytics behavior

Historical and intraday analytics treat bonus shares as a quantity adjustment rather than a cash flow.

When the market price is mechanically adjusted for the increased share count, the corporate action itself must not create artificial portfolio profit/loss or a false Today move.

## Regression coverage

`src/services/corporateActionAccounting.test.ts` covers:

- zero-cash / zero-added-cost share issuance
- weighted cost basis after a subsequent partial sale
- stale source-share rejection
- historical equity neutrality across a price adjustment
- historical effective-date entitlement when later trades already exist

The repository PR quality gate additionally runs TypeScript, the full Vitest suite and the production build.
