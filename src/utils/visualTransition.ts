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

/**
 * State updates remain immediate.
 *
 * Visual continuity is handled by MotionSwap / useMotionPresence instead of the
 * browser View Transition API. Full-page snapshots were producing duplicate,
 * cropped, and temporarily missing content on responsive financial layouts.
 */
export function runVisualTransition(
  _name: PremiumVisualTransition,
  update: () => void,
): void {
  update();
}
