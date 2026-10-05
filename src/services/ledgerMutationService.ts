import type {
  ClosedTrade,
  EGXTicker,
  Position,
  TradeTransaction,
} from '../types';
import { normalizeTransaction } from '../utils/portfolioMetrics';
import { reconcilePortfolioFromLedger } from './portfolioReconciliation';
import { forceFullSyncToFirestore } from './firestoreStorage';

export interface CanonicalLedgerSnapshot {
  transactions: TradeTransaction[];
  positions: Position[];
  closedTrades: ClosedTrade[];
  cashBalance: number;
  capitalDeposits: number;
  tickers: EGXTicker[];
}

export interface LedgerMutationPreparation<TResult = unknown> {
  /**
   * The candidate source ledger. Positions, closed trades and cash are never
   * accepted as authoritative mutation inputs; they are rebuilt below.
   */
  transactions: TradeTransaction[];
  capitalDeposits?: number;
  tickers?: EGXTicker[];
  /**
   * Existing position metadata/quotes used only as reconciliation seeds.
   * Shares/cost/cash are still derived from the ledger.
   */
  positionSeed?: Position[];
  value?: TResult;
}

export interface LedgerMutationRequest<TResult = unknown> {
  kind: string;
  current: CanonicalLedgerSnapshot;
  prepare: (
    current: Readonly<CanonicalLedgerSnapshot>,
  ) => LedgerMutationPreparation<TResult> | Promise<LedgerMutationPreparation<TResult>>;
  apply: (snapshot: CanonicalLedgerSnapshot, value: TResult | undefined) => void;
}

export type LedgerMutationFailureStage =
  | 'busy'
  | 'prepare'
  | 'validate'
  | 'persist'
  | 'apply';

export interface LedgerMutationSuccess<TResult = unknown> {
  ok: true;
  kind: string;
  persisted: true;
  snapshot: CanonicalLedgerSnapshot;
  value: TResult | undefined;
}

export interface LedgerMutationFailure {
  ok: false;
  kind: string;
  persisted: boolean;
  stage: LedgerMutationFailureStage;
  code:
    | 'BUSY'
    | 'PREPARE_FAILED'
    | 'VALIDATION_FAILED'
    | 'PERSIST_FAILED'
    | 'APPLY_FAILED';
  error: Error;
}

export type LedgerMutationResult<TResult = unknown> =
  | LedgerMutationSuccess<TResult>
  | LedgerMutationFailure;

export interface LedgerMutationExecutor {
  execute<TResult = unknown>(
    request: LedgerMutationRequest<TResult>,
  ): Promise<LedgerMutationResult<TResult>>;
  isBusy(): boolean;
  activeKind(): string | null;
}

interface LedgerMutationExecutorDependencies {
  persist?: (snapshot: CanonicalLedgerSnapshot) => Promise<boolean>;
}

interface CanonicalCandidate<TResult> {
  snapshot: CanonicalLedgerSnapshot;
  value: TResult | undefined;
}

const EPSILON = 0.000001;

function errorFromUnknown(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'string' && error.trim()) return new Error(error);
  return new Error(fallback);
}

function fail(
  kind: string,
  stage: LedgerMutationFailureStage,
  code: LedgerMutationFailure['code'],
  error: unknown,
  persisted = false,
): LedgerMutationFailure {
  return {
    ok: false,
    kind,
    stage,
    code,
    persisted,
    error: errorFromUnknown(error, 'Financial mutation failed.'),
  };
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
}

function assertFiniteNonNegative(value: number, label: string): void {
  assertFinite(value, label);
  if (value < 0) throw new Error(`${label} must be non-negative.`);
}

function validateTransaction(transaction: TradeTransaction, index: number): void {
  const label = `Transaction ${transaction.id || index + 1}`;
  if (!transaction.id?.trim()) throw new Error(`${label} requires an id.`);
  if (!transaction.ticker?.trim()) throw new Error(`${label} requires a ticker.`);
  if (transaction.type !== 'BUY' && transaction.type !== 'SELL' && transaction.type !== 'BONUS_SHARES') {
    throw new Error(`${label} has an unsupported transaction type.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}/.test(transaction.date || '') || !Number.isFinite(Date.parse(transaction.date))) {
    throw new Error(`${label} requires a valid date.`);
  }
  assertFinite(transaction.shares, `${label} shares`);
  if (transaction.shares <= EPSILON) throw new Error(`${label} shares must be greater than zero.`);
  assertFiniteNonNegative(transaction.price, `${label} price`);
  assertFiniteNonNegative(transaction.fees ?? 0, `${label} fees`);
  assertFiniteNonNegative(transaction.totalAmount, `${label} total amount`);
  if (transaction.type === 'BONUS_SHARES') {
    if (transaction.ticker.trim().toUpperCase() === 'CASH') throw new Error(`${label} bonus shares require a security ticker.`);
    if (Math.abs(transaction.price) > EPSILON) throw new Error(`${label} bonus shares must have zero price.`);
    if (Math.abs(transaction.fees ?? 0) > EPSILON) throw new Error(`${label} bonus shares must have zero fees.`);
    if (Math.abs(transaction.totalAmount) > EPSILON) throw new Error(`${label} bonus shares must have zero total amount.`);
    if (transaction.netCashImpact != null && Math.abs(transaction.netCashImpact) > EPSILON) {
      throw new Error(`${label} bonus shares must have zero cash impact.`);
    }
  }
  if (transaction.cashFlowAmount != null) assertFinite(transaction.cashFlowAmount, `${label} cash flow amount`);
  if (transaction.grossTradeValue != null) assertFiniteNonNegative(transaction.grossTradeValue, `${label} gross trade value`);
  if (transaction.netCashImpact != null) assertFinite(transaction.netCashImpact, `${label} net cash impact`);
  if (transaction.realizedPnlEgp != null) assertFinite(transaction.realizedPnlEgp, `${label} realized P&L`);
  if (transaction.realizedPnlPercent != null) assertFinite(transaction.realizedPnlPercent, `${label} realized P&L percent`);
}

function validatePosition(position: Position, index: number): void {
  const label = `Position ${position.id || index + 1}`;
  if (!position.id?.trim()) throw new Error(`${label} requires an id.`);
  if (!position.ticker?.trim()) throw new Error(`${label} requires a ticker.`);
  assertFinite(position.shares, `${label} shares`);
  if (position.shares <= EPSILON) throw new Error(`${label} shares must be greater than zero.`);
  assertFiniteNonNegative(position.avgBuyPrice, `${label} average buy price`);
  assertFiniteNonNegative(position.currentPrice, `${label} current price`);
  assertFiniteNonNegative(position.totalFees ?? 0, `${label} fees`);
  if (position.targetPrice != null) assertFiniteNonNegative(position.targetPrice, `${label} target price`);
  if (position.stopLoss != null) assertFiniteNonNegative(position.stopLoss, `${label} stop loss`);
}

function validateClosedTrade(trade: ClosedTrade, index: number): void {
  const label = `Closed trade ${trade.id || index + 1}`;
  if (!trade.id?.trim()) throw new Error(`${label} requires an id.`);
  if (!trade.ticker?.trim()) throw new Error(`${label} requires a ticker.`);
  assertFinite(trade.shares, `${label} shares`);
  if (trade.shares <= EPSILON) throw new Error(`${label} shares must be greater than zero.`);
  assertFiniteNonNegative(trade.buyPrice, `${label} buy price`);
  assertFiniteNonNegative(trade.sellPrice, `${label} sell price`);
  assertFinite(trade.realizedPnlEgp, `${label} realized P&L`);
  assertFinite(trade.realizedPnlPercent, `${label} realized P&L percent`);
  assertFiniteNonNegative(trade.totalFees ?? 0, `${label} fees`);
  assertFiniteNonNegative(trade.holdingDays ?? 0, `${label} holding days`);
}

function normalizedSnapshot(snapshot: CanonicalLedgerSnapshot): CanonicalLedgerSnapshot {
  return {
    transactions: snapshot.transactions.map(normalizeTransaction),
    positions: [...snapshot.positions],
    closedTrades: [...snapshot.closedTrades],
    cashBalance: snapshot.cashBalance,
    capitalDeposits: snapshot.capitalDeposits,
    tickers: [...snapshot.tickers],
  };
}

function buildCandidate<TResult>(
  current: CanonicalLedgerSnapshot,
  prepared: LedgerMutationPreparation<TResult>,
): CanonicalCandidate<TResult> {
  const transactions = prepared.transactions.map(normalizeTransaction);
  const tickers = prepared.tickers ?? current.tickers;
  const capitalDeposits = prepared.capitalDeposits ?? current.capitalDeposits;
  const positionSeed = prepared.positionSeed ?? current.positions;

  assertFiniteNonNegative(capitalDeposits, 'Capital deposits');

  const report = reconcilePortfolioFromLedger(
    transactions,
    tickers,
    capitalDeposits,
    positionSeed,
  );

  return {
    snapshot: {
      transactions,
      positions: report.reconciledPositions,
      closedTrades: report.reconciledClosedTrades,
      cashBalance: report.reconciledCashBalance,
      capitalDeposits,
      tickers: [...tickers],
    },
    value: prepared.value,
  };
}

export function validateLedgerMutationCandidate(
  current: CanonicalLedgerSnapshot,
  candidate: CanonicalLedgerSnapshot,
): void {
  assertFinite(candidate.cashBalance, 'Cash balance');
  assertFiniteNonNegative(candidate.capitalDeposits, 'Capital deposits');

  const transactionIds = new Set<string>();
  candidate.transactions.forEach((transaction, index) => {
    validateTransaction(transaction, index);
    if (transactionIds.has(transaction.id)) {
      throw new Error(`Duplicate transaction id: ${transaction.id}`);
    }
    transactionIds.add(transaction.id);
  });

  candidate.positions.forEach(validatePosition);
  candidate.closedTrades.forEach(validateClosedTrade);

  const positionTickers = new Set<string>();
  for (const position of candidate.positions) {
    const ticker = position.ticker.trim().toUpperCase();
    if (positionTickers.has(ticker)) throw new Error(`Duplicate open position projection: ${ticker}`);
    positionTickers.add(ticker);
  }

  const baseline = reconcilePortfolioFromLedger(
    current.transactions.map(normalizeTransaction),
    current.tickers,
    current.capitalDeposits,
    current.positions,
  );
  const proposed = reconcilePortfolioFromLedger(
    candidate.transactions,
    candidate.tickers,
    candidate.capitalDeposits,
    candidate.positions,
  );

  const baselineDiscrepancies = new Set(baseline.discrepanciesFound);
  const introduced = proposed.discrepanciesFound.filter(
    (item) => !baselineDiscrepancies.has(item),
  );
  if (introduced.length > 0) {
    throw new Error(`Mutation introduces reconciliation discrepancies: ${introduced.join(' | ')}`);
  }

  if (Math.abs(proposed.reconciledCashBalance - candidate.cashBalance) > 0.005) {
    throw new Error('Candidate cash balance does not match ledger reconciliation.');
  }
}

async function persistCanonicalSnapshot(snapshot: CanonicalLedgerSnapshot): Promise<boolean> {
  return forceFullSyncToFirestore(snapshot);
}

export function createLedgerMutationExecutor(
  dependencies: LedgerMutationExecutorDependencies = {},
): LedgerMutationExecutor {
  const persist = dependencies.persist ?? persistCanonicalSnapshot;
  let inFlightKind: string | null = null;

  return {
    isBusy: () => inFlightKind !== null,
    activeKind: () => inFlightKind,

    async execute<TResult>(
      request: LedgerMutationRequest<TResult>,
    ): Promise<LedgerMutationResult<TResult>> {
      const kind = request.kind.trim() || 'UNKNOWN_MUTATION';

      if (inFlightKind !== null) {
        return fail(
          kind,
          'busy',
          'BUSY',
          new Error(`Financial mutation "${inFlightKind}" is still in flight.`),
        );
      }

      inFlightKind = kind;
      try {
        const current = normalizedSnapshot(request.current);

        let prepared: LedgerMutationPreparation<TResult>;
        try {
          prepared = await request.prepare(current);
        } catch (error) {
          return fail(kind, 'prepare', 'PREPARE_FAILED', error);
        }

        let candidate: CanonicalCandidate<TResult>;
        try {
          candidate = buildCandidate(current, prepared);
          validateLedgerMutationCandidate(current, candidate.snapshot);
        } catch (error) {
          return fail(kind, 'validate', 'VALIDATION_FAILED', error);
        }

        let persisted = false;
        try {
          persisted = await persist(candidate.snapshot);
        } catch (error) {
          return fail(kind, 'persist', 'PERSIST_FAILED', error);
        }

        if (!persisted) {
          return fail(
            kind,
            'persist',
            'PERSIST_FAILED',
            new Error('Authoritative portfolio persistence returned false.'),
          );
        }

        try {
          request.apply(candidate.snapshot, candidate.value);
        } catch (error) {
          return fail(kind, 'apply', 'APPLY_FAILED', error, true);
        }

        return {
          ok: true,
          kind,
          persisted: true,
          snapshot: candidate.snapshot,
          value: candidate.value,
        };
      } finally {
        inFlightKind = null;
      }
    },
  };
}
