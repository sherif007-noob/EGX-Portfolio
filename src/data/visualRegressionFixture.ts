import type { EGXTicker, TradeTransaction } from '../types';
import { INITIAL_EGX_TICKERS } from './egxTickers';
import { reconcilePortfolioFromLedger } from '../services/portfolioReconciliation';

const FIXED_PRICE_TIME = '2026-09-30T09:00:00.000Z';

const tickerOverrides: Record<string, Partial<EGXTicker>> = {
  COMI: {
    lastPrice: 61.5,
    change: 1.2,
    changePercent: 1.99,
    dayLow: 59.8,
    dayHigh: 62.1,
    volume: 5_800_000,
    valueEgp: 353_000_000,
    rsi14: 62.4,
    support: 57.8,
    resistance: 63.2,
    targetPrice: 65,
    stopLoss: 54.5,
    priceUpdatedAt: FIXED_PRICE_TIME,
    lastUpdated: FIXED_PRICE_TIME,
  },
  MASR: {
    lastPrice: 6.64,
    change: -0.18,
    changePercent: -2.64,
    dayLow: 6.58,
    dayHigh: 6.88,
    volume: 8_450_000,
    valueEgp: 56_100_000,
    rsi14: 39.8,
    support: 6.35,
    resistance: 7.25,
    targetPrice: 7.8,
    stopLoss: 6.2,
    priceUpdatedAt: FIXED_PRICE_TIME,
    lastUpdated: FIXED_PRICE_TIME,
  },
  TALM: {
    lastPrice: 27.4,
    change: 0.55,
    changePercent: 2.05,
    dayLow: 26.6,
    dayHigh: 27.65,
    volume: 1_750_000,
    valueEgp: 47_900_000,
    rsi14: 58.6,
    support: 25.8,
    resistance: 28.2,
    targetPrice: 30,
    stopLoss: 24.9,
    priceUpdatedAt: FIXED_PRICE_TIME,
    lastUpdated: FIXED_PRICE_TIME,
  },
  NAPR: {
    lastPrice: 8.92,
    change: -0.21,
    changePercent: -2.3,
    dayLow: 8.84,
    dayHigh: 9.2,
    volume: 920_000,
    valueEgp: 8_200_000,
    rsi14: 43.2,
    support: 8.5,
    resistance: 9.6,
    targetPrice: 10.4,
    stopLoss: 8.2,
    priceUpdatedAt: FIXED_PRICE_TIME,
    lastUpdated: FIXED_PRICE_TIME,
  },
  ORHD: {
    lastPrice: 21.1,
    change: 0.2,
    changePercent: 0.96,
    dayLow: 20.7,
    dayHigh: 21.3,
    volume: 2_900_000,
    valueEgp: 61_000_000,
    rsi14: 55.1,
    support: 19.6,
    resistance: 21.8,
    targetPrice: 23,
    stopLoss: 18.8,
    priceUpdatedAt: FIXED_PRICE_TIME,
    lastUpdated: FIXED_PRICE_TIME,
  },
  FWRY: {
    lastPrice: 5.62,
    change: -0.08,
    changePercent: -1.4,
    dayLow: 5.55,
    dayHigh: 5.76,
    volume: 4_200_000,
    valueEgp: 23_600_000,
    rsi14: 44.6,
    support: 5.35,
    resistance: 6.05,
    targetPrice: 6.4,
    stopLoss: 5.2,
    priceUpdatedAt: FIXED_PRICE_TIME,
    lastUpdated: FIXED_PRICE_TIME,
  },
};

export const VISUAL_REGRESSION_TICKERS: EGXTicker[] = INITIAL_EGX_TICKERS.map((ticker) => ({
  ...ticker,
  ...(tickerOverrides[ticker.ticker] ?? {}),
}));

const tx = (
  id: string,
  tradeId: number,
  type: 'BUY' | 'SELL',
  ticker: string,
  companyName: string,
  sector: TradeTransaction['sector'],
  shares: number,
  price: number,
  fees: number,
  date: string,
  extras: Partial<TradeTransaction> = {},
): TradeTransaction => ({
  id,
  tradeId,
  type,
  ticker,
  companyName,
  sector,
  shares,
  price,
  fees,
  totalAmount: Number((shares * price).toFixed(2)),
  date,
  executedAt: `${date.slice(0, 10)}T10:15:00+03:00`,
  ...extras,
});

export const VISUAL_REGRESSION_TRANSACTIONS: TradeTransaction[] = [
  tx(
    'visual-cash-deposit',
    1,
    'BUY',
    'CASH',
    'Opening Capital',
    'Liquid Buying Power',
    120_000,
    1,
    0,
    '2026-08-01',
    { cashFlowType: 'DEPOSIT', cashFlowAmount: 120_000, notes: 'Visual regression seed capital' },
  ),
  tx('visual-fwry-buy', 2, 'BUY', 'FWRY', 'Fawry for Banking & Payment Tech', 'Non-Bank Financial Services & Fintech', 600, 6, 20, '2026-08-20', {
    notes: 'Momentum entry',
    targetPrice: 6.4,
    stopLoss: 5.2,
  }),
  tx('visual-fwry-sell', 3, 'SELL', 'FWRY', 'Fawry for Banking & Payment Tech', 'Non-Bank Financial Services & Fintech', 600, 5.45, 22, '2026-08-28', {
    notes: 'Stopped out',
  }),
  tx('visual-comi-buy', 4, 'BUY', 'COMI', 'Commercial International Bank (CIB)', 'Banking', 300, 55, 60, '2026-09-01', {
    notes: 'Core banking position',
    targetPrice: 65,
    stopLoss: 54.5,
  }),
  tx('visual-orhd-buy', 5, 'BUY', 'ORHD', 'Orascom Development Egypt', 'Tourism & Leisure', 400, 18, 25, '2026-09-02', {
    notes: 'Breakout setup',
    targetPrice: 22,
    stopLoss: 17.2,
  }),
  tx('visual-masr-buy', 6, 'BUY', 'MASR', 'Madinet Masr for Housing & Development', 'Real Estate & Construction', 1000, 7.2, 25, '2026-09-05', {
    notes: 'Real-estate swing',
    targetPrice: 7.8,
    stopLoss: 6.2,
  }),
  tx('visual-orhd-sell', 7, 'SELL', 'ORHD', 'Orascom Development Egypt', 'Tourism & Leisure', 400, 20.5, 30, '2026-09-12', {
    notes: 'Target captured',
  }),
  tx('visual-talm-buy', 8, 'BUY', 'TALM', 'Taaleem Management Services', 'Education & Services', 250, 26, 15, '2026-09-15', {
    notes: 'Trend continuation',
    targetPrice: 30,
    stopLoss: 24.9,
  }),
  tx('visual-napr-buy', 9, 'BUY', 'NAPR', 'National Printing', 'Paper & Packaging', 500, 9.4, 18, '2026-09-18', {
    notes: 'Small-cap test position',
    targetPrice: 10.4,
    stopLoss: 8.2,
  }),
  tx(
    'visual-cash-withdrawal',
    10,
    'SELL',
    'CASH',
    'Cash Withdrawal',
    'Liquid Buying Power',
    5_000,
    1,
    0,
    '2026-09-20',
    { cashFlowType: 'WITHDRAWAL', cashFlowAmount: -5_000, notes: 'Visual regression withdrawal' },
  ),
];

export const VISUAL_REGRESSION_CAPITAL_DEPOSITS = 115_000;

const reconciliation = reconcilePortfolioFromLedger(
  VISUAL_REGRESSION_TRANSACTIONS,
  VISUAL_REGRESSION_TICKERS,
  VISUAL_REGRESSION_CAPITAL_DEPOSITS,
);

export const VISUAL_REGRESSION_POSITIONS = reconciliation.reconciledPositions;
export const VISUAL_REGRESSION_CLOSED_TRADES = reconciliation.reconciledClosedTrades;
export const VISUAL_REGRESSION_CASH_BALANCE = reconciliation.reconciledCashBalance;
