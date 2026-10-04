import type { ClosedTrade, EGXTicker, Position, TradeTransaction } from '../../../types';
import { INITIAL_EGX_TICKERS, mergeTickerDirectoryWithBaseline } from '../../../data/egxTickers';
import {
  INITIAL_CAPITAL_DEPOSITS,
  INITIAL_CASH_BALANCE,
  INITIAL_CLOSED_TRADES,
  INITIAL_POSITIONS,
  INITIAL_TRANSACTIONS,
} from '../../../data/initialPortfolio';
import {
  VISUAL_REGRESSION_CAPITAL_DEPOSITS,
  VISUAL_REGRESSION_CASH_BALANCE,
  VISUAL_REGRESSION_CLOSED_TRADES,
  VISUAL_REGRESSION_POSITIONS,
  VISUAL_REGRESSION_TICKERS,
  VISUAL_REGRESSION_TRANSACTIONS,
} from '../../../data/visualRegressionFixture';
import { VISUAL_REGRESSION_MODE } from '../../../utils/visualRegressionMode';
import { normalizeTransaction } from '../../../utils/portfolioMetrics';
import { reconcilePortfolioFromLedger } from '../../../domain/accounting';
import { resolveTickerFromDirectory, selectPositionQuote } from '../../../domain/market';

export const PORTFOLIO_STORAGE_KEYS = {
  positions: 'egx_pwa_positions_v3_reconciled',
  closedTrades: 'egx_pwa_closed_trades_v3_reconciled',
  cashBalance: 'egx_pwa_cash_balance_v3_reconciled',
  tickers: 'egx_pwa_tickers_directory_v3_reconciled',
  transactions: 'egx_pwa_transactions_v3_reconciled',
  capitalDeposits: 'egx_pwa_capital_deposits_v1',
} as const;

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

export function rehydrateTransactionMetadata(
  transactionList: TradeTransaction[],
  tickerList: EGXTicker[],
): TradeTransaction[] {
  if (!transactionList.length || !tickerList.length) return transactionList;
  const tickerMap = new Map(tickerList.map((ticker) => [ticker.ticker.trim().toUpperCase(), ticker]));
  let changed = false;

  const next = transactionList.map((transaction) => {
    if (transaction.ticker.trim().toUpperCase() === 'CASH') return transaction;
    const canonicalTicker = resolveTickerFromDirectory(transaction.ticker, tickerList);
    const ticker = tickerMap.get(canonicalTicker);
    if (!ticker) return transaction;

    const companyName = ticker.nameEn || transaction.companyName;
    const sector = ticker.sector !== 'Other' ? ticker.sector : transaction.sector;
    if (
      transaction.ticker === canonicalTicker &&
      transaction.companyName === companyName &&
      transaction.sector === sector
    ) return transaction;

    changed = true;
    return { ...transaction, ticker: canonicalTicker, companyName, sector };
  });

  return changed ? next : transactionList;
}

export function rehydrateClosedTradeMetadata(
  tradeList: ClosedTrade[],
  tickerList: EGXTicker[],
): ClosedTrade[] {
  if (!tradeList.length || !tickerList.length) return tradeList;
  const tickerMap = new Map(tickerList.map((ticker) => [ticker.ticker.trim().toUpperCase(), ticker]));
  let changed = false;

  const next = tradeList.map((trade) => {
    const canonicalTicker = resolveTickerFromDirectory(trade.ticker, tickerList);
    const ticker = tickerMap.get(canonicalTicker);
    if (!ticker) return trade;

    const companyName = ticker.nameEn || trade.companyName;
    const sector = ticker.sector !== 'Other' ? ticker.sector : trade.sector;
    if (
      trade.ticker === canonicalTicker &&
      trade.companyName === companyName &&
      trade.sector === sector
    ) return trade;

    changed = true;
    return { ...trade, ticker: canonicalTicker, companyName, sector };
  });

  return changed ? next : tradeList;
}

export function rehydratePositionsWithTickers(
  positions: Position[],
  tickerList: EGXTicker[],
): Position[] {
  if (!tickerList.length || !positions.length) return positions;
  const tickerMap = new Map(tickerList.map((ticker) => [ticker.ticker.trim().toUpperCase(), ticker]));
  let changed = false;

  const next = positions.map((position) => {
    const canonicalTicker = resolveTickerFromDirectory(position.ticker, tickerList);
    const ticker = tickerMap.get(canonicalTicker);
    if (!ticker) return position;

    const quote = selectPositionQuote(position, ticker);
    const currentPrice = quote.currentPrice;
    const targetPrice = position.targetPrice ?? ticker.targetPrice;
    const stopLoss = position.stopLoss ?? ticker.stopLoss;
    const companyName = ticker.nameEn || position.companyName || canonicalTicker;
    const sector = ticker.sector !== 'Other' ? ticker.sector : (position.sector || 'Other');

    if (
      position.priceUpdatedAt !== quote.priceUpdatedAt ||
      position.dayChange !== quote.dayChange ||
      position.dayChangePercent !== quote.dayChangePercent ||
      position.ticker !== canonicalTicker ||
      Math.abs((position.currentPrice || 0) - currentPrice) > 0.0001 ||
      position.targetPrice !== targetPrice ||
      position.stopLoss !== stopLoss ||
      position.companyName !== companyName ||
      position.sector !== sector
    ) {
      changed = true;
      return {
        ...position,
        ...quote,
        ticker: canonicalTicker,
        currentPrice,
        targetPrice,
        stopLoss,
        companyName,
        sector,
      };
    }
    return position;
  });

  return changed ? next : positions;
}

function cachedTransactions(): TradeTransaction[] {
  const parsed = readJson(PORTFOLIO_STORAGE_KEYS.transactions);
  return Array.isArray(parsed) && parsed.length > 0
    ? parsed.map(normalizeTransaction)
    : INITIAL_TRANSACTIONS;
}

export function initialTickers(): EGXTicker[] {
  if (VISUAL_REGRESSION_MODE) return VISUAL_REGRESSION_TICKERS.map((ticker) => ({ ...ticker }));
  const parsed = readJson(PORTFOLIO_STORAGE_KEYS.tickers);
  return parsed ? mergeTickerDirectoryWithBaseline(parsed as EGXTicker[]) : INITIAL_EGX_TICKERS;
}

export function initialCapitalDeposits(): number {
  if (VISUAL_REGRESSION_MODE) return VISUAL_REGRESSION_CAPITAL_DEPOSITS;
  const parsed = readJson(PORTFOLIO_STORAGE_KEYS.capitalDeposits);
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : INITIAL_CAPITAL_DEPOSITS;
}

export function initialTransactions(tickers: EGXTicker[]): TradeTransaction[] {
  if (VISUAL_REGRESSION_MODE) {
    return VISUAL_REGRESSION_TRANSACTIONS.map((transaction) => ({ ...transaction }));
  }
  return rehydrateTransactionMetadata(cachedTransactions(), tickers);
}

export function initialPositions(): Position[] {
  if (VISUAL_REGRESSION_MODE) {
    return VISUAL_REGRESSION_POSITIONS.map((position) => ({ ...position }));
  }
  const parsed = readJson(PORTFOLIO_STORAGE_KEYS.positions);
  if (Array.isArray(parsed) && parsed.length > 0) return parsed as Position[];
  const report = reconcilePortfolioFromLedger(
    cachedTransactions(),
    INITIAL_EGX_TICKERS,
    INITIAL_CAPITAL_DEPOSITS,
  );
  return report.reconciledPositions.length > 0 ? report.reconciledPositions : INITIAL_POSITIONS;
}

export function initialClosedTrades(): ClosedTrade[] {
  if (VISUAL_REGRESSION_MODE) {
    return VISUAL_REGRESSION_CLOSED_TRADES.map((trade) => ({ ...trade }));
  }
  const parsed = readJson(PORTFOLIO_STORAGE_KEYS.closedTrades);
  if (Array.isArray(parsed) && parsed.length > 0) return parsed as ClosedTrade[];
  const report = reconcilePortfolioFromLedger(
    cachedTransactions(),
    INITIAL_EGX_TICKERS,
    INITIAL_CAPITAL_DEPOSITS,
  );
  return report.reconciledClosedTrades.length > 0 ? report.reconciledClosedTrades : INITIAL_CLOSED_TRADES;
}

export function initialCashBalance(): number {
  if (VISUAL_REGRESSION_MODE) return VISUAL_REGRESSION_CASH_BALANCE;
  const parsed = readJson(PORTFOLIO_STORAGE_KEYS.cashBalance);
  if (typeof parsed === 'number' && Number.isFinite(parsed)) return parsed;
  const report = reconcilePortfolioFromLedger(
    cachedTransactions(),
    INITIAL_EGX_TICKERS,
    INITIAL_CAPITAL_DEPOSITS,
  );
  return Number.isFinite(report.reconciledCashBalance)
    ? report.reconciledCashBalance
    : INITIAL_CASH_BALANCE;
}

export function persistPortfolioCompatibilityCache(snapshot: {
  positions: Position[];
  closedTrades: ClosedTrade[];
  transactions: TradeTransaction[];
  cashBalance: number;
  tickers: EGXTicker[];
  capitalDeposits: number;
}) {
  try {
    localStorage.setItem(PORTFOLIO_STORAGE_KEYS.positions, JSON.stringify(snapshot.positions));
    localStorage.setItem(PORTFOLIO_STORAGE_KEYS.closedTrades, JSON.stringify(snapshot.closedTrades));
    localStorage.setItem(PORTFOLIO_STORAGE_KEYS.transactions, JSON.stringify(snapshot.transactions));
    localStorage.setItem(PORTFOLIO_STORAGE_KEYS.cashBalance, JSON.stringify(snapshot.cashBalance));
    localStorage.setItem(PORTFOLIO_STORAGE_KEYS.tickers, JSON.stringify(snapshot.tickers));
    localStorage.setItem(PORTFOLIO_STORAGE_KEYS.capitalDeposits, JSON.stringify(snapshot.capitalDeposits));
  } catch (error) {
    console.warn('LocalStorage save failed:', error);
  }
}
