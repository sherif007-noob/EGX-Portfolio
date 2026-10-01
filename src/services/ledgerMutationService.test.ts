import { describe, expect, it, vi } from 'vitest';
import type { EGXTicker, Position, TradeTransaction } from '../types';
import {
  createLedgerMutationExecutor,
  type CanonicalLedgerSnapshot,
} from './ledgerMutationService';

const ticker = (symbol = 'COMI'): EGXTicker => ({
  ticker: symbol,
  nameEn: symbol,
  nameAr: '',
  isin: `EGS-${symbol}`,
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
  targetPrice: 0,
  stopLoss: 0,
  lastUpdated: '2026-09-30T09:00:00.000Z',
});

const buy = (
  id: string,
  shares = 10,
  price = 10,
  fees = 0,
  tickerSymbol = 'COMI',
): TradeTransaction => ({
  id,
  type: 'BUY',
  ticker: tickerSymbol,
  companyName: tickerSymbol,
  sector: 'Banking',
  shares,
  price,
  fees,
  totalAmount: shares * price + fees,
  grossTradeValue: shares * price,
  netCashImpact: -(shares * price + fees),
  date: '2026-09-01',
});

const sell = (
  id: string,
  shares = 5,
  price = 12,
  tickerSymbol = 'COMI',
): TradeTransaction => ({
  id,
  type: 'SELL',
  ticker: tickerSymbol,
  companyName: tickerSymbol,
  sector: 'Banking',
  shares,
  price,
  fees: 0,
  totalAmount: shares * price,
  grossTradeValue: shares * price,
  netCashImpact: shares * price,
  date: '2026-09-02',
});

const positionSeed = (): Position => ({
  id: 'pos-comi',
  ticker: 'COMI',
  companyName: 'COMI',
  sector: 'Banking',
  shares: 10,
  avgBuyPrice: 10,
  currentPrice: 12,
  buyDate: '2026-09-01',
  totalFees: 0,
  targetPrice: 15,
  stopLoss: 9,
});

const currentSnapshot = (
  transactions: TradeTransaction[] = [buy('buy-1')],
): CanonicalLedgerSnapshot => ({
  transactions,
  positions: [positionSeed()],
  closedTrades: [],
  cashBalance: 900,
  capitalDeposits: 1000,
  tickers: [ticker()],
});

describe('canonical ledger mutation executor', () => {
  it('derives projections from the candidate ledger and applies only after persistence', async () => {
    const events: string[] = [];
    const persisted: CanonicalLedgerSnapshot[] = [];
    const executor = createLedgerMutationExecutor({
      persist: async (snapshot) => {
        events.push('persist');
        persisted.push(snapshot);
        return true;
      },
    });

    const result = await executor.execute({
      kind: 'SELL',
      current: currentSnapshot(),
      prepare: () => ({
        transactions: [buy('buy-1'), sell('sell-1')],
        value: 'sell-1',
      }),
      apply: (snapshot, value) => {
        events.push('apply');
        expect(value).toBe('sell-1');
        expect(snapshot.positions).toHaveLength(1);
        expect(snapshot.positions[0].shares).toBe(5);
        expect(snapshot.cashBalance).toBe(960);
      },
    });

    expect(result.ok).toBe(true);
    expect(events).toEqual(['persist', 'apply']);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].positions[0].shares).toBe(5);
    expect(persisted[0].closedTrades).toHaveLength(1);
    expect(persisted[0].cashBalance).toBe(960);
  });

  it('does not apply local state when authoritative persistence fails', async () => {
    const apply = vi.fn();
    const executor = createLedgerMutationExecutor({
      persist: vi.fn(async () => false),
    });

    const result = await executor.execute({
      kind: 'BUY',
      current: currentSnapshot(),
      prepare: (current) => ({
        transactions: [...current.transactions, buy('buy-2', 2, 11)],
      }),
      apply,
    });

    expect(result).toMatchObject({
      ok: false,
      stage: 'persist',
      code: 'PERSIST_FAILED',
      persisted: false,
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it('does not persist or apply when prepare throws', async () => {
    const persist = vi.fn(async () => true);
    const apply = vi.fn();
    const executor = createLedgerMutationExecutor({ persist });

    const result = await executor.execute({
      kind: 'EDIT_TRANSACTION',
      current: currentSnapshot(),
      prepare: () => {
        throw new Error('invalid edit');
      },
      apply,
    });

    expect(result).toMatchObject({
      ok: false,
      stage: 'prepare',
      code: 'PREPARE_FAILED',
    });
    expect(persist).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });

  it('rejects malformed ledger rows before persistence', async () => {
    const persist = vi.fn(async () => true);
    const executor = createLedgerMutationExecutor({ persist });

    const duplicate = buy('buy-1', 2, 11);
    const result = await executor.execute({
      kind: 'BUY',
      current: currentSnapshot(),
      prepare: (current) => ({
        transactions: [...current.transactions, duplicate],
      }),
      apply: vi.fn(),
    });

    expect(result).toMatchObject({
      ok: false,
      stage: 'validate',
      code: 'VALIDATION_FAILED',
    });
    if (!('error' in result)) throw new Error('Expected duplicate transaction validation to fail.');
    expect(result.error.message).toContain('Duplicate transaction id');
    expect(persist).not.toHaveBeenCalled();
  });

  it('rejects a mutation that introduces a new oversell discrepancy', async () => {
    const persist = vi.fn(async () => true);
    const executor = createLedgerMutationExecutor({ persist });

    const result = await executor.execute({
      kind: 'SELL',
      current: currentSnapshot(),
      prepare: (current) => ({
        transactions: [...current.transactions, sell('sell-too-many', 20)],
      }),
      apply: vi.fn(),
    });

    expect(result).toMatchObject({
      ok: false,
      stage: 'validate',
      code: 'VALIDATION_FAILED',
    });
    if (!('error' in result)) throw new Error('Expected oversell validation to fail.');
    expect(result.error.message).toContain('introduces reconciliation discrepancies');
    expect(persist).not.toHaveBeenCalled();
  });

  it('does not brick mutations solely because the baseline already contains a legacy discrepancy', async () => {
    const legacy = [buy('buy-1', 10), sell('legacy-oversell', 20)];
    const persist = vi.fn(async () => true);
    const executor = createLedgerMutationExecutor({ persist });

    const result = await executor.execute({
      kind: 'NOOP_REPAIR_BOUNDARY',
      current: {
        ...currentSnapshot(legacy),
        positions: [],
        cashBalance: 1020,
      },
      prepare: (current) => ({
        transactions: current.transactions,
      }),
      apply: vi.fn(),
    });

    expect(result.ok).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('serializes financial mutations and rejects a second operation while one is in flight', async () => {
    let releasePersist!: (value: boolean) => void;
    const persist = vi.fn(() => new Promise<boolean>((resolve) => {
      releasePersist = resolve;
    }));
    const executor = createLedgerMutationExecutor({ persist });

    const first = executor.execute({
      kind: 'BUY',
      current: currentSnapshot(),
      prepare: (current) => ({
        transactions: [...current.transactions, buy('buy-2', 1, 11)],
      }),
      apply: vi.fn(),
    });

    await vi.waitFor(() => expect(executor.isBusy()).toBe(true));
    expect(executor.activeKind()).toBe('BUY');

    const second = await executor.execute({
      kind: 'SELL',
      current: currentSnapshot(),
      prepare: (current) => ({
        transactions: [...current.transactions, sell('sell-2', 1)],
      }),
      apply: vi.fn(),
    });

    expect(second).toMatchObject({
      ok: false,
      stage: 'busy',
      code: 'BUSY',
      persisted: false,
    });
    expect(persist).toHaveBeenCalledTimes(1);

    releasePersist(true);
    expect((await first).ok).toBe(true);
    expect(executor.isBusy()).toBe(false);
  });

  it('reports apply failure distinctly after persistence has succeeded', async () => {
    const executor = createLedgerMutationExecutor({
      persist: vi.fn(async () => true),
    });

    const result = await executor.execute({
      kind: 'BUY',
      current: currentSnapshot(),
      prepare: (current) => ({
        transactions: [...current.transactions, buy('buy-2', 1, 11)],
      }),
      apply: () => {
        throw new Error('react state unavailable');
      },
    });

    expect(result).toMatchObject({
      ok: false,
      stage: 'apply',
      code: 'APPLY_FAILED',
      persisted: true,
    });
  });

  it('preserves position-authored metadata through the reconciliation seed', async () => {
    const persist = vi.fn(async () => true);
    const executor = createLedgerMutationExecutor({ persist });

    const seeded: Position = {
      ...positionSeed(),
      targetPrice: 18,
      stopLoss: 8.5,
      notes: 'updated thesis',
    };

    const result = await executor.execute({
      kind: 'POSITION_METADATA',
      current: currentSnapshot(),
      prepare: (current) => ({
        transactions: current.transactions,
        positionSeed: [seeded],
      }),
      apply: vi.fn(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.positions[0]).toMatchObject({
      id: 'pos-comi',
      targetPrice: 18,
      stopLoss: 8.5,
      notes: 'updated thesis',
    });
  });
});
