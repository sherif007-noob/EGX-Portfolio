# Analytics Visual System

## Purpose

The analytics visual system defines how every portfolio chart should look and behave inside EGX Portfolio.

Phase 7 is historical and closed. **docs/PHASE7_CHARTS_PLAN.md** records how the chart system was migrated; this file is the current visual/interaction contract for analytics charts.

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

A defensive Recharts tooltip fallback lives under the chart feature CSS owner. It is not a substitute for using the shared tooltip primitives.

## Crosshair behavior

Cartesian charts should pass:

```tsx
<Tooltip cursor={analyticsTooltipCursor} ... />
```

The shared cursor uses a thin, dashed cyan line.

Today is the live intraday chart. It uses timestamp-aware tooltips and the shared synchronized interaction boundary across the primary and secondary analytics charts.

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

- primary portfolio analytics across Portfolio vs Return / Net Deposits / TWR / MWR;
- Today plus 1W / 1M / 90D / YTD / All;
- synchronized secondary drawdown, fee and realized/unrealized analytics;
- realized trajectory in cumulative and trade-by-trade modes;
- allocation charts;
- Reports Analytics workspace reuse of the same chart components.

This removes the earlier mix of default Recharts surfaces and one-off tooltip/control styling.

## Today chart rule

Today must use a **linear, unsmoothed path** because observations are discrete market valuations. The selectable display resolution is `Auto | 1m | 5m | 15m | 1h`; changing display sampling must not invent observations.

Longer daily timeframes may use restrained visual interpolation where appropriate, provided the plotted points remain the actual calculated observations. The special 1W transition interpolation must match points by date so entering/leaving 1W does not visually start from the wrong quarter of the chart.

## Mobile rules

Tooltips must:

- fit within roughly 78% of viewport width;
- avoid large fixed widths;
- use compact text;
- keep financial values in monospace;
- truncate long labels rather than pushing values off-screen.

Chart controls should be touch-sized and remain usable without hover.

## Current analytics modes

The visual system is used by:

- Portfolio vs Return;
- Portfolio vs Net Deposits;
- Performance (TWR);
- Performance (MWR);
- Today intraday NAV;
- drawdown;
- realized vs unrealized P&L;
- cumulative fees.

The visual layer remains separate from financial calculations in the unified/intraday analytics engines. Reports Stage 5 reorganized where these components appear; it did not create a second chart engine.


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
