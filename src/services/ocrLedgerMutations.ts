import type { Sector, TradeTransaction } from '../types';
import { findStrongDuplicateExecution } from '../utils/tradeExecutionIdentity';
import { calculateBuyImpact, calculateHoldingDays, calculateSellAccounting } from './portfolioAccounting';
import { reconcilePortfolioFromLedger } from './portfolioReconciliation';
import type {
  CanonicalLedgerSnapshot,
  LedgerMutationPreparation,
} from './ledgerMutationService';

export interface OcrTradeInput {
  ticker: string;
  companyName: string;
  sector: Sector;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  date: string;
  executedAt?: string;
  fees: number;
  notes?: string;
}

export interface OcrBatchMutationSummary {
  processedCount: number;
  skippedCount: number;
  duplicateCount: number;
  transactionIds: string[];
}

function nextTradeId(transactions: TradeTransaction[]): number {
  const maxTradeId = transactions.reduce((max, transaction) => {
    const id = Number(transaction.tradeId);
    return Number.isFinite(id) && id > max ? id : max;
  }, 0);
  return maxTradeId > 0 ? maxTradeId + 1 : transactions.length + 1;
}

export function prepareOcrBatchMutation(
  current: Readonly<CanonicalLedgerSnapshot>,
  parsedTrades: OcrTradeInput[],
  idFactory: () => string = () => `tx-ocr-${crypto.randomUUID()}`,
): LedgerMutationPreparation<OcrBatchMutationSummary> {
  if (!Array.isArray(parsedTrades) || parsedTrades.length === 0) {
    throw new Error('OCR batch is empty.');
  }

  const ordered = parsedTrades
    .map((trade, index) => ({ trade, index }))
    .sort((a, b) => {
      const aTime = new Date(a.trade.executedAt || a.trade.date).getTime();
      const bTime = new Date(b.trade.executedAt || b.trade.date).getTime();
      if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return aTime - bTime;
      const sameTicker = a.trade.ticker.trim().toUpperCase() === b.trade.ticker.trim().toUpperCase();
      if (sameTicker && a.trade.type !== b.trade.type) return a.trade.type === 'BUY' ? -1 : 1;
      return a.index - b.index;
    })
    .map(({ trade }) => trade);

  let workingTransactions = [...current.transactions];
  let workingReport = reconcilePortfolioFromLedger(
    workingTransactions,
    current.tickers,
    current.capitalDeposits,
    current.positions,
  );

  let processedCount = 0;
  let skippedCount = 0;
  let duplicateCount = 0;
  const transactionIds: string[] = [];
  const pending = [...ordered];

  while (pending.length > 0) {
    let progressed = false;

    for (let index = 0; index < pending.length; index += 1) {
      const parsed = pending[index];
      const ticker = parsed.ticker.toUpperCase().trim();
      const shares = Number(parsed.shares);
      const price = Number(parsed.price);
      const fees = Number(parsed.fees) || 0;

      if (
        !ticker ||
        !Number.isFinite(shares) ||
        shares <= 0 ||
        !Number.isFinite(price) ||
        price <= 0 ||
        !Number.isFinite(fees) ||
        fees < 0
      ) {
        pending.splice(index, 1);
        index -= 1;
        skippedCount += 1;
        progressed = true;
        continue;
      }

      if (findStrongDuplicateExecution(workingTransactions, {
        type: parsed.type,
        ticker,
        shares,
        price,
        date: parsed.date,
        executedAt: parsed.executedAt,
        fees,
      })) {
        pending.splice(index, 1);
        index -= 1;
        duplicateCount += 1;
        progressed = true;
        continue;
      }

      const tradeId = nextTradeId(workingTransactions);
      let transaction: TradeTransaction;

      if (parsed.type === 'SELL') {
        const position = workingReport.reconciledPositions.find(
          (candidate) => candidate.ticker.toUpperCase() === ticker,
        );
        if (!position || shares > position.shares) continue;

        const accounting = calculateSellAccounting(
          shares,
          price,
          fees,
          position.shares,
          position.shares * position.avgBuyPrice,
          position.totalFees || 0,
        );

        transaction = {
          id: idFactory(),
          tradeId,
          type: 'SELL',
          ticker,
          companyName: position.companyName || parsed.companyName || ticker,
          sector: position.sector || parsed.sector,
          shares,
          price,
          date: parsed.date,
          executedAt: parsed.executedAt,
          fees,
          totalAmount: accounting.netProceeds,
          grossTradeValue: accounting.grossProceeds,
          netCashImpact: accounting.netProceeds,
          realizedPnlEgp: accounting.realizedPnlEgp,
          realizedPnlPercent: accounting.realizedPnlPercent,
          outcome: accounting.outcome,
          holdingDays: calculateHoldingDays(position.buyDate, parsed.date),
          notes: parsed.notes || 'Logged via Screenshot Scanner',
        };
      } else {
        const impact = calculateBuyImpact(shares, price, fees);
        transaction = {
          id: idFactory(),
          tradeId,
          type: 'BUY',
          ticker,
          companyName: parsed.companyName || ticker,
          sector: parsed.sector,
          shares,
          price,
          date: parsed.date,
          executedAt: parsed.executedAt,
          fees,
          totalAmount: impact.cashOutflow,
          grossTradeValue: impact.grossCost,
          netCashImpact: -impact.cashOutflow,
          notes: parsed.notes || 'Logged via Screenshot Scanner',
        };
      }

      workingTransactions = [transaction, ...workingTransactions];
      transactionIds.push(transaction.id);
      processedCount += 1;
      pending.splice(index, 1);
      index -= 1;
      progressed = true;

      workingReport = reconcilePortfolioFromLedger(
        workingTransactions,
        current.tickers,
        current.capitalDeposits,
        current.positions,
      );
    }

    if (!progressed) {
      skippedCount += pending.length;
      break;
    }
  }

  return {
    transactions: workingTransactions,
    capitalDeposits: current.capitalDeposits,
    positionSeed: current.positions,
    value: {
      processedCount,
      skippedCount,
      duplicateCount,
      transactionIds,
    },
  };
}
