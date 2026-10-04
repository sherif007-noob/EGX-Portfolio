import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { CanonicalCashFlowType, EGXTicker, TradeTransaction } from '../types';
import {
  createLedgerMutationExecutor,
  type CanonicalLedgerSnapshot,
  type LedgerMutationPreparation,
} from './ledgerMutationService';
import {
  prepareBuyTradeMutation,
  prepareSellTradeMutation,
} from './tradeLedgerMutations';
import {
  prepareCashBalanceAdjustmentMutation,
  prepareCashEntryMutation,
  prepareCashEventMutation,
  prepareLedgerReconciliationMutation,
  prepareLedgerSnapshotRestoreMutation,
  preparePortfolioRestoreMutation,
  prepareTransactionDeleteMutation,
  prepareTransactionEditMutation,
} from './ledgerWorkflowMutations';
import { prepareOcrBatchMutation } from './ocrLedgerMutations';
import { reconcilePortfolioFromLedger } from './portfolioReconciliation';
import { buildUnifiedAnalyticsResult } from './unifiedAnalyticsEngine';
import { calculateEquityBridge, isEquityBridgeBalanced } from './portfolioPerformance';
import { CANONICAL_COST_BASIS_METHOD } from './portfolioAccounting';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const ticker: EGXTicker = {
  ticker: 'COMI',
  nameEn: 'Commercial International Bank',
  nameAr: '',
  isin: 'EGS60121C018',
  sector: 'Banking',
  lastPrice: 16,
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
  targetPrice: 20,
  stopLoss: 8,
  lastUpdated: '2026-10-03T10:00:00.000Z',
  priceUpdatedAt: '2026-10-03T10:00:00.000Z',
};

function emptySnapshot(capitalDeposits = 10_000): CanonicalLedgerSnapshot {
  return {
    transactions: [],
    positions: [],
    closedTrades: [],
    cashBalance: capitalDeposits,
    capitalDeposits,
    tickers: [ticker],
  };
}

function materialize<T>(
  current: CanonicalLedgerSnapshot,
  prepared: LedgerMutationPreparation<T>,
): CanonicalLedgerSnapshot {
  const capitalDeposits = prepared.capitalDeposits ?? current.capitalDeposits;
  const tickers = prepared.tickers ?? current.tickers;
  const report = reconcilePortfolioFromLedger(
    prepared.transactions,
    tickers,
    capitalDeposits,
    prepared.positionSeed ?? current.positions,
  );
  return {
    transactions: prepared.transactions,
    positions: report.reconciledPositions,
    closedTrades: report.reconciledClosedTrades,
    cashBalance: report.reconciledCashBalance,
    capitalDeposits,
    tickers: [...tickers],
  };
}

function addBuy(
  current: CanonicalLedgerSnapshot,
  id: string,
  shares: number,
  price: number,
  fees: number,
  date: string,
  executedAt?: string,
) {
  return materialize(current, prepareBuyTradeMutation(current, {
    transactionId: id,
    ticker: 'COMI',
    companyName: ticker.nameEn,
    sector: 'Banking',
    shares,
    price,
    fees,
    date,
    executedAt,
  }));
}

function addSell(
  current: CanonicalLedgerSnapshot,
  id: string,
  sharesToSell: number,
  sellPrice: number,
  fees: number,
  sellDate: string,
  executedAt?: string,
) {
  return materialize(current, prepareSellTradeMutation(current, {
    transactionId: id,
    positionId: current.positions[0].id,
    sharesToSell,
    sellPrice,
    fees,
    sellDate,
    executedAt,
  }));
}

function cashTx(
  id: string,
  kind: CanonicalCashFlowType,
  amount: number,
  date: string,
): TradeTransaction {
  const signed =
    kind === 'WITHDRAWAL' || kind === 'FEE' || kind === 'OTHER_EXPENSE'
      ? -Math.abs(amount)
      : kind === 'RECONCILIATION_ADJUSTMENT'
        ? amount
        : Math.abs(amount);
  return {
    id,
    type: signed < 0 ? 'SELL' : 'BUY',
    ticker: 'CASH',
    companyName: 'Cash',
    sector: 'Liquid Buying Power',
    shares: Math.abs(amount),
    price: 1,
    fees: 0,
    totalAmount: Math.abs(amount),
    cashFlowType: kind,
    cashFlowAmount: kind === 'RECONCILIATION_ADJUSTMENT' ? amount : Math.abs(amount),
    date,
  };
}

describe('Stage 2.8 financial acceptance suite', () => {
  it('keeps weighted-average economics through DCA, repeated partial sells, full close, and reopen', () => {
    let current = emptySnapshot();

    current = addBuy(current, 'buy-1', 100, 10, 10, '2026-01-02');
    current = addBuy(current, 'buy-2', 100, 20, 20, '2026-01-03');

    expect(current.positions[0]).toMatchObject({
      shares: 200,
      avgBuyPrice: 15,
      totalFees: 30,
    });
    expect(current.cashBalance).toBe(6970);

    current = addSell(current, 'sell-1', 50, 30, 5, '2026-01-04');
    expect(current.positions[0]).toMatchObject({
      shares: 150,
      avgBuyPrice: 15,
      totalFees: 22.5,
    });
    expect(current.closedTrades[0]).toMatchObject({
      shares: 50,
      realizedPnlEgp: 737.5,
    });
    expect(current.cashBalance).toBe(8465);

    current = addSell(current, 'sell-2', 50, 25, 5, '2026-01-05');
    expect(current.positions[0]).toMatchObject({
      shares: 100,
      avgBuyPrice: 15,
      totalFees: 15,
    });
    expect(current.closedTrades[0]).toMatchObject({
      shares: 100,
      realizedPnlEgp: 1225,
    });
    expect(current.cashBalance).toBe(9710);

    current = addSell(current, 'sell-3', 100, 18, 10, '2026-01-06');
    expect(current.positions).toHaveLength(0);
    expect(current.closedTrades).toHaveLength(1);
    expect(current.closedTrades[0]).toMatchObject({
      shares: 200,
      buyPrice: 15,
      realizedPnlEgp: 1500,
    });
    expect(current.closedTrades[0].sellTransactionIds).toEqual([
      'sell-1',
      'sell-2',
      'sell-3',
    ]);
    expect(current.cashBalance).toBe(11_500);

    current = addBuy(current, 'buy-reopen', 40, 16, 4, '2026-01-07');
    expect(current.positions).toHaveLength(1);
    expect(current.positions[0]).toMatchObject({
      shares: 40,
      avgBuyPrice: 16,
      totalFees: 4,
    });
    expect(current.closedTrades).toHaveLength(1);
    expect(current.closedTrades[0].sellTransactionIds).toEqual([
      'sell-1',
      'sell-2',
      'sell-3',
    ]);
    expect(current.cashBalance).toBe(10_856);
  });

  it('reprices both realized and remaining cost when a source BUY is corrected after a partial sell', () => {
    let current = emptySnapshot();
    current = addBuy(current, 'buy-1', 100, 10, 10, '2026-01-02');
    current = addBuy(current, 'buy-2', 100, 20, 20, '2026-01-03');
    current = addSell(current, 'sell-1', 50, 30, 5, '2026-01-04');

    const originalBuy = current.transactions.find((tx) => tx.id === 'buy-1')!;
    const prepared = prepareTransactionEditMutation(current, {
      ...originalBuy,
      price: 12,
    });
    current = materialize(current, prepared);

    expect(current.positions[0]).toMatchObject({
      shares: 150,
      avgBuyPrice: 16,
      totalFees: 22.5,
    });
    expect(current.closedTrades[0]).toMatchObject({
      shares: 50,
      buyPrice: 16,
      realizedPnlEgp: 687.5,
    });
    expect(current.cashBalance).toBe(8265);
  });

  it('blocks duplicate OCR executions while accepting a distinct execution in the same import', () => {
    const existing: TradeTransaction = {
      id: 'existing-buy',
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
      date: '2026-02-01',
      executedAt: '2026-02-01T10:00:00+03:00',
    };
    const report = reconcilePortfolioFromLedger([existing], [ticker], 5000);
    const current: CanonicalLedgerSnapshot = {
      transactions: [existing],
      positions: report.reconciledPositions,
      closedTrades: report.reconciledClosedTrades,
      cashBalance: report.reconciledCashBalance,
      capitalDeposits: 5000,
      tickers: [ticker],
    };

    let sequence = 0;
    const prepared = prepareOcrBatchMutation(current, [
      {
        ticker: 'COMI',
        companyName: ticker.nameEn,
        sector: 'Banking',
        type: 'BUY',
        shares: 100,
        price: 10,
        fees: 10,
        date: '2026-02-01',
        executedAt: '2026-02-01T10:00:00+03:00',
      },
      {
        ticker: 'COMI',
        companyName: ticker.nameEn,
        sector: 'Banking',
        type: 'BUY',
        shares: 50,
        price: 9.5,
        fees: 5,
        date: '2026-02-01',
        executedAt: '2026-02-01T10:05:00+03:00',
      },
    ], () => `ocr-${++sequence}`);

    expect(prepared.value).toMatchObject({
      processedCount: 1,
      duplicateCount: 1,
      skippedCount: 0,
    });
    expect(prepared.transactions).toHaveLength(2);
    expect(prepared.transactions.filter((tx) => tx.id === 'existing-buy')).toHaveLength(1);
    expect(prepared.value?.transactionIds).toEqual(['ocr-1']);
  });

  it('keeps dated capital flows, cash performance, and reconciliation distinct inside one performance period', () => {
    const ledger: TradeTransaction[] = [
      cashTx('dep', 'DEPOSIT', 1000, '2026-03-01'),
      cashTx('div', 'DIVIDEND', 50, '2026-03-02'),
      cashTx('fee', 'FEE', 10, '2026-03-03'),
      cashTx('recon', 'RECONCILIATION_ADJUSTMENT', 100, '2026-03-04'),
      cashTx('wd', 'WITHDRAWAL', 200, '2026-03-05'),
    ];

    const report = reconcilePortfolioFromLedger(ledger, [], 800);
    expect(report.reconciledCashBalance).toBe(940);

    const bridge = calculateEquityBridge(
      800,
      [],
      [],
      report.reconciledCashBalance,
      ledger,
    );
    expect(bridge.cashPerformancePnl).toBe(40);
    expect(bridge.reconciliationAdjustments).toBe(100);
    expect(bridge.reconciliationDelta).toBe(0);
    expect(isEquityBridgeBalanced(bridge)).toBe(true);

    const performance = buildUnifiedAnalyticsResult(ledger, {}, 'ALL', {
      latestSessionDate: '2026-03-05',
    });
    expect(performance.points.at(-1)?.netDeposits).toBe(800);
    expect(performance.summary.endEquity).toBe(940);
    expect(performance.summary.pnlEgp).toBe(40);
    expect(performance.summary.twrPercent).toBeCloseTo(4, 8);
  });

  it('handles an exact same-day round trip deterministically from execution timestamps', () => {
    const ledger: TradeTransaction[] = [
      {
        id: 'buy-roundtrip',
        type: 'BUY',
        ticker: 'COMI',
        companyName: ticker.nameEn,
        sector: 'Banking',
        shares: 10,
        price: 10,
        fees: 1,
        totalAmount: 101,
        date: '2026-04-01',
        executedAt: '2026-04-01T10:00:00+03:00',
      },
      {
        id: 'sell-roundtrip',
        type: 'SELL',
        ticker: 'COMI',
        companyName: ticker.nameEn,
        sector: 'Banking',
        shares: 10,
        price: 12,
        fees: 1,
        totalAmount: 119,
        date: '2026-04-01',
        executedAt: '2026-04-01T10:30:00+03:00',
      },
    ];

    const report = reconcilePortfolioFromLedger(ledger, [ticker], 1000);
    expect(report.discrepanciesFound).toEqual([]);
    expect(report.reconciledPositions).toEqual([]);
    expect(report.reconciledClosedTrades).toHaveLength(1);
    expect(report.reconciledClosedTrades[0]).toMatchObject({
      shares: 10,
      realizedPnlEgp: 18,
      holdingDays: 0,
    });
    expect(report.reconciledCashBalance).toBe(1018);
  });

  it('keeps local state unchanged when persistence fails across every Stage 2 mutation family', async () => {
    const base = addBuy(emptySnapshot(5000), 'base-buy', 100, 10, 10, '2026-05-01');
    const depositPrepared = prepareCashEventMutation(
      base,
      'DEPOSIT',
      200,
      'stage28 deposit',
      '2026-05-02',
    );
    const cashCurrent = materialize(base, depositPrepared);
    const cashRow = cashCurrent.transactions.find(
      (tx) => tx.cashFlowType === 'DEPOSIT' && tx.notes === 'stage28 deposit',
    )!;

    const cases: Array<{
      name: string;
      current: CanonicalLedgerSnapshot;
      prepare: (current: Readonly<CanonicalLedgerSnapshot>) => LedgerMutationPreparation<unknown>;
    }> = [
      {
        name: 'BUY',
        current: base,
        prepare: (current) => prepareBuyTradeMutation(current, {
          transactionId: 'failed-buy',
          ticker: 'COMI',
          companyName: ticker.nameEn,
          sector: 'Banking',
          shares: 1,
          price: 10,
          fees: 0,
          date: '2026-05-03',
        }),
      },
      {
        name: 'SELL',
        current: base,
        prepare: (current) => prepareSellTradeMutation(current, {
          transactionId: 'failed-sell',
          positionId: current.positions[0].id,
          sharesToSell: 1,
          sellPrice: 11,
          fees: 0,
          sellDate: '2026-05-03',
        }),
      },
      {
        name: 'TRANSACTION_EDIT',
        current: base,
        prepare: (current) => prepareTransactionEditMutation(current, {
          ...current.transactions[0],
          notes: 'must not apply',
        }),
      },
      {
        name: 'TRANSACTION_DELETE',
        current: base,
        prepare: (current) => prepareTransactionDeleteMutation(
          current,
          current.transactions[0].id,
        ),
      },
      {
        name: 'CASH_EVENT',
        current: base,
        prepare: (current) => prepareCashEventMutation(
          current,
          'DIVIDEND',
          25,
          'failed dividend',
          '2026-05-03',
        ),
      },
      {
        name: 'CASH_ENTRY_EDIT',
        current: cashCurrent,
        prepare: (current) => prepareCashEntryMutation(
          current,
          cashRow.id,
          {
            type: 'WITHDRAWAL',
            amount: 50,
            date: '2026-05-04',
            notes: 'must not apply',
          },
        ),
      },
      {
        name: 'CASH_RECONCILIATION',
        current: base,
        prepare: (current) => prepareCashBalanceAdjustmentMutation(
          current,
          current.cashBalance + 50,
        ),
      },
      {
        name: 'LEDGER_RECONCILIATION',
        current: base,
        prepare: (current) => prepareLedgerReconciliationMutation(current),
      },
      {
        name: 'OCR_BATCH',
        current: base,
        prepare: (current) => prepareOcrBatchMutation(current, [{
          ticker: 'COMI',
          companyName: ticker.nameEn,
          sector: 'Banking',
          type: 'BUY',
          shares: 2,
          price: 9,
          fees: 0,
          date: '2026-05-03',
          executedAt: '2026-05-03T10:00:00+03:00',
        }], () => 'failed-ocr'),
      },
      {
        name: 'PORTFOLIO_RESTORE',
        current: base,
        prepare: (current) => preparePortfolioRestoreMutation(current, {
          transactions: current.transactions,
          capitalDeposits: current.capitalDeposits,
          positions: current.positions,
          closedTrades: current.closedTrades,
          cashBalance: current.cashBalance,
          tickers: current.tickers,
        }),
      },
      {
        name: 'SNAPSHOT_RESTORE',
        current: base,
        prepare: (current) => prepareLedgerSnapshotRestoreMutation(current, {
          transactions: current.transactions,
          capitalDeposits: current.capitalDeposits,
          positions: current.positions,
        }),
      },
    ];

    for (const testCase of cases) {
      const persist = vi.fn(async () => false);
      const apply = vi.fn();
      const executor = createLedgerMutationExecutor({ persist });
      const before = structuredClone(testCase.current);

      const result = await executor.execute({
        kind: testCase.name,
        current: testCase.current,
        prepare: testCase.prepare,
        apply,
      });

      expect(result).toMatchObject({
        ok: false,
        stage: 'persist',
        code: 'PERSIST_FAILED',
        persisted: false,
      });
      expect(persist).toHaveBeenCalledTimes(1);
      expect(apply).not.toHaveBeenCalled();
      expect(testCase.current).toEqual(before);
    }
  });

  it('locks the complete Stage 2 exit contract at the runtime boundaries', () => {
    expect(CANONICAL_COST_BASIS_METHOD).toBe('WEIGHTED_AVERAGE_PROPORTIONAL');

    const executor = readRelative('./ledgerMutationService.ts');
    const hooks = readRelative('../hooks/usePortfolioState.ts');
    const navigation = readRelative('../features/app-shell/usePortfolioNavigation.ts');
    const workflow = readRelative('./ledgerWorkflowMutations.ts');

    expect(executor.indexOf('persisted = await persist(candidate.snapshot)'))
      .toBeLessThan(executor.indexOf('request.apply(candidate.snapshot, candidate.value)'));

    expect(hooks).toContain('createLedgerMutationExecutor');
    for (const preparation of [
      'prepareBuyTradeMutation',
      'prepareSellTradeMutation',
      'prepareTransactionEditMutation',
      'prepareTransactionDeleteMutation',
      'prepareCashEventMutation',
      'prepareCashEntryMutation',
      'prepareCashBalanceAdjustmentMutation',
      'prepareOcrBatchMutation',
      'preparePortfolioRestoreMutation',
      'prepareLedgerSnapshotRestoreMutation',
      'prepareLedgerReconciliationMutation',
    ]) {
      expect(hooks).toContain(preparation);
    }

    const tradeRuntime = [
      hooks,
      readRelative('../components/AddTradeModal.tsx'),
      readRelative('./tradeLedgerMutations.ts'),
    ].join('\n');
    expect(tradeRuntime).not.toContain('deductFromCash');
    expect(tradeRuntime).not.toContain('addToCash');
    expect(tradeRuntime).not.toContain('setDeductFromCash');

    expect(navigation).toContain('getActivePositionLedgerTransactionIds');
    expect(navigation).toContain('getClosedCycleLedgerTransactionIds');
    expect(workflow).toContain("'RECONCILIATION_ADJUSTMENT'");
  });

  it('keeps fresher remote quote precedence protected during accounting writes', () => {
    const source = readRelative('./supabasePersistence.ts');
    expect(source).toContain('price_updated_at.is.null,price_updated_at.lte.');
    expect(source).toContain('persistTickerQuotes');

    const stalePosition = {
      id: 'pos-comi',
      ticker: 'COMI',
      companyName: ticker.nameEn,
      sector: 'Banking' as const,
      shares: 10,
      avgBuyPrice: 10,
      currentPrice: 11,
      buyDate: '2026-06-01',
      totalFees: 0,
      priceUpdatedAt: '2026-06-01T10:00:00.000Z',
    };
    const fresherTicker = {
      ...ticker,
      lastPrice: 15,
      priceUpdatedAt: '2026-06-01T11:00:00.000Z',
    };
    const buy: TradeTransaction = {
      id: 'quote-buy',
      type: 'BUY',
      ticker: 'COMI',
      companyName: ticker.nameEn,
      sector: 'Banking',
      shares: 10,
      price: 10,
      fees: 0,
      totalAmount: 100,
      date: '2026-06-01',
    };

    const report = reconcilePortfolioFromLedger(
      [buy],
      [fresherTicker],
      1000,
      [stalePosition],
    );
    expect(report.reconciledPositions[0]).toMatchObject({
      currentPrice: 15,
      priceUpdatedAt: '2026-06-01T11:00:00.000Z',
    });
  });
});
