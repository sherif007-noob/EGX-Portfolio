# EGX Portfolio Documentation Map

## Start here

Use these three documents first:

1. **[STATUS.md](STATUS.md)** — current application truth and next execution point.
2. **[MASTER_STABILIZATION_ROADMAP.md](MASTER_STABILIZATION_ROADMAP.md)** — sequencing authority and accepted stage history.
3. **This file** — exhaustive map of which document owns which subject.

The repository intentionally preserves implementation history. A historical plan can describe what was true during a phase without being a current authority.

## Current canonical domain documents

| Document | Authority |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | current runtime, feature ownership and data-flow architecture |
| [DATA_MODEL.md](DATA_MODEL.md) | persisted data model, ledger/projection ownership and market-data tables |
| [AUTH_AND_SECURITY.md](AUTH_AND_SECURITY.md) | Supabase auth, RLS and security boundaries |
| [API.md](API.md) | Worker/Express application API contract |
| [OPERATIONS.md](OPERATIONS.md) | production branch, deployment and automation operations |
| [DEVELOPMENT.md](DEVELOPMENT.md) | local development and contribution workflow |
| [TESTING.md](TESTING.md) | current CI, regression and rendered-validation strategy |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | operational recovery/debug procedures |
| [PERFORMANCE_ANALYTICS.md](PERFORMANCE_ANALYTICS.md) | portfolio performance and analytics semantics |
| [INTRADAY_MARKET_DATA.md](INTRADAY_MARKET_DATA.md) | current raw-1m / derived-5m / legacy-15m policy |
| [TICKER_REGISTRY.md](TICKER_REGISTRY.md) | security identity, aliases, ISIN resolution and registry rules |
| [ANALYTICS_VISUAL_SYSTEM.md](ANALYTICS_VISUAL_SYSTEM.md) | current analytics chart interaction/visual contract |
| [PREMIUM_VISUAL_LANGUAGE_CONTRACT.md](PREMIUM_VISUAL_LANGUAGE_CONTRACT.md) | protected glass/material/semantic/hierarchy/control visual language |
| [FINANCIAL_MUTATION_CONTRACT.md](FINANCIAL_MUTATION_CONTRACT.md) | canonical persist-confirmed financial mutation semantics |
| [CORPORATE_ACTIONS_LEDGER.md](CORPORATE_ACTIONS_LEDGER.md) | implemented corporate-action ledger contract; currently BONUS_SHARES |

When a historical phase log conflicts with one of these about current behavior, the canonical document wins.

## Current execution / rollout authorities

| Document | State |
| --- | --- |
| [STATUS.md](STATUS.md) | **current truth — Stage 6.1 next** |
| [MASTER_STABILIZATION_ROADMAP.md](MASTER_STABILIZATION_ROADMAP.md) | **master sequencing authority** |
| [INTRADAY_1M_MIGRATION_PLAN.md](INTRADAY_1M_MIGRATION_PLAN.md) | implemented migration record with remaining multi-session/live-soak retirement evidence |
| [POST_OVERHAUL_REPORTS_WORKSPACE_REDESIGN_PLAN.md](POST_OVERHAUL_REPORTS_WORKSPACE_REDESIGN_PLAN.md) | **closed Stage 5 design/acceptance authority** |
| [PHASE10_VISUAL_CONSISTENCY_PLAN.md](PHASE10_VISUAL_CONSISTENCY_PLAN.md) | **closed Stage 1 / Phase 10 acceptance reference** |

## Architecture/stabilization implementation evidence

These files document accepted implementation stages but do not replace the current architecture/roadmap:

- [ARCHITECTURE_MODULE_OWNERSHIP.md](ARCHITECTURE_MODULE_OWNERSHIP.md) — Stage 4.1 ownership design;
- [STAGE4_3_GRANULAR_VALIDATION.md](STAGE4_3_GRANULAR_VALIDATION.md) — Stage 4.3 decomposition evidence;
- [STAGE4_4_GRANULAR_VALIDATION.md](STAGE4_4_GRANULAR_VALIDATION.md) — Stage 4.4 API/runtime contract evidence;
- [STAGE4_5_CSS_OWNERSHIP.md](STAGE4_5_CSS_OWNERSHIP.md) — Stage 4.5 CSS ownership/cascade evidence;
- [STAGE3_BRANCH_DIVERGENCE_REVIEW.md](STAGE3_BRANCH_DIVERGENCE_REVIEW.md) — Stage 3.1 branch review and production-authority migration.

## Dated audits / incident evidence

These documents preserve observations from a specific date. Treat later canonical docs as authoritative where behavior evolved afterward.

- [READINESS_AUDIT.md](READINESS_AUDIT.md)
- [MARKET_DATA_AUDIT_2026_09_28.md](MARKET_DATA_AUDIT_2026_09_28.md)
- [CHART_RENDERING_FIX_2026_09_28.md](CHART_RENDERING_FIX_2026_09_28.md)
- [ANALYTICS_MARKET_DATA_EVOLUTION.md](ANALYTICS_MARKET_DATA_EVOLUTION.md)

## Historical visual implementation journals

These explain how the accepted visual system was reached. They are historical evidence, not current work queues:

- [PREMIUM_UI_REDESIGN_PLAN.md](PREMIUM_UI_REDESIGN_PLAN.md)
- [PREMIUM_UI_REDESIGN_IMPLEMENTATION.md](PREMIUM_UI_REDESIGN_IMPLEMENTATION.md)
- [PHASE4_MOTION_REIMPLEMENTATION_PLAN.md](PHASE4_MOTION_REIMPLEMENTATION_PLAN.md)
- [PHASE5_ADVANCED_EFFECTS_PLAN.md](PHASE5_ADVANCED_EFFECTS_PLAN.md)
- [PHASE6_RESPONSIVE_REFINEMENT_PLAN.md](PHASE6_RESPONSIVE_REFINEMENT_PLAN.md)
- [PHASE6_5_NAVIGATION_REFINEMENT_PLAN.md](PHASE6_5_NAVIGATION_REFINEMENT_PLAN.md)
- [PHASE7_CHARTS_PLAN.md](PHASE7_CHARTS_PLAN.md)
- [PHASE8_VISUAL_HIERARCHY_PLAN.md](PHASE8_VISUAL_HIERARCHY_PLAN.md)
- [PHASE8_HIERARCHY_AUDIT_MAP.md](PHASE8_HIERARCHY_AUDIT_MAP.md)
- [PHASE8_4_TYPOGRAPHY_AUDIT.md](PHASE8_4_TYPOGRAPHY_AUDIT.md)
- [PHASE9_HEADER_NAVIGATION_PLAN.md](PHASE9_HEADER_NAVIGATION_PLAN.md)

Some tests still read historical files by exact path. That is why classification is authoritative even when physical files remain at the docs root.

## Archive policy

See [archive/README.md](archive/README.md).

Physical moves are allowed only when:

- no test/code depends on the current path, or those references are migrated in the same change;
- active/current docs link to the new path;
- the document no longer owns a live contract.

## Documentation update rules

Every accepted implementation pass must:

1. update `STATUS.md`;
2. update the canonical domain document whose invariant changed;
3. update the active roadmap/subplan where relevant;
4. record acceptance evidence only after the relevant gate is green;
5. avoid copying current-state rules into historical logs;
6. update this map whenever a document is added, removed or changes authority class.

## Authority model

### STATUS

Short current truth, known debt and next action.

### MASTER_STABILIZATION_ROADMAP

Ordering, dependencies, stage gates and accepted stage history.

### Canonical domain docs

Long-lived current behavior.

### Closed plans / implementation evidence

How a completed stage was designed and validated.

### Dated audits

What was observed at a point in time.

### Archive

Historical documents whose current root path is no longer required.

This map intentionally names every Markdown file under `docs/` either directly or by the archive-policy entry.
