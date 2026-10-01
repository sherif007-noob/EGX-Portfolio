import { describe, expect, it } from 'vitest';
import type { EGXTicker, Position, TradeTransaction } from '../types';
import type { CanonicalLedgerSnapshot } from './ledgerMutationService';
import {
  prepareBuyTradeMutation,
  prepareSellTradeMutation,
} from './tradeLedgerMutations';
import { reconcilePortfolioFromLedger } from './portfolioReconciliation';

const ticker: EGXTicker = {
  ticker: 'COMI',
  nameEn: 'Commercial International Bank',
  nameAr: '',
  isin: 'EGS60121C018',
  sector: 'Banking',
  lastPrice: 12,
  change: 0,
  changePercent: 0,
  dayLow: 0,
  dayHigh: 0,
  yearLow: 0,
  yearHigh: 0,
  volume: 0,
  valueEgp: 0,
  trendStatus: 'Rangebound Neutral',
  rsi14: 0,
  support: 0,
  resistance: 0,
  targetPrice: 16,
  stopLoss: 8,
  lastUpdated: '2026-10-01T10:00:00.000Z',
};

const buy: TradeTransaction = {
  id: 'buy-1',
  type: 'BUY',
  ticker: 'COMI',
  companyName: ticker.nameEn,
  sector: 'Banking',
  shares: 100,
  price: 10,
  fees: 10,
  totalAmount: 1010,
  grossTradeValue: 1000,
  netCashImpact: -1010,
  date: '2026-10-01',
  executedAt: '2026-10-01T10:00:00+03:00',
  tradeId: 1,
};

const position: Position = {
  id: 'pos-comi',
  ticker: 'COMI',
  companyName: ticker.nameEn,
  sector: 'Banking',
  shares: 100,
  avgBuyPrice: 10,
  currentPrice: 12,
  buyDate: '2026-10-01',
  totalFees: 10,
  targetPrice: 15,
  stopLoss: 9,
  notes: 'original thesis',
};

const snapshot = (): CanonicalLedgerSnapshot => ({
  transactions: [buy],
  positions: [position],
  closedTrades: [],
  cashBalance: 3990,
  capitalDeposits: 5000,
  tickers: [ticker],
});

describe('BUY/SELL ledger mutation preparation', () => {
  it('prepares a canonical DCA BUY and preserves explicitly updated position metadata', () => {
    const prepared = prepareBuyTradeMutation(snapshot(), {
      transactionId: 'buy-2',
      ticker: 'COMI',
      companyName: ticker.nameEn,
      sector: 'Banking',
      shares: 50,
      price: 12,
      fees: 6,
      date: '2026-10-02',
      executedAt: '2026-10-02T10:15:00+03:00',
      targetPrice: 18,
      stopLoss: 10,
      notes: 'raised target after DCA',
    });

    expect(prepared.value).toMatchObject({
      id: 'buy-2',
      type: 'BUY',
      tradeId: 2,
      totalAmount: 606,
      netCashImpact: -606,
    });
    expect(prepared.positionSeed?.[0]).toMatchObject({
      targetPrice: 18,
      stopLoss: 10,
      notes: 'raised target after DCA',
    });

    const report = reconcilePortfolioFromLedger(
      prepared.transactions,
      snapshot().tickers,
      snapshot().capitalDeposits,
      prepared.positionSeed,
    );
    expect(report.reconciledPositions[0]).toMatchObject({
      shares: 150,
      targetPrice: 18,
      stopLoss: 10,
      notes: 'raised target after DCA',
    });
    expect(report.reconciledCashBalance).toBe(3384);
  });

  it('rejects BUY when authoritative cash is insufficient', () => {
    expect(() => prepareBuyTradeMutation(
      { ...snapshot(), cashBalance: 100 },
      {
        transactionId: 'buy-too-large',
        ticker: 'COMI',
        companyName: ticker.nameEn,
        sector: 'Banking',
        shares: 50,
        price: 12,
        fees: 6,
        date: '2026-10-02',
      },
    )).toThrow('Insufficient cash');
  });

  it('rejects the legacy BUY cash-bypass mode instead of creating local-only money', () => {
    expect(() => prepareBuyTradeMutation(snapshot(), {
      transactionId: 'buy-no-cash',
      ticker: 'COMI',
      companyName: ticker.nameEn,
      sector: 'Banking',
      shares: 1,
      price: 12,
      date: '2026-10-02',
      deductFromCash: false,
    })).toThrow('BUY cash bypass');
  });

  it('prepares a proportional partial SELL with canonical proceeds and realized P&L', () => {
    const prepared = prepareSellTradeMutation(snapshot(), {
      transactionId: 'sell-1',
      positionId: 'pos-comi',
      sharesToSell: 40,
      sellPrice: 14,
      fees: 5,
      sellDate: '2026-10-02',
      executedAt: '2026-10-02T10:20:00+03:00',
      notes: 'partial exit',
    });

    expect(prepared.value).toMatchObject({
      id: 'sell-1',
      type: 'SELL',
      tradeId: 2,
      totalAmount: 555,
      netCashImpact: 555,
      realizedPnlEgp: 151,
      realizedPnlPercent: expect.any(Number),
    });

    const report = reconcilePortfolioFromLedger(
      prepared.transactions,
      snapshot().tickers,
      snapshot().capitalDeposits,
      prepared.positionSeed,
    );
    expect(report.reconciledPositions[0].shares).toBe(60);
    expect(report.reconciledCashBalance).toBe(4545);
    expect(report.reconciledClosedTrades[0].sellTransactionIds).toContain('sell-1');
  });

  it('fully closes a position and links the closed cycle to the persisted SELL', () => {
    const prepared = prepareSellTradeMutation(snapshot(), {
      transactionId: 'sell-all',
      positionId: 'pos-comi',
      sharesToSell: 100,
      sellPrice: 14,
      fees: 10,
      sellDate: '2026-10-02',
    });
    const report = reconcilePortfolioFromLedger(
      prepared.transactions,
      snapshot().tickers,
      snapshot().capitalDeposits,
      prepared.positionSeed,
    );

    expect(report.reconciledPositions).toHaveLength(0);
    expect(report.reconciledClosedTrades).toHaveLength(1);
    expect(report.reconciledClosedTrades[0].sellTransactionIds).toEqual(['sell-all']);
  });

  it('keeps same-day executions deterministic by executedAt and tradeId', () => {
    const prepared = prepareSellTradeMutation(snapshot(), {
      transactionId: 'sell-same-day',
      positionId: 'pos-comi',
      sharesToSell: 10,
      sellPrice: 13,
      fees: 1,
      sellDate: '2026-10-01',
      executedAt: '2026-10-01T10:30:00+03:00',
    });
    const report = reconcilePortfolioFromLedger(
      prepared.transactions,
      snapshot().tickers,
      snapshot().capitalDeposits,
      prepared.positionSeed,
    );

    expect(report.discrepanciesFound).toHaveLength(0);
    expect(report.reconciledPositions[0].shares).toBe(90);
  });

  it('rejects a stale SELL after the position has already changed or disappeared', () => {
    expect(() => prepareSellTradeMutation(
      { ...snapshot(), positions: [] },
      {
        transactionId: 'sell-stale',
        positionId: 'pos-comi',
        sharesToSell: 10,
        sellPrice: 13,
        sellDate: '2026-10-02',
      },
    )).toThrow('position changed');
  });

  it('rejects the legacy SELL cash-bypass mode', () => {
    expect(() => prepareSellTradeMutation(snapshot(), {
      transactionId: 'sell-no-cash',
      positionId: 'pos-comi',
      sharesToSell: 10,
      sellPrice: 13,
      sellDate: '2026-10-02',
      addToCash: false,
    })).toThrow('SELL cash bypass');
  });
});
