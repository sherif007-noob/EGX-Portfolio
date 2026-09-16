import { ClosedTrade, Position, TradeTransaction } from '../types';

export const ACCOUNTING_EPSILON = 0.000001;

export interface SellAccounting {
  grossProceeds: number;
  netProceeds: number;
  allocatedGrossCost: number;
  allocatedBuyFees: number;
  costBasisWithFees: number;
  realizedPnlEgp: number;
  realizedPnlPercent: number;
  outcome: 'WIN' | 'LOSS' | 'BREAKEVEN';
}

export function calculateBuyImpact(shares: number, price: number, fees = 0) {
  const grossCost = shares * price;
  return {
    grossCost,
    fees,
    cashOutflow: grossCost + fees,
  };
}

export function calculateSellAccounting(
  sharesToSell: number,
  sellPrice: number,
  sellFees: number,
  openShares: number,
  openGrossCost: number,
  openBuyFees: number,
): SellAccounting {
  if (sharesToSell <= 0) throw new Error('Sell shares must be greater than zero.');
  if (openShares <= 0) throw new Error('Cannot sell from an empty position.');
  if (sharesToSell > openShares + ACCOUNTING_EPSILON) {
    throw new Error(`Cannot sell ${sharesToSell} shares; only ${openShares} are open.`);
  }

  const ratio = sharesToSell / openShares;
  const grossProceeds = sharesToSell * sellPrice;
  const netProceeds = grossProceeds - sellFees;
  const allocatedGrossCost = openGrossCost * ratio;
  const allocatedBuyFees = openBuyFees * ratio;
  const costBasisWithFees = allocatedGrossCost + allocatedBuyFees;
  const realizedPnlEgp = netProceeds - costBasisWithFees;
  const realizedPnlPercent = costBasisWithFees > ACCOUNTING_EPSILON
    ? (realizedPnlEgp / costBasisWithFees) * 100
    : 0;
  const outcome = realizedPnlEgp > 0.01 ? 'WIN' : realizedPnlEgp < -0.01 ? 'LOSS' : 'BREAKEVEN';

  return {
    grossProceeds,
    netProceeds,
    allocatedGrossCost,
    allocatedBuyFees,
    costBasisWithFees,
    realizedPnlEgp,
    realizedPnlPercent,
    outcome,
  };
}

export function calculatePositionMarketValue(position: Position): number {
  return position.shares * Math.max(0, position.currentPrice || 0);
}

export function calculatePositionUnrealizedPnl(position: Position): number {
  const marketValue = calculatePositionMarketValue(position);
  const cost = position.shares * position.avgBuyPrice;
  return marketValue - cost - (position.totalFees || 0);
}

export function calculatePortfolioValue(cashBalance: number, positions: Position[]): number {
  return cashBalance + positions.reduce((sum, position) => sum + calculatePositionMarketValue(position), 0);
}

export function calculateTotalTradingPnl(realizedPnl: number, positions: Position[]): number {
  const unrealizedPnl = positions.reduce((sum, position) => sum + calculatePositionUnrealizedPnl(position), 0);
  return realizedPnl + unrealizedPnl;
}

export function calculateHoldingDays(buyDate: string, sellDate: string): number {
  const buy = new Date(buyDate).getTime();
  const sell = new Date(sellDate).getTime();
  if (!Number.isFinite(buy) || !Number.isFinite(sell)) return 0;
  return Math.max(0, Math.round((sell - buy) / 86400000));
}

export function calculatePerformanceStats(closedTrades: ClosedTrade[]) {
  const wins = closedTrades.filter(t => t.realizedPnlEgp > 0.01);
  const losses = closedTrades.filter(t => t.realizedPnlEgp < -0.01);
  const decisive = wins.length + losses.length;
  const grossProfit = wins.reduce((sum, t) => sum + t.realizedPnlEgp, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.realizedPnlEgp, 0));
  const profitFactor = grossLoss > ACCOUNTING_EPSILON ? grossProfit / grossLoss : grossProfit > ACCOUNTING_EPSILON ? Infinity : null;
  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const expectancy = decisive
    ? (wins.length / decisive) * avgWin - (losses.length / decisive) * avgLoss
    : null;

  return {
    totalTrades: closedTrades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    breakevenTrades: closedTrades.length - decisive,
    winRate: decisive ? (wins.length / decisive) * 100 : null,
    grossProfit,
    grossLoss,
    profitFactor,
    avgWin,
    avgLoss,
    payoffRatio: avgLoss > ACCOUNTING_EPSILON ? avgWin / avgLoss : avgWin > 0 ? Infinity : null,
    expectancy,
    avgReturnPercent: closedTrades.length
      ? closedTrades.reduce((sum, t) => sum + t.realizedPnlPercent, 0) / closedTrades.length
      : null,
    avgHoldDays: closedTrades.length
      ? closedTrades.reduce((sum, t) => sum + Math.max(0, t.holdingDays || 0), 0) / closedTrades.length
      : null,
  };
}

export function validateAccountingInvariants(
  transactions: TradeTransaction[],
  positions: Position[],
  closedTrades: ClosedTrade[],
  cashBalance: number,
) {
  const boughtShares = transactions.filter(t => t.type === 'BUY' && t.ticker !== 'CASH').reduce((s, t) => s + t.shares, 0);
  const soldShares = transactions.filter(t => t.type === 'SELL').reduce((s, t) => s + t.shares, 0);
  const openShares = positions.reduce((s, p) => s + p.shares, 0);
  const realized = closedTrades.reduce((s, t) => s + t.realizedPnlEgp, 0);
  const unrealized = positions.reduce((s, p) => s + calculatePositionUnrealizedPnl(p), 0);
  const portfolioValue = calculatePortfolioValue(cashBalance, positions);

  return {
    sharesBalanced: Math.abs(boughtShares - soldShares - openShares) < 0.01,
    tradingPnlFinite: Number.isFinite(realized + unrealized),
    portfolioValueFinite: Number.isFinite(portfolioValue),
  };
}
