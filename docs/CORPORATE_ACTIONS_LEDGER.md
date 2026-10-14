# Corporate Actions Ledger

## Status

**CANONICAL CURRENT SUBSET — BONUS_SHARES IMPLEMENTED.** The current app supports bonus/free-share actions end to end through the canonical ledger mutation path. Stage 6.3 owns auditing this implementation and extending it to the remaining corporate-action lifecycle; it must not create a parallel accounting system.

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

## KORA separate rights offering — design gate (14 October 2026)

**Evidence, not an automatic ledger action:** EGX authorized a paid rights
offering of 0.90 new shares per eligible original share, last entitled close
13 Oct, ex-rights 14 Oct. The underlying KORA ISIN is `EGS07911C018`; the
separate security is `EGS924O1C014`. Subscription price is EGP 0.205
(EGP 0.200 nominal + EGP 0.005 issue cost). The subscription window opens
18 Oct and closes by 1 Nov (subject to early closure); separate rights
trading is conditionally available 18–27 Oct, restricted to Egyptian holders.
The official EGX opening reference for the *rights* is EGP 2.32 per right,
but it is **not an actual executed price or live tradable quote** ahead of
18 Oct. Sources:

- https://www.sigma-cap.com/main/news_page_exact?newsId=46117673&newsType=EGX
- https://www.sigma-cap.com/main/news_page_exact?newsId=46127438&newsType=EGX
- https://www.vantagesb.com/News/NewsDetails.aspx?NewsID=908190

### Pure, read-only rights engine already implemented

`src/services/rightsOfferings.ts` contains verified `KORA_RIGHTS_2026`
terms, historical entitlement reconstruction from the transaction ledger
rather than *today's* holdings, and a pure lifecycle projection.
`src/services/rightsOfferings.test.ts` covers cutoff holdings, sales
after cutoff, fractional theoretical rights, rights bought/sold,
exercise vs. **later** allocation, exhaustion/overselling,
deadline validation, zero cash and zero new shares at detachment.

At the authoritative snapshot reviewed for this branch, 650 KORA shares were
held through the 13 Oct close. This suggests **585 theoretical rights** and a
**119.925 EGP** full-exercise amount excluding any additional broker-specific
charges. These are not a broker-confirmed credit and must not be rounded or
submitted as a transaction automatically.

**Accounting contract for future approved UI + persistence implementation:**

1. `ENTITLEMENT`: as-of-cutoff position gets separate subscription rights,
   not original KORA shares. Idempotent event keyed by issue + broker account +
   cutoff; never multiply shares by 1.9 at detachment. Zero cash movement.
   Capture actual broker-credited rights and handling of fractional claims.
2. `RIGHTS_BUY / RIGHTS_SELL`: use rights ISIN, independent trade/fees and
   rights inventory. Never transact KORA common shares as a proxy.
3. `EXERCISE`: consume only available rights, record actual broker payment
   `rights exercised × 0.205` plus *confirmed* extra broker fees. Maintain
   pending subscribed-shares entitlement. This is not a market BUY and does not
   instantly add freely tradable shares.
4. `ALLOCATION / CREDIT`: add newly credited ordinary shares **only when the
   broker confirms** allocation/issuance. Their cost basis must include
   exercise consideration and appropriate original/right acquisition basis.
5. `EXPIRY / UNSUBSCRIBED`: preserve an explicit audit event and recognize
   any cost-basis/value consequence. Never silently make unused rights vanish,
   fabricate proceeds, or sell them without the user's instruction.
6. **Market-data integrity**: after 14 Oct, KORA ex-rights market price and
   rights value must be valued as separate economic assets, avoiding a false
   portfolio drop and double counting. Use actual quotes with provenance when
   trading begins; the official 2.32 opening reference may be used only in a
   clearly labelled **indicative** preview, not silently booked into broker NAV.
   Historical charts require an explicit verified ex-rights basis treatment,
   without rewriting vendor closes or backfilling imagined prices.

### Scope / approval gate

The pure calculator does not wire into live NAV, database tables, transaction
mutation routines, or the user interface. This protects the canonical ledger
and prevents imaginary cash transfers or bonus-share events.

**Before enabling mutating buttons or changing any UI design**, show the user
a preview of the new "Subscription Rights" detail/card and confirm the
required layout. Then implement versioned schema, atomic/idempotent
transactions and corrections, ledger replay and historical valuation,
separate rights quote resolution, device QA and reconciliation.
Do not treat the existing `RIGHTS_SUBSCRIPTION` type alias as supported:
the canonical ledger currently explicitly rejects all corporate-action
types except `BONUS_SHARES`.

### Ex-rights valuation example, non-posting

The production KORA 13 Oct closing price observed in Supabase was
EGP **4.62**. For a fully entitled 650-share holding:

- Theoretical ex-rights share reference =
  `(4.62 + 0.90 × 0.205) / 1.90 = 2.5286842105 EGP`.
- Theoretical value per subscription right =
  `(4.62 − 0.205) / 1.90 = 2.3236842105 EGP`.
- Pre-detach original holding: `650 × 4.62 = 3003 EGP`.
- Theoretical ex-detachment ordinary shares value plus 585 theoretical
  detached rights also equals **3003 EGP**, not a mechanical loss.
- Actual market movements, spread, legal trading/eligibility restrictions,
  fractional-right settlement and broker charges make real NAV different.
  The EGX 2.32 reference isn't a pre-trading quote.

`theoreticalExRightsBridge` is a **pure explanatory projection only**,
not a live price source, an automatic return adjustment, or a persisted
portfolio position. Until a user-approved rights lifecycle is implemented
with a reliable quote, the app must not treat this value as verified NAV.
