# Analytics Visual System

## Purpose

The analytics visual system defines how every portfolio chart should look and behave inside EGX Portfolio.

Phase 7 implementation is governed by **docs/PHASE7_CHARTS_PLAN.md**, which audits the current seven chart visualizations and defines the staged migration/validation order.

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

A CSS fallback in `src/index.css` also darkens Recharts' built-in tooltip if a future chart accidentally uses the default component. This is defensive only; new charts should still use the shared tooltip component.

## Crosshair behavior

Cartesian charts should pass:

```tsx
<Tooltip cursor={analyticsTooltipCursor} ... />
```

The shared cursor uses a thin, dashed cyan line.

The 1D chart in the later intraday phase will build on this with a highlighted active point and timestamp tooltip.

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

## Current migrated charts

Phase 3 migrates the existing Recharts surfaces:

- historical MWRR;
- realized P&L trajectory;
- allocation pie chart;
- detailed cumulative realized trajectory;
- trade-by-trade realized bar chart.

This removes the inconsistent mix of default Recharts white tooltips and custom dark tooltips.

## 1D chart rule

The future 1D portfolio chart must use a **linear, unsmoothed path** because the observations are discrete 15-minute portfolio valuations.

Longer daily timeframes may use restrained visual interpolation where appropriate, provided the plotted points remain the actual calculated observations.

## Mobile rules

Tooltips must:

- fit within roughly 78% of viewport width;
- avoid large fixed widths;
- use compact text;
- keep financial values in monospace;
- truncate long labels rather than pushing values off-screen.

Chart controls should be touch-sized and remain usable without hover.

## Future chart modes

The same visual system will be reused for:

- Portfolio vs Return
- Portfolio vs Net Deposits
- Performance (TWR)
- Performance (MWR)
- 1D intraday NAV
- drawdown
- realized vs unrealized P&L
- cumulative fees

This visual layer must remain separate from financial calculations in the unified analytics engine.


## Secondary chart layout

Risk and cost analytics follow the same visual system as the primary analytics card.

- Drawdown uses the rose risk accent.
- Fees use the amber cost accent.
- Realized P&L uses emerald.
- Unrealized P&L uses cyan.
- Today uses unsmoothed linear observations.
- Longer price/performance series may use restrained monotone interpolation.
- Cumulative fees use a step line because costs occur at discrete transaction events.
- Secondary charts share a Recharts `syncId` so crosshair position stays aligned when comparing the same valuation timestamp.
- Responsive containers use a small resize debounce to reduce layout churn on mobile orientation/viewport changes.
