# Analytics & Market-Data Change Log

## Why this work exists

This work began inside the Premium visual overhaul, but chart comparison exposed data and accounting requirements that could not be solved with presentation changes alone.

The market-data path therefore evolved from a legacy 15-minute Today curve, through a transitional direct-TradingView 5-minute layer, to the current Premium 1-minute architecture.

## Scope progression

1. **Premium visual overhaul** — frosted surfaces, controls, modals, motion and chart presentation.
2. **Chart presentation parity** — weekly morph behavior and calendar-time spacing were corrected.
3. **Headline-number parity** — Today live endpoint and 1W previous-close baseline semantics were corrected.
4. **Historical coverage repair** — newly traded securities exposed missing daily-history behavior.
5. **Centralized TradingView identity** — NAPR exposed symbol instability, leading to ticker/canonical/ISIN resolution instead of one-off aliases.
6. **Intraday density** — direct 15m was first supplemented with transitional 5m TradingView data.
7. **Runtime boundary correction** — TradingView WebSocket ingestion was removed from Cloudflare/browser repair paths and kept in GitHub Actions / Node.
8. **1-minute source architecture** — raw 1m became the recent source of truth and 5m became a deterministic locally-derived cache.
9. **Coverage-aware reads** — Today now evaluates the quality of 1m/5m/15m candidates rather than selecting a resolution just because any row exists.
10. **Migration hardening** — retention boundaries, TradingView source exhaustion, raw immutability and derived-cache reconstruction were validated against ACTF/NAPR.

## Current authoritative architecture

- **Cloudflare Worker / application runtime:** serves the application and normal HTTP API. It does not open TradingView WebSockets.
- **Supabase:** authoritative persisted portfolio ledger, ticker metadata, daily history and intraday history.
- **GitHub Actions / Node:** authoritative TradingView intraday ingestion runtime.
- **Browser:** reads persisted Supabase history and never triggers TradingView history repair.
- **TradingView Scanner HTTP:** latest/live quote snapshot only.
- **TradingView resolver:** one shared resolver handles ticker/canonical/ISIN attempts and records the full attempt path.

## Current intraday policy

Canonical constants live in `src/services/intradayPolicy.ts`.

- raw interval: **1 minute**;
- derived interval: **5 minutes**;
- legacy fallback: **15 minutes**;
- raw retention: **30 calendar days**;
- derived retention: **90 calendar days**;
- timezone: **Africa/Cairo**;
- regular EGX window used by the scheduler: **10:00-14:30 Cairo**, Sunday-Thursday;
- post-close ingestion grace: through **14:40 Cairo**;
- target ingestion cadence: about **5 minutes**;
- browser read order: **sufficient 1m -> sufficient 5m -> legacy 15m**.

The Cairo clock is date-aware and therefore follows DST changes instead of assuming a fixed UTC offset.

## Raw 1m and derived 5m semantics

Completed persisted 1-minute observations are treated as historical source truth and are not rewritten during ordinary sync.

The derived 5-minute cache is built from actual stored 1-minute observations:

- first open;
- maximum high;
- minimum low;
- last close;
- sum of observed volume.

No missing minute is synthesized.

A 2026-09-24 validation exposed an important edge case: TradingView later returned revised historical volume for a minute that was already persisted. The sync initially rebuilt the 5m cache from the newer fetch, which made the 5m row disagree with the immutable raw source.

The fix now reloads persisted 1m rows and gives them precedence before 5m derivation. The resulting ACTF/NAPR overlap check reports zero OHLCV mismatches.

## TradingView history depth and legacy bootstrap

TradingView 1m history depth depends on the instrument and available observations.

NAPR currently exposes enough 1m history to rebuild the full targeted derived window. ACTF reports source exhaustion around late August 2026 when walking backwards through 1m history.

Therefore ACTF retains older direct-TradingView 5m rows **only before reconstructible 1m history begins**. These rows are a temporary migration bootstrap. The system does not invent older 1m data merely to replace them.

Inside reconstructible 1m coverage, legacy direct-5m rows are not allowed to survive.

## ACTF / NAPR migration validation

The successful migration smoke on 2026-09-24 validated:

- ACTF resolves directly by ticker;
- NAPR logs `ticker NAPR -> invalid symbol -> ISIN EGS370O1C013 -> success`;
- raw 1m rows are present;
- derived 5m rows are present;
- duplicate timestamps are zero;
- 1,830 overlapping retained raw/derived buckets were checked;
- overlapping persisted 1m -> derived 5m OHLCV mismatches are zero;
- ACTF older legacy 5m rows are outside reconstructible 1m coverage;
- the focused typecheck/regression suite passes before the smoke writes.

An established ticker is also included in the migration smoke so the validation does not only exercise the two new/missing-history cases.

## Today resolution selection

`PerformanceTimeframeChart.tsx` loads configured interval candidates and calls `selectBestIntradayResolution()`.

The selector compares:

- latest real session not after the requested date;
- ticker breadth;
- per-ticker observed session envelope.

A fine-resolution sample cannot win simply because it contains one row for every ticker. At the same time, an illiquid security is not required to have a candle for every minute.

The reader also handles after-midnight/weekend/closed-session cases by using the latest real market session rather than creating synthetic points.

## Portfolio mathematics

The intraday analytics regression suite compares 1m, 5m and 15m paths with a transaction between old 15-minute boundaries.

Higher resolution is allowed to change path timing and shape. It is not allowed to arbitrarily change:

- opening equity;
- cash accounting;
- external deposits/withdrawals;
- final authoritative NAV;
- final P&L;
- TWR/MWR semantics;
- previous-close baseline.

The finer path applies the transaction earlier, which is the intended improvement.

## Scheduling migration

The staged Premium scheduler is:

```text
.github/workflows/intraday-1m-sync.yml
```

with a broad UTC cron every five minutes. The Node script applies the Cairo-local trading-session gate.

The previous direct-TradingView 5m workflow is now manual-only and shares the same concurrency group. This prevents the transitional producer from competing with the new derived-5m pipeline.

GitHub schedules execute from the repository default branch, so the Premium schedule is not active production scheduling until the branch is intentionally promoted.

## Observability evolution

Per-ticker output records resolution attempts, mode, request depth, source exhaustion, fetch/write counts, derived buckets, legacy bootstrap state and coverage boundaries.

The current gap metric is deliberately source-backed: a repaired gap is a TradingView observation that is missing at or before the previously persisted latest raw timestamp. A no-trade minute is not counted as a gap.

This distinction is required for sparse EGX securities.

## Stale-client / browser-repair incident

Earlier browser code POSTed transaction tickers to a Worker repair route. `@ch99q/twc` requires the Node-compatible TradingView WebSocket path; attempting synchronous Worker ingestion was an architectural mismatch.

The browser-triggered repair was removed. A compatibility no-op remains for stale cached clients, and PWA cache cleanup prevents an old bundle from repeatedly producing repair errors.

This remains a non-negotiable boundary: TradingView WebSocket ingestion belongs in Node automation, not Cloudflare Workers or browser startup.

## Important invariants

- Do not fabricate intraday observations.
- Do not overwrite completed raw 1m history during ordinary sync.
- Derived reconstructible 5m must match persisted raw 1m.
- Do not regress the verified Today live endpoint or 1W previous-close baseline.
- Do not reintroduce browser/Cloudflare TradingView WebSocket repair.
- Do not add ticker-specific aliases where centralized resolution can solve identity.
- Do not delete the 15m fallback before multi-session rollout observation.
- Do not merge CI-only validation branches into `main`.
- Premium implementation remains on `feature/premium-ui-redesign` unless explicitly requested otherwise.

See `docs/INTRADAY_1M_MIGRATION_PLAN.md` for the canonical 15-phase roadmap and `docs/INTRADAY_MARKET_DATA.md` for operational data semantics.
