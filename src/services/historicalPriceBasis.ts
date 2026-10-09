import type { TradeTransaction } from '../types';
import type { HistoricalPriceSeries } from './portfolioPerformance';
import { isBonusSharesTransaction } from './corporateActions';

/**
 * Some EGX vendor histories change share-price basis before a broker credits
 * the associated shares. This is a valuation-only bridge, never a trade and
 * never a mutation to Supabase price history.
 *
 * Every entry requires a manually reviewed vendor transition date, with
 * audited evidence in docs/ANALYTICS_RETURN_CASHFLOW_INTEGRITY_REPAIR_PLAN.md.
 * Do NOT infer a corporate action from an unexplained price jump.
 */
interface VerifiedVendorPriceTransition {
  ticker: string;
  vendorAdjustedFrom: string;
  ledgerShareCreditDate: string;
  /** Matching source shares and credited share quantity are taken from ledger. */
  expectedBonusRatio: number;
  reference: string;
}

export const VERIFIED_VENDOR_PRICE_TRANSITIONS: readonly VerifiedVendorPriceTransition[] = [
  {
    ticker: 'ORHD',
    vendorAdjustedFrom: '2026-09-30',
    ledgerShareCreditDate: '2026-10-07',
    expectedBonusRatio: 2.228,
    reference: 'TradingView daily closes changed from 38.80 (2026-09-29) to 11.641924 (2026-09-30); original EGX ORHD credited bonus-share ledger entry is dated 2026-10-07.',
  },
];

export interface HistoricalPriceBasisBridge {
  ticker: string;
  startDate: string;
  endExclusive: string;
  factor: number;
}

export function resolvedHistoricalPriceBasisBridges(
  transactions: TradeTransaction[],
  prices: HistoricalPriceSeries,
): { bridges: HistoricalPriceBasisBridge[]; unverified: string[] } {
  const bridges: HistoricalPriceBasisBridge[] = [];
  const unverified: string[] = [];
  for (const transition of VERIFIED_VENDOR_PRICE_TRANSITIONS) {
    const matches = transactions.filter(tx =>
      isBonusSharesTransaction(tx)
      && tx.ticker.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '') === transition.ticker
      && tx.date === transition.ledgerShareCreditDate,
    );
    if (matches.length === 0) continue;
    if (matches.length !== 1) { unverified.push(transition.ticker); continue; }
    const bonus = matches[0];
    const sourceShares = Number(bonus.corporateActionSourceShares);
    const creditedShares = Number(bonus.shares);
    const ratio = Number(bonus.corporateActionRatio);
    const factor = (sourceShares + creditedShares) / sourceShares;
    const tickerPrices = prices[transition.ticker] ?? [];
    const preceding = tickerPrices.filter(p => p.date < transition.vendorAdjustedFrom).at(-1);
    const following = tickerPrices.find(p => p.date === transition.vendorAdjustedFrom);
    // Verify the actual ledger event, its rounded entitlement, and the observed
    // vendor discontinuity; never construct the adjustment just from a ticker.
    const safe = Number.isFinite(sourceShares) && sourceShares > 0
      && Number.isSafeInteger(creditedShares) && creditedShares > 0
      && Math.abs(ratio - transition.expectedBonusRatio) < 0.01
      && Math.abs(sourceShares * ratio - creditedShares) <= 1.01
      && Number.isFinite(factor) && factor > 1
      && preceding && following
      && Number.isFinite(preceding.close) && preceding.close > 0
      && Number.isFinite(following.close) && following.close > 0
      && Math.abs((preceding.close / following.close) / factor - 1) <= 0.2
      && !transactions.some(tx =>
        tx.id !== bonus.id && tx.ticker.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '') === transition.ticker
        && (tx.type === 'BUY' || tx.type === 'SELL' || tx.type === 'OPENING_POSITION')
        && tx.date >= transition.vendorAdjustedFrom && tx.date < transition.ledgerShareCreditDate,
      );
    if (!safe) { unverified.push(transition.ticker); continue; }
    bridges.push({
      ticker:transition.ticker,
      startDate:transition.vendorAdjustedFrom,
      endExclusive:transition.ledgerShareCreditDate,
      factor,
    });
  }
  return { bridges, unverified };
}

export function historicalPriceOnEconomicShareBasis(
  ticker: string,
  date: string,
  vendorClose: number,
  bridges: readonly HistoricalPriceBasisBridge[],
): number {
  const bridge = bridges.find(item => item.ticker === ticker && date >= item.startDate && date < item.endExclusive);
  return bridge ? vendorClose * bridge.factor : vendorClose;
}
