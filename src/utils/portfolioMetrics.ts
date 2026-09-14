import { Position, ClosedTrade, TradeTransaction, EGXTicker, PortfolioMetrics, PerformanceStats, Sector } from '../types';

/**
 * Standardizes calculation of open position and overall portfolio metrics.
 */
export function calculatePortfolioMetrics(
  positions: Position[],
  cashBalance: number,
  closedTrades: ClosedTrade[] = [],
  tickers: EGXTicker[] = [],
  transactions: TradeTransaction[] = []
): PortfolioMetrics {
  let totalCost = 0;
  let totalEquitiesValue = 0;
  let dayChangeEgp = 0;
  let winningPositionsCount = 0;
  let losingPositionsCount = 0;
  let openFeesPaid = 0;

  // Build ticker map for quick quote lookup
  const tickerMap = new Map<string, EGXTicker>();
  tickers.forEach((t) => {
    const sym = t.ticker.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
    tickerMap.set(sym, t);
    tickerMap.set(t.ticker.trim().toUpperCase(), t);
  });

  positions.forEach((pos) => {
    const cost = pos.shares * pos.avgBuyPrice;
    
    // Fallback to avgBuyPrice if currentPrice is missing or 0 (cost-basis valuation)
    // to prevent artificial -100% loss from wiping out portfolio equity before quotes load
    const currentPrice = (pos.currentPrice && pos.currentPrice > 0)
      ? pos.currentPrice
      : (pos.avgBuyPrice > 0 ? pos.avgBuyPrice : 0);
    const mktVal = pos.shares * currentPrice;
    const entryFee = pos.totalFees || 0;
    openFeesPaid += entryFee;

    // Brokerage app Unrealized P&L accounts for entry fees:
    const netCost = cost + entryFee;
    const netPnl = currentPrice > 0 ? mktVal - netCost : 0;

    totalCost += cost;
    totalEquitiesValue += mktVal;

    if (pos.currentPrice && pos.currentPrice > 0) {
      if (netPnl > 0.01) {
        winningPositionsCount++;
      } else if (netPnl < -0.01) {
        losingPositionsCount++;
      }
    }

    // Calculate day change for position based on ticker day change in EGP
    const cleanSym = pos.ticker.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
    const quote = tickerMap.get(cleanSym) || tickerMap.get(pos.ticker.trim().toUpperCase());
    
    let posDayChangePerShare = 0;
    if (quote) {
      if (quote.change !== undefined && !isNaN(quote.change)) {
        posDayChangePerShare = quote.change;
      } else if (quote.changePercent !== undefined && quote.lastPrice > 0) {
        const prevClose = quote.lastPrice / (1 + quote.changePercent / 100);
        posDayChangePerShare = quote.lastPrice - prevClose;
      }
    } else if (pos.dayChange !== undefined && !isNaN(pos.dayChange)) {
      posDayChangePerShare = pos.dayChange;
    } else if (pos.dayChangePercent !== undefined && currentPrice > 0) {
      const prevClose = currentPrice / (1 + pos.dayChangePercent / 100);
      posDayChangePerShare = currentPrice - prevClose;
    }

    dayChangeEgp += pos.shares * posDayChangePerShare;
  });

  const totalCostWithFees = totalCost + openFeesPaid;
  // Net unrealized P&L matches the brokerage app (market value minus cost basis with entry fees)
  const unrealizedPnlEgp = totalEquitiesValue - totalCostWithFees;
  const unrealizedPnlPercent = totalCostWithFees > 0 ? (unrealizedPnlEgp / totalCostWithFees) * 100 : 0;

  // Gross price-only appreciation (excluding fees)
  const grossUnrealizedPnlEgp = totalEquitiesValue - totalCost;
  const grossUnrealizedPnlPercent = totalCost > 0 ? (grossUnrealizedPnlEgp / totalCost) * 100 : 0;

  const closedFeesPaid = closedTrades.reduce(
    (acc, ct) => acc + (ct.totalFees || (ct.buyFees || 0) + (ct.sellFees || 0)),
    0
  );

  // Total fees paid across all trades (open + closed / transactions)
  const totalFeesPaid = transactions && transactions.length > 0
    ? transactions.reduce((acc, tx) => acc + (tx.fees || 0), 0)
    : openFeesPaid + closedFeesPaid;

  const totalRealizedPnl = closedTrades.reduce((acc, ct) => acc + (ct.realizedPnlEgp || 0), 0);
  const totalValue = totalEquitiesValue + cashBalance;

  // Baseline to compute day change percentage matching brokerage app:
  // Return % on equities: dayChangeEgp / (totalEquitiesValue - dayChangeEgp)
  const prevEquitiesValue = totalEquitiesValue - dayChangeEgp;
  const prevPortfolioValue = totalValue - dayChangeEgp;
  const dayChangePercent = prevEquitiesValue > 0
    ? (dayChangeEgp / prevEquitiesValue) * 100
    : (prevPortfolioValue > 0 ? (dayChangeEgp / prevPortfolioValue) * 100 : 0);

  return {
    totalValue: Number(totalValue.toFixed(2)),
    totalMarketValue: Number(totalEquitiesValue.toFixed(2)),
    totalCost: Number(totalCost.toFixed(2)),
    totalCostWithFees: Number(totalCostWithFees.toFixed(2)),
    unrealizedPnlEgp: Number(unrealizedPnlEgp.toFixed(2)),
    unrealizedPnlPercent: Number(unrealizedPnlPercent.toFixed(2)),
    grossUnrealizedPnlEgp: Number(grossUnrealizedPnlEgp.toFixed(2)),
    grossUnrealizedPnlPercent: Number(grossUnrealizedPnlPercent.toFixed(2)),
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
 * Standardizes calculation of closed trade statistics and performance reports.
 */
export function calculatePerformanceStats(
  closedTrades: ClosedTrade[],
  positions: Position[] = []
): PerformanceStats {
  const totalTrades = closedTrades.length;
  if (totalTrades === 0) {
    // Generate sector allocation from open positions even if no closed trades exist yet
    const sectorMap: Record<string, { value: number; count: number }> = {};
    let totalPositionValue = 0;

    positions.forEach((pos) => {
      const currentPrice = pos.currentPrice || 0;
      const val = currentPrice > 0 ? pos.shares * currentPrice : 0;
      totalPositionValue += val;
      const sec = pos.sector || 'Other';
      if (!sectorMap[sec]) sectorMap[sec] = { value: 0, count: 0 };
      sectorMap[sec].value += val;
      sectorMap[sec].count += 1;
    });

    const sectorAllocation = Object.entries(sectorMap).map(([sector, data]) => ({
      sector: sector as Sector,
      value: Number(data.value.toFixed(2)),
      percentage: totalPositionValue > 0 ? Number(((data.value / totalPositionValue) * 100).toFixed(1)) : 0,
      count: data.count,
    })).sort((a, b) => b.value - a.value);

    return {
      winRate: 0,
      profitFactor: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      avgReturnPercent: 0,
      avgHoldDays: 0,
      bestTradePercent: 0,
      worstTradePercent: 0,
      totalRealizedGainEgp: 0,
      totalRealizedLossEgp: 0,
      totalBrokerageFeesPaid: 0,
      sectorAllocation,
      maxDrawdownPercent: 0,
      maxDrawdownEgp: 0,
      payoffRatio: 0,
      expectancyEgp: 0,
    };
  }

  let winningTrades = 0;
  let losingTrades = 0;
  let totalRealizedGainEgp = 0;
  let totalRealizedLossEgp = 0;
  let totalReturnPercent = 0;
  let totalHoldDays = 0;
  let bestTradePercent = -Infinity;
  let worstTradePercent = Infinity;
  let totalBrokerageFeesPaid = 0;

  closedTrades.forEach((ct) => {
    const pnl = ct.realizedPnlEgp || 0;
    const pct = ct.realizedPnlPercent || 0;
    const hold = ct.holdingDays || 1;
    const fees = ct.totalFees || (ct.buyFees || 0) + (ct.sellFees || 0);

    totalBrokerageFeesPaid += fees;
    totalReturnPercent += pct;
    totalHoldDays += hold;

    if (pct > bestTradePercent) bestTradePercent = pct;
    if (pct < worstTradePercent) worstTradePercent = pct;

    if (pnl > 0.01) {
      winningTrades++;
      totalRealizedGainEgp += pnl;
    } else if (pnl < -0.01) {
      losingTrades++;
      totalRealizedLossEgp += Math.abs(pnl);
    }
  });

  // Track equity curve chronologically (oldest to newest) to calculate maximum drawdown accurately
  let runningCumulativePnl = 0;
  let peakCumulativePnl = 0;
  let maxDrawdownEgp = 0;

  const chronologicalTrades = [...closedTrades].sort((a, b) => {
    const dateA = a.sellDate || a.buyDate || '';
    const dateB = b.sellDate || b.buyDate || '';
    return dateA.localeCompare(dateB);
  });

  chronologicalTrades.forEach((ct) => {
    const pnl = ct.realizedPnlEgp || 0;
    runningCumulativePnl += pnl;
    if (runningCumulativePnl > peakCumulativePnl) {
      peakCumulativePnl = runningCumulativePnl;
    }
    const currentDrawdown = peakCumulativePnl - runningCumulativePnl;
    if (currentDrawdown > maxDrawdownEgp) {
      maxDrawdownEgp = currentDrawdown;
    }
  });

  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const profitFactor = totalRealizedLossEgp > 0
    ? totalRealizedGainEgp / totalRealizedLossEgp
    : totalRealizedGainEgp > 0 ? 99.99 : 0;

  const avgReturnPercent = totalTrades > 0 ? totalReturnPercent / totalTrades : 0;
  const avgHoldDays = totalTrades > 0 ? Math.round(totalHoldDays / totalTrades) : 0;

  const avgWinEgp = winningTrades > 0 ? totalRealizedGainEgp / winningTrades : 0;
  const avgLossEgp = losingTrades > 0 ? totalRealizedLossEgp / losingTrades : 0;
  const payoffRatio = avgLossEgp > 0 ? avgWinEgp / avgLossEgp : avgWinEgp > 0 ? avgWinEgp : 0;

  const winProb = totalTrades > 0 ? winningTrades / totalTrades : 0;
  const lossProb = totalTrades > 0 ? losingTrades / totalTrades : 0;
  const expectancyEgp = (winProb * avgWinEgp) - (lossProb * avgLossEgp);

  // Sector allocation calculation combining open and closed exposure
  const sectorMap: Record<string, { value: number; count: number }> = {};
  let totalPositionValue = 0;

  positions.forEach((pos) => {
    const currentPrice = (pos.currentPrice && pos.currentPrice > 0)
      ? pos.currentPrice
      : (pos.avgBuyPrice > 0 ? pos.avgBuyPrice : 0);
    const val = currentPrice > 0 ? pos.shares * currentPrice : 0;
    totalPositionValue += val;
    const sec = pos.sector || 'Other';
    if (!sectorMap[sec]) sectorMap[sec] = { value: 0, count: 0 };
    sectorMap[sec].value += val;
    sectorMap[sec].count += 1;
  });

  const sectorAllocation = Object.entries(sectorMap).map(([sector, data]) => ({
    sector: sector as Sector,
    value: Number(data.value.toFixed(2)),
    percentage: totalPositionValue > 0 ? Number(((data.value / totalPositionValue) * 100).toFixed(1)) : 0,
    count: data.count,
  })).sort((a, b) => b.value - a.value);

  const baselineEquity = totalPositionValue;
  const maxDrawdownPercent = (baselineEquity + peakCumulativePnl) > 0
    ? (maxDrawdownEgp / (baselineEquity + peakCumulativePnl)) * 100
    : 0;

  return {
    winRate: Number(winRate.toFixed(1)),
    profitFactor: Number(profitFactor.toFixed(2)),
    totalTrades,
    winningTrades,
    losingTrades,
    avgReturnPercent: Number(avgReturnPercent.toFixed(2)),
    avgHoldDays,
    bestTradePercent: bestTradePercent === -Infinity ? 0 : Number(bestTradePercent.toFixed(2)),
    worstTradePercent: worstTradePercent === Infinity ? 0 : Number(worstTradePercent.toFixed(2)),
    totalRealizedGainEgp: Number(totalRealizedGainEgp.toFixed(2)),
    totalRealizedLossEgp: Number(totalRealizedLossEgp.toFixed(2)),
    totalBrokerageFeesPaid: Number(totalBrokerageFeesPaid.toFixed(2)),
    sectorAllocation,
    maxDrawdownEgp: Number(maxDrawdownEgp.toFixed(2)),
    maxDrawdownPercent: Number(maxDrawdownPercent.toFixed(2)),
    payoffRatio: Number(payoffRatio.toFixed(2)),
    expectancyEgp: Number(expectancyEgp.toFixed(2)),
  };
}

/**
 * Normalizes any legacy snake_case trade transaction into standard camelCase.
 */
export function normalizeTransaction(tx: any): TradeTransaction {
  const tradeId = tx.tradeId !== undefined ? tx.tradeId : tx.trade_id !== undefined ? tx.trade_id : undefined;
  const price = typeof tx.price === 'number' ? tx.price : parseFloat(tx.price) || 0;
  const shares = typeof tx.shares === 'number' ? tx.shares : parseInt(tx.shares, 10) || 0;
  const fees = typeof tx.fees === 'number' ? tx.fees : parseFloat(tx.fees) || 0;

  const grossAmount = shares * price;
  const defaultTotal = tx.type === 'BUY' ? grossAmount + fees : Math.max(0, grossAmount - fees);
  const totalAmount = typeof tx.totalAmount === 'number' ? tx.totalAmount : defaultTotal;

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
    targetPrice: tx.targetPrice || tx.target_price,
    stopLoss: tx.stopLoss || tx.stop_loss,
    realizedPnlEgp: tx.realizedPnlEgp !== undefined ? tx.realizedPnlEgp : tx.realized_pnl_egp,
    realizedPnlPercent: tx.realizedPnlPercent !== undefined ? tx.realizedPnlPercent : tx.realized_pnl_percent,
    outcome: tx.outcome,
    holdingDays: tx.holdingDays !== undefined ? tx.holdingDays : tx.holding_days,
    positionId: tx.positionId || tx.position_id,
  };
}
