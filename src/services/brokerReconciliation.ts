import type { EGXTicker, Position, TradeTransaction } from '../types';
import { isBonusSharesTransaction } from './corporateActions';
import { cashFlowSignedImpact } from './cashFlowSemantics';
import { sortTransactions } from './portfolioReconciliation';
import { resolveTickerFromDirectory } from './tickerRegistry';

const EPSILON = 0.000001;

export interface BrokerSnapshotPosition {
  ticker: string;
  shares: number;
  avgPrice?: number;
}

export interface BrokerSnapshot {
  brokerName: string;
  asOfDate: string;
  cashBalance: number;
  positions: BrokerSnapshotPosition[];
}

export type BrokerPositionMatchStatus =
  | 'MATCH'
  | 'SHARE_MISMATCH'
  | 'MISSING_IN_APP'
  | 'MISSING_AT_BROKER';

export interface BrokerLedgerEvidence {
  id: string;
  date: string;
  type: TradeTransaction['type'];
  shareDelta: number;
  cashImpact: number;
  label: string;
}

export interface BrokerPositionReconciliationRow {
  ticker: string;
  companyName: string;
  status: BrokerPositionMatchStatus;
  brokerShares: number;
  appShares: number;
  differenceShares: number;
  appPosition?: Position;
  ledgerTransactionIds: string[];
  ledgerEvidence: BrokerLedgerEvidence[];
  explanation: string;
}

export interface BrokerCashReconciliation {
  brokerCash: number;
  appCash: number;
  differenceCash: number;
  matches: boolean;
  ledgerEvidence: BrokerLedgerEvidence[];
  explanation: string;
}

export interface BrokerReconciliationReport {
  brokerName: string;
  asOfDate: string;
  rows: BrokerPositionReconciliationRow[];
  cash: BrokerCashReconciliation;
  matchedPositions: number;
  mismatchedPositions: number;
  brokerPositionCount: number;
  appPositionCount: number;
  isFullyMatched: boolean;
}

function normalizeTicker(value: unknown): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^EGX:/, '')
    .replace(/\.CA$/, '');
}

function finiteNumber(value: unknown, label: string): number {
  const normalized = typeof value === 'string'
    ? value.replace(/[,\s]/g, '')
    : value;
  const number = Number(normalized);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a valid number.`);
  return number;
}

function shareDelta(transaction: TradeTransaction): number {
  if (transaction.cashFlowType || normalizeTicker(transaction.ticker) === 'CASH') return 0;

  const shares = Number(transaction.shares);
  if (transaction.type === 'BUY') return Number.isFinite(shares) ? shares : 0;
  if (transaction.type === 'SELL') return Number.isFinite(shares) ? -shares : 0;
  if (isBonusSharesTransaction(transaction)) return Number.isFinite(shares) ? shares : 0;

  if (
    transaction.type === 'IPO_SUBSCRIPTION'
    && transaction.ipoSubscription?.status === 'ALLOCATED'
  ) {
    const allocated = Number(transaction.ipoSubscription.allocatedShares ?? transaction.shares);
    return Number.isFinite(allocated) ? allocated : 0;
  }

  return 0;
}

function cashImpact(transaction: TradeTransaction): number {
  if (transaction.cashFlowType) {
    return cashFlowSignedImpact(
      transaction.cashFlowType,
      transaction.cashFlowAmount ?? transaction.totalAmount,
    ) ?? 0;
  }

  if (transaction.type === 'CORPORATE_ACTION') return 0;

  if (transaction.type === 'IPO_SUBSCRIPTION' && transaction.ipoSubscription) {
    if (transaction.ipoSubscription.status === 'SUBMITTED') {
      return -Number(transaction.ipoSubscription.requestedAmount || 0);
    }
    if (transaction.ipoSubscription.status === 'ALLOCATED') {
      return -Number(transaction.totalAmount || transaction.ipoSubscription.allocatedAmount || 0);
    }
    return 0;
  }

  const explicit = Number(transaction.netCashImpact);
  if (Number.isFinite(explicit)) return explicit;

  const amount = Math.abs(Number(transaction.totalAmount || 0));
  if (!Number.isFinite(amount)) return 0;
  if (transaction.type === 'BUY') return -amount;
  if (transaction.type === 'SELL') return amount;
  return 0;
}

function evidenceFor(transaction: TradeTransaction): BrokerLedgerEvidence {
  const delta = shareDelta(transaction);
  const impact = cashImpact(transaction);
  const action = transaction.cashFlowType
    ? transaction.cashFlowType
    : transaction.type === 'CORPORATE_ACTION'
      ? transaction.corporateActionType || transaction.type
      : transaction.type;

  return {
    id: transaction.id,
    date: transaction.date,
    type: transaction.type,
    shareDelta: delta,
    cashImpact: impact,
    label: `${action} ${normalizeTicker(transaction.ticker)}`,
  };
}

function activeTickerEvidence(
  transactions: TradeTransaction[],
  ticker: string,
): BrokerLedgerEvidence[] {
  const target = normalizeTicker(ticker);
  let runningShares = 0;
  let currentCycle: BrokerLedgerEvidence[] = [];
  const allTickerEvidence: BrokerLedgerEvidence[] = [];

  for (const transaction of sortTransactions(transactions)) {
    if (normalizeTicker(transaction.ticker) !== target) continue;
    if (transaction.cashFlowType || normalizeTicker(transaction.ticker) === 'CASH') continue;

    const delta = shareDelta(transaction);
    if (Math.abs(delta) <= EPSILON) continue;

    const evidence = evidenceFor(transaction);
    allTickerEvidence.push(evidence);

    if (runningShares <= EPSILON && delta > 0) currentCycle = [];
    currentCycle.push(evidence);
    runningShares += delta;

    if (runningShares <= EPSILON) {
      runningShares = 0;
      currentCycle = [];
    }
  }

  return currentCycle.length > 0
    ? currentCycle
    : allTickerEvidence.slice(-12);
}

function recentCashEvidence(transactions: TradeTransaction[]): BrokerLedgerEvidence[] {
  return sortTransactions(transactions)
    .map(evidenceFor)
    .filter((item) => Math.abs(item.cashImpact) > 0.005)
    .slice(-12)
    .reverse();
}

function companyNameForTicker(ticker: string, positions: Position[], tickers: EGXTicker[]): string {
  return positions.find((position) => normalizeTicker(position.ticker) === ticker)?.companyName
    || tickers.find((item) => normalizeTicker(item.ticker) === ticker)?.nameEn
    || ticker;
}

export function parseBrokerPositionsText(
  input: string,
  tickers: EGXTicker[] = [],
): BrokerSnapshotPosition[] {
  const rows: BrokerSnapshotPosition[] = [];
  const seen = new Set<string>();

  const lines = String(input || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const cells = line.includes('\t')
      ? line.split('\t')
      : line.includes(';')
        ? line.split(';')
        : line.includes(',')
          ? line.split(',')
          : line.split(/\s+/);

    const rawTicker = String(cells[0] || '').trim();
    const rawShares = String(cells[1] || '').trim();

    if (
      index === 0
      && /ticker|symbol|stock/i.test(rawTicker)
      && /shares|qty|quantity/i.test(rawShares)
    ) {
      continue;
    }

    if (!rawTicker || !rawShares) {
      throw new Error(`Broker holdings line ${index + 1} must contain ticker and shares.`);
    }

    const ticker = resolveTickerFromDirectory(rawTicker, tickers);
    const shares = finiteNumber(rawShares, `Shares on line ${index + 1}`);
    if (shares < -EPSILON) {
      throw new Error(`Shares on line ${index + 1} cannot be negative.`);
    }
    if (!ticker) throw new Error(`Ticker on line ${index + 1} is invalid.`);
    if (seen.has(ticker)) {
      throw new Error(`Ticker ${ticker} appears more than once in the broker snapshot.`);
    }
    seen.add(ticker);

    const avgPriceRaw = cells[2] == null || String(cells[2]).trim() === ''
      ? undefined
      : finiteNumber(cells[2], `Average price on line ${index + 1}`);

    rows.push({
      ticker,
      shares,
      avgPrice: avgPriceRaw,
    });
  }

  return rows;
}

export function reconcileBrokerSnapshot(
  snapshot: BrokerSnapshot,
  app: {
    positions: Position[];
    transactions: TradeTransaction[];
    cashBalance: number;
    tickers?: EGXTicker[];
  },
): BrokerReconciliationReport {
  const tickers = app.tickers || [];
  const appPositions = new Map(
    app.positions.map((position) => [normalizeTicker(position.ticker), position]),
  );
  const brokerPositions = new Map<string, BrokerSnapshotPosition>();

  for (const raw of snapshot.positions) {
    const ticker = resolveTickerFromDirectory(raw.ticker, tickers);
    if (!ticker) throw new Error('Broker snapshot contains an invalid ticker.');
    if (brokerPositions.has(ticker)) {
      throw new Error(`Broker snapshot contains duplicate ticker ${ticker}.`);
    }

    const shares = finiteNumber(raw.shares, `${ticker} broker shares`);
    if (shares < -EPSILON) throw new Error(`${ticker} broker shares cannot be negative.`);

    brokerPositions.set(ticker, {
      ...raw,
      ticker,
      shares,
    });
  }

  const allTickers = [...new Set([
    ...appPositions.keys(),
    ...brokerPositions.keys(),
  ])].sort();

  const rows: BrokerPositionReconciliationRow[] = allTickers.map((ticker) => {
    const appPosition = appPositions.get(ticker);
    const brokerPosition = brokerPositions.get(ticker);
    const appShares = Number(appPosition?.shares || 0);
    const brokerShares = Number(brokerPosition?.shares || 0);
    const differenceShares = appShares - brokerShares;

    let status: BrokerPositionMatchStatus = 'MATCH';
    if (Math.abs(differenceShares) > EPSILON) {
      if (appShares <= EPSILON && brokerShares > EPSILON) status = 'MISSING_IN_APP';
      else if (brokerShares <= EPSILON && appShares > EPSILON) status = 'MISSING_AT_BROKER';
      else status = 'SHARE_MISMATCH';
    }

    const evidence = status === 'MATCH'
      ? []
      : activeTickerEvidence(app.transactions, ticker);

    let explanation = 'Broker and app share quantities match.';
    if (status === 'MISSING_IN_APP') {
      explanation = `Broker has ${brokerShares.toLocaleString('en-EG')} shares that are absent from the canonical app projection. A BUY, allocation, corporate action, transfer, or other share-increasing broker event may be missing from the ledger.`;
    } else if (status === 'MISSING_AT_BROKER') {
      explanation = `The app carries ${appShares.toLocaleString('en-EG')} shares that the broker snapshot does not. Inspect the active-cycle ledger for a missing SELL/transfer-out or an incorrectly recorded share-increasing event.`;
    } else if (status === 'SHARE_MISMATCH') {
      explanation = differenceShares > 0
        ? `The app carries ${Math.abs(differenceShares).toLocaleString('en-EG')} more shares than the broker.`
        : `The broker carries ${Math.abs(differenceShares).toLocaleString('en-EG')} more shares than the app.`;
    }

    return {
      ticker,
      companyName: companyNameForTicker(ticker, app.positions, tickers),
      status,
      brokerShares,
      appShares,
      differenceShares,
      appPosition,
      ledgerTransactionIds: evidence.map((item) => item.id),
      ledgerEvidence: evidence,
      explanation,
    };
  });

  const brokerCash = finiteNumber(snapshot.cashBalance, 'Broker cash balance');
  const appCash = finiteNumber(app.cashBalance, 'App cash balance');
  const differenceCash = appCash - brokerCash;
  const cashMatches = Math.abs(differenceCash) <= 0.005;

  const cash: BrokerCashReconciliation = {
    brokerCash,
    appCash,
    differenceCash,
    matches: cashMatches,
    ledgerEvidence: cashMatches ? [] : recentCashEvidence(app.transactions),
    explanation: cashMatches
      ? 'Broker cash and canonical app cash match.'
      : differenceCash > 0
        ? `The app has ${Math.abs(differenceCash).toLocaleString('en-EG')} EGP more available cash than the broker. Review recent cash-affecting ledger events for a missing debit, fee, purchase, withdrawal, or reservation.`
        : `The broker has ${Math.abs(differenceCash).toLocaleString('en-EG')} EGP more available cash than the app. Review recent cash-affecting ledger events for a missing credit, sale, deposit, refund, or cancellation.`,
  };

  const mismatchedPositions = rows.filter((row) => row.status !== 'MATCH').length;

  return {
    brokerName: String(snapshot.brokerName || 'Broker').trim() || 'Broker',
    asOfDate: snapshot.asOfDate,
    rows,
    cash,
    matchedPositions: rows.length - mismatchedPositions,
    mismatchedPositions,
    brokerPositionCount: snapshot.positions.filter((position) => Number(position.shares) > EPSILON).length,
    appPositionCount: app.positions.filter((position) => Number(position.shares) > EPSILON).length,
    isFullyMatched: mismatchedPositions === 0 && cashMatches,
  };
}


export interface ParsedBrokerSnapshotOcr {
  brokerName?: string;
  cashBalance?: number;
  positions: BrokerSnapshotPosition[];
  rawText: string;
}

function firstNumericMatch(text: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const value = Number(match[1].replace(/[,\s]/g, ''));
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

export function parseBrokerSnapshotOcrText(
  rawText: string,
  tickers: EGXTicker[],
): ParsedBrokerSnapshotOcr {
  const text = String(rawText || '').replace(/\r/g, '\n');
  if (!text.trim()) return { positions: [], rawText: '' };

  const upper = text.toUpperCase();
  const occurrences: Array<{ index: number; ticker: string }> = [];

  for (const item of tickers || []) {
    const canonical = normalizeTicker(item.ticker);
    if (!canonical || canonical === 'CASH') continue;

    const identities = [canonical, ...(item.aliases || []).map(normalizeTicker)]
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    let bestIndex = -1;
    for (const identity of identities) {
      const escaped = identity.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
      const match = new RegExp(
        '(?:^|[^A-Z0-9])' + escaped + '(?=$|[^A-Z0-9])',
        'i',
      ).exec(upper);
      if (match && (bestIndex < 0 || match.index < bestIndex)) bestIndex = match.index;
    }

    if (bestIndex >= 0) occurrences.push({ index: bestIndex, ticker: canonical });
  }

  occurrences.sort((a, b) => a.index - b.index);

  const positions: BrokerSnapshotPosition[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < occurrences.length; i += 1) {
    const occurrence = occurrences[i];
    if (seen.has(occurrence.ticker)) continue;

    const end = occurrences[i + 1]?.index ?? Math.min(text.length, occurrence.index + 900);
    const block = text.slice(occurrence.index, end);

    const shares = firstNumericMatch(block, [
      /(?:shares?|quantity|qty|units?)\s*[:\-]?\s*([0-9][0-9,\s]*(?:\.[0-9]+)?)/i,
      /(?:عدد\s*الاسهم|الأسهم|اسهم|سهم)\s*[:\-]?\s*([0-9][0-9,\s]*(?:\.[0-9]+)?)/i,
    ]);

    if (shares == null || shares < 0) continue;

    const avgPrice = firstNumericMatch(block, [
      /(?:avg(?:erage)?\s*(?:buy|price)?|average\s*cost|avg\.?\s*buy)\s*[:\-]?\s*(?:EGP|LE)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i,
    ]);

    positions.push({
      ticker: occurrence.ticker,
      shares,
      avgPrice,
    });
    seen.add(occurrence.ticker);
  }

  const cashBalance = firstNumericMatch(text, [
    /(?:available\s+cash|cash\s+balance|buying\s+power)\s*[:\-]?\s*(?:EGP|LE)?\s*([0-9][0-9,\s]*(?:\.[0-9]+)?)/i,
    /(?:available\s+cash|cash\s+balance|buying\s+power)[^0-9]{0,30}([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:EGP|LE)/i,
  ]);

  const brokerName = /\bTELDA\b/i.test(text)
    ? 'Telda'
    : /\bTHNDR|THUNDER\b/i.test(text)
      ? 'Thndr'
      : /\bMUBASHER\b/i.test(text)
        ? 'Mubasher'
        : undefined;

  return {
    brokerName,
    cashBalance,
    positions,
    rawText: text.trim(),
  };
}
