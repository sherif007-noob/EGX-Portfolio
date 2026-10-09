/**
 * Current-account snapshot, not a historical performance series.
 * Each component is taken from existing portfolio accounting values.
 */
export interface PortfolioComposition {
  marketValue: number;
  availableCash: number;
  ipoHeld: number;
  nav: number;
  componentsTotal: number;
  reconciliationDifference: number;
  shares: { market: number; cash: number; ipo: number };
  hasAllocatableBar: boolean;
}

export function portfolioCompositionModel(
  marketValue: number,
  availableCash: number,
  ipoHeld: number,
  nav: number,
): PortfolioComposition {
  const safe = (x: number) => Number.isFinite(x) ? x : 0;
  const market = safe(marketValue);
  const cash = safe(availableCash);
  const reserved = safe(ipoHeld);
  const total = safe(nav);
  const sum = market + cash + reserved;
  const canStack = total > 0 && market >= 0 && cash >= 0 && reserved >= 0 && Math.abs(total - sum) <= 0.02;
  return {
    marketValue: market,
    availableCash: cash,
    ipoHeld: reserved,
    nav: total,
    componentsTotal: sum,
    reconciliationDifference: Number((total - sum).toFixed(2)),
    shares: {
      market: canStack ? (market / total) * 100 : 0,
      cash: canStack ? (cash / total) * 100 : 0,
      ipo: canStack ? (reserved / total) * 100 : 0,
    },
    hasAllocatableBar: canStack,
  };
}
