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
 * Presentation-only state-update boundary.
 *
 * Phase 4 v3 deliberately keeps state updates immediate. Motion for React owns
 * the visual lifecycle through keyed presence primitives; this helper no longer
 * snapshots DOM, delays React state, queries modal elements, or runs timers.
 *
 * Keeping the named transition call sites makes intent explicit without
 * introducing a second animation system.
 */
export function runVisualTransition(
  _name: PremiumVisualTransition,
  update: () => void,
): void {
  update();
}
