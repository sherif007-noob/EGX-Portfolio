import { Position, ClosedTrade, TradeTransaction, EGXTicker, Sector } from '../types';

export interface ReconciliationReport {
  reconciledPositions: Position[];
  reconciledClosedTrades: ClosedTrade[];
  reconciledCashBalance: number;
  transactionsProcessed: number;
  discrepanciesFound: string[];
}

export function reconcilePortfolioFromLedger(
  transactions: TradeTransaction[],
  tickers: EGXTicker[],
  initialCash: number = 39989.43
): ReconciliationReport {
  const discrepancies: string[] = [];

  // Sort transactions chronologically (oldest first)
  const chronologicalTxs = [...transactions].sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    if (timeA !== timeB) return timeA - timeB;
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
  }

  const openLotsByTicker: Record<string, BuyLot[]> = {};
  const closedTrades: ClosedTrade[] = [];
  let runningCash = initialCash;

  chronologicalTxs.forEach((tx) => {
    const tickerKey = tx.ticker.toUpperCase();
    const tickerQuote = tickers.find((t) => t.ticker.toUpperCase() === tickerKey);
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

      while (remainingSharesToSell > 0 && lots.length > 0) {
        const currentLot = lots[0];
        const sharesFromLot = Math.min(remainingSharesToSell, currentLot.shares);

        const lotProratedBuyFee = currentLot.shares > 0 ? (sharesFromLot / currentLot.shares) * currentLot.fees : 0;
        totalCostBasis += sharesFromLot * currentLot.price;
        totalAllocatedBuyFees += lotProratedBuyFee;

        currentLot.shares -= sharesFromLot;
        currentLot.fees -= lotProratedBuyFee;
        remainingSharesToSell -= sharesFromLot;

        if (currentLot.shares <= 0.0001) {
          lots.shift();
        }
      }

      if (remainingSharesToSell > 0) {
        discrepancies.push(
          `SELL transaction on ${tx.date} for ${tx.ticker} (${tx.shares} shares) exceeded open buy lots by ${remainingSharesToSell} shares.`
        );
      }

      const totalFeesForTrade = totalAllocatedBuyFees + sellFees;
      const costBasisWithFees = totalCostBasis + totalAllocatedBuyFees;
      const realizedPnlEgp = tx.realizedPnlEgp !== undefined ? tx.realizedPnlEgp : (netProceeds - costBasisWithFees);
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
        buyPrice: totalCostBasis / (tx.shares || 1),
        sellPrice,
        buyDate: earliestBuyDate,
        sellDate: tx.date,
        holdingDays,
        buyFees: totalAllocatedBuyFees,
        sellFees,
        totalFees: totalFeesForTrade,
        realizedPnlEgp,
        realizedPnlPercent,
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
    if (totalRemainingShares > 0.001) {
      const totalCost = lots.reduce((acc, l) => acc + (l.shares * l.price), 0);
      const totalFees = lots.reduce((acc, l) => acc + l.fees, 0);
      const avgBuyPrice = totalCost / totalRemainingShares;
      const quoteMatch = tickers.find((t) => t.ticker.toUpperCase() === ticker);
      const currentPrice = quoteMatch?.lastPrice || avgBuyPrice;
      const sampleLot = lots[0];

      reconciledPositions.push({
        id: `pos-rec-${ticker}`,
        ticker,
        companyName: sampleLot.companyName,
        sector: sampleLot.sector,
        shares: totalRemainingShares,
        avgBuyPrice: Number(avgBuyPrice.toFixed(4)),
        currentPrice,
        buyDate: sampleLot.date,
        totalFees,
        targetPrice: quoteMatch?.targetPrice,
        stopLoss: quoteMatch?.stopLoss,
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
