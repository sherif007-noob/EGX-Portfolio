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

function sortTransactions(transactions: TradeTransaction[]): TradeTransaction[] {
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

  const hasExternalCashFlow = chronologicalTxs.some((tx) => {
    const kind = cashFlowKind(tx);
    const ticker = tx.ticker.trim().toUpperCase();
    return ticker === 'CASH' || kind === 'DEPOSIT' || kind === 'WITHDRAWAL' || kind === 'DIVIDEND' || kind === 'FEE' || kind === 'CASH_ADJUSTMENT';
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
        cycle.shares += tx.shares;
        cycle.totalCostBasis += tx.shares * tx.price;
        cycle.buyFees += accounting.fees;
        cycle.totalFees += accounting.fees;
        if (tx.notes) cycle.notes.push(tx.notes);
        if (tx.cycleTag) cycle.cycleTags.push(tx.cycleTag);
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
    if (tx.shares <= EPSILON || tx.shares > totalOpenShares + EPSILON) {
      discrepancies.push(`SELL ${tx.id} for ${tx.ticker} exceeds available shares (${tx.shares} > ${totalOpenShares}).`);
      continue;
    }

    try {
      const accounting = calculateSellAccounting(tx.shares, tx.price, tx.fees, totalOpenShares, totalOpenGrossCost, totalOpenBuyFees);
      runningCash += Number.isFinite(tx.netCashImpact) && tx.netCashImpact > 0 ? tx.netCashImpact : accounting.netProceeds;

      let remainingToSell = tx.shares;
      let allocatedCost = 0;
      let allocatedBuyFees = 0;
      while (remainingToSell > EPSILON && lots.length) {
        const lot = lots[0];
        const allocatedShares = Math.min(remainingToSell, lot.shares);
        const lotRatio = allocatedShares / lot.shares;
        allocatedCost += allocatedShares * lot.price;
        allocatedBuyFees += lot.fees * lotRatio;
        lot.shares -= allocatedShares;
        lot.fees -= lot.fees * lotRatio;
        remainingToSell -= allocatedShares;
        if (lot.shares <= EPSILON) lots.shift();
      }

      const cycle = activeCyclesByTicker[tickerKey];
      if (cycle) {
        cycle.shares += 0;
        cycle.totalGrossProceeds += accounting.grossProceeds;
        cycle.sellFees += accounting.fees;
        cycle.totalFees += accounting.fees;
        cycle.realizedPnlEgp += accounting.grossProceeds - allocatedCost - allocatedBuyFees - accounting.fees;
        cycle.sellDate = tx.date;
        cycle.sellTransactionIds.push(tx.id);
        if (tx.notes) cycle.notes.push(tx.notes);
        if (tx.cycleTag) cycle.cycleTags.push(tx.cycleTag);
        if (lots.length === 0) {
          finalizeCycle(cycle);
          delete activeCyclesByTicker[tickerKey];
        }
      }
    } catch (error) {
      discrepancies.push(`SELL ${tx.id} for ${tx.ticker} rejected: ${error instanceof Error ? error.message : 'invalid accounting data'}`);
    }
  }

  const reconciledPositions: Position[] = [];
  for (const [ticker, lots] of Object.entries(openLotsByTicker)) {
    const openShares = lots.reduce((sum, lot) => sum + lot.shares, 0);
    if (openShares <= EPSILON) continue;
    const grossCost = lots.reduce((sum, lot) => sum + lot.shares * lot.price, 0);
    const totalFees = lots.reduce((sum, lot) => sum + lot.fees, 0);
    const existing = existingPositions.find((p) => p.ticker.trim().toUpperCase() === ticker);
    const quote = tickers.find((t) => t.ticker.trim().toUpperCase() === ticker);
    reconciledPositions.push({
      id: existing?.id || `reconciled-pos-${ticker}`,
      ticker,
      companyName: existing?.companyName || lots[0].companyName || quote?.nameEn || ticker,
      sector: existing?.sector || lots[0].sector || quote?.sector || 'Other',
      shares: Number(openShares.toFixed(4)),
      avgBuyPrice: Number((grossCost / openShares).toFixed(4)),
      currentPrice: quote?.lastPrice || existing?.currentPrice || 0,
      dayChange: quote?.change ?? existing?.dayChange,
      dayChangePercent: quote?.changePercent ?? existing?.dayChangePercent,
      buyDate: lots.reduce((earliest, lot) => new Date(lot.date) < new Date(earliest) ? lot.date : earliest, lots[0].date),
      totalFees: Number(totalFees.toFixed(2)),
      targetPrice: existing?.targetPrice ?? lots[0].targetPrice,
      stopLoss: existing?.stopLoss ?? lots[0].stopLoss,
      notes: existing?.notes ?? lots.map((l) => l.notes).filter(Boolean).join(' | '),
      priceUpdatedAt: quote?.priceUpdatedAt || existing?.priceUpdatedAt,
    });
  }

  const orphanedCycles = Object.values(activeCyclesByTicker).filter((cycle) => cycle.shares > EPSILON);
  if (orphanedCycles.length) {
    // Open cycles are intentionally not emitted as closed trades.
  }

  return {
    reconciledPositions,
    reconciledClosedTrades: closedTrades,
    reconciledCashBalance: Number(runningCash.toFixed(2)),
    transactionsProcessed: chronologicalTxs.length,
    discrepanciesFound: discrepancies,
  };
}