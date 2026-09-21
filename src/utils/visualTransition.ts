export type PremiumVisualTransition =
  | 'tab'
  | 'journal-filter'
  | 'performance-filter'
  | 'monthly-filter'
  | 'allocation-filter'
  | 'cash-action'
  | 'cash-history'
  | 'closed-filter'
  | 'positions-filter'
  | 'directory-filter'
  | 'modal-close';

const MODAL_EXIT_MS = 220;
let modalExitTimer: number | null = null;

function reducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Content/state continuity is owned by MotionSwap, which paints one React tree
 * at a time. This helper therefore updates normal state immediately.
 *
 * Modal close is the one exception: legacy modal components that do not use
 * useMotionPresence receive a short DOM-only exit phase before their ordinary
 * close callback runs. Presence-aware modals already expose data-motion-phase,
 * so they keep their React-driven exit path and update immediately.
 */
export function runVisualTransition(
  name: PremiumVisualTransition,
  update: () => void,
): void {
  if (
    name !== 'modal-close' ||
    typeof document === 'undefined' ||
    typeof window === 'undefined' ||
    reducedMotion()
  ) {
    update();
    return;
  }

  const backdrops = Array.from(
    document.querySelectorAll<HTMLElement>('.premium-modal-backdrop'),
  ).filter((element) => element.getClientRects().length > 0);
  const backdrop = backdrops[backdrops.length - 1];

  if (!backdrop) {
    update();
    return;
  }

  // Motion-owned/presence-aware modals keep themselves mounted after isOpen
  // becomes false, so their React lifecycle should receive the close immediately.
  if (
    backdrop.hasAttribute('data-motion-owned') ||
    backdrop.hasAttribute('data-motion-phase')
  ) {
    update();
    return;
  }

  if (modalExitTimer !== null) {
    window.clearTimeout(modalExitTimer);
  }

  backdrop.dataset.motionPhase = 'exit';
  backdrop.style.pointerEvents = 'none';

  const modal = backdrop.querySelector<HTMLElement>('.premium-modal');
  if (modal) modal.dataset.motionPhase = 'exit';

  modalExitTimer = window.setTimeout(() => {
    modalExitTimer = null;
    update();
  }, MODAL_EXIT_MS);
}
