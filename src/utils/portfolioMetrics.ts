import { Position, ClosedTrade, TradeTransaction, EGXTicker, PortfolioMetrics, PerformanceStats, Sector, CashFlowType } from '../types';
import { calculatePortfolioValue, calculatePositionMarketValue, calculatePositionUnrealizedPnl, calculatePerformanceStats as calculateAccountingPerformanceStats, calculateFeeBreakdown } from '../services/portfolioAccounting';
import { cashFlowSignedImpact, isCapitalCashFlowType, isReconciliationCashFlowType, normalizeCashFlowType } from '../services/cashFlowSemantics';
import { getLatestEgxSessionDate } from '../services/analyticsTimeframes';
import { sessionChangePercent } from '../services/sessionReturnPresentation';
import { normalizeCorporateActionType } from '../services/corporateActions';
import {
  normalizeIpoSubscriptionMetadata,
  pendingIpoSubscriptionValue,
  ipoHeldAmount,
} from '../services/ipoSubscriptions';


function normalizeTickerKey(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
}

export function getLatestEgxTradingSessionDate(now = new Date()): string {
  return getLatestEgxSessionDate(now);
}

function quotePreviousClose(quote: EGXTicker | undefined): number | undefined {
  if (!quote || !Number.isFinite(quote.lastPrice) || quote.lastPrice <= 0) return undefined;
  if (Number.isFinite(quote.change)) {
    const previous = quote.lastPrice - quote.change;
    if (previous > 0) return previous;
  }
  if (Number.isFinite(quote.changePercent) && Math.abs(1 + quote.changePercent / 100) > 1e-9) {
    const previous = quote.lastPrice / (1 + quote.changePercent / 100);
    if (Number.isFinite(previous) && previous > 0) return previous;
  }
  return undefined;
}

/** Fallback for held tickers missing from the live registry quote directory.
 * These are price deltas from the stored latest session, not new-day changes.
 */
function heldPositionPreviousClose(position: Position | undefined): number | undefined {
  if (!position || !Number.isFinite(position.currentPrice) || position.currentPrice <= 0) return undefined;
  if (Number.isFinite(position.dayChange)) {
    const previous=position.currentPrice-(position.dayChange ?? 0);
    if (previous>0) return previous;
  }
  if (Number.isFinite(position.dayChangePercent)) {
    const previous=position.currentPrice/(1+(position.dayChangePercent??0)/100);
    if (Number.isFinite(previous)&&previous>0)return previous;
  }
  return undefined;
}

/** Presentation adapter around the authoritative accounting engine. */
export function calculatePortfolioMetrics(positions: Position[], cashBalance: number, closedTrades: ClosedTrade[] = [], tickers: EGXTicker[] = [], transactions: TradeTransaction[] = []): PortfolioMetrics {
  const totalMarketValue = positions.reduce((sum, position) => sum + calculatePositionMarketValue(position), 0);
  const totalCost = positions.reduce((sum, position) => sum + position.shares * position.avgBuyPrice, 0);
  const openFeesPaid = positions.reduce((sum, position) => sum + (position.totalFees || 0), 0);
  const totalCostWithFees = totalCost + openFeesPaid;
  const unrealizedPnlEgp = positions.reduce((sum, position) => sum + calculatePositionUnrealizedPnl(position), 0);
  const grossUnrealizedPnlEgp = totalMarketValue - totalCost;
  const totalRealizedPnl = closedTrades.reduce((sum, trade) => sum + (trade.realizedPnlEgp || 0), 0);
  const pendingIpoSubscriptionsEgp = pendingIpoSubscriptionValue(transactions);
  const totalValue = calculatePortfolioValue(cashBalance, positions) + pendingIpoSubscriptionsEgp;
  const feeBreakdown = calculateFeeBreakdown(transactions);
  const closedFeesPaid = closedTrades.reduce((sum, trade) => sum + (trade.totalFees ?? ((trade.buyFees || 0) + (trade.sellFees || 0))), 0);
  const totalFeesPaid = transactions.length > 0 ? feeBreakdown.totalFees : openFeesPaid + closedFeesPaid;
  const tickerMap = new Map<string, EGXTicker>();
  tickers.forEach((ticker) => {
    const raw = ticker.ticker.trim().toUpperCase();
    const clean = normalizeTickerKey(raw);
    tickerMap.set(raw, ticker);
    tickerMap.set(clean, ticker);
  });

  let winningPositionsCount = 0;
  let losingPositionsCount = 0;
  positions.forEach((position) => {
    const unrealized = calculatePositionUnrealizedPnl(position);
    if (position.currentPrice > 0) {
      if (unrealized > 0.01) winningPositionsCount++;
      else if (unrealized < -0.01) losingPositionsCount++;
    }
  });

  // Reconstruct the portfolio at the start of the latest EGX session. This makes
  // "Today" transaction-aware: intraday round trips affect today's P&L and shares
  // bought during the session are measured from their actual execution cash cost,
  // not as if they were already owned at yesterday's close.
  const sessionDate = getLatestEgxTradingSessionDate();
  const startShares = new Map<string, number>();
  const livePositionMap = new Map<string,Position>();
  positions.forEach((position)=>{
    const key=normalizeTickerKey(position.ticker);
    startShares.set(key,position.shares);
    livePositionMap.set(key,position);
  });
  let startCash = cashBalance;
  // Submitted IPO cash is still a portfolio asset, not a trading return.
  // Reconstruct its opening balance independently from available cash.
  let startPendingIpoAsset = pendingIpoSubscriptionsEgp;
  let externalNetFlow = 0;

  const sessionTransactions = transactions.filter((tx) => String(tx.date || '').slice(0, 10) === sessionDate);
  for (const tx of [...sessionTransactions].reverse()) {
    const ticker = normalizeTickerKey(tx.ticker);
    const kind = normalizeCashFlowType(tx.cashFlowType);
    const amount = Number(tx.cashFlowAmount ?? tx.totalAmount ?? 0);

    if (ticker === 'CASH') {
      if (kind) {
        const impact = cashFlowSignedImpact(kind, amount);
        if (impact === null) continue;
        startCash -= impact;
        if (isCapitalCashFlowType(kind) || isReconciliationCashFlowType(kind)) {
          externalNetFlow += impact;
        }
      } else {
        const legacyAmount = Math.abs(amount);
        if (!Number.isFinite(legacyAmount)) continue;
        const impact = tx.type === 'BUY' ? legacyAmount : -legacyAmount;
        startCash -= impact;
        externalNetFlow += impact;
      }
      continue;
    }

    if (tx.type === 'CORPORATE_ACTION') {
      // Corporate actions are effective before the trading session begins.
      // Current positions already include them, so the session opening state
      // must keep the adjusted share count and apply no cash reversal.
      continue;
    }

    if (tx.type === 'IPO_SUBSCRIPTION') {
      const ipo = tx.ipoSubscription;
      if (ipo?.status === 'SUBMITTED') {
        // Reverse the reservation from available cash. The pending IPO asset is
        // equal in value, so submission itself is return-neutral.
        startCash += ipoHeldAmount(ipo);
        startPendingIpoAsset -= ipoHeldAmount(ipo);
      } else if (ipo?.status === 'ALLOCATED') {
        startCash += Number(tx.totalAmount || 0);
        startShares.set(ticker, (startShares.get(ticker) || 0) - Number(ipo.allocatedShares ?? tx.shares ?? 0));
      }
      continue;
    }

    if (tx.type === 'BUY') {
      startCash += Number(tx.totalAmount || tx.shares * tx.price + (tx.fees || 0));
      startShares.set(ticker, (startShares.get(ticker) || 0) - tx.shares);
    } else if (tx.type === 'SELL') {
      startCash -= Number(tx.totalAmount || tx.shares * tx.price - (tx.fees || 0));
      startShares.set(ticker, (startShares.get(ticker) || 0) + tx.shares);
    }
  }

  let startMarketValue = 0;
  let sessionReconstructionComplete = true;
  for (const [ticker, shares] of startShares) {
    if (shares <= 0.000001) continue;
    const previousClose = quotePreviousClose(tickerMap.get(ticker)) ?? heldPositionPreviousClose(livePositionMap.get(ticker));
    if (previousClose === undefined) {
      sessionReconstructionComplete = false;
      break;
    }
    startMarketValue += shares * previousClose;
  }

  let dayChangeEgp: number;
  if (sessionReconstructionComplete) {
    const startEquity = startCash + startMarketValue + startPendingIpoAsset;
    dayChangeEgp = totalValue - startEquity - externalNetFlow;
  } else {
    // Explicitly mark this fallback unreliable: static holdings × quote deltas
    // omit round trips, fees and positions fully sold during the session.
    // Keep the existing number for legacy data consumers but never label it
    // as broker-comparable Today P&L in the new UI.
    dayChangeEgp = positions.reduce((sum, position) => {
      const clean = normalizeTickerKey(position.ticker);
      const quote = tickerMap.get(clean);
      let perShareChange = 0;
      if (quote?.change !== undefined && Number.isFinite(quote.change)) perShareChange = quote.change;
      else if (quote?.changePercent !== undefined && quote.lastPrice > 0) {
        const previousClose = quote.lastPrice / (1 + quote.changePercent / 100);
        perShareChange = quote.lastPrice - previousClose;
      } else if (position.dayChange !== undefined && Number.isFinite(position.dayChange)) perShareChange = position.dayChange;
      else if (position.dayChangePercent !== undefined && position.currentPrice > 0) {
        const previousClose = position.currentPrice / (1 + position.dayChangePercent / 100);
        perShareChange = position.currentPrice - previousClose;
      }
      return sum + position.shares * perShareChange;
    }, 0);
  }

  const dayChangePercent = sessionChangePercent(dayChangeEgp, totalValue) ?? 0;
  return { totalValue: Number(totalValue.toFixed(2)), totalMarketValue: Number(totalMarketValue.toFixed(2)), totalCost: Number(totalCost.toFixed(2)), totalCostWithFees: Number(totalCostWithFees.toFixed(2)), unrealizedPnlEgp: Number(unrealizedPnlEgp.toFixed(2)), unrealizedPnlPercent: totalCostWithFees > 0 ? Number(((unrealizedPnlEgp / totalCostWithFees) * 100).toFixed(2)) : 0, grossUnrealizedPnlEgp: Number(grossUnrealizedPnlEgp.toFixed(2)), grossUnrealizedPnlPercent: totalCost > 0 ? Number(((grossUnrealizedPnlEgp / totalCost) * 100).toFixed(2)) : 0, realizedPnlEgp: Number(totalRealizedPnl.toFixed(2)), cashBalance: Number(cashBalance.toFixed(2)), dayChangeEgp: Number(dayChangeEgp.toFixed(2)), dayChangePercent: Number(dayChangePercent.toFixed(2)), dayChangeReliable: sessionReconstructionComplete, totalPositions: positions.length, winningPositionsCount, losingPositionsCount, totalFeesPaid: Number(totalFeesPaid.toFixed(2)), openFeesPaid: Number(openFeesPaid.toFixed(2)), closedFeesPaid: Number(closedFeesPaid.toFixed(2)), pendingIpoSubscriptionsEgp: Number(pendingIpoSubscriptionsEgp.toFixed(2)) };
}

export function calculatePerformanceStats(closedTrades: ClosedTrade[], positions: Position[] = []): PerformanceStats {
  const accounting = calculateAccountingPerformanceStats(closedTrades);
  const totalPositionValue = positions.reduce((sum, position) => sum + calculatePositionMarketValue(position), 0);
  const sectorMap: Record<string, { value: number; count: number }> = {};
  positions.forEach((position) => { const value = calculatePositionMarketValue(position); const sector = position.sector || 'Other'; if (!sectorMap[sector]) sectorMap[sector] = { value: 0, count: 0 }; sectorMap[sector].value += value; sectorMap[sector].count += 1; });
  const sectorAllocation = Object.entries(sectorMap).map(([sector, data]) => ({ sector: sector as Sector, value: Number(data.value.toFixed(2)), percentage: totalPositionValue > 0 ? Number(((data.value / totalPositionValue) * 100).toFixed(1)) : 0, count: data.count })).sort((a, b) => b.value - a.value);
  const bestTradePercent = closedTrades.length ? Math.max(...closedTrades.map(t => t.realizedPnlPercent || 0)) : 0;
  const worstTradePercent = closedTrades.length ? Math.min(...closedTrades.map(t => t.realizedPnlPercent || 0)) : 0;
  const totalBrokerageFeesPaid = closedTrades.reduce((sum, trade) => sum + (trade.totalFees ?? ((trade.buyFees || 0) + (trade.sellFees || 0))), 0);
  return { winRate: accounting.winRate === null ? 0 : Number(accounting.winRate.toFixed(1)), profitFactor: accounting.profitFactor === null || !Number.isFinite(accounting.profitFactor) ? (accounting.profitFactor === Infinity ? Infinity : 0) : Number(accounting.profitFactor.toFixed(2)), totalTrades: accounting.totalTrades, winningTrades: accounting.winningTrades, losingTrades: accounting.losingTrades, avgReturnPercent: accounting.avgReturnPercent === null ? 0 : Number(accounting.avgReturnPercent.toFixed(2)), avgHoldDays: accounting.avgHoldDays === null ? 0 : Math.round(accounting.avgHoldDays), bestTradePercent: Number(bestTradePercent.toFixed(2)), worstTradePercent: Number(worstTradePercent.toFixed(2)), totalRealizedGainEgp: Number(accounting.grossProfit.toFixed(2)), totalRealizedLossEgp: Number(accounting.grossLoss.toFixed(2)), totalBrokerageFeesPaid: Number(totalBrokerageFeesPaid.toFixed(2)), sectorAllocation, payoffRatio: accounting.payoffRatio === null ? 0 : Number(accounting.payoffRatio.toFixed(2)), expectancyEgp: accounting.expectancy === null ? 0 : Number(accounting.expectancy.toFixed(2)) };
}

export function normalizeTransaction(tx: any): TradeTransaction {
  const rawType = String(tx?.type || '').trim().toUpperCase();
  const rawCashFlowType = String(tx?.cashFlowType || tx?.cash_flow_type || '').trim().toUpperCase();
  const direction = String(tx?.direction || '').trim().toUpperCase();
  const explicitCashFlowType = normalizeCashFlowType(rawCashFlowType);
  const inferredCashFlowType: CashFlowType | undefined = explicitCashFlowType
    || normalizeCashFlowType(rawType)
    || (rawType === 'CASH' && direction === 'IN' ? 'DEPOSIT' : undefined)
    || (rawType === 'CASH' && direction === 'OUT' ? 'WITHDRAWAL' : undefined);
  const isCash = rawType === 'CASH' || !!inferredCashFlowType;
  const isTrade = rawType === 'BUY' || rawType === 'SELL';
  const isCorporateAction = rawType === 'CORPORATE_ACTION';
  const isIpoSubscription = rawType === 'IPO_SUBSCRIPTION';
  const isOpeningPosition = rawType === 'OPENING_POSITION';
  if (!isTrade && !isCash && !isCorporateAction && !isIpoSubscription && !isOpeningPosition) {
    throw new Error(`Unsupported transaction type: ${rawType || 'EMPTY'}`);
  }
  const tradeId = tx.tradeId !== undefined ? tx.tradeId : tx.trade_id !== undefined ? tx.trade_id : undefined;
  const price = typeof tx.price === 'number' ? tx.price : parseFloat(tx.price) || 0;
  const shares = typeof tx.shares === 'number' ? tx.shares : parseFloat(tx.shares) || 0;
  const fees = typeof tx.fees === 'number' ? tx.fees : parseFloat(tx.fees) || 0;
  const explicitAmount = typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount);
  const grossAmount = shares * price;
  const rawCashAmount = Number(tx.cashFlowAmount ?? tx.cash_flow_amount);
  const cashAmountForDirection = Number.isFinite(rawCashAmount)
    ? rawCashAmount
    : Number.isFinite(explicitAmount)
      ? explicitAmount
      : Number(tx.totalAmount ?? tx.total_amount ?? grossAmount);
  const cashImpactForDirection = inferredCashFlowType
    ? cashFlowSignedImpact(inferredCashFlowType, cashAmountForDirection)
    : null;
  const normalizedType = isCorporateAction
    ? 'CORPORATE_ACTION'
    : isIpoSubscription
      ? 'IPO_SUBSCRIPTION'
    : isOpeningPosition
      ? 'OPENING_POSITION'
    : isCash
      ? (cashImpactForDirection ?? (rawType === 'SELL' ? -1 : 1)) < 0 ? 'SELL' : 'BUY'
      : rawType;
  const normalizedTicker = isCash ? 'CASH' : String(tx.ticker || '').trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
  const normalizedShares = isCash && Number.isFinite(explicitAmount) ? Math.abs(explicitAmount) : shares;
  const ipoSubscription = isIpoSubscription
    ? normalizeIpoSubscriptionMetadata(tx.ipoSubscription ?? tx.ipo_subscription)
    : undefined;
  const normalizedPrice = isCorporateAction
    ? 0
    : isCash
      ? 1
      : isIpoSubscription
        ? Number(ipoSubscription?.offerPrice ?? price)
        : price;
  const totalAmount = isCorporateAction || isOpeningPosition
    ? 0
    : isCash
      ? Math.abs(Number.isFinite(explicitAmount) ? explicitAmount : (tx.totalAmount ?? tx.total_amount ?? grossAmount))
      : isIpoSubscription
        ? Number(tx.totalAmount ?? tx.total_amount ?? ipoSubscription?.requestedAmount ?? grossAmount)
      : typeof tx.totalAmount === 'number'
        ? tx.totalAmount
        : rawType === 'BUY'
          ? grossAmount + fees
          : grossAmount - fees;
  const cashFlowAmount = inferredCashFlowType === 'RECONCILIATION_ADJUSTMENT'
    ? Number.isFinite(rawCashAmount)
      ? rawCashAmount
      : Number.isFinite(explicitAmount)
        ? explicitAmount
        : normalizedType === 'SELL'
          ? -totalAmount
          : totalAmount
    : isCash
      ? totalAmount
      : undefined;
  const corporateActionType = isCorporateAction
    ? normalizeCorporateActionType(tx.corporateActionType ?? tx.corporate_action_type)
    : undefined;
  const rawCorporateRatio = Number(tx.corporateActionRatio ?? tx.corporate_action_ratio);
  const rawCorporateSourceShares = Number(tx.corporateActionSourceShares ?? tx.corporate_action_source_shares);
  return { id: tx.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, type: normalizedType as TradeTransaction['type'], ticker: normalizedTicker, companyName: isCash ? 'Cash Balance' : (tx.companyName || tx.company_name || tx.ticker || ''), sector: isCash ? 'Liquid Buying Power' : (tx.sector || 'Other'), shares: normalizedShares, price: normalizedPrice, date: tx.date || tx.transactionDate || tx.transaction_date || new Date().toISOString().split('T')[0], executedAt:
    typeof tx.executedAt === 'string' && tx.executedAt.trim()
      ? tx.executedAt
      : typeof tx.executed_at === 'string' && tx.executed_at.trim()
        ? tx.executed_at
        : undefined, fees: isCorporateAction ? 0 : fees, totalAmount, cashFlowType: isCorporateAction || isIpoSubscription || isOpeningPosition ? undefined : inferredCashFlowType, cashFlowAmount: isCorporateAction || isIpoSubscription || isOpeningPosition ? undefined : cashFlowAmount, corporateActionType, corporateActionRatio: Number.isFinite(rawCorporateRatio) ? rawCorporateRatio : undefined, corporateActionSourceShares: Number.isFinite(rawCorporateSourceShares) ? rawCorporateSourceShares : undefined, corporateActionReference: tx.corporateActionReference ?? tx.corporate_action_reference ?? undefined, ipoSubscription, isDCA: isCorporateAction || isOpeningPosition ? false : (tx.isDCA ?? tx.isDca ?? tx.is_dca), notes: tx.notes || '', targetPrice: tx.targetPrice ?? tx.target_price, stopLoss: tx.stopLoss ?? tx.stop_loss, tradeId, trade_id: tradeId, tradeCycle: tx.tradeCycle || tx.trade_cycle, cycleTag: tx.cycleTag || tx.cycle_tag, runningShares: tx.runningShares ?? tx.running_shares, grossTradeValue: tx.grossTradeValue ?? tx.gross_trade_value, netCashImpact: tx.netCashImpact ?? tx.net_cash_impact, realizedPnlEgp: tx.realizedPnlEgp ?? tx.realized_pnl_egp, realizedPnlPercent: tx.realizedPnlPercent ?? tx.realized_pnl_percent, outcome: tx.outcome, holdingDays: tx.holdingDays ?? tx.holding_days, positionId: tx.positionId || tx.position_id };
}