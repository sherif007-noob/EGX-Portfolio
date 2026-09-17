import { Position, ClosedTrade, TradeTransaction, EGXTicker, Sector } from '../types';
import { INITIAL_CAPITAL_DEPOSITS } from '../data/initialPortfolio';
import { normalizeTransaction } from '../utils/portfolioMetrics';
import { calculateBuyImpact, calculateHoldingDays, calculateSellAccounting } from './portfolioAccounting';

export interface ReconciliationReport {
  reconciledPositions: Position[];
  reconciledClosedTrades: ClosedTrade[];
  reconciledCashBalance: number;
  transactionsProcessed: number;
  discrepanciesFound: string[];
}

const EPSILON = 0.0001;

interface BuyLot {
  id: string;
  shares: number;
  price: number;
  date: string;
  fees: number;
  companyName: string;
  sector: Sector;
  targetPrice?: number;
  stopLoss?: number;
  notes?: string;
}

interface ActiveCycle {
  id: string;
  ticker: string;
  companyName: string;
  sector: Sector;
  shares: number;
  totalCostBasis: number;
  totalGrossProceeds: number;
  buyDate: string;
  sellDate: string;
  buyFees: number;
  sellFees: number;
  totalFees: number;
  realizedPnlEgp: number;
  notes: string[];
  cycleTags: string[];
  buyTransactionIds: string[];
  sellTransactionIds: string[];
}

function transactionTime(tx: TradeTransaction): number {
  if (tx.executedAt) {
    const executed = new Date(tx.executedAt).getTime();
    if (Number.isFinite(executed)) return executed;
  }
  const date = new Date(tx.date).getTime();
  return Number.isFinite(date) ? date : Number.POSITIVE_INFINITY;
}

export function sortTransactions(transactions: TradeTransaction[]): TradeTransaction[] {
  return transactions.map(normalizeTransaction).sort((a, b) => {
    const timeA = transactionTime(a);
    const timeB = transactionTime(b);
    if (timeA !== timeB) return timeA - timeB;
    const tradeA = Number(a.tradeId);
    const tradeB = Number(b.tradeId);
    if (Number.isFinite(tradeA) && Number.isFinite(tradeB) && tradeA !== tradeB) return tradeA - tradeB;
    if (a.type === 'BUY' && b.type === 'SELL') return -1;
    if (a.type === 'SELL' && b.type === 'BUY') return 1;
    return a.id.localeCompare(b.id);
  });
}

function cashFlowKind(tx: TradeTransaction): string | undefined {
  return typeof tx.cashFlowType === 'string' ? tx.cashFlowType.trim().toUpperCase() : undefined;
}

/**
 * Ledger-first accounting engine.
 *
 * The transaction ledger is authoritative. Positions, closed cycles and cash
 * are deterministic projections rebuilt from the ledger on every reconciliation.
 * Persisted derived state is only used for stable position IDs and quote fallback.
 */
export function reconcilePortfolioFromLedger(
  transactions: TradeTransaction[],
  tickers: EGXTicker[],
  totalCapitalDeposited: number = INITIAL_CAPITAL_DEPOSITS,
  existingPositions: Position[] = [],
): ReconciliationReport {
  const discrepancies: string[] = [];
  const chronologicalTxs = Array.isArray(transactions) ? sortTransactions(transactions) : [];
  const openingCapital = Number.isFinite(totalCapitalDeposited) && totalCapitalDeposited >= 0 ? totalCapitalDeposited : 0;

  // Explicit contributed-capital events replace the legacy implicit opening-capital
  // model. Dividends, fees, and CASH_ADJUSTMENT modify cash without redefining
  // contributed capital, so they must preserve the opening-capital baseline.
  const hasExternalCashFlow = chronologicalTxs.some((tx) => {
    const kind = cashFlowKind(tx);
    const ticker = tx.ticker.trim().toUpperCase();
    if (kind === 'DEPOSIT' || kind === 'WITHDRAWAL') return true;
    return ticker === 'CASH' && !kind && (tx.type === 'BUY' || tx.type === 'SELL');
  });

  let runningCash = hasExternalCashFlow ? 0 : openingCapital;

  if (chronologicalTxs.length === 0) {
    return {
      reconciledPositions: [],
      reconciledClosedTrades: [],
      reconciledCashBalance: Number(runningCash.toFixed(2)),
      transactionsProcessed: 0,
      discrepanciesFound: [],
    };
  }

  const activeCyclesByTicker: Record<string, ActiveCycle> = {};
  const openLotsByTicker: Record<string, BuyLot[]> = {};
  const closedTrades: ClosedTrade[] = [];

  const finalizeCycle = (cycle: ActiveCycle) => {
    const costBasisWithFees = cycle.totalCostBasis + cycle.buyFees;
    const pnl = cycle.realizedPnlEgp;
    const pnlPercent = costBasisWithFees > EPSILON ? (pnl / costBasisWithFees) * 100 : 0;
    const outcome = pnl > 0.01 ? 'WIN' : pnl < -0.01 ? 'LOSS' : 'BREAKEVEN';

    closedTrades.push({
      id: cycle.id,
      ticker: cycle.ticker,
      companyName: cycle.companyName,
      sector: cycle.sector,
      shares: cycle.shares,
      buyPrice: cycle.shares > 0 ? Number((cycle.totalCostBasis / cycle.shares).toFixed(4)) : 0,
      sellPrice: cycle.shares > 0 ? Number((cycle.totalGrossProceeds / cycle.shares).toFixed(4)) : 0,
      buyDate: cycle.buyDate,
      sellDate: cycle.sellDate,
      holdingDays: calculateHoldingDays(cycle.buyDate, cycle.sellDate),
      buyFees: Number(cycle.buyFees.toFixed(2)),
      sellFees: Number(cycle.sellFees.toFixed(2)),
      totalFees: Number(cycle.totalFees.toFixed(2)),
      realizedPnlEgp: Number(pnl.toFixed(2)),
      realizedPnlPercent: Number(pnlPercent.toFixed(2)),
      outcome,
      tradeType: 'Swing',
      notes: cycle.notes.filter(Boolean).join(' | ') || undefined,
      cycleTag: cycle.cycleTags.filter(Boolean)[0] || undefined,
      buyTransactionIds: [...new Set(cycle.buyTransactionIds)],
      sellTransactionIds: [...new Set(cycle.sellTransactionIds)],
    });
  };

  for (const tx of chronologicalTxs) {
    const tickerKey = tx.ticker.trim().toUpperCase();
    const kind = cashFlowKind(tx);

    if (kind === 'CASH_ADJUSTMENT') {
      const amount = Number(tx.cashFlowAmount ?? tx.totalAmount);
      if (!Number.isFinite(amount)) discrepancies.push(`CASH_ADJUSTMENT ${tx.id} has an invalid amount.`);
      else runningCash += amount;
      continue;
    }

    if (kind === 'DEPOSIT' || (tickerKey === 'CASH' && tx.type === 'BUY' && !kind)) {
      const amount = Number(tx.totalAmount);
      if (!Number.isFinite(amount) || amount < 0) discrepancies.push(`CASH ${tx.id} has an invalid deposit amount.`);
      else runningCash += amount;
      continue;
    }

    if (kind === 'WITHDRAWAL' || (tickerKey === 'CASH' && tx.type === 'SELL' && !kind)) {
      const amount = Number(tx.totalAmount);
      if (!Number.isFinite(amount) || amount < 0) discrepancies.push(`CASH ${tx.id} has an invalid withdrawal amount.`);
      else runningCash -= amount;
      if (runningCash < -EPSILON) discrepancies.push(`CASH balance became negative after ${tx.id}: ${runningCash.toFixed(2)}.`);
      continue;
    }

    if (kind === 'DIVIDEND') {
      const amount = Number(tx.cashFlowAmount ?? tx.totalAmount);
      if (!Number.isFinite(amount) || amount < 0) discrepancies.push(`DIVIDEND ${tx.id} has an invalid amount.`);
      else runningCash += amount;
      continue;
    }

    if (kind === 'FEE') {
      const amount = Number(tx.cashFlowAmount ?? tx.totalAmount ?? tx.fees);
      if (!Number.isFinite(amount) || amount < 0) discrepancies.push(`FEE ${tx.id} has an invalid amount.`);
      else runningCash -= amount;
      continue;
    }

    if (tickerKey === 'CASH') {
      discrepancies.push(`CASH ${tx.id} has unsupported transaction semantics.`);
      continue;
    }

    const tickerQuote = tickers.find((t) => t.ticker.trim().toUpperCase() === tickerKey);
    const sector = tx.sector || tickerQuote?.sector || 'Other';
    const companyName = tx.companyName || tickerQuote?.nameEn || tx.ticker;

    if (tx.type === 'BUY') {
      try {
        const accounting = calculateBuyImpact(tx.shares, tx.price, tx.fees);
        runningCash += Number.isFinite(tx.netCashImpact) && tx.netCashImpact < 0 ? tx.netCashImpact : -accounting.cashOutflow;

        if (!openLotsByTicker[tickerKey]) openLotsByTicker[tickerKey] = [];
        if (!activeCyclesByTicker[tickerKey]) {
          activeCyclesByTicker[tickerKey] = {
            id: `reconciled-ct-${tx.id}`,
            ticker: tx.ticker,
            companyName,
            sector,
            shares: 0,
            totalCostBasis: 0,
            totalGrossProceeds: 0,
            buyDate: tx.date,
            sellDate: tx.date,
            buyFees: 0,
            sellFees: 0,
            totalFees: 0,
            realizedPnlEgp: 0,
            notes: [],
            cycleTags: [],
            buyTransactionIds: [],
            sellTransactionIds: [],
          };
        }

        const cycle = activeCyclesByTicker[tickerKey];
        cycle.buyTransactionIds.push(tx.id);
        if (new Date(tx.date).getTime() < new Date(cycle.buyDate).getTime()) cycle.buyDate = tx.date;
        openLotsByTicker[tickerKey].push({
          id: tx.id,
          shares: tx.shares,
          price: tx.price,
          date: tx.date,
          fees: accounting.fees,
          companyName,
          sector,
          targetPrice: tx.targetPrice,
          stopLoss: tx.stopLoss,
          notes: tx.notes,
        });
      } catch (error) {
        discrepancies.push(`BUY ${tx.id} for ${tx.ticker} rejected: ${error instanceof Error ? error.message : 'invalid accounting data'}`);
      }
      continue;
    }

    if (tx.type !== 'SELL') {
      discrepancies.push(`Transaction ${tx.id} has unsupported type ${tx.type}.`);
      continue;
    }

    const lots = openLotsByTicker[tickerKey] || [];
    const totalOpenShares = lots.reduce((sum, lot) => sum + lot.shares, 0);
    const totalOpenGrossCost = lots.reduce((sum, lot) => sum + lot.shares * lot.price, 0);
    const totalOpenBuyFees = lots.reduce((sum, lot) => sum + lot.fees, 0);

    if (totalOpenShares <= EPSILON) {
      discrepancies.push(`SELL ${tx.id} for ${tx.ticker} has no open shares.`);
      continue;
    }
    if (tx.shares > totalOpenShares + EPSILON) {
      discrepancies.push(`SELL ${tx.id} for ${tx.ticker} exceeds open shares by ${(tx.shares - totalOpenShares).toFixed(4)}.`);
      continue;
    }

    try {
      const accounting = calculateSellAccounting(tx.shares, tx.price, tx.fees, totalOpenShares, totalOpenGrossCost, totalOpenBuyFees);
      runningCash += Number.isFinite(tx.netCashImpact) && tx.netCashImpact > 0 ? tx.netCashImpact : accounting.netProceeds;

      let cycle = activeCyclesByTicker[tickerKey];
      if (!cycle) {
        cycle = {
          id: `reconciled-ct-${tx.id}`,
          ticker: tx.ticker,
          companyName,
          sector,
          shares: 0,
          totalCostBasis: 0,
          totalGrossProceeds: 0,
          buyDate: lots[0]?.date || tx.date,
          sellDate: tx.date,
          buyFees: 0,
          sellFees: 0,
          totalFees: 0,
          realizedPnlEgp: 0,
          notes: [],
          cycleTags: [],
          buyTransactionIds: lots.map((lot) => lot.id),
          sellTransactionIds: [],
        };
        activeCyclesByTicker[tickerKey] = cycle;
      }

      cycle.sellTransactionIds.push(tx.id);
      cycle.shares += tx.shares;
      cycle.totalCostBasis += accounting.allocatedGrossCost;
      cycle.totalGrossProceeds += accounting.grossProceeds;
      cycle.sellDate = tx.date;
      cycle.buyFees += accounting.allocatedBuyFees;
      cycle.sellFees += tx.fees;
      cycle.totalFees += accounting.allocatedBuyFees + tx.fees;
      cycle.realizedPnlEgp += accounting.realizedPnlEgp;
      if (tx.notes) cycle.notes.push(tx.notes);
      if (tx.cycleTag) cycle.cycleTags.push(tx.cycleTag);

      const remainingRatio = Math.max(0, 1 - tx.shares / totalOpenShares);
      for (const lot of lots) {
        lot.shares *= remainingRatio;
        lot.fees *= remainingRatio;
      }
      for (let i = lots.length - 1; i >= 0; i -= 1) {
        if (lots[i].shares <= EPSILON) lots.splice(i, 1);
      }

      if (lots.length === 0) {
        finalizeCycle(cycle);
        delete activeCyclesByTicker[tickerKey];
      }
    } catch (error) {
      discrepancies.push(`SELL ${tx.id} for ${tx.ticker} rejected: ${error instanceof Error ? error.message : 'invalid accounting data'}`);
    }
  }

  // A partially realized cycle is reportable because the ledger contains an
  // executed SELL and therefore realized P&L. A buy-only cycle remains open and
  // must never be projected as a ClosedTrade.
  Object.values(activeCyclesByTicker)
    .filter((cycle) => cycle.sellTransactionIds.length > 0)
    .forEach(finalizeCycle);

  const reconciledPositions: Position[] = [];
  Object.entries(openLotsByTicker).forEach(([ticker, lots]) => {
    const shares = lots.reduce((sum, lot) => sum + lot.shares, 0);
    if (shares <= EPSILON) return;
    const grossCost = lots.reduce((sum, lot) => sum + lot.shares * lot.price, 0);
    const totalFees = lots.reduce((sum, lot) => sum + lot.fees, 0);
    const avgBuyPrice = grossCost / shares;
    const quote = tickers.find((t) => t.ticker.trim().toUpperCase() === ticker);
    const existing = existingPositions.find((p) => p.ticker.trim().toUpperCase() === ticker);
    const currentPrice = quote && quote.lastPrice > 0
      ? quote.lastPrice
      : existing && Number.isFinite(existing.currentPrice) && existing.currentPrice > 0
        ? existing.currentPrice
        : avgBuyPrice;
    const sample = lots[0];
    const cleanShares = Math.abs(shares - Math.round(shares)) < EPSILON ? Math.round(shares) : shares;

    reconciledPositions.push({
      id: existing?.id || `pos-rec-${ticker}`,
      ticker,
      companyName: sample.companyName,
      sector: sample.sector,
      shares: cleanShares,
      avgBuyPrice: Number(avgBuyPrice.toFixed(4)),
      currentPrice: Number(currentPrice.toFixed(4)),
      buyDate: sample.date,
      totalFees: Number(totalFees.toFixed(2)),
      targetPrice: quote?.targetPrice ?? existing?.targetPrice ?? sample.targetPrice,
      stopLoss: quote?.stopLoss ?? existing?.stopLoss ?? sample.stopLoss,
      notes: sample.notes || existing?.notes,
    });
  });

  return {
    reconciledPositions,
    reconciledClosedTrades: closedTrades.reverse(),
    reconciledCashBalance: Number(runningCash.toFixed(2)),
    transactionsProcessed: chronologicalTxs.length,
    discrepanciesFound: discrepancies,
  };
}

export function getOpenBuyTransactionIdsForTicker(transactions: TradeTransaction[], ticker: string): string[] {
  const targetSym = ticker.trim().toUpperCase();
  if (!Array.isArray(transactions) || transactions.length === 0) return [];
  const chronologicalTxs = sortTransactions(transactions);
  const openLots: { id: string; shares: number }[] = [];

  chronologicalTxs.forEach((tx) => {
    if (tx.ticker.trim().toUpperCase() !== targetSym) return;
    if (tx.type === 'BUY') {
      openLots.push({ id: tx.id, shares: tx.shares });
      return;
    }
    if (tx.type === 'SELL') {
      let remaining = tx.shares;
      while (remaining > EPSILON && openLots.length > 0) {
        const lot = openLots[0];
        const sold = Math.min(remaining, lot.shares);
        lot.shares -= sold;
        remaining -= sold;
        if (lot.shares <= EPSILON) openLots.shift();
      }
    }
  });

  return openLots.map((lot) => lot.id);
}
