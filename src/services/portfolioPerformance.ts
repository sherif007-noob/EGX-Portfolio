import { ClosedTrade, Position } from '../types';
import {
  ACCOUNTING_EPSILON,
  calculatePortfolioValue,
  calculatePositionUnrealizedPnl,
} from './portfolioAccounting';

export interface EquityBridge {
  netCapitalContributed: number;
  realizedPnl: number;
  unrealizedPnl: number;
  endingEquity: number;
  reconciliationDelta: number;
}

/**
 * Builds the fundamental portfolio equity equation:
 *
 * ending equity = net capital contributed + realized P&L + unrealized P&L
 *
 * Trading fees are already embedded in realized/unrealized P&L, so they must
 * not be subtracted a second time in this bridge.
 */
export function calculateEquityBridge(
  netCapitalContributed: number,
  closedTrades: ClosedTrade[],
  positions: Position[],
  cashBalance: number,
): EquityBridge {
  const capital = Number.isFinite(netCapitalContributed) ? netCapitalContributed : 0;
  const realizedPnl = closedTrades.reduce((sum, trade) => sum + (Number.isFinite(trade.realizedPnlEgp) ? trade.realizedPnlEgp : 0), 0);
  const unrealizedPnl = positions.reduce((sum, position) => sum + calculatePositionUnrealizedPnl(position), 0);
  const endingEquity = calculatePortfolioValue(cashBalance, positions);
  const expectedEquity = capital + realizedPnl + unrealizedPnl;

  return {
    netCapitalContributed: capital,
    realizedPnl,
    unrealizedPnl,
    endingEquity,
    reconciliationDelta: endingEquity - expectedEquity,
  };
}

export function isEquityBridgeBalanced(bridge: EquityBridge, tolerance = 0.01): boolean {
  return Number.isFinite(bridge.reconciliationDelta)
    && Math.abs(bridge.reconciliationDelta) <= Math.max(tolerance, ACCOUNTING_EPSILON);
}

export interface DrawdownPoint {
  equity: number;
}

export interface DrawdownResult {
  maxDrawdownEgp: number;
  maxDrawdownPercent: number;
  peakEquity: number;
  troughEquity: number;
}

/**
 * Calculates peak-to-trough drawdown from an equity curve. The input must be
 * chronological. No drawdown is inferred from realized P&L alone.
 */
export function calculateMaxDrawdown(points: DrawdownPoint[]): DrawdownResult {
  let peak = Number.NEGATIVE_INFINITY;
  let maxDrawdownEgp = 0;
  let maxDrawdownPercent = 0;
  let peakEquity = 0;
  let troughEquity = 0;

  for (const point of points) {
    if (!Number.isFinite(point.equity)) continue;

    if (point.equity > peak) {
      peak = point.equity;
    }

    if (!Number.isFinite(peak) || peak <= ACCOUNTING_EPSILON) continue;

    const drawdownEgp = Math.max(0, peak - point.equity);
    const drawdownPercent = (drawdownEgp / peak) * 100;

    if (drawdownEgp > maxDrawdownEgp) {
      maxDrawdownEgp = drawdownEgp;
      maxDrawdownPercent = drawdownPercent;
      peakEquity = peak;
      troughEquity = point.equity;
    }
  }

  return { maxDrawdownEgp, maxDrawdownPercent, peakEquity, troughEquity };
}
