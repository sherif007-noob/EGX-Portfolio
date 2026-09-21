import React, { useEffect, useMemo, useRef, useState } from 'react';

export type MotionSwapVariant = 'tab' | 'state';

interface MotionSwapProps {
  motionKey: string | number;
  children: React.ReactNode;
  variant?: MotionSwapVariant;
  className?: string;
}

const SWAP_TIMINGS: Record<MotionSwapVariant, { exit: number; enter: number }> = {
  tab: { exit: 220, enter: 360 },
  state: { exit: 180, enter: 320 },
};

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Deterministic sequential content transition.
 *
 * Only one application tree is painted at a time:
 * current content exits -> React swaps once -> next content enters.
 *
 * Rapid repeated changes collapse to the latest requested state. The currently
 * displayed tree is always the source for the next exit, so an interrupted
 * transition can never flash an older/stale tree back onto the screen.
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

  const currentNodeRef = useRef<React.ReactNode>(children);
  const pendingRef = useRef<{ key: string | number; node: React.ReactNode }>({
    key: motionKey,
    node: children,
  });
  const exitTimerRef = useRef<number | null>(null);
  const enterTimerRef = useRef<number | null>(null);
  const reduced = useMemo(prefersReducedMotion, []);

  pendingRef.current = { key: motionKey, node: children };

  if (phase === 'idle' && displayedKey === motionKey) {
    currentNodeRef.current = children;
  }

  useEffect(() => {
    if (reduced) {
      currentNodeRef.current = children;
      setDisplayedKey(motionKey);
      setDisplayedNode(children);
      setPhase('idle');
      return;
    }

    if (phase !== 'idle' || motionKey === displayedKey) return;

    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current);

    setDisplayedNode(currentNodeRef.current);
    setPhase('exit');

    exitTimerRef.current = window.setTimeout(() => {
      const next = pendingRef.current;
      currentNodeRef.current = next.node;
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
      : displayedNode;

  return (
    <div
      className={`premium-motion-swap premium-motion-swap--${variant} premium-motion-swap--${phase} ${className}`.trim()}
      data-motion-phase={phase}
      aria-busy={phase !== 'idle' ? true : undefined}
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
