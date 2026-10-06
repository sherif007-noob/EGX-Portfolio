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
| [CORPORATE_ACTIONS_LEDGER.md](CORPORATE_ACTIONS_LEDGER.md) | implemented corporate-action ledger semantics; currently BONUS_SHARES, with later lifecycle expansion owned by Stage 6.3 |

When a historical phase log conflicts with one of these about current behavior, the canonical document wins.

---

# Execution plans

| Document | State |
| --- | --- |
| [MASTER_STABILIZATION_ROADMAP.md](MASTER_STABILIZATION_ROADMAP.md) | **master sequencing authority** |
| [PHASE10_VISUAL_CONSISTENCY_PLAN.md](PHASE10_VISUAL_CONSISTENCY_PLAN.md) | **closed Stage 1 reference; visual system CLOSED / CI CLEAN** |
| [POST_OVERHAUL_REPORTS_WORKSPACE_REDESIGN_PLAN.md](POST_OVERHAUL_REPORTS_WORKSPACE_REDESIGN_PLAN.md) | **closed Stage 5 reference; R1–R8 accepted / CI + rendered green** |
| [INTRADAY_1M_MIGRATION_PLAN.md](INTRADAY_1M_MIGRATION_PLAN.md) | promoted migration/history reference; Stage 3.5 live-session soak/remediation remains relevant |

---

# Whole-app documentation coverage

Use this matrix to find the current authority for each live subsystem. A feature is considered documented only when it has an owner here or is explicitly classified as historical evidence.

| App area | Current authority |
| --- | --- |
| Runtime topology, feature/data boundaries | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Supabase schema and persisted records | [DATA_MODEL.md](DATA_MODEL.md) |
| Auth, RLS, secrets | [AUTH_AND_SECURITY.md](AUTH_AND_SECURITY.md) |
| Worker/Express API contracts | [API.md](API.md) |
| Deployment, workflows, production operations | [OPERATIONS.md](OPERATIONS.md) |
| Test gates and rendered/browser regression | [TESTING.md](TESTING.md) |
| Ledger mutation / persist-before-apply | [FINANCIAL_MUTATION_CONTRACT.md](FINANCIAL_MUTATION_CONTRACT.md) |
| Corporate actions / bonus shares | [CORPORATE_ACTIONS_LEDGER.md](CORPORATE_ACTIONS_LEDGER.md) |
| Daily + intraday market data, Today session-date policy, benchmark ingestion | [INTRADAY_MARKET_DATA.md](INTRADAY_MARKET_DATA.md) and [ANALYTICS_MARKET_DATA_EVOLUTION.md](ANALYTICS_MARKET_DATA_EVOLUTION.md) |
| Ticker / ISIN / alias identity | [TICKER_REGISTRY.md](TICKER_REGISTRY.md) |
| NAV, TWR, MWR, drawdown, realized/unrealized analytics, EGX benchmark comparison | [PERFORMANCE_ANALYTICS.md](PERFORMANCE_ANALYTICS.md) |
| Chart interaction/visual behavior | [ANALYTICS_VISUAL_SYSTEM.md](ANALYTICS_VISUAL_SYSTEM.md) |
| Reports Overview/Analytics/Trading/Allocation/Monthly workspace | [POST_OVERHAUL_REPORTS_WORKSPACE_REDESIGN_PLAN.md](POST_OVERHAUL_REPORTS_WORKSPACE_REDESIGN_PLAN.md) |
| Glass/refraction/aura/hierarchy/control language | [PREMIUM_VISUAL_LANGUAGE_CONTRACT.md](PREMIUM_VISUAL_LANGUAGE_CONTRACT.md) |
| Stage 4 module/CSS ownership closure | [ARCHITECTURE_MODULE_OWNERSHIP.md](ARCHITECTURE_MODULE_OWNERSHIP.md) and [STAGE4_5_CSS_OWNERSHIP.md](STAGE4_5_CSS_OWNERSHIP.md) |
| Scanner/alerts current limitations and future operationalization | [ARCHITECTURE.md](ARCHITECTURE.md), [API.md](API.md), and Stage 9 in [MASTER_STABILIZATION_ROADMAP.md](MASTER_STABILIZATION_ROADMAP.md) |
| Google Sheets / OCR integration boundaries | [ARCHITECTURE.md](ARCHITECTURE.md), [API.md](API.md), [FINANCIAL_MUTATION_CONTRACT.md](FINANCIAL_MUTATION_CONTRACT.md) |
| Troubleshooting / stale PWA / recovery | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |

## Closed architecture implementation records

These are still useful technical evidence, but they do not own the current execution point:

- [ARCHITECTURE_MODULE_OWNERSHIP.md](ARCHITECTURE_MODULE_OWNERSHIP.md) — Stage 4 ownership map and migration record;
- [STAGE4_3_GRANULAR_VALIDATION.md](STAGE4_3_GRANULAR_VALIDATION.md) — Stage 4.3 validation history;
- [STAGE4_4_GRANULAR_VALIDATION.md](STAGE4_4_GRANULAR_VALIDATION.md) — Stage 4.4 validation history;
- [STAGE4_5_CSS_OWNERSHIP.md](STAGE4_5_CSS_OWNERSHIP.md) — Stage 4.5 CSS ownership/cascade evidence.

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

They are **historical implementation evidence**, even when some remain physically in `docs/`. Contemporaneous words such as **ACTIVE**, **NEXT**, **deferred**, or an old branch name inside those journals describe the state at that historical checkpoint; they are not the current execution status. Current truth always comes from `STATUS.md`, the master roadmap, and the canonical domain docs above.

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
