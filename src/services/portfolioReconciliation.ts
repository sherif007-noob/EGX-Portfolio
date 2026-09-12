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

  const openLotsByTicker: Record<string, BuyLot[]> = {};
  const closedTrades: ClosedTrade[] = [];

  // Ensure running cash starts from total capital deposits
  const startingCapital = (totalCapitalDeposited && totalCapitalDeposited >= 1000)
    ? totalCapitalDeposited
    : INITIAL_CAPITAL_DEPOSITS;
  let runningCash = startingCapital;

  chronologicalTxs.forEach((tx) => {
    const tickerKey = tx.ticker.trim().toUpperCase();

    // Handle cash adjustments (Dividends, Deposits, Withdrawals)
    if (tickerKey === 'CASH' || tx.type === ('DIVIDEND' as any) || tx.type === ('DEPOSIT' as any)) {
      const amount = tx.totalAmount || (tx.shares * tx.price);
      runningCash += amount;
      return;
    }

    if (tx.type === ('WITHDRAW' as any)) {
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
      }

      while (remainingSharesToSell > EPSILON && lots.length > 0) {
        const currentLot = lots[0];
        const sharesFromLot = Math.min(remainingSharesToSell, currentLot.shares);

        const lotProratedBuyFee = currentLot.shares > 0 ? (sharesFromLot / currentLot.shares) * currentLot.fees : 0;
        totalCostBasis += sharesFromLot * currentLot.price;
        totalAllocatedBuyFees += lotProratedBuyFee;

        currentLot.shares -= sharesFromLot;
        currentLot.fees = Math.max(0, currentLot.fees - lotProratedBuyFee);
        remainingSharesToSell -= sharesFromLot;

        if (currentLot.shares <= EPSILON) {
          lots.shift();
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
      const realizedPnlPercent = costBasisWithFees > 0 ? (realizedPnlEgp / costBasisWithFees) * 100 : 0;
      const outcome = tx.outcome || (realizedPnlEgp > 0.01 ? 'WIN' : realizedPnlEgp < -0.01 ? 'LOSS' : 'BREAKEVEN');

      const entryTime = new Date(earliestBuyDate).getTime();
      const exitTime = new Date(tx.date).getTime();
      const holdingDays = Math.max(1, Math.round((exitTime - entryTime) / (1000 * 60 * 60 * 24)) || 1);

      closedTrades.push({
        id: `reconciled-ct-${tx.id}`,
        ticker: tx.ticker,
        companyName,
        sector,
        shares: tx.shares,
        buyPrice: tx.shares > 0 ? Number((totalCostBasis / tx.shares).toFixed(4)) : 0,
        sellPrice: Number(sellPrice.toFixed(4)),
        buyDate: earliestBuyDate,
        sellDate: tx.date,
        holdingDays,
        buyFees: Number(totalAllocatedBuyFees.toFixed(2)),
        sellFees: Number(sellFees.toFixed(2)),
        totalFees: Number(totalFeesForTrade.toFixed(2)),
        realizedPnlEgp: Number(realizedPnlEgp.toFixed(2)),
        realizedPnlPercent: Number(realizedPnlPercent.toFixed(2)),
        outcome,
        tradeType: 'Swing',
        notes: tx.notes,
        cycleTag: tx.cycleTag,
      });
    }
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
