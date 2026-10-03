import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { TradeTransaction } from '../types';
import { INITIAL_EGX_TICKERS } from '../data/egxTickers';
import { CANONICAL_COST_BASIS_METHOD } from './portfolioAccounting';
import { reconcilePortfolioFromLedger } from './portfolioReconciliation';
import { reconstructPortfolioFromTransactions } from './googleSheets';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const dcaPartialSellLedger: TradeTransaction[] = [
  {
    id: 'buy-1',
    type: 'BUY',
    ticker: 'COMI',
    companyName: 'Commercial International Bank (CIB)',
    sector: 'Banking',
    shares: 100,
    price: 10,
    date: '2026-01-01',
    fees: 10,
    totalAmount: 1010,
    grossTradeValue: 1000,
    netCashImpact: -1010,
  },
  {
    id: 'buy-2',
    type: 'BUY',
    ticker: 'COMI',
    companyName: 'Commercial International Bank (CIB)',
    sector: 'Banking',
    shares: 100,
    price: 20,
    date: '2026-01-02',
    fees: 20,
    totalAmount: 2020,
    grossTradeValue: 2000,
    netCashImpact: -2020,
  },
  {
    id: 'sell-1',
    type: 'SELL',
    ticker: 'COMI',
    companyName: 'Commercial International Bank (CIB)',
    sector: 'Banking',
    shares: 100,
    price: 30,
    date: '2026-01-03',
    fees: 30,
    totalAmount: 2970,
    grossTradeValue: 3000,
    netCashImpact: 2970,
  },
];

describe('Stage 2.6 canonical cost-basis contract', () => {
  it('freezes weighted-average proportional allocation as the accounting method', () => {
    expect(CANONICAL_COST_BASIS_METHOD).toBe('WEIGHTED_AVERAGE_PROPORTIONAL');

    const canonical = reconcilePortfolioFromLedger(
      dcaPartialSellLedger,
      INITIAL_EGX_TICKERS,
    );

    expect(canonical.reconciledPositions).toHaveLength(1);
    expect(canonical.reconciledPositions[0]).toMatchObject({
      ticker: 'COMI',
      shares: 100,
      avgBuyPrice: 15,
      totalFees: 15,
    });

    expect(canonical.reconciledClosedTrades).toHaveLength(1);
    expect(canonical.reconciledClosedTrades[0]).toMatchObject({
      ticker: 'COMI',
      shares: 100,
      buyPrice: 15,
      buyFees: 15,
      sellFees: 30,
      realizedPnlEgp: 1455,
      realizedPnlPercent: 96.04,
    });
  });

  it('makes Google Sheets reconstruction use the same canonical allocation', () => {
    const reconstructed = reconstructPortfolioFromTransactions(
      dcaPartialSellLedger,
      { COMI: 25 },
    );

    expect(reconstructed.positions).toHaveLength(1);
    expect(reconstructed.positions[0]).toMatchObject({
      ticker: 'COMI',
      shares: 100,
      avgBuyPrice: 15,
      totalFees: 15,
      currentPrice: 25,
    });

    expect(reconstructed.closedTrades).toHaveLength(1);
    expect(reconstructed.closedTrades[0]).toMatchObject({
      ticker: 'COMI',
      shares: 100,
      buyPrice: 15,
      buyFees: 15,
      sellFees: 30,
      realizedPnlEgp: 1455,
      realizedPnlPercent: 96.04,
    });
  });

  it('removes the duplicate FIFO accounting path from Google Sheets', () => {
    const sheets = readRelative('./googleSheets.ts');

    expect(sheets).toContain('reconcilePortfolioFromLedger');
    expect(sheets).toContain('sortTransactions');
    expect(sheets).not.toContain('lots.shift()');
    expect(sheets).not.toContain('const lot = lots[0]');
    expect(sheets).not.toContain('estimatedUnitCost = tx.price');
  });

  it('reuses canonical sell allocation in secondary analytics instead of cloning the formula', () => {
    const analytics = readRelative('./secondaryAnalytics.ts');

    expect(analytics).toContain('calculateSellAccounting(');
    expect(analytics).toContain('accounting.allocatedGrossCost');
    expect(analytics).toContain('accounting.allocatedBuyFees');
    expect(analytics).not.toContain('const allocatedGrossCost = state.grossCost * ratio');
    expect(analytics).not.toContain('const allocatedBuyFees = state.buyFees * ratio');
  });

  it('keeps Closed Cycles source phases for traceability without re-pricing realized cost', () => {
    const view = readRelative('../components/ClosedCyclesView.tsx');

    expect(view).toContain('const weightedAvgBuyPrice = ct.buyPrice;');
    expect(view).toContain('const weightedAvgSellPrice = ct.sellPrice;');
    expect(view).toContain('const netOutlay = netProceeds - ct.realizedPnlEgp;');
    expect(view).not.toContain(
      'buyPhases.reduce((acc, p) => acc + p.shares * p.price, 0)',
    );
  });
});
