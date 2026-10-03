# EGX Portfolio Documentation Map

## Start here

Use these three documents first:

1. **[STATUS.md](STATUS.md)** — what is true now and what pass comes next.
2. **[MASTER_STABILIZATION_ROADMAP.md](MASTER_STABILIZATION_ROADMAP.md)** — ordered plan for stabilization and future features.
3. **This file** — which document owns which subject.

The repository accumulated many implementation journals while the application evolved rapidly. They are valuable evidence, but they are not all current authorities.

---

# Canonical current-state documents

| Document | Authority |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | runtime/component/data architecture |
| [DATA_MODEL.md](DATA_MODEL.md) | persisted data model |
| [AUTH_AND_SECURITY.md](AUTH_AND_SECURITY.md) | auth, RLS and security model |
| [API.md](API.md) | application/API surface |
| [OPERATIONS.md](OPERATIONS.md) | deploy, workflows, production operations |
| [TESTING.md](TESTING.md) | test gates and regression strategy |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | recovery/debug procedures |
| [PERFORMANCE_ANALYTICS.md](PERFORMANCE_ANALYTICS.md) | performance calculation semantics |
| [INTRADAY_MARKET_DATA.md](INTRADAY_MARKET_DATA.md) | current 1m/5m/15m market-data policy |
| [TICKER_REGISTRY.md](TICKER_REGISTRY.md) | security identity/resolver rules |
| [ANALYTICS_VISUAL_SYSTEM.md](ANALYTICS_VISUAL_SYSTEM.md) | analytics chart visual contract |
| [PREMIUM_VISUAL_LANGUAGE_CONTRACT.md](PREMIUM_VISUAL_LANGUAGE_CONTRACT.md) | material/semantic/hierarchy visual contract |
| [FINANCIAL_MUTATION_CONTRACT.md](FINANCIAL_MUTATION_CONTRACT.md) | canonical financial mutation ordering, persistence and failure semantics |

When a historical phase log conflicts with one of these about current behavior, the canonical document wins.

---

# Execution plans

| Document | State |
| --- | --- |
| [MASTER_STABILIZATION_ROADMAP.md](MASTER_STABILIZATION_ROADMAP.md) | **master sequencing authority** |
| [PHASE10_VISUAL_CONSISTENCY_PLAN.md](PHASE10_VISUAL_CONSISTENCY_PLAN.md) | **closed Stage 1 reference; visual system CLOSED / CI CLEAN** |
| [POST_OVERHAUL_REPORTS_WORKSPACE_REDESIGN_PLAN.md](POST_OVERHAUL_REPORTS_WORKSPACE_REDESIGN_PLAN.md) | scheduled as master-roadmap Stage 5; implementation deferred |
| [INTRADAY_1M_MIGRATION_PLAN.md](INTRADAY_1M_MIGRATION_PLAN.md) | migration/rollout reference; remaining promotion evidence still relevant |

---

# Audit and incident evidence

These documents capture what was observed/fixed at a point in time. They support history and regression reasoning; they are not automatically the current architecture.

| Document | Purpose |
| --- | --- |
| [READINESS_AUDIT.md](READINESS_AUDIT.md) | earlier cross-app readiness snapshot |
| [STAGE3_BRANCH_DIVERGENCE_REVIEW.md](STAGE3_BRANCH_DIVERGENCE_REVIEW.md) | Stage 3.1 commit-by-commit main/premium divergence review and integration decision |
| [MARKET_DATA_AUDIT_2026_09_28.md](MARKET_DATA_AUDIT_2026_09_28.md) | September 28 intraday/valuation root-cause audit |
| [CHART_RENDERING_FIX_2026_09_28.md](CHART_RENDERING_FIX_2026_09_28.md) | dated chart-rendering incident/fix record |
| [ANALYTICS_MARKET_DATA_EVOLUTION.md](ANALYTICS_MARKET_DATA_EVOLUTION.md) | evolution history for analytics market data |

---

# Historical visual implementation journals

These record how the accepted visual system was reached.

They are **historical implementation evidence**, even when some remain physically in `docs/`.

- `PREMIUM_UI_REDESIGN_PLAN.md`
- `PREMIUM_UI_REDESIGN_IMPLEMENTATION.md`
- `PHASE4_MOTION_REIMPLEMENTATION_PLAN.md`
- `PHASE5_ADVANCED_EFFECTS_PLAN.md`
- `PHASE6_RESPONSIVE_REFINEMENT_PLAN.md`
- `PHASE6_5_NAVIGATION_REFINEMENT_PLAN.md`
- `PHASE7_CHARTS_PLAN.md`
- `PHASE8_VISUAL_HIERARCHY_PLAN.md`
- `PHASE8_HIERARCHY_AUDIT_MAP.md`
- `PHASE8_4_TYPOGRAPHY_AUDIT.md`
- `PHASE9_HEADER_NAVIGATION_PLAN.md`

Do not use an old phase recipe to override the canonical visual contract.

Some regression tests intentionally read historical plan files by exact path. Phase 10 is now closed, but physical archive moves remain deferred until those path bindings are deliberately removed and updated.

See [archive/README.md](archive/README.md).

---

# Development/reference documents

- [DEVELOPMENT.md](DEVELOPMENT.md)
- [API.md](API.md)
- [DATA_MODEL.md](DATA_MODEL.md)

Root-level project governance remains in:

- `../CONTRIBUTING.md`
- `../SECURITY.md`
- `../CHANGELOG.md`

---

# Documentation update rules

Every accepted implementation pass should:

1. update `STATUS.md`;
2. update the domain document whose invariant changed;
3. update its active phase/subplan where relevant;
4. avoid duplicating the same current-state rule into multiple historical logs;
5. keep dated audits immutable except for an explicit correction note.

## What belongs where

### STATUS
Short current truth and next action.

### MASTER_STABILIZATION_ROADMAP
Ordering, dependencies, stage gates, deferred features.

### Domain docs
Long-lived behavioral rules.

### Phase/subplan docs
Implementation detail for the currently active scoped project.

### Audit docs
Evidence from a particular investigation/date.

### Archive
Completed implementation journals no longer needed by active code/tests.

---

# Physical archive policy

The intended future structure is:

```text
docs/
  STATUS.md
  MASTER_STABILIZATION_ROADMAP.md
  README.md
  <canonical domain docs>
  <active plans>
  archive/
    visual/
    audits/
    migrations/
```

Do **not** move a document while:

- tests read its exact path;
- active docs link to it without being updated in the same change;
- it still owns an active implementation contract.

Physical archive migration is a closure task, not a cosmetic rename exercise.
