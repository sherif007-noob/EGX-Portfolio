import { Position, ClosedTrade, TradeTransaction, EGXTicker, Sector } from '../types';
import { INITIAL_CAPITAL_DEPOSITS } from '../data/initialPortfolio';
import { normalizeTransaction } from '../utils/portfolioMetrics';

export interface ReconciliationReport {
  reconciledPositions: Position[];
  reconciledClosedTrades: ClosedTrade[];
  reconciledCashBalance: number;
  transactionsProcessed: number;
  discrepanciesFound: string[];
}

const EPSILON = 0.0001;

export function reconcilePortfolioFromLedger(
  transactions: TradeTransaction[],
  tickers: EGXTicker[],
  totalCapitalDeposited: number = INITIAL_CAPITAL_DEPOSITS,
  existingPositions: Position[] = []
): ReconciliationReport {
  const discrepancies: string[] = [];

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return {
      reconciledPositions: [],
      reconciledClosedTrades: [],
      reconciledCashBalance: totalCapitalDeposited || INITIAL_CAPITAL_DEPOSITS,
      transactionsProcessed: 0,
      discrepanciesFound: [],
    };
  }

  // Normalize and sort transactions chronologically (oldest first)
  const chronologicalTxs = transactions
    .map(normalizeTransaction)
    .sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (timeA !== timeB) return timeA - timeB;
      // If same date, sort by tradeId if present
      if (a.tradeId !== undefined && b.tradeId !== undefined && a.tradeId !== b.tradeId) {
        return Number(a.tradeId) - Number(b.tradeId);
      }
      // BUYs before SELLs if same date
      if (a.type === 'BUY' && b.type === 'SELL') return -1;
      if (a.type === 'SELL' && b.type === 'BUY') return 1;
      return 0;
    });

  // Track inventory per ticker: array of buy lots { shares, price, date, fees, id }
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

  const activeCyclesByTicker: Record<string, ActiveCycle> = {};
  const openLotsByTicker: Record<string, BuyLot[]> = {};
  const closedTrades: ClosedTrade[] = [];

  const finalizeCycle = (cycle: ActiveCycle) => {
    const costBasisWithFees = cycle.totalCostBasis + cycle.buyFees;
    const netProceeds = cycle.totalGrossProceeds - cycle.sellFees;
    // We only use calculated PNL if the cycle's accumulated realizedPnlEgp is exactly 0 and there were actual proceeds
    // Actually, just sum the realizedPnlEgp from transactions. 
    // If the transactions had tx.realizedPnlEgp, it's summed. If not, the calculated one was summed.
    const pnl = cycle.realizedPnlEgp;
    const pnlPercent = costBasisWithFees > 0 ? (pnl / costBasisWithFees) * 100 : 0;
    const outcome = pnl > 0.01 ? 'WIN' : pnl < -0.01 ? 'LOSS' : 'BREAKEVEN';
    
    const entryTime = new Date(cycle.buyDate).getTime();
    const exitTime = new Date(cycle.sellDate).getTime();
    const holdingDays = Math.max(1, Math.round((exitTime - entryTime) / (1000 * 60 * 60 * 24)) || 1);

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
      holdingDays,
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

  // Ensure running cash starts from total capital deposits
  const startingCapital = (typeof totalCapitalDeposited === 'number' && totalCapitalDeposited > 0)
    ? totalCapitalDeposited
    : (INITIAL_CAPITAL_DEPOSITS || 0);
  let runningCash = startingCapital;

  chronologicalTxs.forEach((tx) => {
    const tickerKey = tx.ticker.trim().toUpperCase();

    // Handle cash adjustments (Dividends, Deposits, Withdrawals)
    if (tickerKey === 'CASH' || tx.type === ('DIVIDEND' as any) || tx.type === ('DEPOSIT' as any)) {
      const amount = tx.totalAmount || (tx.shares * tx.price);
      runningCash += amount;
      return;
    }

    if (tx.type === ('WITHDRAW' as any) || tx.type === ('WITHDRAWAL' as any)) {
      const amount = tx.totalAmount || (tx.shares * tx.price);
      runningCash -= amount;
      return;
    }

    const tickerQuote = tickers.find((t) => t.ticker.trim().toUpperCase() === tickerKey);
    const sector = tx.sector || tickerQuote?.sector || 'Other';
    const companyName = tx.companyName || tickerQuote?.nameEn || tx.ticker;

    if (tx.type === 'BUY') {
      const grossCost = tx.shares * tx.price;
      const totalOutlay = grossCost + (tx.fees || 0);

      // If open lots is empty but we have an active cycle, it means the old cycle is complete.
      // (This handles the case where they bought again after selling everything)
      const currentLots = openLotsByTicker[tickerKey] || [];
      const remainingShares = currentLots.reduce((acc, l) => acc + l.shares, 0);
      if (remainingShares <= EPSILON && activeCyclesByTicker[tickerKey]) {
        finalizeCycle(activeCyclesByTicker[tickerKey]);
        delete activeCyclesByTicker[tickerKey];
      }

      // Add to buy lots
      if (!openLotsByTicker[tickerKey]) {
        openLotsByTicker[tickerKey] = [];
      }
      openLotsByTicker[tickerKey].push({
        id: tx.id,
        shares: tx.shares,
        price: tx.price,
        date: tx.date,
        fees: tx.fees || 0,
        companyName,
        sector,
        targetPrice: tx.targetPrice,
        stopLoss: tx.stopLoss,
        notes: tx.notes,
      });

      runningCash -= totalOutlay;
    } else if (tx.type === 'SELL') {
      let remainingSharesToSell = tx.shares;
      const sellPrice = tx.price;
      const sellFees = tx.fees || 0;
      const grossProceeds = tx.shares * sellPrice;
      const netProceeds = Math.max(0, grossProceeds - sellFees);

      runningCash += netProceeds;

      const lots = openLotsByTicker[tickerKey] || [];
      let totalCostBasis = 0;
      let totalAllocatedBuyFees = 0;
      let earliestBuyDate = tx.date;

      if (lots.length > 0) {
        earliestBuyDate = lots[0].date;
        
        let totalOpenShares = 0;
        let totalOpenCost = 0;
        let totalOpenFees = 0;
        
        for (const lot of lots) {
          totalOpenShares += lot.shares;
          totalOpenCost += lot.shares * lot.price;
          totalOpenFees += lot.fees;
        }
        
        const avgBuyPrice = totalOpenShares > 0 ? totalOpenCost / totalOpenShares : 0;
        const avgFeesPerShare = totalOpenShares > 0 ? totalOpenFees / totalOpenShares : 0;
        
        const sharesToAllocate = Math.min(remainingSharesToSell, totalOpenShares);
        
        totalCostBasis = sharesToAllocate * avgBuyPrice;
        totalAllocatedBuyFees = sharesToAllocate * avgFeesPerShare;
        
        const ratio = totalOpenShares > 0 ? (totalOpenShares - sharesToAllocate) / totalOpenShares : 0;
        for (const lot of lots) {
          lot.shares = lot.shares * ratio;
          lot.fees = lot.fees * ratio;
        }
        
        remainingSharesToSell -= sharesToAllocate;
        
        for (let i = lots.length - 1; i >= 0; i--) {
          if (lots[i].shares <= EPSILON) {
            lots.splice(i, 1);
          }
        }
      }

      if (remainingSharesToSell > EPSILON) {
        discrepancies.push(
          `SELL transaction on ${tx.date} for ${tx.ticker} (${tx.shares} shares) exceeded open buy lots by ${remainingSharesToSell.toFixed(2)} shares.`
        );
      }

      const totalFeesForTrade = totalAllocatedBuyFees + sellFees;
      const costBasisWithFees = totalCostBasis + totalAllocatedBuyFees;
      const calculatedPnl = netProceeds - costBasisWithFees;
      const realizedPnlEgp = tx.realizedPnlEgp !== undefined && tx.realizedPnlEgp !== null
        ? tx.realizedPnlEgp
        : calculatedPnl;

      // Accumulate into active cycle
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
          buyDate: earliestBuyDate,
          sellDate: tx.date,
          buyFees: 0,
          sellFees: 0,
          totalFees: 0,
          realizedPnlEgp: 0,
          notes: [],
          cycleTags: []
        };
        activeCyclesByTicker[tickerKey] = cycle;
      }

      cycle.shares += tx.shares;
      cycle.totalCostBasis += totalCostBasis;
      cycle.totalGrossProceeds += grossProceeds;
      cycle.sellDate = tx.date;
      
      const currentBuyTime = new Date(cycle.buyDate).getTime();
      const newBuyTime = new Date(earliestBuyDate).getTime();
      if (newBuyTime < currentBuyTime) {
        cycle.buyDate = earliestBuyDate;
      }

      cycle.buyFees += totalAllocatedBuyFees;
      cycle.sellFees += sellFees;
      cycle.totalFees += totalFeesForTrade;
      cycle.realizedPnlEgp += realizedPnlEgp;
      
      if (tx.notes) cycle.notes.push(tx.notes);
      if (tx.cycleTag) cycle.cycleTags.push(tx.cycleTag);

      // Finalize immediately if position is now empty
      const remainingLotsShares = lots.reduce((acc, l) => acc + l.shares, 0);
      if (remainingLotsShares <= EPSILON) {
        finalizeCycle(cycle);
        delete activeCyclesByTicker[tickerKey];
      }
    }
  });

  // Finalize any partially closed cycles that never reached 0 position
  Object.values(activeCyclesByTicker).forEach((cycle) => {
    finalizeCycle(cycle);
  });

  // Reconstruct open positions from remaining lots
  const reconciledPositions: Position[] = [];

  Object.entries(openLotsByTicker).forEach(([ticker, lots]) => {
    const totalRemainingShares = lots.reduce((acc, l) => acc + l.shares, 0);
    if (totalRemainingShares > EPSILON) {
      const totalCost = lots.reduce((acc, l) => acc + (l.shares * l.price), 0);
      const totalFees = lots.reduce((acc, l) => acc + l.fees, 0);
      const avgBuyPrice = totalCost / totalRemainingShares;
      const cleanSym = ticker.trim().toUpperCase();
      const quoteMatch = tickers.find((t) => t.ticker.trim().toUpperCase() === cleanSym);
      const existingPos = existingPositions.find((p) => p.ticker.trim().toUpperCase() === cleanSym);
      const currentPrice = (quoteMatch && quoteMatch.lastPrice > 0)
        ? quoteMatch.lastPrice
        : (existingPos && existingPos.currentPrice > 0 ? existingPos.currentPrice : Number(avgBuyPrice.toFixed(4)));
      const sampleLot = lots[0];

      // If shares are very close to an integer, round to eliminate IEEE 754 floating drift
      const cleanShares = Math.abs(totalRemainingShares - Math.round(totalRemainingShares)) < EPSILON
        ? Math.round(totalRemainingShares)
        : totalRemainingShares;

      reconciledPositions.push({
        id: existingPos?.id || `pos-rec-${ticker}`,
        ticker,
        companyName: sampleLot.companyName,
        sector: sampleLot.sector,
        shares: cleanShares,
        avgBuyPrice: Number(avgBuyPrice.toFixed(4)),
        currentPrice: Number(currentPrice.toFixed(4)),
        buyDate: sampleLot.date,
        totalFees: Number(totalFees.toFixed(2)),
        targetPrice: quoteMatch?.targetPrice || existingPos?.targetPrice || sampleLot.targetPrice,
        stopLoss: quoteMatch?.stopLoss || existingPos?.stopLoss || sampleLot.stopLoss,
        notes: sampleLot.notes || existingPos?.notes,
      });
    }
  });

  return {
    reconciledPositions,
    reconciledClosedTrades: closedTrades.reverse(), // newest first
    reconciledCashBalance: Number(runningCash.toFixed(2)),
    transactionsProcessed: chronologicalTxs.length,
    discrepanciesFound: discrepancies,
  };
}

/**
 * Returns the transaction IDs of all unclosed BUY transactions (open lots) for a specific ticker.
 */
export function getOpenBuyTransactionIdsForTicker(
  transactions: TradeTransaction[],
  ticker: string
): string[] {
  const targetSym = ticker.trim().toUpperCase();
  if (!Array.isArray(transactions) || transactions.length === 0) return [];

  const chronologicalTxs = transactions
    .map(normalizeTransaction)
    .sort((a, b) => {
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

  interface LotRef {
    id: string;
    shares: number;
  }

  const openLots: LotRef[] = [];

  chronologicalTxs.forEach((tx) => {
    if (tx.ticker.trim().toUpperCase() !== targetSym) return;

    if (tx.type === 'BUY') {
      openLots.push({ id: tx.id, shares: tx.shares });
    } else if (tx.type === 'SELL') {
      let sharesToSell = tx.shares;
      while (sharesToSell > EPSILON && openLots.length > 0) {
        const lot = openLots[0];
        const sold = Math.min(sharesToSell, lot.shares);
        lot.shares -= sold;
        sharesToSell -= sold;
        if (lot.shares <= EPSILON) {
          openLots.shift();
        }
      }
    }
  });

  return openLots.map((l) => l.id);
}

