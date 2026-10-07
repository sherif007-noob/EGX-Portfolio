import { selectPositionQuote } from './positionQuote';
import { Position, ClosedTrade, TradeTransaction, EGXTicker, Sector } from '../types';
import { INITIAL_CAPITAL_DEPOSITS } from '../data/initialPortfolio';
import { normalizeTransaction } from '../utils/portfolioMetrics';
import { calculateBuyImpact, calculateHoldingDays, calculateSellAccounting } from './portfolioAccounting';
import { normalizeCashFlowType } from './cashFlowSemantics';
import { isBonusSharesTransaction } from './corporateActions';
import { isIpoSubscriptionTransaction, validateIpoSubscriptionMetadata } from './ipoSubscriptions';

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
    // Corporate actions are effective before same-day exchange executions so
    // ex-date holdings are adjusted before any new BUY/SELL entered that day.
    if (a.type === 'CORPORATE_ACTION' && b.type !== 'CORPORATE_ACTION') return -1;
    if (b.type === 'CORPORATE_ACTION' && a.type !== 'CORPORATE_ACTION') return 1;
    if (a.type === 'BUY' && b.type === 'SELL') return -1;
    if (a.type === 'SELL' && b.type === 'BUY') return 1;
    return a.id.localeCompare(b.id);
  });
}

function cashFlowKind(tx: TradeTransaction) {
  return normalizeCashFlowType(tx.cashFlowType);
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
  // model. Performance cash events and reconciliation adjustments modify cash
  // without redefining contributed capital, so they preserve the opening baseline.
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

    if (kind === 'RECONCILIATION_ADJUSTMENT') {
      const amount = Number(tx.cashFlowAmount ?? tx.totalAmount);
      if (!Number.isFinite(amount)) discrepancies.push(`RECONCILIATION_ADJUSTMENT ${tx.id} has an invalid amount.`);
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

    if (kind === 'DIVIDEND' || kind === 'OTHER_INCOME') {
      const amount = Number(tx.cashFlowAmount ?? tx.totalAmount);
      if (!Number.isFinite(amount) || amount < 0) discrepancies.push(`${kind} ${tx.id} has an invalid amount.`);
      else runningCash += amount;
      continue;
    }

    if (kind === 'FEE' || kind === 'OTHER_EXPENSE') {
      const amount = Number(tx.cashFlowAmount ?? tx.totalAmount ?? tx.fees);
      if (!Number.isFinite(amount) || amount < 0) discrepancies.push(`${kind} ${tx.id} has an invalid amount.`);
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

    if (tx.type === 'CORPORATE_ACTION') {
      if (!isBonusSharesTransaction(tx)) {
        discrepancies.push(`Corporate action ${tx.id} for ${tx.ticker} has unsupported type ${tx.corporateActionType || 'EMPTY'}.`);
        continue;
      }

      const lots = openLotsByTicker[tickerKey] || [];
      const currentShares = lots.reduce((sum, lot) => sum + lot.shares, 0);
      const sourceShares = Number(tx.corporateActionSourceShares);
      const bonusShares = Number(tx.shares);
      const ratio = Number(tx.corporateActionRatio);

      if (currentShares <= EPSILON) {
        discrepancies.push(`BONUS_SHARES ${tx.id} for ${tx.ticker} has no open position.`);
        continue;
      }
      if (!Number.isFinite(sourceShares) || sourceShares <= EPSILON) {
        discrepancies.push(`BONUS_SHARES ${tx.id} for ${tx.ticker} has invalid source shares.`);
        continue;
      }
      if (Math.abs(currentShares - sourceShares) > 0.01) {
        discrepancies.push(
          `BONUS_SHARES ${tx.id} for ${tx.ticker} expected ${sourceShares.toFixed(4)} source shares but ledger has ${currentShares.toFixed(4)}.`,
        );
        continue;
      }
      if (!Number.isFinite(bonusShares) || bonusShares <= EPSILON) {
        discrepancies.push(`BONUS_SHARES ${tx.id} for ${tx.ticker} has invalid received shares.`);
        continue;
      }
      if (!Number.isFinite(ratio) || ratio < 0) {
        discrepancies.push(`BONUS_SHARES ${tx.id} for ${tx.ticker} has invalid official ratio.`);
        continue;
      }

      // Bonus shares add units without adding economic cost or cash movement.
      // A zero-cost lot preserves total gross cost and buy fees, so weighted
      // average cost automatically drops over the enlarged share count.
      lots.push({
        id: tx.id,
        shares: bonusShares,
        price: 0,
        date: tx.date,
        fees: 0,
        companyName,
        sector,
        notes: tx.notes,
      });
      openLotsByTicker[tickerKey] = lots;
      continue;
    }

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
    const selectedQuote = selectPositionQuote(existing, quote, avgBuyPrice);
    const currentPrice = selectedQuote.currentPrice;
    const sample = lots[0];
    const cleanShares = Math.abs(shares - Math.round(shares)) < EPSILON ? Math.round(shares) : shares;

    reconciledPositions.push({
      id: existing?.id || `pos-rec-${ticker}`,
      ticker,
      companyName: sample.companyName,
      sector: sample.sector,
      shares: cleanShares,
      avgBuyPrice: Number(avgBuyPrice.toFixed(4)),
      ...selectedQuote,
      currentPrice: Number(currentPrice.toFixed(4)),
      buyDate: sample.date,
      totalFees: Number(totalFees.toFixed(2)),
      // Position-authored metadata is portfolio state; ticker-directory target/stop
      // values are defaults only. Persist-first BUY must not erase explicit position
      // metadata when the canonical ledger is reconciled.
      targetPrice: existing?.targetPrice ?? sample.targetPrice ?? quote?.targetPrice,
      stopLoss: existing?.stopLoss ?? sample.stopLoss ?? quote?.stopLoss,
      notes: existing?.notes ?? sample.notes,
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

export function deriveCanonicalCapitalDeposits(
  transactions: TradeTransaction[],
  currentCashBalance: number,
  fallbackCapitalDeposits = 0,
): number {
  const fallback = Number.isFinite(fallbackCapitalDeposits) && fallbackCapitalDeposits >= 0
    ? Number(fallbackCapitalDeposits)
    : 0;
  if (!Number.isFinite(currentCashBalance)) return Number(fallback.toFixed(2));

  const normalized = Array.isArray(transactions) ? sortTransactions(transactions) : [];
  const externalFlows = normalized.filter((tx) => {
    const kind = cashFlowKind(tx);
    const ticker = tx.ticker.trim().toUpperCase();
    return (
      kind === 'DEPOSIT' ||
      kind === 'WITHDRAWAL' ||
      (ticker === 'CASH' && !kind && (tx.type === 'BUY' || tx.type === 'SELL'))
    );
  });

  if (externalFlows.length) {
    const contributed = externalFlows.reduce((sum, tx) => {
      const kind = cashFlowKind(tx);
      const ticker = tx.ticker.trim().toUpperCase();
      const amount = Math.abs(Number(tx.cashFlowAmount ?? tx.totalAmount));
      if (!Number.isFinite(amount)) return sum;
      const deposit = kind === 'DEPOSIT' || (ticker === 'CASH' && !kind && tx.type === 'BUY');
      const withdrawal = kind === 'WITHDRAWAL' || (ticker === 'CASH' && !kind && tx.type === 'SELL');
      if (deposit) return sum + amount;
      if (withdrawal) return sum - amount;
      return sum;
    }, 0);
    return Number(Math.max(0, contributed).toFixed(2));
  }

  // Legacy portfolios may have no explicit cash contribution rows. In that
  // model, current cash = opening capital + the signed cash impact of every
  // ledger transaction. Reconcile once from a zero opening balance to recover
  // that cumulative ledger impact, then solve for the implied opening capital.
  const zeroBaselineCash = reconcilePortfolioFromLedger(normalized, [], 0).reconciledCashBalance;
  const impliedOpeningCapital = Number(currentCashBalance) - zeroBaselineCash;
  return Number(
    (Number.isFinite(impliedOpeningCapital) && impliedOpeningCapital >= 0
      ? impliedOpeningCapital
      : fallback
    ).toFixed(2),
  );
}
