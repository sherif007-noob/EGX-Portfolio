import type { TradeTransaction } from '../types';

/**
 * Corporate rights are NOT bonus shares, BUY trades, IPO orders, or immediately
 * issued stock. Keep their entitlement / future cash requirements separate
 * until the broker reports what was actually credited / exercised.
 */
export interface RightsOfferingTerms {
  id: string;
  parentTicker: string;
  parentIsin: string;
  rightsIsin: string;
  entitlementCutoffDate: string;
  exRightsDate: string;
  newSharesPerExistingShare: number;
  subscriptionPriceEgp: number;
  faceValueEgp: number;
  issuanceFeeEgp: number;
  subscriptionOpenDate: string;
  subscriptionCloseDate: string;
  rightsTradingStartDate: string;
  rightsTradingEndDate: string;
  /** EGX's first-trading-session reference, NOT a live market quote. */
  indicativeRightOpeningPriceEgp?: number;
  rightsTradingConditional: boolean;
  disclosureUrl: string;
}

export const KORA_RIGHTS_2026: Readonly<RightsOfferingTerms> = Object.freeze({
  id: 'EGX:KORA:RIGHTS:2026-10-14',
  parentTicker: 'KORA',
  parentIsin: 'EGS07911C018',
  rightsIsin: 'EGS924O1C014',
  entitlementCutoffDate: '2026-10-13',
  exRightsDate: '2026-10-14',
  newSharesPerExistingShare: 0.9,
  subscriptionPriceEgp: 0.205,
  faceValueEgp: 0.2,
  issuanceFeeEgp: 0.005,
  subscriptionOpenDate: '2026-10-18',
  subscriptionCloseDate: '2026-11-01',
  rightsTradingStartDate: '2026-10-18',
  rightsTradingEndDate: '2026-10-27',
  indicativeRightOpeningPriceEgp: 2.32,
  rightsTradingConditional: true,
  disclosureUrl: 'https://www.sigma-cap.com/main/news_page_exact?newsId=46127438&newsType=EGX',
});

const tickerOf = (value: string) => String(value || '').trim().toUpperCase()
  .replace(/^EGX:/, '').replace(/\.CA$/, '');

function assertQuantity(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite, non-negative quantity.`);
  }
}

function validCalendarDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

/** Snapshot holdings *at the entitlement cutoff*, not when the action is
 * entered. Do not use current Positions: the shareholder may sell on ex-date.
 * No transaction or position objects are modified.
 */
export function sharesHeldAtRightsCutoff(
  transactions: ReadonlyArray<TradeTransaction>,
  terms: RightsOfferingTerms,
): number {
  if (!validCalendarDate(terms.entitlementCutoffDate)) {
    throw new Error('Invalid entitlement cutoff date.');
  }
  let shares = 0;
  const events = transactions
    .filter(tx => tickerOf(tx.ticker) === tickerOf(terms.parentTicker)
      && String(tx.date || '').slice(0, 10) <= terms.entitlementCutoffDate)
    .sort((a, b) => String(a.date).localeCompare(String(b.date))
      || String(a.executedAt || '').localeCompare(String(b.executedAt || ''))
      || a.id.localeCompare(b.id));

  for (const tx of events) {
    const qty = Number(tx.shares);
    if (tx.type === 'BUY' || tx.type === 'SELL' || tx.type === 'OPENING_POSITION'
      || (tx.type === 'CORPORATE_ACTION' && tx.corporateActionType === 'BONUS_SHARES')) {
      assertQuantity(qty, 'Ledger share');
      shares += tx.type === 'SELL' ? -qty : qty;
      if (shares < -0.000001) {
        throw new Error('KORA share ledger is inconsistent before entitlement cutoff.');
      }
    }
  }
  return Math.max(0, shares);
}

export interface RightsEntitlementPreview {
  heldOriginalShares: number;
  theoreticalRights: number;
  /** Indicative whole-right amount, not authoritative broker allocation. */
  estimatedWholeRights: number;
  residualFractionalRights: number;
  subscriptionCostEgp: number;
  indicativeRightsReferenceValueEgp: number | null;
  cashDebitTodayEgp: 0;
  newSharesAlreadyCredited: 0;
  sharesAfterConfirmedFullExercise: number;
  requiresBrokerConfirmation: true;
}

export function previewRightsEntitlement(
  terms: RightsOfferingTerms,
  sharesAtCutoff: number,
): RightsEntitlementPreview {
  assertQuantity(sharesAtCutoff, 'Eligible original shares');
  if (!Number.isFinite(terms.newSharesPerExistingShare)
    || terms.newSharesPerExistingShare <= 0
    || !Number.isFinite(terms.subscriptionPriceEgp)
    || terms.subscriptionPriceEgp <= 0) {
    throw new Error('Invalid offering ratio or subscription price.');
  }
  const theoreticalRights = sharesAtCutoff * terms.newSharesPerExistingShare;
  // Tolerate binary floating-point near an integer without fabricating rights.
  const whole = Math.floor(theoreticalRights + 1e-8);
  const estimatedWholeRights = Math.min(whole, Math.ceil(theoreticalRights));
  const fraction = Math.max(0, theoreticalRights - estimatedWholeRights);
  return {
    heldOriginalShares: sharesAtCutoff,
    theoreticalRights,
    estimatedWholeRights,
    residualFractionalRights: fraction,
    subscriptionCostEgp: estimatedWholeRights * terms.subscriptionPriceEgp,
    indicativeRightsReferenceValueEgp: terms.indicativeRightOpeningPriceEgp == null
      ? null : Math.round(estimatedWholeRights * terms.indicativeRightOpeningPriceEgp * 100) / 100,
    cashDebitTodayEgp: 0,
    newSharesAlreadyCredited: 0,
    sharesAfterConfirmedFullExercise: sharesAtCutoff + estimatedWholeRights,
    requiresBrokerConfirmation: true,
  };
}

/**
 * An *illustrative* ex-rights bridge only. Do not substitute these theoretical
 * observations for TradingView OHLC, a tradable rights quote or broker NAV.
 * For each original share, its old value is redistributed between one ex-rights
 * share and (newSharesPerExistingShare) rights, before any market movement.
 */
export function theoreticalExRightsBridge(
  terms: RightsOfferingTerms,
  priorCumRightsCloseEgp: number,
  originalSharesAtCutoff: number,
) {
  assertQuantity(originalSharesAtCutoff, 'Original shares');
  if (!Number.isFinite(priorCumRightsCloseEgp) || priorCumRightsCloseEgp <= 0) {
    throw new Error('The last cum-rights share price must be positive and finite.');
  }
  if (!Number.isFinite(terms.newSharesPerExistingShare)
    || terms.newSharesPerExistingShare <= 0
    || !Number.isFinite(terms.subscriptionPriceEgp)
    || terms.subscriptionPriceEgp <= 0) {
    throw new Error('Offering ratio or subscription price is invalid.');
  }
  const ratio = terms.newSharesPerExistingShare;
  const theoreticalExRightsSharePriceEgp =
    (priorCumRightsCloseEgp + ratio * terms.subscriptionPriceEgp) / (1 + ratio);
  const theoreticalRightPriceEgp =
    (priorCumRightsCloseEgp - terms.subscriptionPriceEgp) / (1 + ratio);
  return {
    theoreticalExRightsSharePriceEgp,
    theoreticalRightPriceEgp,
    originalSharesAtCutoff,
    theoreticalRights: originalSharesAtCutoff * ratio,
    preDetachEquityEgp: originalSharesAtCutoff * priorCumRightsCloseEgp,
    postDetachSharesValueEgp: originalSharesAtCutoff * theoreticalExRightsSharePriceEgp,
    detachedRightsValueEgp: originalSharesAtCutoff * ratio * theoreticalRightPriceEgp,
    valueType:'THEORETICAL_ONLY' as const,
  };
}

export type RightsOperation =
  | { type: 'PURCHASE_RIGHTS' | 'SELL_RIGHTS'; date: string; quantity: number; grossCashEgp: number; feesEgp?: number }
  | { type: 'EXERCISE_RIGHTS'; date: string; quantity: number; actualCashEgp: number }
  | { type: 'EXPIRE_RIGHTS'; date: string; quantity: number }
  | { type: 'CREDIT_NEW_SHARES'; date: string; quantity: number };

/** Pure, explicit lifecycle projection. This does not produce ledger writes or
 * cash/position mutations: all events require a broker-confirmed source.
 */
export function projectRightsLifecycle(
  terms: RightsOfferingTerms,
  grantedRights: number,
  actions: ReadonlyArray<RightsOperation>,
) {
  assertQuantity(grantedRights, 'Confirmed granted rights');
  let availableRights = grantedRights;
  let exercisedRights = 0;
  let creditedShares = 0;
  let cashMovementEgp = 0;
  let pendingShares = 0;
  for (const action of actions) {
    if (!validCalendarDate(action.date)) throw new Error('Rights action requires a valid date.');
    assertQuantity(action.quantity, 'Rights action quantity');
    if (!Number.isSafeInteger(action.quantity) || action.quantity <= 0) {
      throw new Error('Rights operation quantities must be positive whole units.');
    }
    if (action.type === 'PURCHASE_RIGHTS' || action.type === 'SELL_RIGHTS') {
      if (action.date < terms.rightsTradingStartDate || action.date > terms.rightsTradingEndDate) {
        throw new Error('Rights may only trade within the announced trading dates.');
      }
      if (!Number.isFinite(action.grossCashEgp) || action.grossCashEgp < 0
        || !Number.isFinite(action.feesEgp ?? 0) || (action.feesEgp ?? 0) < 0) {
        throw new Error('Rights trading cash and fees must be valid.');
      }
      const fees = action.feesEgp ?? 0;
      if (action.type === 'PURCHASE_RIGHTS') {
        availableRights += action.quantity;
        cashMovementEgp -= action.grossCashEgp + fees;
      } else {
        if (action.quantity > availableRights) throw new Error('Cannot sell more rights than held.');
        availableRights -= action.quantity;
        cashMovementEgp += action.grossCashEgp - fees;
      }
    } else if (action.type === 'EXERCISE_RIGHTS') {
      if (action.date < terms.subscriptionOpenDate || action.date > terms.subscriptionCloseDate) {
        throw new Error('Exercise is outside the announced subscription dates.');
      }
      if (action.quantity > availableRights) throw new Error('Cannot exercise more rights than held.');
      if (!Number.isFinite(action.actualCashEgp) || action.actualCashEgp < 0) {
        throw new Error('Actual broker subscription payment must be non-negative.');
      }
      availableRights -= action.quantity;
      exercisedRights += action.quantity;
      pendingShares += action.quantity;
      cashMovementEgp -= action.actualCashEgp;
    } else if (action.type === 'EXPIRE_RIGHTS') {
      if (action.date <= terms.subscriptionCloseDate) {
        throw new Error('Do not mark rights expired before subscription closes.');
      }
      if (action.quantity > availableRights) throw new Error('Cannot expire more rights than held.');
      availableRights -= action.quantity;
    } else {
      if (action.quantity > pendingShares) {
        throw new Error('Cannot credit more new shares than subscribed and pending.');
      }
      creditedShares += action.quantity;
      pendingShares -= action.quantity;
    }
  }
  return { availableRights, exercisedRights, pendingShares, creditedShares, cashMovementEgp };
}
