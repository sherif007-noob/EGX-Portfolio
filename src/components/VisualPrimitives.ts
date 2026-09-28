/**
 * Phase 10.1 — canonical visual primitive ownership.
 *
 * This registry does not define styling. CSS remains the material/token owner.
 * It gives shared React controls one source for the primitive class names they
 * compose so later consistency passes do not invent parallel visual families.
 */
export const PREMIUM_PRIMITIVE_CLASS = Object.freeze({
  action: 'premium-action',
  control: 'premium-control',
  field: 'premium-field',
  iconAction: 'premium-icon-action',
  selectorShell: 'premium-selector-shell',
  selectTrigger: 'premium-select-trigger',
  floating: 'premium-floating',
  dropdown: 'premium-dropdown',
  dropdownSurface: 'premium-floating premium-dropdown',
  menuItem: 'premium-menu-item',
  insetGlass: 'premium-inset-glass',
  panel: 'premium-panel',
  subpanel: 'premium-subpanel',
  tableShell: 'premium-table-shell',
  modal: 'premium-modal',
  modalSection: 'premium-modal-section',
} as const);

export type PremiumPrimitiveName = keyof typeof PREMIUM_PRIMITIVE_CLASS;
