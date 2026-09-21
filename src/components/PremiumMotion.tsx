import React, { useEffect, useMemo, useRef, useState } from 'react';

export type MotionSwapVariant = 'tab' | 'state';

interface MotionSwapProps {
  motionKey: string | number;
  children: React.ReactNode;
  variant?: MotionSwapVariant;
  className?: string;
}

const SWAP_TIMINGS: Record<MotionSwapVariant, { exit: number; enter: number }> = {
  tab: { exit: 180, enter: 320 },
  state: { exit: 140, enter: 300 },
};

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Deterministic sequential content transition.
 *
 * Unlike the browser View Transition API, this never paints old and new
 * application trees at the same time. The currently rendered tree exits,
 * React swaps to the latest requested tree, then that tree enters.
 *
 * Rapid repeated changes collapse to the latest requested state rather than
 * stacking snapshots or replaying intermediate transitions.
 */
export const MotionSwap: React.FC<MotionSwapProps> = ({
  motionKey,
  children,
  variant = 'state',
  className = '',
}) => {
  const timings = SWAP_TIMINGS[variant];
  const [displayedKey, setDisplayedKey] = useState<string | number>(motionKey);
  const [displayedNode, setDisplayedNode] = useState<React.ReactNode>(children);
  const [phase, setPhase] = useState<'idle' | 'exit' | 'enter'>('idle');

  const stableNodeRef = useRef<React.ReactNode>(children);
  const pendingRef = useRef<{ key: string | number; node: React.ReactNode }>({
    key: motionKey,
    node: children,
  });
  const exitTimerRef = useRef<number | null>(null);
  const enterTimerRef = useRef<number | null>(null);

  const reduced = useMemo(prefersReducedMotion, []);

  if (phase === 'idle' && displayedKey === motionKey) {
    stableNodeRef.current = children;
  }
  pendingRef.current = { key: motionKey, node: children };

  useEffect(() => {
    if (reduced) {
      setDisplayedKey(motionKey);
      setDisplayedNode(children);
      setPhase('idle');
      return;
    }

    if (motionKey === displayedKey || phase !== 'idle') return;

    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current);

    setDisplayedNode(stableNodeRef.current);
    setPhase('exit');

    exitTimerRef.current = window.setTimeout(() => {
      const next = pendingRef.current;
      setDisplayedKey(next.key);
      setDisplayedNode(next.node);
      setPhase('enter');

      enterTimerRef.current = window.setTimeout(() => {
        setPhase('idle');
      }, timings.enter);
    }, timings.exit);
  }, [children, displayedKey, motionKey, phase, reduced, timings.enter, timings.exit]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
      if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current);
    };
  }, []);

  const renderedNode =
    reduced || (phase === 'idle' && displayedKey === motionKey)
      ? children
      : phase === 'idle'
        ? stableNodeRef.current
        : displayedNode;

  return (
    <div
      className={`premium-motion-swap premium-motion-swap--${variant} premium-motion-swap--${phase} ${className}`.trim()}
      data-motion-phase={phase}
    >
      {renderedNode}
    </div>
  );
};

interface MotionPresenceResult {
  isPresent: boolean;
  phase: 'idle' | 'enter' | 'exit';
}

/**
 * Keeps an overlay mounted long enough to play its exit animation.
 * The owning component can update its normal open/closed state immediately.
 */
export function useMotionPresence(
  isOpen: boolean,
  enterMs = 320,
  exitMs = 220,
): MotionPresenceResult {
  const [isPresent, setIsPresent] = useState(isOpen);
  const [phase, setPhase] = useState<'idle' | 'enter' | 'exit'>(
    isOpen ? 'enter' : 'idle',
  );
  const timerRef = useRef<number | null>(null);
  const reduced = useMemo(prefersReducedMotion, []);

  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (reduced) {
      setIsPresent(isOpen);
      setPhase('idle');
      return;
    }

    if (isOpen) {
      setIsPresent(true);
      setPhase('enter');
      timerRef.current = window.setTimeout(() => setPhase('idle'), enterMs);
      return;
    }

    if (isPresent) {
      setPhase('exit');
      timerRef.current = window.setTimeout(() => {
        setIsPresent(false);
        setPhase('idle');
      }, exitMs);
    }
  }, [enterMs, exitMs, isOpen, isPresent, reduced]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  return { isPresent: isOpen || isPresent, phase };
}
