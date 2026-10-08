import React, { useMemo, useState } from 'react';
import type { ClosedTrade, PerformanceStats, PortfolioMetrics, Position, TradeTransaction } from '../types';
import type { HistoricalPriceSeries } from '../services/historicalPriceStore';
import type { AnalyticsTimeframe } from '../services/analyticsTimeframes';
import { buildDailyBenchmarkComparison, PORTFOLIO_BENCHMARKS } from '../services/portfolioBenchmarks';
import { calculateEquityBridge, isEquityBridgeBalanced } from '../services/portfolioPerformance';
import { useAnalyticsSeries } from './useAnalyticsSeries';
import { MetricTile, SectionHeader, StatRow } from './parts';
import { formatEgp, formatPercent, formatSigned } from './format';

interface MetricsScreenProps {
  stats: PerformanceStats;
  closedTrades: ClosedTrade[];
  positions: Position[];
  metrics?: PortfolioMetrics;
  cashBalance: number;
  capitalDeposits: number;
  transactions: TradeTransaction[];
  historicalPrices: HistoricalPriceSeries;
  historicalLoading?: boolean;
}

const RANGES: Array<{ value: AnalyticsTimeframe; label: string }> = [
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '90D', label: '90D' },
  { value: 'YTD', label: 'YTD' },
  { value: 'ALL', label: 'All' },
];

/** Fewer closed trades than this is too small a sample to read win rate or profit factor from. */
export const SMALL_SAMPLE_TRADES = 20;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const ratio = (value: number | undefined) => (finite(value) ? value.toFixed(2) : value === Infinity ? '∞' : '—');

export const MetricsScreen: React.FC<MetricsScreenProps> = ({
  stats,
  closedTrades,
  positions,
  metrics,
  cashBalance,
  capitalDeposits,
  transactions,
  historicalPrices,
  historicalLoading = false,
}) => {
  const [timeframe, setTimeframe] = useState<AnalyticsTimeframe>('1M');
  const { result, loading } = useAnalyticsSeries({
    transactions,
    historicalPrices,
    capitalDeposits,
    positions,
    currentCashBalance: cashBalance,
    timeframe,
  });

  const summary = result?.summary;
  const points = result?.points ?? [];

  const risk = useMemo(() => {
    if (!points.length) return null;
    const peak = Math.max(...points.map((point) => point.equity));
    const last = points[points.length - 1];
    return { peakEquity: peak, currentDrawdown: last.drawdownPercent };
  }, [points]);

  const relative = useMemo(() => {
    const usable = points.filter((point) => finite(point.twrPercent));
    if (usable.length < 2) return [];
    const comparison = buildDailyBenchmarkComparison(
      usable.map((point) => ({ date: point.date, twrPercent: point.twrPercent as number })),
      historicalPrices,
    );
    const last = comparison[comparison.length - 1];
    if (!last) return [];
    return PORTFOLIO_BENCHMARKS.map((item) => {
      const index = last[item.ticker];
      return {
        label: item.label,
        indexReturn: finite(index) ? index : null,
        relative: finite(index) ? last.portfolioReturnPercent - index : null,
      };
    });
  }, [points, historicalPrices]);

  const bridge = useMemo(
    () => calculateEquityBridge(capitalDeposits, closedTrades, positions, cashBalance, transactions),
    [capitalDeposits, closedTrades, positions, cashBalance, transactions],
  );
  const balanced = isEquityBridgeBalanced(bridge);

  const closedFees = stats.totalBrokerageFeesPaid || 0;
  const openFees = positions.reduce((sum, position) => sum + (position.totalFees || 0), 0);
  const totalFees = metrics?.totalFeesPaid ?? closedFees + openFees;

  const grossProfit = stats.totalRealizedGainEgp;
  const grossLoss = stats.totalRealizedLossEgp;
  const avgWin = stats.winningTrades > 0 ? grossProfit / stats.winningTrades : null;
  const avgLoss = stats.losingTrades > 0 ? grossLoss / stats.losingTrades : null;
  const breakeven = Math.max(0, stats.totalTrades - stats.winningTrades - stats.losingTrades);
  const waiting = loading || historicalLoading;

  return (
    <div className="ui-stack">
      <div className="ui-chips" role="group" aria-label="Metrics range">
        {RANGES.map((range) => (
          <button key={range.value} type="button" className="ui-chip" aria-pressed={timeframe === range.value} onClick={() => setTimeframe(range.value)}>
            {range.label}
          </button>
        ))}
      </div>

      <div className="ui-tile-grid">
        <MetricTile
          label="TWR"
          value={waiting ? '…' : formatPercent(summary?.twrPercent)}
          sub="time-weighted"
          color="var(--ui-teal)"
          tone={summary?.twrPercent}
        />
        <MetricTile
          label="MWR"
          value={waiting ? '…' : formatPercent(summary?.mwrrPercent)}
          sub="money-weighted"
          color="var(--ui-blue)"
          tone={summary?.mwrrPercent}
        />
        <MetricTile
          label="Max drawdown"
          value={waiting ? '…' : formatPercent(finite(summary?.maxDrawdownPercent) ? -Math.abs(summary.maxDrawdownPercent) : null)}
          sub="in range"
          color="var(--ui-coral)"
          tone={finite(summary?.maxDrawdownPercent) && summary.maxDrawdownPercent !== 0 ? -1 : 0}
        />
        <MetricTile
          label="Return"
          value={waiting || !finite(summary?.pnlEgp) ? '…' : `${formatSigned(summary.pnlEgp, 0)} EGP`}
          sub="in range"
          color="var(--ui-teal)"
          tone={summary?.pnlEgp}
        />
      </div>

      {relative.length > 0 && (
        <section aria-label="Versus indices">
          <SectionHeader title="Versus indices" aside="relative, in range" />
          {relative.map((row) => (
            <StatRow
              key={row.label}
              label={`vs ${row.label}`}
              hint={row.indexReturn === null ? undefined : `index ${formatPercent(row.indexReturn)}`}
              value={row.relative === null ? '—' : `${row.relative > 0 ? '+' : ''}${row.relative.toFixed(2)} pts`}
              tone={row.relative}
            />
          ))}
        </section>
      )}

      <section aria-label="Risk">
        <SectionHeader title="Risk" aside="in range" />
        <StatRow
          label="Max drawdown"
          value={
            finite(summary?.maxEquityDrawdownEgp) && finite(summary?.maxDrawdownPercent)
              ? `-${formatEgp(Math.abs(summary.maxEquityDrawdownEgp))} EGP · -${Math.abs(summary.maxDrawdownPercent).toFixed(2)}%`
              : '—'
          }
          tone={-1}
        />
        <StatRow label="Peak equity" value={risk ? formatEgp(risk.peakEquity) : '—'} />
        <StatRow
          label="Current drawdown"
          value={risk && finite(risk.currentDrawdown) ? formatPercent(-Math.abs(risk.currentDrawdown)) : '—'}
          tone={risk && finite(risk.currentDrawdown) && risk.currentDrawdown !== 0 ? -1 : 0}
        />
      </section>

      <section aria-label="Equity bridge">
        <SectionHeader
          title="Equity bridge"
          aside={balanced ? <span className="ui-pos">Balanced</span> : <span className="ui-neg">Off by {formatEgp(Math.abs(bridge.reconciliationDelta))} EGP</span>}
        />
        <StatRow label="Net capital contributed" value={formatEgp(bridge.netCapitalContributed)} />
        <StatRow label="Realized P&L" value={formatSigned(bridge.tradingRealizedPnl)} tone={bridge.tradingRealizedPnl} />
        {Math.abs(bridge.cashPerformancePnl) > 0.005 && (
          <StatRow label="Cash performance" value={formatSigned(bridge.cashPerformancePnl)} tone={bridge.cashPerformancePnl} />
        )}
        <StatRow label="Unrealized P&L" value={formatSigned(bridge.unrealizedPnl)} tone={bridge.unrealizedPnl} />
        {Math.abs(bridge.reconciliationAdjustments) > 0.005 && (
          <StatRow label="Reconciliation adjustments" value={formatSigned(bridge.reconciliationAdjustments)} tone={bridge.reconciliationAdjustments} />
        )}
        <StatRow label="Equity" value={formatEgp(bridge.endingEquity)} />
      </section>

      <section aria-label="Trading">
        <SectionHeader title="Trading" aside="all closed trades" />
        {stats.totalTrades === 0 ? (
          <p className="ui-sm" style={{ padding: '10px 0' }}>No closed trades yet.</p>
        ) : (
          <>
            <StatRow label="Closed trades" value={`${stats.totalTrades} · ${stats.winningTrades}W / ${stats.losingTrades}L / ${breakeven} BE`} />
            <StatRow label="Win rate" value={`${stats.winRate.toFixed(1)}%`} />
            <StatRow label="Gross profit" value={formatSigned(grossProfit)} tone={grossProfit} />
            <StatRow label="Gross loss" value={formatSigned(grossLoss > 0 ? -grossLoss : grossLoss)} tone={-Math.abs(grossLoss)} />
            <StatRow label="Profit factor" value={ratio(stats.profitFactor)} />
            <StatRow label="Average win" value={avgWin === null ? '—' : formatSigned(avgWin)} tone={avgWin} />
            <StatRow label="Average loss" value={avgLoss === null ? '—' : formatSigned(avgLoss > 0 ? -avgLoss : avgLoss)} tone={avgLoss === null ? null : -Math.abs(avgLoss)} />
            <StatRow label="Payoff ratio" value={ratio(stats.payoffRatio)} />
            <StatRow label="Expectancy" value={finite(stats.expectancyEgp) ? `${formatSigned(stats.expectancyEgp)} / trade` : '—'} tone={stats.expectancyEgp} />
            <StatRow label="Avg return per trade" value={formatPercent(stats.avgReturnPercent)} tone={stats.avgReturnPercent} />
            <StatRow label="Best / worst trade" value={`${formatPercent(stats.bestTradePercent, 1)} / ${formatPercent(stats.worstTradePercent, 1)}`} />
            <StatRow label="Avg hold" value={`${Math.round(stats.avgHoldDays)} days`} />
          </>
        )}
        {stats.totalTrades > 0 && stats.totalTrades < SMALL_SAMPLE_TRADES && (
          <p className="ui-note">
            Only {stats.totalTrades} closed trade{stats.totalTrades === 1 ? '' : 's'} — too few to judge win rate or profit factor.
          </p>
        )}
      </section>

      <section aria-label="Costs">
        <SectionHeader title="Costs" />
        <StatRow label="Fees paid" value={formatEgp(totalFees)} />
        <StatRow label="On open positions" value={formatEgp(openFees)} />
        <StatRow label="On closed trades" value={formatEgp(closedFees)} />
      </section>
    </div>
  );
};
