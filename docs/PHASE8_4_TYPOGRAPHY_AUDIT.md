# Phase 8.4 Typography & Spacing Audit

## Status

**8.4.5 — CODE COMPLETE / CI CLEAN — full typography + spacing consistency sweep passed Quality Checks #36265246582. Device visual validation is pending before Phase 8.4 closure.**

This audit starts Pass 8.4 without changing the accepted material system.

Protected and frozen during all of 8.4:
- glass, blur, refraction and opacity recipes;
- semantic aura/glow intensity accepted in Pass 8.3b;
- semantic edge geometry and corner-wrap/fade;
- semantic color mapping;
- H0–H5 structural composition;
- charts, selectors, motion and business behavior.

## Canonical text roles

Phase 8 keeps exactly six hierarchy text roles:

1. page / hero title;
2. section title;
3. metric value;
4. metric label;
5. metadata;
6. helper copy.

Metric size is an independent scale inside the **metric** role, not additional text roles.

## Canonical metric scale

| Scale | Class | Intended use |
| --- | --- | --- |
| Hero | `premium-type-metric-hero` | Sole H1 financial anchor, e.g. Total Portfolio Value |
| Primary | `premium-type-metric-primary` | H2 supporting financial values |
| Secondary | `premium-type-metric-secondary` | H3 supporting KPIs |
| Dense | `premium-type-metric-dense` | H5 operational records / compact data |
| Unit helper | `premium-type-unit` | EGP, %, shares, days and other subordinate units |

The base `premium-type-metric` role remains available and defaults to primary scale for compatibility.

## Initial audit findings

### Overview

Already closest to the target:
- labels already use `premium-type-metric-label`;
- metadata already uses `premium-type-metadata`;
- the three current Overview number classes already express hero / primary / secondary sizing.

Migration task for 8.4.2:
- map those existing sizes onto the canonical metric scale;
- convert raw EGP labels to the unit helper;
- remove only redundant local type declarations once visual parity is confirmed.

### Reports

Partially normalized:
- page title and some section titles already use canonical roles;
- report summary values still use local `text-lg / sm:text-xl` recipes;
- several report modules use repeated `text-[10px] uppercase tracking-*` metadata;
- units are often embedded inside the metric line with one-off sizing.

Migration task for 8.4.2:
- normalize main report values and units first;
- keep semantic colors exactly as they are;
- reduce uppercase/tracking only where it does not communicate a real status/category.

### Monthly Performance / Trading Performance

These are currently the largest typography exception zones:
- titles, audit metadata, KPI values, units and benchmark labels mostly use local utility classes;
- repeated uppercase/tracking patterns exist at several nested levels.

Migration task:
- preserve Monthly Performance as the visual material reference;
- change typography only;
- do not touch audit-card glass, aura, semantic edge or report-tone classes.

### Dense workflows

Positions, Closed Cycles, Transactions, Cash Ledger and Stocks intentionally use compact local sizes.

Migration task for 8.4.3:
- keep operational density;
- map ticker / P&L / labels / metadata to the canonical roles without enlarging rows;
- use the dense metric scale instead of promoting H5 records toward dashboard KPI sizing.

## Spacing baseline

The existing ladder remains canonical:
- inline: 4–6px;
- control/group: 8–10px;
- card internal: 12–16px;
- related sections: 16–20px;
- major sections: 24–32px.

Spacing migration begins after Overview + Reports typography validation.

## 8.4 execution order

1. **8.4.1 — complete:** canonical six roles + metric scale + audit.
2. **8.4.2:** Overview + Reports typography migration.
3. **8.4.3:** dense workflow typography migration.
4. **8.4.4:** global spacing rhythm normalization.
5. **8.4.5:** full consistency sweep and device validation.

## Acceptance guardrail

If any 8.4 change alters glass, aura, glow, semantic edge, semantic color, chart behavior, motion, or business logic, it is outside the pass and must be reverted.


## 8.4.2 implementation result

Commit `d079304e798b022e2ef1e1d488eb9dc8253b9ace` migrates the hierarchy-sensitive Overview and Reports surfaces onto the canonical typography system.

Implemented:
- Overview Total Portfolio Value → hero metric scale;
- Overview Unrealized P&L / Total Market Value → primary metric scale;
- Overview Realized Gain / Cash / Fees → secondary metric scale;
- Overview EGP labels → subordinate unit helper;
- Reports summary band → canonical secondary metrics + unit helper;
- Portfolio Allocation summary → canonical section / metric / metadata roles;
- Monthly Performance header, month banners, audit KPIs, audit-card performance values, labels, units, dates and notes → canonical roles while preserving material;
- Trading Performance header, KPI ribbon, benchmark-scorecard labels and measured values → canonical roles;
- removed redundant uppercase/tracking from non-status metadata where hierarchy roles now provide the distinction.

Protected:
- glass / blur / opacity;
- semantic aura / glow strength;
- semantic edge geometry and corner wrap;
- semantic colors;
- H0–H5 structural composition;
- chart behavior, motion, selectors and business logic.

Quality Checks `36257664993` passed typecheck, tests and production build.


## 8.4.3 implementation result

Commit `7b018b96c8a5470f82a4bdccd11d8f603a75ca39` migrates dense workflows onto the canonical typography system without increasing row/card density.

Covered:
- Open Positions;
- Closed Cycles;
- Transactions / Trade Journal;
- Cash Ledger;
- Ticker Directory / Stocks.

Implemented:
- screen headings use the canonical section-title role;
- workflow descriptions use helper copy;
- H3 summary KPI labels use metric-label and H3 values use secondary scale where appropriate;
- H5 record P&L / price / execution values use the dense metric scale;
- EGP units are visually subordinate through `premium-type-unit`;
- company, sector, date and supporting details move to helper/metadata roles;
- repeated `text-[10px]` label recipes are replaced with canonical metric-label roles in the migrated surfaces;
- dense operational rows stay compact and do not inherit dashboard-sized metrics.

Protected:
- glass, aura and glow intensity;
- semantic edge and its corner-wrap/fade geometry;
- semantic colors;
- H0–H5 composition;
- filters, selectors, tables, motion and business behavior.

Quality Checks `36258191821` passed typecheck, tests and production build.


## 8.4.4 implementation result

Implementation range `6e9f75bff50003aaefbea67e498bc96d177b67e9` → `59a1b4c8ca41774a9982606cbab20eaa2455ecc8` normalizes spacing across Overview, Reports, Monthly/Trading Performance, Positions, Closed Cycles, Transactions, Cash Ledger, and Ticker Directory.

Canonical rhythm introduced:
- major section separation → `premium-flow-major` using the existing 24–32px section token range;
- related conceptual blocks → `premium-flow-related` using the 16–20px related token range;
- repeated controls / dense records → `premium-flow-control` and `premium-gap-control`;
- hierarchy padding helpers → `premium-pad-h1` through `premium-pad-h5`;
- mobile uses tighter H-level padding and 8px control gaps while preserving the same information order.

Applied:
- Overview KPI tiers and Market Feed now use the canonical gap/padding rhythm;
- Reports major sections use deliberate major separation and H2/H3 section padding;
- Monthly and Trading Performance outer flows use the same major-section rhythm;
- Monthly audit cards and Trading Performance KPI cards use hierarchy-owned padding only;
- Positions / Cycles / Transactions / Cash / Stocks now share summary → controls → dense-data rhythm;
- repeated H5 records use the same dense padding and control-gap cadence;
- Cash H2/H3 KPI cards now reflect their hierarchy through spacing rather than unrelated local padding values.

Protected:
- glass/background recipes;
- semantic aura and glow intensity;
- semantic edge geometry and corner blend;
- semantic colors;
- typography scale established in 8.4.1–8.4.3;
- charts, selectors, motion, business logic, filtering and data behavior.

Quality Checks `36263281878` passed typecheck, tests and production build.


## 8.4.5 implementation result

Implementation range `a3964c8ea2d0878a6cfe7d8444b3ee4cff21a8d9` → `57a46324b1834a737bb558b3d179b33ca7fa3abe` performs the final Phase 8.4 consistency sweep across every Phase-8-owned screen.

Covered:
- Overview;
- Reports;
- Monthly Performance;
- Trading Performance;
- Open Positions;
- Closed Cycles;
- Transactions / Trade Journal;
- Cash Ledger;
- Ticker Directory / Stocks.

Corrected genuine outliers:
- leftover raw 9px/10px/11px helper and metadata text that was not a badge/control/status;
- one remaining arbitrary tracked allocation caption;
- residual helper/description text in report scorecards and allocation UI;
- desktop position/cycle/cash supporting metadata that had escaped 8.4.2–8.4.3;
- one remaining report-level `space-y-6` flow and other local spacing drift;
- Monthly Report month-banner spacing now uses the canonical H3/related-group rhythm.

Intentional compact exceptions retained:
- status/outcome chips;
- report identity badges;
- tiny action/control labels;
- target/stop alert badges;
- compact table status pills.

Regression guard:
- rejects raw `text-[9px]` and arbitrary `tracking-[0.xem]` inside Phase-8-owned screens;
- rejects legacy Overview metric-size classes;
- requires every migrated screen to use canonical typography and spacing primitives;
- preserves accepted glass, aura/glow and semantic-edge recipes.

Quality Checks `36265246582` passed dependency install, typecheck, tests and production build.

**Remaining acceptance:** device visual validation only. No further 8.4 code work is planned unless device review finds a real regression.
