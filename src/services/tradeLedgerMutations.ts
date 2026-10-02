import type { Position, Sector, TradeTransaction } from '../types';
import { calculateBuyImpact, calculateHoldingDays, calculateSellAccounting } from './portfolioAccounting';
import { resolveTickerFromDirectory } from './tickerRegistry';
import type {
  CanonicalLedgerSnapshot,
  LedgerMutationPreparation,
} from './ledgerMutationService';

export interface PrepareBuyTradeInput {
  transactionId: string;
  ticker: string;
  companyName: string;
  sector: Sector;
  shares: number;
  price: number;
  fees?: number;
  date: string;
  executedAt?: string;
  targetPrice?: number;
  stopLoss?: number;
  notes?: string;
  cycleTag?: string;
}

export interface PrepareSellTradeInput {
  transactionId: string;
  positionId: string;
  sharesToSell: number;
  sellPrice: number;
  fees?: number;
  sellDate: string;
  executedAt?: string;
  notes?: string;
}

function nextTradeId(transactions: TradeTransaction[]): number {
  const maxExistingTradeId = transactions.reduce((max, transaction) => {
    const id = Number(transaction.tradeId);
    return Number.isFinite(id) && id > max ? id : max;
  }, 0);
  return maxExistingTradeId > 0 ? maxExistingTradeId + 1 : transactions.length + 1;
}

function updateBuyMetadataSeed(
  positions: Position[],
  ticker: string,
  input: Pick<PrepareBuyTradeInput, 'targetPrice' | 'stopLoss' | 'notes'>,
): Position[] {
  const index = positions.findIndex(
    (position) => position.ticker.trim().toUpperCase() === ticker,
  );
  if (index < 0) return positions;

  const existing = positions[index];
  const next = [...positions];
  next[index] = {
    ...existing,
    targetPrice: input.targetPrice !== undefined ? input.targetPrice : existing.targetPrice,
    stopLoss: input.stopLoss !== undefined ? input.stopLoss : existing.stopLoss,
    notes: input.notes !== undefined && input.notes !== '' ? input.notes : existing.notes,
  };
  return next;
}

export function prepareBuyTradeMutation(
  current: Readonly<CanonicalLedgerSnapshot>,
  input: PrepareBuyTradeInput,
): LedgerMutationPreparation<TradeTransaction> {
  const ticker = resolveTickerFromDirectory(input.ticker, current.tickers);
  const { grossCost, fees, cashOutflow } = calculateBuyImpact(
    input.shares,
    input.price,
    input.fees ?? 0,
  );

  if (cashOutflow > current.cashBalance + 0.005) {
    throw new Error(
      `Insufficient cash for BUY: requires ${cashOutflow.toFixed(2)} EGP but only ${current.cashBalance.toFixed(2)} EGP is available.`,
    );
  }

  const transaction: TradeTransaction = {
    id: input.transactionId,
    type: 'BUY',
    ticker,
    companyName: input.companyName,
    sector: input.sector,
    shares: input.shares,
    price: input.price,
    date: input.date,
    executedAt: input.executedAt,
    fees,
    totalAmount: cashOutflow,
    targetPrice: input.targetPrice,
    stopLoss: input.stopLoss,
    notes: input.notes || '',
    cycleTag: input.cycleTag,
    tradeId: nextTradeId(current.transactions),
    grossTradeValue: grossCost,
    netCashImpact: -cashOutflow,
  };

  return {
    transactions: [transaction, ...current.transactions],
    positionSeed: updateBuyMetadataSeed(current.positions, ticker, input),
    value: transaction,
  };
}

export function prepareSellTradeMutation(
  current: Readonly<CanonicalLedgerSnapshot>,
  input: PrepareSellTradeInput,
): LedgerMutationPreparation<TradeTransaction> {
  const position = current.positions.find((candidate) => candidate.id === input.positionId);
  if (!position) {
    throw new Error('The position changed before the sale could be saved. Reload and try again.');
  }

  const accounting = calculateSellAccounting(
    input.sharesToSell,
    input.sellPrice,
    input.fees ?? 0,
    position.shares,
    position.shares * position.avgBuyPrice,
    position.totalFees || 0,
  );
  const holdingDays = calculateHoldingDays(position.buyDate, input.sellDate);

  const transaction: TradeTransaction = {
    id: input.transactionId,
    type: 'SELL',
    ticker: position.ticker.trim().toUpperCase(),
    companyName: position.companyName,
    sector: position.sector,
    shares: input.sharesToSell,
    price: input.sellPrice,
    date: input.sellDate,
    executedAt: input.executedAt,
    fees: input.fees ?? 0,
    totalAmount: accounting.netProceeds,
    grossTradeValue: accounting.grossProceeds,
    netCashImpact: accounting.netProceeds,
    realizedPnlEgp: accounting.realizedPnlEgp,
    realizedPnlPercent: accounting.realizedPnlPercent,
    outcome: accounting.outcome,
    holdingDays,
    notes: input.notes || '',
    tradeId: nextTradeId(current.transactions),
  };

  return {
    transactions: [transaction, ...current.transactions],
    positionSeed: current.positions,
    value: transaction,
  };
}
