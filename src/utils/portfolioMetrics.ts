import { Position, ClosedTrade, TradeTransaction, EGXTicker, PortfolioMetrics, PerformanceStats, Sector } from '../types';
import {
  calculatePortfolioValue,
  calculatePositionMarketValue,
  calculatePositionUnrealizedPnl,
  calculatePerformanceStats as calculateAccountingPerformanceStats,
  calculateFeeBreakdown,
} from '../services/portfolioAccounting';

/**
 * Presentation adapter around the authoritative accounting engine.
 * Financial formulas belong in portfolioAccounting.ts; this module only
 * combines accounting results with quote-derived display metrics.
 */
export function calculatePortfolioMetrics(
  positions: Position[],
  cashBalance: number,
  closedTrades: ClosedTrade[] = [],
  tickers: EGXTicker[] = [],
  transactions: TradeTransaction[] = []
): PortfolioMetrics {
  const totalMarketValue = positions.reduce((sum, position) => sum + calculatePositionMarketValue(position), 0);
  const totalCost = positions.reduce((sum, position) => sum + position.shares * position.avgBuyPrice, 0);
  const openFeesPaid = positions.reduce((sum, position) => sum + (position.totalFees || 0), 0);
  const totalCostWithFees = totalCost + openFeesPaid;
  const unrealizedPnlEgp = positions.reduce((sum, position) => sum + calculatePositionUnrealizedPnl(position), 0);
  const grossUnrealizedPnlEgp = totalMarketValue - totalCost;
  const totalRealizedPnl = closedTrades.reduce((sum, trade) => sum + (trade.realizedPnlEgp || 0), 0);
  const totalValue = calculatePortfolioValue(cashBalance, positions);

  const feeBreakdown = calculateFeeBreakdown(transactions);
  const closedFeesPaid = closedTrades.reduce(
    (sum, trade) => sum + (trade.totalFees ?? ((trade.buyFees || 0) + (trade.sellFees || 0))),
    0,
  );
  const totalFeesPaid = transactions.length > 0 ? feeBreakdown.totalFees : openFeesPaid + closedFeesPaid;

  const tickerMap = new Map<string, EGXTicker>();
  tickers.forEach((ticker) => {
    const raw = ticker.ticker.trim().toUpperCase();
    const clean = raw.replace(/^EGX:/, '').replace(/\.CA$/, '');
    tickerMap.set(raw, ticker);
    tickerMap.set(clean, ticker);
  });

  let dayChangeEgp = 0;
  let winningPositionsCount = 0;
  let losingPositionsCount = 0;

  positions.forEach((position) => {
    const unrealized = calculatePositionUnrealizedPnl(position);
    if (position.currentPrice > 0) {
      if (unrealized > 0.01) winningPositionsCount++;
      else if (unrealized < -0.01) losingPositionsCount++;
    }

    const clean = position.ticker.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
    const quote = tickerMap.get(clean) || tickerMap.get(position.ticker.trim().toUpperCase());
    let perShareChange = 0;

    if (quote?.change !== undefined && Number.isFinite(quote.change)) {
      perShareChange = quote.change;
    } else if (quote?.changePercent !== undefined && quote.lastPrice > 0) {
      const previousClose = quote.lastPrice / (1 + quote.changePercent / 100);
      perShareChange = quote.lastPrice - previousClose;
    } else if (position.dayChange !== undefined && Number.isFinite(position.dayChange)) {
      perShareChange = position.dayChange;
    } else if (position.dayChangePercent !== undefined && position.currentPrice > 0) {
      const previousClose = position.currentPrice / (1 + position.dayChangePercent / 100);
      perShareChange = position.currentPrice - previousClose;
    }

    dayChangeEgp += position.shares * perShareChange;
  });

  // Day change is an equity/NAV change, so the prior-value denominator must
  // include cash as well as securities. This also remains correct when the
  // portfolio is mostly or entirely cash.
  const previousPortfolioValue = totalValue - dayChangeEgp;
  const dayChangePercent = previousPortfolioValue > 0
    ? (dayChangeEgp / previousPortfolioValue) * 100
    : 0;

  return {
    totalValue: Number(totalValue.toFixed(2)),
    totalMarketValue: Number(totalMarketValue.toFixed(2)),
    totalCost: Number(totalCost.toFixed(2)),
    totalCostWithFees: Number(totalCostWithFees.toFixed(2)),
    unrealizedPnlEgp: Number(unrealizedPnlEgp.toFixed(2)),
    unrealizedPnlPercent: totalCostWithFees > 0 ? Number(((unrealizedPnlEgp / totalCostWithFees) * 100).toFixed(2)) : 0,
    grossUnrealizedPnlEgp: Number(grossUnrealizedPnlEgp.toFixed(2)),
    grossUnrealizedPnlPercent: totalCost > 0 ? Number(((grossUnrealizedPnlEgp / totalCost) * 100).toFixed(2)) : 0,
    realizedPnlEgp: Number(totalRealizedPnl.toFixed(2)),
    cashBalance: Number(cashBalance.toFixed(2)),
    dayChangeEgp: Number(dayChangeEgp.toFixed(2)),
    dayChangePercent: Number(dayChangePercent.toFixed(2)),
    totalPositions: positions.length,
    winningPositionsCount,
    losingPositionsCount,
    totalFeesPaid: Number(totalFeesPaid.toFixed(2)),
    openFeesPaid: Number(openFeesPaid.toFixed(2)),
    closedFeesPaid: Number(closedFeesPaid.toFixed(2)),
  };
}

/**
 * Presentation adapter for performance statistics. Breakevens are excluded
 * from the win-rate denominator by the accounting engine.
 */
export function calculatePerformanceStats(
  closedTrades: ClosedTrade[],
  positions: Position[] = []
): PerformanceStats {
  const accounting = calculateAccountingPerformanceStats(closedTrades);
  const totalPositionValue = positions.reduce((sum, position) => sum + calculatePositionMarketValue(position), 0);
  const sectorMap: Record<string, { value: number; count: number }> = {};

  positions.forEach((position) => {
    const value = calculatePositionMarketValue(position);
    const sector = position.sector || 'Other';
    if (!sectorMap[sector]) sectorMap[sector] = { value: 0, count: 0 };
    sectorMap[sector].value += value;
    sectorMap[sector].count += 1;
  });

  const sectorAllocation = Object.entries(sectorMap)
    .map(([sector, data]) => ({
      sector: sector as Sector,
      value: Number(data.value.toFixed(2)),
      percentage: totalPositionValue > 0 ? Number(((data.value / totalPositionValue) * 100).toFixed(1)) : 0,
      count: data.count,
    }))
    .sort((a, b) => b.value - a.value);

  const bestTradePercent = closedTrades.length ? Math.max(...closedTrades.map(t => t.realizedPnlPercent || 0)) : 0;
  const worstTradePercent = closedTrades.length ? Math.min(...closedTrades.map(t => t.realizedPnlPercent || 0)) : 0;
  const totalBrokerageFeesPaid = closedTrades.reduce(
    (sum, trade) => sum + (trade.totalFees ?? ((trade.buyFees || 0) + (trade.sellFees || 0))),
    0,
  );

  return {
    winRate: accounting.winRate === null ? 0 : Number(accounting.winRate.toFixed(1)),
    profitFactor: accounting.profitFactor === null || !Number.isFinite(accounting.profitFactor)
      ? (accounting.profitFactor === Infinity ? Infinity : 0)
      : Number(accounting.profitFactor.toFixed(2)),
    totalTrades: accounting.totalTrades,
    winningTrades: accounting.winningTrades,
    losingTrades: accounting.losingTrades,
    avgReturnPercent: accounting.avgReturnPercent === null ? 0 : Number(accounting.avgReturnPercent.toFixed(2)),
    avgHoldDays: accounting.avgHoldDays === null ? 0 : Math.round(accounting.avgHoldDays),
    bestTradePercent: Number(bestTradePercent.toFixed(2)),
    worstTradePercent: Number(worstTradePercent.toFixed(2)),
    totalRealizedGainEgp: Number(accounting.grossProfit.toFixed(2)),
    totalRealizedLossEgp: Number(accounting.grossLoss.toFixed(2)),
    totalBrokerageFeesPaid: Number(totalBrokerageFeesPaid.toFixed(2)),
    sectorAllocation,
    // Historical mark-to-market drawdown requires historical valuation points.
    // The current ledger only guarantees realized trade history, so don't label
    // realized-P&L drawdown as portfolio equity drawdown.
    maxDrawdownEgp: 0,
    maxDrawdownPercent: 0,
    payoffRatio: accounting.payoffRatio === null ? 0 : Number(accounting.payoffRatio.toFixed(2)),
    expectancyEgp: accounting.expectancy === null ? 0 : Number(accounting.expectancy.toFixed(2)),
  };
}

/** Normalize legacy snake_case trade fields into the canonical trade shape. */
export function normalizeTransaction(tx: any): TradeTransaction {
  const tradeId = tx.tradeId !== undefined ? tx.tradeId : tx.trade_id !== undefined ? tx.trade_id : undefined;
  const price = typeof tx.price === 'number' ? tx.price : parseFloat(tx.price) || 0;
  const shares = typeof tx.shares === 'number' ? tx.shares : parseFloat(tx.shares) || 0;
  const fees = typeof tx.fees === 'number' ? tx.fees : parseFloat(tx.fees) || 0;
  const grossAmount = shares * price;
  const totalAmount = typeof tx.totalAmount === 'number'
    ? tx.totalAmount
    : tx.type === 'BUY' ? grossAmount + fees : grossAmount - fees;

  return {
    id: tx.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type: tx.type === 'SELL' ? 'SELL' : 'BUY',
    ticker: String(tx.ticker || '').trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, ''),
    companyName: tx.companyName || tx.company_name || tx.ticker || '',
    sector: tx.sector || 'Other',
    shares,
    price,
    date: tx.date || new Date().toISOString().split('T')[0],
    fees,
    totalAmount,
    tradeId,
    trade_id: tradeId,
    tradeCycle: tx.tradeCycle || tx.trade_cycle,
    cycleTag: tx.cycleTag || tx.cycle_tag,
    notes: tx.notes || '',
    targetPrice: tx.targetPrice ?? tx.target_price,
    stopLoss: tx.stopLoss ?? tx.stop_loss,
    realizedPnlEgp: tx.realizedPnlEgp ?? tx.realized_pnl_egp,
    realizedPnlPercent: tx.realizedPnlPercent ?? tx.realized_pnl_percent,
    outcome: tx.outcome,
    holdingDays: tx.holdingDays ?? tx.holding_days,
    positionId: tx.positionId || tx.position_id,
  };
}
