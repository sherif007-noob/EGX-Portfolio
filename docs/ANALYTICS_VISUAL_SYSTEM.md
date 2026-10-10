# Analytics Visual System

## Purpose

The analytics visual system defines how every portfolio chart should look and behave inside EGX Portfolio.

Phase 7 originally established this system; `PHASE7_CHARTS_PLAN.md` is now historical implementation evidence. This document is the canonical current chart visual/interaction contract.

External apps such as Telda are references for useful interactions and information hierarchy. They are **not** the visual design source. Charts must continue to look like native EGX Portfolio components.

## Design rules

- Dark slate/navy surfaces only.
- No default white chart tooltips.
- Light primary text with muted slate secondary text.
- Cyan for live/informational series.
- Emerald for positive financial values.
- Rose for negative financial values.
- Purple and blue for secondary analytical series.
- Amber for fees/warnings.
- Rounded corners and borders consistent with the rest of the app.
- Tooltips must remain readable on mobile and must not overflow the viewport.
- Crosshairs should be subtle cyan rather than the Recharts default.
- EGP and percentage formatting must be consistent across charts.
- Missing data should use an explicit dark empty state rather than an empty plotting area.
- Loading charts should use a dark skeleton state.
- Visual smoothing must never change the underlying financial observations.

## Shared implementation

The shared chart primitives live in:

```text
src/components/charts/AnalyticsChartTheme.tsx
```

It exports:

- `ANALYTICS_CHART_THEME`
- `analyticsGridProps`
- `analyticsXAxisProps`
- `analyticsYAxisProps`
- `analyticsTooltipCursor`
- `ChartTooltipShell`
- `AnalyticsChartTooltip`
- `AnalyticsEmptyState`
- `AnalyticsChartLoadingState`
- EGP/percent/compact-axis formatting helpers

All new Recharts analytics should consume these primitives instead of defining independent tooltip colors, axis styles, and value formatting.

## Tooltips

Generic analytical tooltips use `AnalyticsChartTooltip`.

Trade-specific charts can use `ChartTooltipShell` when they require richer custom content.

The shell provides:

- `slate-950` translucent background;
- slate border;
- light text;
- compact mobile-safe maximum width;
- backdrop blur;
- dark shadow;
- app-consistent rounded corners.

A CSS fallback in `src/styles/features/charts.css` also darkens Recharts' built-in tooltip if a future chart accidentally uses the default component. This is defensive only; new charts should still use the shared tooltip component.

## Crosshair behavior

Cartesian charts should pass:

```tsx
<Tooltip cursor={analyticsTooltipCursor} ... />
```

The shared cursor uses a thin, dashed cyan line.

The Today chart uses this interaction language with active-point/timestamp inspection and synchronized secondary analytics where applicable.

## Axes and grid

Use the shared axis/grid props:

```tsx
<CartesianGrid {...analyticsGridProps} />
<XAxis {...analyticsXAxisProps} />
<YAxis {...analyticsYAxisProps} />
```

Individual charts may override tick formatters or width when needed, but should not redefine the base colors.

## Number formatting

Use:

```ts
formatAnalyticsEgp(value, signed)
formatAnalyticsPercent(value, signed)
formatAnalyticsCompactEgp(value)
```

Examples:

```text
69,154.76 EGP
+372.55 EGP
+0.54%
-2.50%
+69.2k
```

## Current chart surfaces

The shared system now covers:

- Portfolio vs Return;
- Portfolio vs Net Deposits;
- Performance (TWR);
- Performance (MWR);
- Portfolio vs Benchmarks (EGX30 / EGX70 / EGX100);
- Today intraday NAV;
- performance drawdown;
- cumulative fees;
- realized vs unrealized P&L;
- realized trajectory (cumulative and trade-by-trade);
- portfolio allocation.

This removes the earlier mix of default Recharts white tooltips and independent chart-control recipes.

## Today chart rule

The Today portfolio chart uses a **linear, unsmoothed path** because intraday observations are discrete market/accounting observations at the selected resolution.

Today session ownership is EGX-session based, not midnight based: before 10:00 Cairo on a normal trading weekday the chart still represents the previous trading session; from 10:00 it represents the current date. This session switch must not alter the accepted linear visual treatment or manufacture an empty midnight session.

Longer daily timeframes may use restrained visual interpolation where appropriate, provided the plotted points remain the actual calculated observations.

## Mobile rules

Tooltips must:

- fit within roughly 78% of viewport width;
- avoid large fixed widths;
- use compact text;
- keep financial values in monospace;
- truncate long labels rather than pushing values off-screen.

Chart controls should be touch-sized and remain usable without hover.

## Current analytics modes

The same visual system is used for:

- Portfolio vs Return
- Portfolio vs Net Deposits
- Performance (TWR)
- Performance (MWR)
- Portfolio vs Benchmarks (normalized percentage overlay)
- Today intraday NAV
- drawdown
- realized vs unrealized P&L
- cumulative fees

This visual layer must remain separate from financial calculations in the unified analytics engine.


## Secondary chart layout

Risk and cost analytics follow the same visual system as the primary analytics card.

- Drawdown uses the rose risk accent.
- Fees use the amber cost accent.
- Realized and unrealized P&L use emerald for gains, rose for losses, and neutral for zero.
- Cyan/blue identify informational NAV comparisons, not positive/negative profitability.
- Today uses unsmoothed linear observations.
- Longer price/performance series may use restrained monotone interpolation.
- Cumulative fees use a step line because costs occur at discrete transaction events.
- Secondary charts share a Recharts `syncId` so crosshair position stays aligned when comparing the same valuation timestamp.
- Responsive containers use a small resize debounce to reduce layout churn on mobile orientation/viewport changes.


## Benchmark comparison visual contract

Benchmark comparison is a percentage-domain overlay, never a dual-axis EGP/percent chart.

- Portfolio is the primary solid series and uses flow-neutral TWR.
- EGX30, EGX70 and EGX100 are subordinate comparison lines with distinct shared-theme accents/dash patterns.
- Every series is normalized from the selected-period baseline.
- The headline/tooltip exposes relative portfolio-minus-index return so outperformance and underperformance are explicit rather than inferred only from line position.
- Today remains linear/unsmoothed; daily ranges retain the accepted restrained interpolation and existing 1W transition behavior.
- Missing benchmark observations are not fabricated or forward-looking.

## Medium UI Return/NAV comparison (2026-10-10)

- P&L and NAV must not be overlaid on independent left/right Y axes. Those apparent line intersections are misleading, especially on external cash transfers.
- The `HomeChart` Return mode uses a signed cumulative EGP return; plot green **above** zero and rose **below** zero, with a true color transition at the zero level, and gray when flat.
- Opting into portfolio value renders a **second, date-synchronized NAV panel**, with its own zero-based EGP scale. NAV retains blue informational coloring.
- Real cash transfer dates on the daily NAV panel use amber dots and descriptive date/amount labels. Never place date-only transfers at a fictional precise intraday clock.
- Tooltip values use the underlying financial engine; the visual comparison does not normalize, recompute or rescale the financial return series itself.
- Home and Reports share the same chart component and therefore the same comparison contract. Compact layouts wrap captions without allowing overflowing amounts.
