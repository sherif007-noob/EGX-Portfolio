import { flushSync } from 'react-dom';

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

type ViewTransitionLike = {
  finished?: Promise<unknown>;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ViewTransitionLike;
};

let activeTransitionId = 0;

export function runVisualTransition(
  name: PremiumVisualTransition,
  update: () => void,
): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    update();
    return;
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }

  const doc = document as ViewTransitionDocument;
  if (typeof doc.startViewTransition !== 'function') {
    update();
    return;
  }

  const root = document.documentElement;
  const transitionId = ++activeTransitionId;
  root.dataset.premiumTransition = name;

  try {
    const transition = doc.startViewTransition(() => flushSync(update));
    Promise.resolve(transition.finished)
      .catch(() => undefined)
      .finally(() => {
        if (activeTransitionId === transitionId && root.dataset.premiumTransition === name) {
          delete root.dataset.premiumTransition;
        }
      });
  } catch {
    delete root.dataset.premiumTransition;
    update();
  }
}
