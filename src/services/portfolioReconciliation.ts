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
}

export function reconcilePortfolioFromLedger(
  transactions: TradeTransaction[],
  tickers: EGXTicker[],
  totalCapitalDeposited: number = INITIAL_CAPITAL_DEPOSITS,
  existingPositions: Position[] = []
): ReconciliationReport {
  const discrepancies: string[] = [];
  const startingCash = Number.isFinite(totalCapitalDeposited) && totalCapitalDeposited >= 0
    ? totalCapitalDeposited
    : 0;

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return {
      reconciledPositions: [],
      reconciledClosedTrades: [],
      reconciledCashBalance: startingCash,
      transactionsProcessed: 0,
      discrepanciesFound: [],
    };
  }

  const chronologicalTxs = transactions.map(normalizeTransaction).sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    if (timeA !== timeB) return timeA - timeB;
    if (a.tradeId !== undefined && b.tradeId !== undefined && a.tradeId !== b.tradeId) {
      return Number(a.tradeId) - Number(b.tradeId);
    }
    if (a.type === 'BUY' && b.type === 'SELL') return -1;
    if (a.type === 'SELL' && b.type === 'BUY') return 1;
    return 0;
  });

  const activeCyclesByTicker: Record<string, ActiveCycle> = {};
  const openLotsByTicker: Record<string, BuyLot[]> = {};
  const closedTrades: ClosedTrade[] = [];
  let runningCash = startingCash;

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
    });
  };

  chronologicalTxs.forEach((tx) => {
    const tickerKey = tx.ticker.trim().toUpperCase();

    // Legacy cash-flow rows are normalized to ticker CASH. BUY means an
    // inflow (deposit/dividend); SELL means an outflow (withdrawal).
    if (tickerKey === 'CASH') {
      const amount = tx.totalAmount;
      if (!Number.isFinite(amount) || amount < 0) {
        discrepancies.push(`CASH ${tx.id} has an invalid non-negative amount.`);
        return;
      }
      if (tx.type === 'BUY') {
        runningCash += amount;
      } else if (tx.type === 'SELL') {
        runningCash -= amount;
      } else {
        discrepancies.push(`CASH ${tx.id} has unsupported transaction type ${tx.type}.`);
      }
      return;
    }

    const tickerQuote = tickers.find(t => t.ticker.trim().toUpperCase() === tickerKey);
    const sector = tx.sector || tickerQuote?.sector || 'Other';
    const companyName = tx.companyName || tickerQuote?.nameEn || tx.ticker;

    if (tx.type === 'BUY') {
      let accounting;
      try {
        accounting = calculateBuyImpact(tx.shares, tx.price, tx.fees);
      } catch (error) {
        discrepancies.push(`BUY ${tx.id} for ${tx.ticker} rejected: ${error instanceof Error ? error.message : 'invalid accounting data'}`);
        return;
      }

      runningCash -= accounting.cashOutflow;

      const currentLots = openLotsByTicker[tickerKey] || [];
      if (currentLots.length === 0 && activeCyclesByTicker[tickerKey]) {
        finalizeCycle(activeCyclesByTicker[tickerKey]);
        delete activeCyclesByTicker[tickerKey];
      }

      if (!openLotsByTicker[tickerKey]) openLotsByTicker[tickerKey] = [];
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
      return;
    }

    if (tx.type !== 'SELL') return;

    const lots = openLotsByTicker[tickerKey] || [];
    const totalOpenShares = lots.reduce((sum, lot) => sum + lot.shares, 0);
    const totalOpenGrossCost = lots.reduce((sum, lot) => sum + lot.shares * lot.price, 0);
    const totalOpenBuyFees = lots.reduce((sum, lot) => sum + lot.fees, 0);

    if (totalOpenShares <= EPSILON) {
      discrepancies.push(`SELL ${tx.id} for ${tx.ticker} has no open shares.`);
      return;
    }
    if (tx.shares > totalOpenShares + EPSILON) {
      discrepancies.push(`SELL ${tx.id} for ${tx.ticker} exceeds open shares by ${(tx.shares - totalOpenShares).toFixed(4)}.`);
      return;
    }

    let accounting;
    try {
      accounting = calculateSellAccounting(
        tx.shares,
        tx.price,
        tx.fees,
        totalOpenShares,
        totalOpenGrossCost,
        totalOpenBuyFees,
      );
    } catch (error) {
      discrepancies.push(`SELL ${tx.id} for ${tx.ticker} rejected: ${error instanceof Error ? error.message : 'invalid accounting data'}`);
      return;
    }

    runningCash += accounting.netProceeds;

    const cycleBuyDate = lots
      .map(lot => lot.date)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] || tx.date;

    const ratioRemaining = 1 - tx.shares / totalOpenShares;
    for (const lot of lots) {
      lot.shares *= Math.max(0, ratioRemaining);
      lot.fees *= Math.max(0, ratioRemaining);
    }
    for (let i = lots.length - 1; i >= 0; i--) {
      if (lots[i].shares <= EPSILON) lots.splice(i, 1);
    }

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
        buyDate: cycleBuyDate,
        sellDate: tx.date,
        buyFees: 0,
        sellFees: 0,
        totalFees: 0,
        realizedPnlEgp: 0,
        notes: [],
        cycleTags: [],
      };
      activeCyclesByTicker[tickerKey] = cycle;
    } else if (new Date(cycleBuyDate).getTime() < new Date(cycle.buyDate).getTime()) {
      cycle.buyDate = cycleBuyDate;
    }

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

    if (lots.reduce((sum, lot) => sum + lot.shares, 0) <= EPSILON) {
      finalizeCycle(cycle);
      delete activeCyclesByTicker[tickerKey];
    }
  });

  Object.values(activeCyclesByTicker).forEach(finalizeCycle);

  const reconciledPositions: Position[] = [];
  Object.entries(openLotsByTicker).forEach(([ticker, lots]) => {
    const shares = lots.reduce((sum, lot) => sum + lot.shares, 0);
    if (shares <= EPSILON) return;

    const grossCost = lots.reduce((sum, lot) => sum + lot.shares * lot.price, 0);
    const totalFees = lots.reduce((sum, lot) => sum + lot.fees, 0);
    const avgBuyPrice = grossCost / shares;
    const cleanSym = ticker.trim().toUpperCase();
    const quote = tickers.find(t => t.ticker.trim().toUpperCase() === cleanSym);
    const existing = existingPositions.find(p => p.ticker.trim().toUpperCase() === cleanSym);
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

  const chronologicalTxs = transactions.map(normalizeTransaction).sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    if (timeA !== timeB) return timeA - timeB;
    if (a.tradeId !== undefined && b.tradeId !== undefined && a.tradeId !== b.tradeId) {
      return Number(a.tradeId) - Number(b.tradeId);
    }
    if (a.type === 'BUY' && b.type === 'SELL') return -1;
    if (a.type === 'SELL' && b.type === 'BUY') return 1;
    return 0;
  });

  const openLots: { id: string; shares: number }[] = [];
  chronologicalTxs.forEach(tx => {
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
  return openLots.map(lot => lot.id);
}
