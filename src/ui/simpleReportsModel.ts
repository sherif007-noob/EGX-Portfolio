import type { ClosedTrade, Position } from '../types';
import { calculatePositionUnrealizedPnl } from '../services/portfolioAccounting';
import { getCairoTodayISO, getMonthKey, getMonthLabel } from '../utils/dateUtils';

export interface SimpleAllocationRow {
  label: string;
  value: number;
  percent: number;
  count: number;
}

/** No rounding or normalization of ledger quantities; display percentages only. */
export function buildSimpleAllocation(positions: Position[], cashBalance: number, mode: 'sector'|'stock', includeCash = true, pendingIpoValue = 0): SimpleAllocationRow[] {
  const rows = new Map<string, { value: number; count: number }>();
  for (const position of positions) {
    const name = mode === 'sector' ? position.sector : position.ticker;
    const existing = rows.get(name) ?? { value: 0, count: 0 };
    rows.set(name, {
      value: existing.value + position.shares * position.currentPrice,
      count: existing.count + 1,
    });
  }
  if (includeCash && cashBalance > 0) {
    const existing = rows.get('Cash') ?? { value: 0, count: 0 };
    rows.set('Cash', { value: existing.value + cashBalance, count: existing.count });
  }
  if (includeCash && Number.isFinite(pendingIpoValue) && pendingIpoValue > 0) {
    // Broker reserve remains part of NAV but cannot be invested again.
    rows.set('IPO held', { value: pendingIpoValue, count: 0 });
  }
  const total = [...rows.values()].reduce((sum, row) => sum + row.value, 0);
  return [...rows.entries()].map(([label, row]) => ({
    label, value: row.value, count: row.count,
    percent: total > 0 ? row.value / total * 100 : 0,
  })).sort((a, b) => b.value - a.value);
}

export interface SimpleMonth {
  key: string;
  label: string;
  realized: number;
  closed: number;
  wins: number;
  fees: number;
  /** Only the current-month *snapshot* includes currently open positions. */
  openSnapshot: number | null;
  openCount: number;
  snapshotTotal: number | null;
}

/** Older months never infer historical holdings P&L from present-day quotes. */
export function buildSimpleMonths(closedTrades: ClosedTrade[], positions: Position[], today = getCairoTodayISO()): SimpleMonth[] {
  const currentKey = getMonthKey(today);
  const keys = new Set<string>();
  if (currentKey) keys.add(currentKey);
  closedTrades.forEach(c => { const k = getMonthKey(c.sellDate); if (k) keys.add(k); });
  const currentOpen = positions.reduce((sum, pos) => sum + calculatePositionUnrealizedPnl(pos), 0);
  return [...keys].sort().reverse().map(key => {
    const closed = closedTrades.filter(c => getMonthKey(c.sellDate) === key);
    const realized = closed.reduce((sum, c) => sum + c.realizedPnlEgp, 0);
    const fees = closed.reduce((sum,c) => sum + (c.totalFees ?? (c.buyFees ?? 0)+(c.sellFees ?? 0)), 0);
    const openSnapshot = key === currentKey ? currentOpen : null;
    return {
      key,
      label: getMonthLabel(key, 'long'),
      realized,
      closed: closed.length,
      wins: closed.filter(c => c.outcome === 'WIN').length,
      fees,
      openSnapshot,
      openCount: key === currentKey ? positions.length : 0,
      snapshotTotal: openSnapshot === null ? null : realized + openSnapshot,
    };
  });
}
