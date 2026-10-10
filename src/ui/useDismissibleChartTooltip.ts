import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Recharts may keep a touch tooltip open after its last chart interaction.
 * Outside taps dismiss both synced charts; the next chart interaction restores
 * Recharts' normal tooltip handling. No chart data or layout is changed.
 */
export function useDismissibleChartTooltip() {
  const mainChartRef = useRef<HTMLDivElement>(null);
  const comparisonChartRef = useRef<HTMLDivElement>(null);
  const [dismissed, setDismissed] = useState(false);
  const onChartInteraction = useCallback(() => setDismissed(false), []);

  useEffect(() => {
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (mainChartRef.current?.contains(target) || comparisonChartRef.current?.contains(target)) return;
      setDismissed(true);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDismissed(true);
    };
    document.addEventListener('pointerdown', dismissOutside, true);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside, true);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, []);

  return { mainChartRef, comparisonChartRef, dismissed, onChartInteraction };
}
