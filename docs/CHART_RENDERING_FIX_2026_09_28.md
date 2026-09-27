# Desktop chart rendering repair — 2026-09-28

## Report and findings

The supplied desktop screenshots show detached green curve fragments, red rectangular edges and amber vertical strips around the trajectory, drawdown and fee charts. The affected series applied CSS drop-shadow filters to entire animated Recharts groups, including area fills and reveal clipping. This creates large offscreen filter surfaces rather than a halo limited to the curve. It is a plausible source of compositor artifacts matching the screenshots; the exact reporting PC/GPU was not available for reproduction. The screenshots alone do not establish duplicate financial records.

The chart definitions also used fixed document-wide SVG fragment IDs. Concurrent instances (including overlapping tab transitions) could resolve gradients and filters against another instance. This collision was independently identifiable in the source.

## Repair

- Paint faint halo strokes using Recharts AreaRevealShape and LineDrawShape with the same geometry and animation progress as the visible curve. Do not raster-filter whole series groups or area fills.
- Preserve the accepted colors, gradients, markers, layout, animation and chart data. Decorative halo paths do not add Recharts data series or tooltip entries.
- Allocate per-instance IDs with React useId for primary/secondary gradients, trajectory gradients/bar filters and allocation filters.
- Leave valuation, fetching, persistence and timeframe calculations unchanged in this rendering repair.

## Validation

- Regression tests cover area geometry and horizontal reveal alignment at progress 0, 0.4 and 1; dashed line alignment; unique resource references; and absence of whole-series raster filters.
- All 313 tests pass; TypeScript and production build pass.
- Local browser fixture at 1920×1080 checked trajectory, drawdown and fee rendering, data changes and concurrent chart instances. No detached fragments were visible; the fixture reported zero duplicate SVG IDs and zero filtered series groups.
- This is local browser validation, not confirmation on the reporting PC's exact graphics stack.
